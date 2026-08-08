#!/usr/bin/env bash
# Regenerate functional LOCAL signing config for both platforms by pulling the secrets
# from 1Password (op CLI). The Distribution cert is read from the login keychain and the
# App Store provisioning profile from Xcode's local cache — neither the .p12 nor the
# .mobileprovision live in 1Password, and they don't need to.
#
# Nothing secret is written to disk except the artifacts the existing bootstrap scripts
# already produce — .p8 / .env.signing (iOS), the keystore / .env.signing.android and the
# Play service-account cache (Android). All gitignored or outside the repo.
#
# Setup:
#   1. cp scripts/.env.signing-op.example scripts/.env.signing-op   (gitignored)
#      then edit it so OP_VAULT / OP_ITEM / OP_*_FIELD point at YOUR 1Password entry.
#   2. op signin        (or eval "$(op signin)")
#   3. ./scripts/bootstrap-local-signing-op.sh              # both platforms
#      ./scripts/bootstrap-local-signing-op.sh --platform android   # one of them
#   4. source .env.signing && npm run ship:all
#
# Where each piece comes from:
#   - ASC API key + issuer/team/key ids + both profile UUIDs: your 1Password item
#     (configured via scripts/.env.signing-op).
#   - Distribution cert: the login-keychain "Apple Distribution" identity — so we skip
#     the cert import.
#   - The .mobileprovision file: Xcode's local cache (re-downloadable from Apple).
#   - Android upload keystore + Play publisher service account: two more 1Password
#     items (OP_ANDROID_* / OP_PLAY_* in the config). Optional — omit them and the
#     Android half is skipped.

set -euo pipefail
cd "$(dirname "$0")/.."   # repo root

# --dry-run: report what every input resolves to and stop. Writes nothing — no .p8,
# no .env.signing, no profiles installed — so it is safe to run against real signing
# config at any time. Secret values are never printed, only whether they resolved.
DRY_RUN=0
PLATFORM=all
while (( $# )); do
  case "$1" in
    --dry-run) DRY_RUN=1 ;;
    --platform) PLATFORM="${2:-}"; shift ;;
    --platform=*) PLATFORM="${1#*=}" ;;
    -h|--help) echo "Usage: $0 [--dry-run] [--platform ios|android|all]"; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
  shift
done
case "$PLATFORM" in
  ios|android|all) ;;
  *) echo "--platform must be one of: ios android all" >&2; exit 2 ;;
esac
DO_IOS=0; DO_ANDROID=0
[[ "$PLATFORM" == ios     || "$PLATFORM" == all ]] && DO_IOS=1
[[ "$PLATFORM" == android || "$PLATFORM" == all ]] && DO_ANDROID=1
(( DRY_RUN )) && echo "▸ DRY RUN — nothing will be written"

command -v op >/dev/null || { echo "1Password CLI (op) not installed: brew install 1password-cli" >&2; exit 1; }

# Load the op reference config (vault / item / field names). Not secret — just the map
# of where to read from. A committed *.example documents the shape; the real file is
# gitignored so each developer can point at their own vault without editing this script.
OP_CONFIG="scripts/.env.signing-op"
[[ -f "$OP_CONFIG" ]] || { echo "Missing $OP_CONFIG — copy scripts/.env.signing-op.example to it and set your vault/item names." >&2; exit 1; }
# shellcheck disable=SC1090
source "$OP_CONFIG"

if (( DO_IOS )); then
  : "${OP_VAULT:?set OP_VAULT in $OP_CONFIG}"
  : "${OP_ITEM:?set OP_ITEM in $OP_CONFIG}"
fi

op vault list >/dev/null 2>&1 || { echo "Not signed in to op. Run: eval \"\$(op signin)\"" >&2; exit 1; }

# op read helper: op://<vault>/<item>/<field>
opread() { op read "op://${OP_VAULT}/${OP_ITEM}/$1"; }

# ── ASC secrets + profile UUID from 1Password ───────────────────────────────────
# Reads one required field, naming the missing field rather than letting `op` fail
# with a bare error. Reports presence only — values are never echoed.
MISSING_FIELDS=0
require_field() {
  local var="$1" field="$2" vault="${3:-${OP_VAULT:-}}" item="${4:-${OP_ITEM:-}}" value
  if ! value="$(op read "op://${vault}/${item}/${field}" 2>/dev/null)" || [[ -z "$value" ]]; then
    echo "  MISSING field '${field}' on item '${item}' (vault '${vault}')" >&2
    MISSING_FIELDS=$((MISSING_FIELDS + 1))
    return 0
  fi
  printf -v "$var" '%s' "$value"
  export "${var?}"
  (( DRY_RUN )) && echo "  ${field}: OK"
  return 0
}

