# Deployment

How to ship iOS builds of this Expo / React Native app. There are four paths.
Pick one based on what you have access to and what you're trying to do.

## TL;DR — which path do I use?

### iOS

| Path | Use when | Command |
| --- | --- | --- |
| **`ship-ios.sh`** | You're the maintainer (have access to the 1Password signing vault). Full-featured: signing bootstrap, git safety checks, polls until the build is `VALID` on App Store Connect, optional App Store submission. | `./scripts/ship-ios.sh` |
| **fastlane** | You're a contributor / running on a machine without the 1Password vault. Vanilla fastlane, configured purely via env vars. TestFlight only, no polling, no App Store submission. | `bundle exec fastlane beta` |
| **EAS cloud builds** | You want to build on Expo's servers (e.g. CI without macOS, or no local Xcode). Costs money. Opt-in only. | `/ship-expo-cloud` (skill, manual approval required) |
| **Manual Xcode** | Tooling diagnosis or a one-off where you want to see every step in the UI. | Xcode → Product → Archive → Distribute App |

All three local paths (`ship-ios.sh`, fastlane, manual Xcode) produce the same kind
of artifact — an App Store IPA archived locally and uploaded to TestFlight.
They differ in how much automation sits around the archive step.

### Android

| Path | Use when | Command |
| --- | --- | --- |
| **`ship-android.sh`** | You're the maintainer (have 1Password access for keystore + Play service account). Builds a signed AAB, bumps versionCode if needed, uploads to the chosen track. | `./scripts/ship-android.sh` |

---

## Path A — `./scripts/ship-ios.sh` (maintainer default)

The full pipeline. This is what the `/expo-local-ship` skill runs, and it's
the default for anyone with the 1Password signing vault.

### What it does

1. **Preflight** — `scripts/preflight.sh` (Node version, Xcode CLI, etc.).
2. **Install dependencies** — auto-detects bun / pnpm / yarn / npm.
3. **Prebuild** — `npx expo prebuild --platform ios` if `ios/` is missing.
4. **Bootstrap signing** — `scripts/bootstrap-ios-signing.sh` pulls the ASC
   API key + signing config from 1Password into `.env.signing`.
5. **Git sync check** — refuses to ship if local `main` is behind `origin/main`
   or if `app.json` has uncommitted changes. Catches the multi-machine "someone
   else already shipped a higher build number on another laptop" footgun.
6. **Check/bump build number** — `scripts/check-build-number.sh` queries
   TestFlight; if `app.json` → `expo.ios.buildNumber` is ≤ the latest TestFlight
   build, it auto-bumps `app.json` (and commits it).
7. **Archive + upload** — `xcodebuild archive` → `xcodebuild -exportArchive` →
   altool/notarytool upload. Non-interactive, ASC API key auth.
8. **Poll until VALID** — `scripts/poll-build.sh` watches App Store Connect
   until the build hits processing state `VALID`. 30-minute timeout.
9. *(optional, `--target production` only)* **Submit for App Store review** —
   `scripts/submit-for-review.sh` with release notes and release type.

### Usage

```bash
./scripts/ship-ios.sh                                     # → TestFlight (default)
./scripts/ship-ios.sh --target testflight                 # explicit
./scripts/ship-ios.sh --target production \
  --release-notes "Fixes..." \
  --release-type AFTER_APPROVAL                       # → App Store review
```

Other flags: `--skip-preflight`, `--skip-prebuild`, `--bundle-id <id>`,
`--release-date 2026-04-26T08:00:00-07:00` (required for
`--release-type SCHEDULED`).

### Prerequisites

- 1Password CLI signed in (either via `op signin` or
  `OP_SERVICE_ACCOUNT_TOKEN`).
- macOS with Xcode + CLI tools installed.
- Node version that satisfies the Expo SDK's `engines` field.

If 1Password isn't available, **stop and use fastlane (Path B) instead** — don't
try to hand-roll `.env.signing`.

