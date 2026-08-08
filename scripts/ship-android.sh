#!/usr/bin/env bash
# ship-android.sh — single-command end-to-end Android ship pipeline.
#
#   fetch Play credentials → preflight → git sync check → check/bump versionCode →
#   install deps → prebuild (if missing) → bootstrap signing → bundle + upload →
#   commit version bump → prompt for other dirty files → done.
#
# The versionCode check runs early (before npm install / Gradle) so the script
# fails fast before any slow work begins. The bump commit is deferred until
# after the upload succeeds so git history matches what actually shipped.
#
# No emulator, no UI. Default track is internal.
# Step 1 always runs first: verifies Google Play credentials are available
# before any slow step (npm, Gradle).
#
# Usage:
#   ./scripts/ship-android.sh                           # → Internal testing
#   ./scripts/ship-android.sh --track alpha             # → Closed testing (Alpha)
#   ./scripts/ship-android.sh --track beta              # → Open testing
#   ./scripts/ship-android.sh --track production        # → Production
#   ./scripts/ship-android.sh --promote 8 --track alpha # → Promote versionCode 8 to alpha (no rebuild)
#
# Play Console UI → API track name mapping:
#   Internal testing  = internal
#   Closed testing    = alpha
#   Open testing      = beta
#   Production        = production
#
# Flags:
#   --track internal|alpha|beta|production  default: internal
#   --promote <versionCode>                 promote an existing build to --track (no rebuild/upload)
#   --skip-preflight                        skip ./scripts/preflight.sh
#   --skip-prebuild                         skip `npx expo prebuild` even if android/ missing
#   --skip-bundle                           skip Gradle build; reuse existing AAB at default path
#   --skip-git-sync                         skip git sync check (used by CI)
#   --skip-version-check                    skip versionCode reconciliation (used by CI)
#   --no-bump                               skip both git sync and version bump (ship from branch as-is)
#   --package <id>                          override expo.android.package
#
# Exits non-zero on any failure. Re-running is safe.

set -euo pipefail

TRACK="internal"
PROMOTE_VERSION=""
SKIP_PREFLIGHT=0
SKIP_PREBUILD=0
SKIP_BUNDLE=0
SKIP_GIT_SYNC=0
SKIP_VERSION_CHECK=0
PACKAGE_OVERRIDE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --track)               TRACK="$2"; shift 2 ;;
    --promote)             PROMOTE_VERSION="$2"; shift 2 ;;
    --skip-preflight)      SKIP_PREFLIGHT=1; shift ;;
    --skip-prebuild)       SKIP_PREBUILD=1; shift ;;
    --skip-bundle)         SKIP_BUNDLE=1; shift ;;
    --skip-git-sync)       SKIP_GIT_SYNC=1; shift ;;
    --skip-version-check)  SKIP_VERSION_CHECK=1; shift ;;
    --no-bump)             SKIP_GIT_SYNC=1; SKIP_VERSION_CHECK=1; shift ;;
    --package)             PACKAGE_OVERRIDE="$2"; shift 2 ;;
    -h|--help) sed -n '1,30p' "$0"; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

case "$TRACK" in internal|alpha|beta|production) ;;
  *) echo "--track must be one of: internal alpha beta production" >&2; exit 2 ;;
esac

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TOTAL_STEPS=8

# ── Promote-only fast path ────────────────────────────────────────────────────
# --promote <versionCode> skips the entire build pipeline and just moves an
# already-uploaded versionCode to a different track via the Play API.
_PLAY_CREDS_CACHE="$HOME/.config/threadbase/play-console-sa.json"

_fetch_play_creds() {
  if [[ -f "$_PLAY_CREDS_CACHE" ]]; then
    echo "$_PLAY_CREDS_CACHE"
    return 0
  fi
  "$SCRIPT_DIR/fetch-play-credentials.sh"
}