# ── Android upload keystore + Play publisher account ────────────────────────────
# Mirrors the iOS path: pull the secrets, then hand them to the bootstrap scripts that
# already exist and already validate them (keytool for the keystore, a jq shape check
# for the service-account JSON). ANDROID_* are inputs only — bootstrap-android-signing.sh
# renames them to the TB_MOBILE_UPLOAD_* that gradle reads when it writes
# .env.signing.android.
bootstrap_android() {
  if [[ -z "${OP_ANDROID_VAULT:-}" || -z "${OP_ANDROID_ITEM:-}" ]]; then
    echo "  Android: not configured (set OP_ANDROID_VAULT/OP_ANDROID_ITEM in $OP_CONFIG) — skipping" >&2
    return 0
  fi
  require_field ANDROID_KEYSTORE_B64   "${OP_ANDROID_KEYSTORE_B64_FIELD:-keystore_b64}"     "$OP_ANDROID_VAULT" "$OP_ANDROID_ITEM"
  require_field ANDROID_STORE_PASSWORD "${OP_ANDROID_STORE_PASSWORD_FIELD:-store_password}" "$OP_ANDROID_VAULT" "$OP_ANDROID_ITEM"
  require_field ANDROID_KEY_ALIAS      "${OP_ANDROID_KEY_ALIAS_FIELD:-key_alias}"           "$OP_ANDROID_VAULT" "$OP_ANDROID_ITEM"
  require_field ANDROID_KEY_PASSWORD   "${OP_ANDROID_KEY_PASSWORD_FIELD:-key_password}"     "$OP_ANDROID_VAULT" "$OP_ANDROID_ITEM"

  # PLAY_SA_JSON_B64 is the only variable fetch-play-credentials.sh reads, and the only
  # credential with no local fallback — without it ship-android.sh dies at its first step.
  local have_play=0
  if [[ -n "${OP_PLAY_VAULT:-}" && -n "${OP_PLAY_ITEM:-}" ]]; then
    require_field PLAY_SA_JSON_B64 "${OP_PLAY_SA_JSON_B64_FIELD:-sa_json_b64}" "$OP_PLAY_VAULT" "$OP_PLAY_ITEM"
    have_play=1
  else
    echo "  Play: not configured (set OP_PLAY_VAULT/OP_PLAY_ITEM in $OP_CONFIG) — ship:android cannot upload" >&2
  fi

  if (( MISSING_FIELDS > 0 )); then
    echo "${MISSING_FIELDS} required Android field(s) missing from 1Password — cannot continue." >&2
    exit 1
  fi
  if (( DRY_RUN )); then
    echo "  Android: OK — keystore fields resolved$( (( have_play )) && echo ", Play service account resolved")"
    return 0
  fi

  ./scripts/bootstrap-android-signing.sh
  (( have_play )) && ./scripts/fetch-play-credentials.sh >/dev/null
  echo
  echo "✓ Android signing bootstrapped. Next: npm run ship:android"
  return 0
}

if (( DO_ANDROID )); then
  bootstrap_android
fi

if (( ! DO_IOS )); then
  (( DRY_RUN )) && echo "▸ DRY RUN complete — nothing written."
  exit 0
fi

require_field ASC_KEY_ID       "${OP_KEY_ID_FIELD:-key_id}"
require_field ASC_ISSUER_ID    "${OP_ISSUER_ID_FIELD:-issuer_id}"
require_field ASC_TEAM_ID      "${OP_TEAM_ID_FIELD:-team_id}"
require_field ASC_AUTH_KEY_B64 "${OP_AUTH_KEY_B64_FIELD:-auth_key_b64}"

# Profile items (preferred): 1Password items that carry the .mobileprovision as an
# attachment. The UUID is derived from the file itself rather than read from a
# separate field — a hand-maintained UUID field can drift from the profile it names,
# and did: it pointed at an Xcode-managed profile with no App Groups entitlement,
# which failed only at archive time with four misleading signing errors.
# Falls back to the UUID fields + Xcode cache when no profile item is configured.
profile_from_item() {
  local vault="$1" item="$2" label="$3" uuid_var="$4" b64_var="$5"
  local json file tmp uuid
  json="$(op item get "$item" --vault "$vault" --format json 2>/dev/null)" || {
    echo "  ${label} profile item '${item}' not found in vault '${vault}'" >&2; return 1; }
  file="$(printf '%s' "$json" | jq -r '.files[0].name // empty')"
  [[ -n "$file" ]] || { echo "  ${label} profile item '${item}' has no attachment" >&2; return 1; }
  tmp="$(mktemp -t prof)"
  op read "op://${vault}/${item}/${file}" --out-file "$tmp" --force >/dev/null 2>&1 || {
    echo "  could not download '${file}' from '${item}'" >&2; rm -f "$tmp"; return 1; }
  uuid="$(security cms -D -i "$tmp" 2>/dev/null | plutil -extract UUID raw - 2>/dev/null)"
  [[ -n "$uuid" ]] || { echo "  '${file}' is not a readable .mobileprovision" >&2; rm -f "$tmp"; return 1; }
  printf -v "$uuid_var" '%s' "$uuid"
  printf -v "$b64_var" '%s' "$(base64 -i "$tmp")"
  export "${uuid_var?}" "${b64_var?}"
  # grep the decoded plist directly: `plutil -extract` treats dots in the key
  # com.apple.security.application-groups as a keypath and silently finds nothing.
  local groups="none"
  security cms -D -i "$tmp" 2>/dev/null | grep -q 'application-groups' && groups="present"
  echo "  ${label} profile from 1Password '${item}': ${uuid} (app-groups: ${groups})"
  rm -f "$tmp"
}