---

## Path B — fastlane `bundle exec fastlane beta` (contributor-friendly)

Vanilla fastlane setup. No 1Password integration, no polling, no App Store
submission — just bump the build number, archive, and upload to TestFlight.

> **Note:** `fastlane/README.md` is auto-generated from the `Fastfile` on every
> fastlane run — it's just a lane index. The canonical setup docs are right
> here in `docs/deployment.md`.

### What it does

1. **Pre-ship checks** — `./scripts/git-sync-check.sh`. Refuses to ship if
   local `main` is behind `origin/main`, or if `app.json` has uncommitted
   edits. Shared canonical policy (see
   [`.claude/skills/_shared/pre-ship-checks.md`](../.claude/skills/_shared/pre-ship-checks.md))
   — mirrors what `ship-ios.sh` enforces.
2. Authenticate to App Store Connect via the API key (no Apple ID prompt, no 2FA).
3. Read `expo.version` from `app.json` for the marketing version.
4. Call `latest_testflight_build_number` for that marketing version and add 1.
5. Write the new build number into `app.json` and into the on-disk `Info.plist`.
6. `build_app` — archives the workspace and exports an App Store IPA.
7. `upload_to_testflight` with `skip_waiting_for_build_processing: true` — the
   lane returns as soon as the upload completes; processing continues on
   Apple's side.
8. **Restore `app.json`** — drops the working-tree change so `git status`
   stays clean.

### One-time setup

1. **Install Ruby gems:**

   ```bash
   bundle install
   ```

2. **Create an App Store Connect API key:**
   - Go to https://appstoreconnect.apple.com/access/integrations/api
   - Click **Generate API Key** (or **+**) with role **App Manager**.
   - Download the `AuthKey_<KEY_ID>.p8`. Apple only lets you download it once.
   - Note the **Key ID** and **Issuer ID** from the same page.

3. **Configure env vars:**

   ```bash
   cp fastlane/.env.example fastlane/.env
   # then edit fastlane/.env
   ```

   `fastlane/.env` is gitignored. Required vars:

   - `APP_BUNDLE_ID` — must match `app.json` → `expo.ios.bundleIdentifier`
   - `APP_SCHEME` — your Xcode scheme name; also used to derive
     `ios/<scheme>.xcworkspace` and `ios/<scheme>/Info.plist`
   - `APPLE_TEAM_ID` — Apple Developer Portal team id (used as `teamID` in the
     export options so xcodebuild can sign the IPA)
   - `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_PATH`

   Store the `.p8` outside the repo (e.g. `~/.appstoreconnect/`).

### Usage

```bash
bundle exec fastlane beta
```

The lane writes the new build number into `app.json` to keep it in sync with
the archive, then runs `git restore app.json` on the way out so your working
tree stays clean. The value is derived from App Store Connect on every run —
the next ship queries ASC again and writes a fresh number. There's nothing
to commit.

(`./scripts/ship-ios.sh` does commit the bump, because its bash pipeline is built
around it. That convention does not apply to the fastlane path.)

To target multiple environments, drop additional files like
`fastlane/.env.staging`, then `bundle exec fastlane beta --env staging`.

### Verification (no upload)

```bash
bundle exec fastlane lanes                  # list discovered lanes
bundle exec fastlane --version              # confirm pinned version
ruby -c fastlane/Fastfile                   # syntax-check the Fastfile
bundle exec fastlane action build_app       # show signatures/help
```

### When to prefer fastlane over `ship-ios.sh`

- You don't have access to the 1Password signing vault.
- You're setting up CI and want a single, declarative pipeline tool.
- `ship-ios.sh` is broken or behaving weirdly and you want a known-vanilla fallback.
- You're contributing from another machine and just need to get a build to
  TestFlight without configuring the full maintainer pipeline.

### Notes

