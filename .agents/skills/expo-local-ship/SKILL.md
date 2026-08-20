---
name: expo-local-ship
description: >
  DEFAULT ship skill for Threadbase iOS. Use this for ALL release operations
  unless the user explicitly invokes /ship-expo-cloud. Builds and ships
  locally on macOS using native CLI toolchains only — no Xcode UI, no
  Organizer, no App Store Connect website clicks. Covers: TestFlight uploads,
  App Store submissions, local dev (run:ios / run:android), CocoaPods +
  Gradle troubleshooting, and signing setup. Triggers: "ship", "TestFlight",
  "submit to App Store", "run:ios", "run:android", "prebuild", "archive",
  "expo build", "local build", "simulator", "dev client", "CocoaPods error",
  "Gradle error", "fresh machine setup".
---

# Expo Local Build & Ship (CLI-only)

Every step is non-interactive shell. No Xcode windows, no App Store
Connect website. Apple talks to us via the ASC REST API and `xcodebuild`'s
API-key flags.

## Contents

- [Quick start](#quick-start)
- [Architecture](#architecture)
- [One-time setup](#one-time-setup)
- [The ship pipeline](#the-ship-pipeline)
- [Local dev iteration](#local-dev-iteration)
- [Expo gotchas](#expo-gotchas)
- [Anti-patterns](#anti-patterns)
- [CI variant](#ci-variant)
- [Troubleshooting](#troubleshooting)
- [Rules](#rules)

## Quick start

```bash
./scripts/ship-ios.sh              # → TestFlight (default)
./scripts/ship-ios.sh --target production --release-notes "Fixes login bug" \
                  --release-type AFTER_APPROVAL          # → App Store
```

That's the whole flow. No simulator, no UI clicks. The script:

1. **Preflight** — runs every prerequisite check, fails loud if anything is off.
2. **Install deps** — npm / yarn / pnpm / bun, auto-detected from lockfile.
3. **Prebuild** — runs `npx expo prebuild` only if `ios/` is missing.
4. **Bootstrap signing** — skipped automatically if `.env.signing` and the `.p8` key are already on disk. On a fresh machine, reads ASC API key + Team ID from environment variables, renders `ExportOptions.plist`, writes `.env.signing`.
5. **Git sync check** — `git fetch origin` then refuses to ship if local `main` is behind `origin/main` (someone else may have pushed an `app.json` bump from another machine that you haven't pulled). Also refuses if `app.json` has uncommitted edits.
6. **Build-number reconciliation** — queries the App Store Connect API for the highest `buildNumber` already in TestFlight for this `bundleIdentifier`, compares against `app.json`. If local ≤ remote, auto-bumps `app.json` to `remote + 1`. A drift ≥ 2 prints a louder warning (likely sign of a multi-machine skip).
7. **Archive + upload** — `xcodebuild archive` then `xcodebuild -exportArchive` with `destination=upload`.
8. **Poll** — watches `processingState` until `VALID` (or hard-fails after 30 min).
9. *(production only)* **Submit for review** — App Store Connect REST API.

## Architecture

The skill is a thin spec; the canonical implementation is the `scripts/`
folder. When invoked in a project, copy `~/.Codex/skills/expo-local-build/scripts/`
into the project's `scripts/` folder, then customize any project-specific
defaults if needed.

| Script | Role |
|--------|------|
| `ship-ios.sh` | Top-level orchestrator. The only command users typically run. |
| `preflight.sh` | Runs every prerequisite check and fails loud. Standalone too. |
| `git-sync-check.sh` | Verifies local `main` is up to date with `origin/main` and `app.json` has no uncommitted edits. Prevents shipping from a stale base on a multi-machine setup. |
| `check-build-number.sh` | Queries App Store Connect for the highest `buildNumber` in TestFlight, compares to `app.json`, and auto-bumps if local ≤ remote. Surfaces a louder warning when drift ≥ 2 (sign of a missed bump). |
| `bootstrap-ios-signing.sh` | Reads API key + Team ID from environment variables, writes `.p8`, renders plist, emits `.env.signing`. |
| `archive-and-upload.sh` | `xcodebuild archive` + `xcodebuild -exportArchive --destination=upload`. |
| `asc-jwt.sh` | Mints a 19-min ES256 JWT for ASC API requests. |
| `poll-build.sh` | Watches `processingState` with 7 independent kill switches (per-curl timeout, wall clock, iteration cap, failure cap, watchdog, orphan check, signal traps). `--timeout` is hard-capped at 1800 s. |
| `submit-for-review.sh` | App Store Connect REST API: resolve app+build → create version → attach build → set `whatsNew` → submit. |
| `ExportOptions.template.plist` | Template plist — `TEAM_ID_PLACEHOLDER` is substituted at bootstrap time. |

## One-time setup

### Apple side (manual, but truly one-time)

1. **App Store Connect API key** — at App Store Connect → Users and Access → Integrations → App Store Connect API. Role: App Manager (or higher). Download the `.p8` *immediately* (only chance). Record Key ID + Issuer ID.
2. **Register the app** in App Store Connect with the bundle ID.

### Signing env vars

Set these variables in the environment before running the ship pipeline:

| Field | Value |
|-------|-------|
| `ASC_KEY_ID` | ASC API Key ID |
| `ASC_ISSUER_ID` | Issuer UUID |
| `ASC_TEAM_ID` | Apple Developer Team ID (10 chars) — `xcodebuild -showBuildSettings ... \| awk '/DEVELOPMENT_TEAM/ {print $3}'` |
| `ASC_AUTH_KEY_B64` | base64 of the `.p8`: `base64 -i AuthKey_<KEYID>.p8 \| pbcopy` |

### Project side

Copy these into your project (one-time per repo):

```bash
cp -R ~/.Codex/skills/expo-local-build/scripts ./scripts
```

Add to `.gitignore`:

```
build/
.env.signing
*.p8
```

Commit `scripts/`.

## The ship pipeline

Each script is independent and idempotent — `ship.sh` just chains them. You
can run any step alone:

```bash
./scripts/preflight.sh                                   # any time
./scripts/bootstrap-ios-signing.sh                        # refresh secrets
source .env.signing
./scripts/archive-and-upload.sh                           # archive + upload only
./scripts/poll-build.sh com.your.app --watch              # watch processing
./scripts/submit-for-review.sh com.your.app 1.2.0 \
  --release-notes "..." --release-type AFTER_APPROVAL    # promote to App Store
```

Bump the build number before shipping (Apple rejects re-uploads of the same
`buildNumber`):

```bash
NEW_BUILD=$(($(jq -r '.expo.ios.buildNumber' app.json) + 1))
jq ".expo.ios.buildNumber = \"$NEW_BUILD\"" app.json > app.json.tmp \
  && mv app.json.tmp app.json
```

## Local dev iteration

Separate from the ship pipeline. Use these for development on a simulator
or device — they are **not** invoked by `ship.sh`.

```bash
# iOS — defaults to first available simulator
npx expo run:ios
npx expo run:ios --simulator "iPhone 16 Pro"
DEVICE_UDID=<udid> npm run dev:device           # connected physical device (signing: see below)
npx expo run:ios --configuration Release        # release build (no dev menu)

# Android
emulator -avd <AVD_NAME> &                       # start AVD if needed
npx expo run:android
npx expo run:android --device                   # connected physical device
npx expo run:android --variant release

# Metro in its own terminal (better log visibility)
npx expo start --dev-client
# … then in the build terminal:
npx expo run:ios --no-bundler
```

**Physical-device builds cannot use `expo run:ios --device` on this project.** Automatic
signing produces a profile without App Groups, which both `Threadbase` and
`ExpoWidgetsTarget` require — the build fails to sign with six errors and `xcodebuild`
exits 65. `npm run dev:device` (`scripts/dev-device.sh`) discovers a development profile
per target and passes them via `XCODE_XCCONFIG_FILE`. Simulator builds are unaffected.

Cleanup after testing:

```bash
xcrun simctl shutdown booted        # iOS
adb emu kill                        # Android
```

## Expo gotchas

These bit us in real ships — call them out before they cost an hour.

- **dSYM warnings for `React.framework`, `hermes.framework`, `ReactNativeDependencies.framework`** during upload are **non-blocking**. Apple accepts the build; only crashes *inside* those RN-internal frameworks won't symbolicate. Your app's own dSYM is fine.
- **`prebuild --clean` wipes `ios/`** — never put generated files (e.g. rendered `ExportOptions.plist`) inside `ios/`. Put them in `build/` so they survive a clean prebuild.
- **`EXPO_PUBLIC_*` env vars are baked at bundle time**, not at runtime. Changing them requires a rebuild.
- **Paths with spaces break `xcodebuild`** — keep the project under a space-free path on disk.
- **`expo build` is deprecated** (replaced by EAS Build, which this skill doesn't use). Don't suggest it.
- **Apple Development vs Distribution signing** — the local archive can be Apple-Development-signed and still upload fine: `xcodebuild -exportArchive` with `signingStyle=automatic` + API-key auth re-signs for Distribution at export time.
- **Build number must monotonically increase** per `bundleIdentifier` per `version`. Bump it before re-uploading.
- **Node version must match Expo SDK's engine field.** Expo SDK 54 requires Node `^20.19.0 || ^22.13.0 || >=24` — Node 22.12.x silently breaks Metro's *absolute path* resolution at bundle time (you'll see `Unable to resolve module /abs/path/...` for files that exist on disk). `npm install` only warns (`EBADENGINE`); the failure happens later during archive. Use `nvm use` with a compatible version before shipping.
- **`pod install` is required after any `node_modules` refresh.** If you ever delete or reinstall `node_modules`, `cd ios && pod install` before archiving — otherwise `ReactCodegen` will fail with *"Build input file cannot be found"* errors for `*-generated.cpp` / `*JSI-generated.cpp` files. Pod install regenerates the autolinking codegen Run Script Phase that produces those inputs.
- **Watchman state corruption** can produce non-deterministic Metro errors where each run fails on a *different* `node_modules` file with *"this file does not exist"* even though the file is on disk. Reset it: `watchman watch-del-all && watchman shutdown-server`, then purge `$TMPDIR/metro-*` and `$TMPDIR/haste-*` before retrying.
- **JWT for App Store Connect API must be ES256 with raw r||s signature (IEEE P1363, 64 bytes), not DER.** `openssl dgst -sha256 -binary -sign` emits DER and Apple's API will reject the JWT with `401 NOT_AUTHORIZED`. Use Node's `crypto.createSign(...).sign({key, dsaEncoding: "ieee-p1363"})` instead — `asc-jwt.sh` now does this.

## Anti-patterns

Refuse or warn against:

- ❌ "Open Xcode and click Archive" — use `xcodebuild archive`.
- ❌ "Upload via Transporter" / "Distribute App in Organizer" — use `xcodebuild -exportArchive` with `destination=upload` or `xcrun altool`.
- ❌ "Sign in with Apple ID" — use API key (`.p8`) + `-allowProvisioningUpdates`.
- ❌ Committing `.env.signing`, `build/`, or `*.p8`. The provided `.gitignore` covers all three.
- ❌ Pinning Xcode betas (signing breaks unpredictably). Stick to GM unless the user explicitly requested a beta.
- ❌ `expo build:ios` / `expo build:android` (deprecated). Use the local pipeline or EAS Build.
- ❌ Committing `.p8` or env files. The bootstrap script materializes the key with `umask 077` and `chmod 600` for a reason.

## CI variant

For unattended (GitHub Actions, etc.), provide the same signing variables from
repository secrets:

```yaml
# .github/workflows/ship-testflight.yml
jobs:
  ship:
    runs-on: macos-14
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: ./scripts/ship-ios.sh
        env:
          ASC_KEY_ID: ${{ secrets.ASC_KEY_ID }}
          ASC_ISSUER_ID: ${{ secrets.ASC_ISSUER_ID }}
          ASC_TEAM_ID: ${{ secrets.ASC_TEAM_ID }}
          ASC_AUTH_KEY_B64: ${{ secrets.ASC_AUTH_KEY_B64 }}
```

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| Bootstrap dies on PEM sanity check | `ASC_AUTH_KEY_B64` is missing or invalid | Re-encode: `base64 -i AuthKey_*.p8` and export `ASC_AUTH_KEY_B64` |
| Archive succeeds, upload rejected: "Invalid Bundle Structure" | Stale Pods after a config-plugin change | `cd ios && pod install --repo-update && cd ..` then re-archive |
| `processingState=INVALID` | App Store Connect rejected the binary | `curl …/v1/builds/<id>` for reason; common: missing privacy manifest, deprecated APIs |
| `xcodebuild` hangs at signing | Distribution profile missing | Pass `-allowProvisioningUpdates` + the API-key flags (the scripts already do this) |
| `CocoaPods out of sync` warning | Lockfile drift | `cd ios && pod install --repo-update` |
| Gradle: `Unsupported Java version` | Wrong JDK | `export JAVA_HOME=$(/usr/libexec/java_home -v 17)` |
| `Metro port 8081 in use` | Stale bundler | `lsof -ti :8081 \| xargs kill` |
| `Unable to resolve module /abs/path/...` for files that exist on disk | Node version older than Expo SDK requires (e.g. Node 22.12.x with SDK 54) | Check `package.json`'s `engines` warning at install time; `nvm use` a compatible version (Expo SDK 54 → `>=22.13` or `>=24`) |
| `error: Build input file cannot be found: '...rnscreensJSI-generated.cpp'` (or similar `*-generated.{cpp,mm}`) | Pods out of sync with `node_modules` after a refresh | `cd ios && pod install` then re-archive |
| Metro fails on a *different* `node_modules` file each run, all "exist but unresolved" | Watchman / Metro haste-map state corruption | `watchman watch-del-all && watchman shutdown-server`, then `rm -rf $TMPDIR/metro-* $TMPDIR/haste-* node_modules/.cache .expo` |
| ASC API returns `401 NOT_AUTHORIZED` despite valid `.p8` | JWT signature is DER (`openssl dgst -sign`) instead of raw r||s (IEEE P1363) | Ensure `asc-jwt.sh` signs with Node's `crypto.createSign(...).sign({key, dsaEncoding: "ieee-p1363"})` — Apple rejects DER ES256 |
| White screen after install | Bundler unreachable from device | Confirm Metro is running on `--lan`/`--tunnel` matching the device's network |

## Rules

- **Every command must be non-interactive CLI.** Never instruct the user to open Xcode, the Organizer, or the App Store Connect website. If a step requires UI today, document the App Store Connect REST API call instead.
- **The ship pipeline never opens a simulator.** That's `npx expo run:ios` territory (dev iteration), not shipping.
- **Default target is TestFlight.** Production submission is opt-in via `--target production`.
- **Apple auth is API key (`.p8`) only.** No Apple ID prompts. Always pass `-allowProvisioningUpdates` + `-authenticationKey*` flags to `xcodebuild`.
- **Secrets are provided via environment variables**, materialized at bootstrap. The scripts use `umask 077` + `chmod 600` for the `.p8`. Never inline secrets in markdown, scripts, or commits.
- **Detect the package manager from the lockfile.** Don't assume npm.
- **`prebuild` only when `ios/` is missing**, unless the user requested a clean regen. Warn if `ios/` has uncommitted changes before `--clean`.
- **The script files are canonical.** This document is a spec; `scripts/*` is the implementation. Don't paraphrase script contents inline — link instead.
- **Pre-ship checks are mandatory** — see [`../_shared/pre-ship-checks.md`](../_shared/pre-ship-checks.md) for the canonical rules (branch sanity, no uncommitted `app.json`, local `main` synced with `origin/main`, build-number reconciled against TestFlight). `ship.sh` runs `scripts/git-sync-check.sh` (step 5) and `scripts/check-build-number.sh` (step 6) before any archive/upload. The same checks apply to `/ship-expo-cloud`.