IOS_PROVISION_PROFILE_UUID=""; IOS_PROVISION_PROFILE_B64=""
IOS_WIDGET_PROVISION_PROFILE_UUID=""; IOS_WIDGET_PROVISION_PROFILE_B64=""
USE_PROFILE_ITEMS=0
if [[ -n "${OP_PROFILE_VAULT:-}" && -n "${OP_APP_PROFILE_ITEM:-}" && -n "${OP_WIDGET_PROFILE_ITEM:-}" ]]; then
  USE_PROFILE_ITEMS=1
  profile_from_item "$OP_PROFILE_VAULT" "$OP_APP_PROFILE_ITEM" "App" \
    IOS_PROVISION_PROFILE_UUID IOS_PROVISION_PROFILE_B64 || MISSING_FIELDS=$((MISSING_FIELDS + 1))
  profile_from_item "$OP_PROFILE_VAULT" "$OP_WIDGET_PROFILE_ITEM" "Widget" \
    IOS_WIDGET_PROVISION_PROFILE_UUID IOS_WIDGET_PROVISION_PROFILE_B64 || MISSING_FIELDS=$((MISSING_FIELDS + 1))
else
  require_field IOS_PROVISION_PROFILE_UUID        "${OP_PROFILE_UUID_FIELD:-provision_profile_uuid}"
  require_field IOS_WIDGET_PROVISION_PROFILE_UUID "${OP_WIDGET_PROFILE_UUID_FIELD:-widget_provision_profile_uuid}"
fi

if (( MISSING_FIELDS > 0 )); then
  echo "${MISSING_FIELDS} required field(s) missing from 1Password — cannot continue." >&2
  exit 1
fi

# ── Provisioning profile files ──────────────────────────────────────────────────
# Xcode's cache first — it is the freshest copy and costs nothing. When a profile
# is absent there (new machine, cleared DerivedData, a target added after the last
# device build), fall back to a base64 copy in 1Password. Before that fallback
# existed a cache miss only produced a warning here, and the ship then died much
# later inside xcodebuild on a profile UUID it could not resolve.
XCODE_CACHE="$HOME/Library/Developer/Xcode/UserData/Provisioning Profiles"
DEST_DIR="$HOME/Library/MobileDevice/Provisioning Profiles"

# opread_optional: empty string instead of a hard failure when the field is absent,
# so the B64 fields stay optional for anyone whose Xcode cache is already populated.
opread_optional() { op read "op://${OP_VAULT}/${OP_ITEM}/$1" 2>/dev/null || true; }

resolve_profile() {
  local uuid="$1" op_field="$2" label="$3" out_var="$4"
  if [[ -f "$XCODE_CACHE/${uuid}.mobileprovision" ]]; then
    if (( DRY_RUN )); then
      echo "  ${label} profile: OK — found in Xcode cache (${uuid})"
    else
      mkdir -p "$DEST_DIR"
      cp "$XCODE_CACHE/${uuid}.mobileprovision" "$DEST_DIR/${uuid}.mobileprovision"
      echo "  ${label} profile installed from Xcode cache: ${uuid}"
    fi
    return 0
  fi
  local b64
  b64="$(opread_optional "$op_field")"
  if [[ -n "$b64" ]]; then
    # Handing the base64 to bootstrap-ios-signing.sh rather than decoding here keeps
    # one install path, which also validates the decode.
    printf -v "$out_var" '%s' "$b64"
    if (( DRY_RUN )); then
      # Decode-check here too, so a truncated secret is caught by the dry run
      # rather than surfacing mid-archive on the real ship.
      if printf '%s' "$b64" | base64 -d 2>/dev/null | grep -qa 'DOCTYPE plist\|<?xml'; then
        echo "  ${label} profile: OK — not in Xcode cache, valid base64 in 1Password field '${op_field}'"
      else
        echo "  ${label} profile: FAIL — 1Password field '${op_field}' is not a valid .mobileprovision" >&2
        return 1
      fi
    else
      echo "  ${label} profile not in Xcode cache — using 1Password field '${op_field}'"
    fi
    return 0
  fi
  echo "WARNING: ${label} profile ${uuid} not in Xcode cache and no '${op_field}' field in 1Password." >&2
  echo "  Fix either source: Xcode > Settings > Accounts > Download Manual Profiles," >&2
  echo "  or add the profile to the item:" >&2
  echo "    base64 -i <profile>.mobileprovision | op item edit '${OP_ITEM}' --vault '${OP_VAULT}' '${op_field}[password]=-'" >&2
}