- The lane never touches code signing, provisioning profiles, or entitlements —
  whatever the Xcode project already has is used as-is. (`ship-ios.sh` is the path
  that sets those up from 1Password.)
- If `latest_testflight_build_number` returns 0 (e.g. brand-new marketing
  version with no uploads yet), the lane sets the build number to 1.
- Any missing required env var fails the lane fast with a clear message — no
  fallback to interactive auth, no silent defaults.

---

## Path C — EAS cloud builds (`/ship-expo-cloud`)

Expo Application Services builds and submits on their own infrastructure. The
project is configured for it (see `app.json` → `extra.eas.projectId`), but
**this path is opt-in only**.

### When to use

- You're on a machine that can't build locally (no macOS, no Xcode, broken
  toolchain).
- You're wiring up CI where keeping macOS runners isn't worth it.
- You need an EAS-specific feature (EAS Update, EAS Build profiles, etc.).

### When *not* to use

- Day-to-day shipping when local builds work. EAS cloud builds **cost money**;
  local builds are free. (Per project policy — see CLAUDE.md.)

### How

Invoke the `/ship-expo-cloud` skill. It will stop and ask for explicit
approval before running any EAS build or submit command. Never trigger it as a
side-effect of a "ship" or "commit and ship" request.

---

## Path D — Manual Xcode (last resort)

When all automation is broken and you need to ship anyway, or you're diagnosing
exactly which step of the pipeline is misbehaving.

1. `npx expo prebuild --platform ios` (if `ios/` is missing).
2. Open `ios/<scheme>.xcworkspace` in Xcode.
3. Select **Any iOS Device (arm64)** as the destination.
4. Product → **Archive**.
5. In the Organizer that opens, **Distribute App** → **App Store Connect** →
   **Upload**.

After upload, watch the build on App Store Connect manually until it processes,
then expose it to TestFlight testers from the website.

This path bypasses the build-number guard, the git sync check, signing
bootstrap, and polling. Use it sparingly.

---

---

## Path E — `./scripts/ship-android.sh` (Android maintainer default)

The Android equivalent of Path A. Builds a signed App Bundle and uploads it
to Google Play via the Play Developer API.

### What it does

1. **Preflight** — `scripts/preflight.sh` with `PLATFORM=android` (ANDROID_HOME, JAVA_HOME, etc.).
2. **Install dependencies** — auto-detects bun / pnpm / yarn / npm.
3. **Prebuild** — `npx expo prebuild --platform android` if `android/` is missing.
4. **Bootstrap signing** — `scripts/bootstrap-android-signing.sh` pulls the upload keystore + passwords from 1Password (vault/item set in `.env.op` via `OP_ANDROID_VAULT`/`OP_ANDROID_ITEM`) into `.env.signing.android`.
5. **Fetch Play credentials** — `scripts/fetch-play-credentials.sh` pulls the service-account JSON from 1Password (`op://$OP_PLAY_VAULT/$OP_PLAY_ITEM`) to `~/.config/threadbase/play-console-sa.json` and sets `GOOGLE_APPLICATION_CREDENTIALS`.
6. **Git sync check** — same as iOS: refuses to ship if `main` is behind `origin/main` or `app.json` has uncommitted changes.
7. **Check/bump versionCode** — `scripts/check-version-code.sh` queries all Play tracks for the highest live versionCode, auto-bumps `app.json` if local ≤ remote, and commits the bump.
8. **Bundle + upload** — `scripts/bundle-and-upload-android.sh` runs `./gradlew :app:bundleRelease` then uploads the `.aab` to the chosen track via the Play Developer API (resumable upload + edits.commit).

### Usage

```bash
./scripts/ship-android.sh                           # → Internal testing (default)
./scripts/ship-android.sh --track alpha             # → Closed testing (Alpha)
./scripts/ship-android.sh --track beta              # → Open testing
./scripts/ship-android.sh --track production        # → Production
./scripts/ship-android.sh --promote 8 --track alpha # → Promote versionCode 8 to alpha (no rebuild)
```