# Cold machine: no Play service-account cache and/or no keystore. Pull both from
# 1Password before either the promote path or the build path needs them — mirrors how
# ship-ios.sh self-bootstraps .env.signing.
# Inert in CI on two independent counts: scripts/.env.signing-op is gitignored so it never
# exists on a runner, and deploy.yml materializes both artifacts in earlier steps. Note it
# does NOT export PLAY_SA_JSON_B64 into this script — that env is scoped to its own step —
# so the check below is for a shell that exports it directly, not for CI.
# With no op config the fall-through is today's behavior: fetch-play-credentials.sh's error.
if [[ ! -f "$_PLAY_CREDS_CACHE" || ! -f .env.signing.android ]] \
   && [[ -f scripts/.env.signing-op && -z "${PLAY_SA_JSON_B64:-}" ]]; then
  echo "▸ Bootstrap Android credentials from 1Password"
  "$SCRIPT_DIR/bootstrap-local-signing-op.sh" --platform android
fi

if [[ -n "$PROMOTE_VERSION" ]]; then
  if [[ -f "$_PLAY_CREDS_CACHE" ]]; then
    echo "▸ [1/2] Google Play credentials already cached — skipping"
    CREDS_PATH="$_PLAY_CREDS_CACHE"
  else
    echo "▸ [1/2] Fetch Google Play credentials"
    CREDS_PATH=$(_fetch_play_creds)
  fi

  PACKAGE="${PACKAGE_OVERRIDE:-$(jq -r '.expo.android.package' app.json)}"
  [[ -n "$PACKAGE" && "$PACKAGE" != "null" ]] || { echo "Could not resolve android package name" >&2; exit 1; }

  echo "▸ [2/2] Promote versionCode=$PROMOTE_VERSION → $TRACK"
  node "$SCRIPT_DIR/promote-android.js" "$PACKAGE" "$PROMOTE_VERSION" "$TRACK" "$CREDS_PATH"
  echo
  echo "✅  versionCode $PROMOTE_VERSION promoted to Play ($TRACK track)."

  # A promote ships the same artifact to another track, so its Sentry release
  # already exists from the build that produced it — record where it went rather
  # than minting a second release for the same versionCode. Assumes expo.version
  # hasn't moved since that build, which is what makes the release name match.
  if [[ -n "${SENTRY_AUTH_TOKEN:-}" && -n "${SENTRY_ORG:-}" && -n "${SENTRY_PROJECT:-}" ]]; then
    PROMOTE_RELEASE="threadbase-mobile-android@$(jq -r '.expo.version' app.json)+${PROMOTE_VERSION}"
    if node_modules/@sentry/cli/bin/sentry-cli deploys new -r "$PROMOTE_RELEASE" -e "$TRACK"; then
      echo "  ✓ Sentry deploy recorded: ${PROMOTE_RELEASE} → ${TRACK}"
    else
      echo "  ! Sentry deploy not recorded for ${PROMOTE_RELEASE} — release may not exist" >&2
    fi
  fi
  exit 0
fi

# 1. Fetch Google Play credentials.
# Cache: ~/.config/threadbase/play-console-sa.json — skipped if already present,
# matching the iOS/Android keystore bootstrap behavior. Re-run fetch-play-credentials.sh
# manually to rotate the key.
if [[ -f "$_PLAY_CREDS_CACHE" ]]; then
  echo "▸ [1/$TOTAL_STEPS] Google Play credentials already cached — skipping"
  CREDS_PATH="$_PLAY_CREDS_CACHE"
else
  echo "▸ [1/$TOTAL_STEPS] Fetch Google Play credentials"
  CREDS_PATH=$(_fetch_play_creds)
fi
export GOOGLE_APPLICATION_CREDENTIALS="$CREDS_PATH"

# 2. Preflight
if (( SKIP_PREFLIGHT == 0 )); then
  echo "▸ [2/$TOTAL_STEPS] Preflight (Android)"
  PLATFORM=android "$SCRIPT_DIR/preflight.sh"
else
  echo "▸ [2/$TOTAL_STEPS] Preflight — skipped"
fi

# 3. Git sync — refuse to ship if local main is behind origin/main, or if
# app.json has uncommitted changes.
# Skipped in CI: the workflow checks out main fresh and owns the bump commit.
if (( SKIP_GIT_SYNC == 0 )); then
  echo "▸ [3/$TOTAL_STEPS] Git sync check"
  "$SCRIPT_DIR/git-sync-check.sh"
else
  echo "▸ [3/$TOTAL_STEPS] Git sync check — skipped (CI)"
fi