# ── Sentry (optional) ───────────────────────────────────────────────────────────
# sentry-cli runs as a build phase during archive and aborts the whole build when it
# has credentials for neither org nor project. CI supplies these from repository
# secrets; locally they came from nowhere, so a local ship died mid-archive until
# SENTRY_DISABLE_AUTO_UPLOAD was set — which silently costs symbolication.
# Optional by design: absent Sentry config must not block signing.
SENTRY_AUTH_TOKEN=""; SENTRY_ORG=""; SENTRY_PROJECT=""
if [[ -n "${OP_SENTRY_VAULT:-}" && -n "${OP_SENTRY_ITEM:-}" ]]; then
  sread() { op read "op://${OP_SENTRY_VAULT}/${OP_SENTRY_ITEM}/$1" 2>/dev/null || true; }
  SENTRY_AUTH_TOKEN="$(sread "${OP_SENTRY_TOKEN_FIELD:-token}")"
  # org SLUG, not org id — sentry-cli builds API paths from it, and an id 404s.
  SENTRY_ORG="$(sread "${OP_SENTRY_ORG_FIELD:-org_slug}")"
  SENTRY_PROJECT="$(sread "${OP_SENTRY_PROJECT_FIELD:-project}")"
  export SENTRY_AUTH_TOKEN SENTRY_ORG SENTRY_PROJECT
  if [[ -n "$SENTRY_AUTH_TOKEN" && -n "$SENTRY_ORG" && -n "$SENTRY_PROJECT" ]]; then
    (( DRY_RUN )) && echo "  Sentry: OK — token, org '${SENTRY_ORG}', project '${SENTRY_PROJECT}'"
  else
    echo "  Sentry: INCOMPLETE — token=$([[ -n "$SENTRY_AUTH_TOKEN" ]] && echo set || echo MISSING)" \
         "org=$([[ -n "$SENTRY_ORG" ]] && echo "$SENTRY_ORG" || echo MISSING)" \
         "project=$([[ -n "$SENTRY_PROJECT" ]] && echo "$SENTRY_PROJECT" || echo MISSING)" >&2
    echo "    Archive will fail unless SENTRY_DISABLE_AUTO_UPLOAD=true. Check field names in $OP_CONFIG." >&2
  fi
elif (( DRY_RUN )); then
  echo "  Sentry: not configured (set OP_SENTRY_VAULT/OP_SENTRY_ITEM) — dSYM upload will fail"
fi

if (( ! USE_PROFILE_ITEMS )); then
  resolve_profile "${IOS_PROVISION_PROFILE_UUID}" \
    "${OP_PROFILE_B64_FIELD:-provision_profile_b64}" "App" IOS_PROVISION_PROFILE_B64
  resolve_profile "${IOS_WIDGET_PROVISION_PROFILE_UUID}" \
    "${OP_WIDGET_PROFILE_B64_FIELD:-widget_provision_profile_b64}" "Widget" IOS_WIDGET_PROVISION_PROFILE_B64
fi
export IOS_PROVISION_PROFILE_B64 IOS_WIDGET_PROVISION_PROFILE_B64

# Distribution cert is already in the login keychain — leave IOS_DIST_CERT_* unset so
# bootstrap-ios-signing.sh skips its cert-import block and xcodebuild uses the keychain
# identity directly. RUNNER_TEMP is only referenced inside that (skipped) block, but set
# it anyway so `set -u` is happy if the block is ever entered.
export RUNNER_TEMP="${RUNNER_TEMP:-${TMPDIR:-/tmp}}"

if (( DRY_RUN )); then
  echo
  echo "  Distribution cert: $(security find-identity -v -p codesigning 2>/dev/null | grep -c 'Apple Distribution') matching identity/identities in login keychain"
  echo
  echo "▸ DRY RUN complete — nothing written."
  echo "  Re-run without --dry-run to write .p8, build/ExportOptions.plist and .env.signing."
  exit 0
fi

./scripts/bootstrap-ios-signing.sh
echo
echo "✓ .env.signing regenerated. Next: source .env.signing && npm run ship:ios"