Play Console UI names → API track names: Internal testing=`internal`, Closed testing=`alpha`, Open testing=`beta`, Production=`production`.

Other flags: `--skip-preflight`, `--skip-prebuild`, `--skip-bundle` (reuse existing AAB without rebuilding), `--package <id>`.

### Prerequisites

1. **1Password** signed in (`eval "$(op signin)"` or `OP_SERVICE_ACCOUNT_TOKEN`).
2. **1Password item for Android signing** (vault/item set via `OP_ANDROID_VAULT`/`OP_ANDROID_ITEM` in `.env.op`) with fields:
   - `keystore_b64` — base64 of the upload keystore (`base64 -i tb-mobile-upload.keystore`)
   - `store_password`, `key_alias` (default: `upload`), `key_password`
3. **Play service-account JSON** in 1Password — vault/item set via `OP_PLAY_VAULT` / `OP_PLAY_ITEM` env vars (see `docs/google-play-mcp-setup.md`).
4. `ANDROID_HOME` pointing at the Android SDK, `JAVA_HOME` pointing at JDK 17.
5. The app registered in Play Console with the bundle ID `com.ronenmars.threadbase`.

### Individual steps

Each script is independent and idempotent:

```bash
PLATFORM=android ./scripts/preflight.sh
./scripts/bootstrap-android-signing.sh
./scripts/fetch-play-credentials.sh
./scripts/git-sync-check.sh
GOOGLE_APPLICATION_CREDENTIALS=~/.config/threadbase/play-console-sa.json \
  ./scripts/check-version-code.sh
source .env.signing.android
GOOGLE_APPLICATION_CREDENTIALS=~/.config/threadbase/play-console-sa.json \
ANDROID_TRACK=internal \
  ./scripts/bundle-and-upload-android.sh
```

### Promoting a build between tracks

Once a build is live on a track, use `scripts/promote-android.js` to move it
to a wider track **without re-uploading**. The Play API reuses the already-uploaded
AAB — no Gradle rebuild needed.

```bash
SA="$HOME/.config/threadbase/play-console-sa.json"
node scripts/promote-android.js com.ronenmars.threadbase <versionCode> alpha "$SA"
node scripts/promote-android.js com.ronenmars.threadbase <versionCode> beta  "$SA"
node scripts/promote-android.js com.ronenmars.threadbase <versionCode> production "$SA"
```

The service-account JSON path is the same one fetched by `scripts/fetch-play-credentials.sh`.

> **Why not `ship-android.sh --track alpha`?** That path tries to re-upload the
> AAB, which fails with `PERMISSION_DENIED: Version code N has already been used`.
> The promote script opens an edit, updates the target track to include the
> existing versionCode, and commits — no binary upload.

#### Connectivity failure behaviour

Each `https.request` in `promote-android.js` carries a **30-second timeout**.

| Failure mode | What happens |
|---|---|
| No connectivity / DNS failure | Node fires `ECONNREFUSED` / `ENOTFOUND` immediately → script exits with a clear error message |
| Server connected but never responds | Timeout fires after 30 s → `req.destroy()` → `ERROR: … timed out after 30s` → exit 1 |

If the script exits with a timeout error, check your network connection and retry. No Play edit is left open — the edit is only committed in the final step, so a mid-flight timeout leaves no side effects in Play Console.

---

## See also

- `/expo-local-ship` skill — wraps `scripts/ship-ios.sh` with conversational
  affordances (release notes prompts, etc.).
- `/ship-expo-cloud` skill — EAS cloud build/submit. Manual approval required.
- `fastlane/.env.example` — env var template for Path B.
- `scripts/ship-ios.sh` — iOS Path A entry point.
- `scripts/ship-android.sh` — Android Path E entry point.
- `scripts/promote-android.js` — promote an existing build between Play tracks.
- `docs/google-play-mcp-setup.md` — Play service-account credential setup.