# 4. Verify (and auto-bump) versionCode against Play — before any slow work
# (npm install, Gradle). Queries Google Play: if the local versionCode already
# exceeds the latest on any track the script continues immediately; otherwise
# it bumps app.json + build.gradle and commits before the bundle step runs.
# Exit 2 from check-version-code.sh means a bump commit was made; we install
# a rollback trap so that if step 8 fails the bump is reverted.
# Skipped in CI: the workflow runs check-version-code.sh as a separate step,
# commits the bump to main, and pushes before invoking this script.
VERSION_BUMPED=0
if (( SKIP_VERSION_CHECK == 0 )); then
  echo "▸ [4/$TOTAL_STEPS] Check/bump versionCode against Play"
  "$SCRIPT_DIR/check-version-code.sh" && true || {
    code=$?
    if (( code == 2 )); then
      VERSION_BUMPED=1
    else
      exit $code
    fi
  }
else
  echo "▸ [4/$TOTAL_STEPS] versionCode check — skipped (CI)"
fi

# 5. Install deps (detect package manager)
echo "▸ [5/$TOTAL_STEPS] Install dependencies"
if   [[ -f bun.lockb || -f bun.lock ]]; then bun install
elif [[ -f pnpm-lock.yaml ]];           then pnpm install
elif [[ -f yarn.lock ]];               then yarn install
else                                        npm ci --legacy-peer-deps || npm install --legacy-peer-deps
fi
npx expo install --check >/dev/null || true

# 6. Prebuild if android/ missing
if (( SKIP_PREBUILD == 0 )) && [[ ! -d android ]]; then
  echo "▸ [6/$TOTAL_STEPS] Prebuild (no android/ directory)"
  npx expo prebuild --platform android --non-interactive
else
  echo "▸ [6/$TOTAL_STEPS] Prebuild — android/ exists, skipping"
fi

# 7. Bootstrap Android signing
# Skip if .env.signing.android already exists and keystore is on disk.
if [[ -f .env.signing.android ]]; then
  _ks_path=$(bash -c 'source .env.signing.android 2>/dev/null && echo "${TB_MOBILE_UPLOAD_KEYSTORE:-}"')
  if [[ -n "$_ks_path" && -f "$_ks_path" ]]; then
    echo "▸ [7/$TOTAL_STEPS] Android signing already bootstrapped — skipping"
    source .env.signing.android
  else
    echo "▸ [7/$TOTAL_STEPS] Bootstrap Android signing"
    "$SCRIPT_DIR/bootstrap-android-signing.sh"
    source .env.signing.android
  fi
else
  echo "▸ [7/$TOTAL_STEPS] Bootstrap Android signing"
  "$SCRIPT_DIR/bootstrap-android-signing.sh"
  source .env.signing.android
fi

# 8. Build AAB + upload to Play
PACKAGE="${PACKAGE_OVERRIDE:-$(jq -r '.expo.android.package' app.json)}"
[[ -n "$PACKAGE" && "$PACKAGE" != "null" ]] || { echo "Could not resolve android package name" >&2; exit 1; }

VERSION_CODE=$(jq -r '.expo.android.versionCode' app.json)

if (( SKIP_BUNDLE )); then
  AAB_PATH="${AAB_PATH:-android/app/build/outputs/bundle/release/app-release.aab}"
  [[ -f "$AAB_PATH" ]] || { echo "ERROR: --skip-bundle set but no AAB found at $AAB_PATH" >&2; exit 1; }
  echo "▸ [8/$TOTAL_STEPS] Bundle — skipped (reusing $AAB_PATH)"
else
  echo "▸ [8/$TOTAL_STEPS] Bundle and upload"
fi
ANDROID_TRACK="$TRACK" SKIP_BUNDLE="$SKIP_BUNDLE" "$SCRIPT_DIR/bundle-and-upload-android.sh"

echo
echo "✅  Build is live on Play ($TRACK track)."
echo "    Open Play Console to promote to a wider track when ready."

# ── Post-deploy: commit version bump + prompt for other dirty files ───────────
"$SCRIPT_DIR/land-version-bump.sh" \
  --platform android \
  --version-code "$VERSION_CODE" \
  --version-bumped "$VERSION_BUMPED"
