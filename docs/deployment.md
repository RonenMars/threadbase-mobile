# Deployment

How to ship iOS builds of this Expo / React Native app. There are four paths.
Pick one based on what you have access to and what you're trying to do.

## TL;DR — which path do I use?

### iOS

| Path | Use when | Command |
| --- | --- | --- |
| **`ship-ios.sh`** | You're the maintainer and have the signing env vars. Full-featured: signing bootstrap, git safety checks, polls until the build is `VALID` on App Store Connect, optional App Store submission. | `./scripts/ship-ios.sh` |
| **fastlane** | You're a contributor or want a vanilla fastlane path configured purely via env vars. TestFlight only, no polling, no App Store submission. | `bundle exec fastlane beta` |
| **EAS cloud builds** | You want to build on Expo's servers (e.g. CI without macOS, or no local Xcode). Costs money. Opt-in only. | `/ship-expo-cloud` (skill, manual approval required) |
| **Manual Xcode** | Tooling diagnosis or a one-off where you want to see every step in the UI. | Xcode → Product → Archive → Distribute App |

All three local paths (`ship-ios.sh`, fastlane, manual Xcode) produce the same kind
of artifact — an App Store IPA archived locally and uploaded to TestFlight.
They differ in how much automation sits around the archive step.

### Android

| Path | Use when | Command |
| --- | --- | --- |
| **`ship-android.sh`** | You're the maintainer and have the Android signing + Play service account env vars. Builds a signed AAB, bumps versionCode if needed, uploads to the chosen track. | `./scripts/ship-android.sh` |

---

## Local credentials — the 1Password bootstrap

Every path below needs signing credentials in the environment. Locally they come from
1Password rather than hand-typed exports, via `scripts/bootstrap-local-signing-op.sh`.

### Two kinds of artifact

Knowing which is which explains why a brand-new worktree still needs a bootstrap run
even though you already shipped from this machine yesterday.

**Machine-global** — provisioned once per Mac, shared by every checkout:
`~/.appstoreconnect/keys/AuthKey_<KEYID>.p8`, `~/.android-signing/tb-mobile-upload.keystore`,
`~/.config/threadbase/play-console-sa.json`, and the Distribution cert in the login keychain.

**Per-checkout** — gitignored files at the repo root, regenerated for each clone or worktree:
`.env.signing` (iOS), `.env.signing.android` (Android), `build/ExportOptions.plist`.

### Per checkout, once

```bash
eval "$(op signin)"
./scripts/bootstrap-local-signing-op.sh          # both platforms
```

`--platform ios` or `--platform android` does one half only.
`--dry-run` reports what every field resolves to and writes nothing, which is the safe way
to check a vault change or a rotated key.

Which 1Password vault, item and field each credential comes from is configured in
`scripts/.env.signing-op` — gitignored, so the real vault names never reach the repo.
Copy `scripts/.env.signing-op.example` and fill it in.
The Android and Play blocks are optional: omit them and the Android half degrades to a
skip-with-warning rather than an error.

### Every ship

```bash
npm run ship:ios          # or: npm run ship:android
npm run ship:all          # both, sequentially
```

No manual `source` is needed. `ship-ios.sh` sources `.env.signing` itself, `ship-android.sh`
sources `.env.signing.android`, and `npm run status:ios` has the `source` baked into the
package.json script.

### The two ships are not equally self-sufficient

`ship-android.sh` is fully self-bootstrapping: when the Play credential cache or
`.env.signing.android` is missing it calls the 1Password wrapper itself, so a fresh worktree
with nothing exported just works.

`ship-ios.sh` only *skips* its bootstrap step when `.env.signing` already exists.
Its fallback is `bootstrap-ios-signing.sh` directly, which expects `ASC_KEY_ID`,
`ASC_ISSUER_ID`, `ASC_TEAM_ID` and `ASC_AUTH_KEY_B64` to be exported already — it never
reaches 1Password on its own.
So in a fresh worktree `npm run ship:ios` fails with `ASC_KEY_ID must be set` until you
run the bootstrap above.
That asymmetry is why the per-checkout step is genuinely required for iOS and merely a
convenience for Android.

### None of this runs in CI

GitHub Actions reads its own repository secrets and never invokes `op`, so moving an item
between 1Password vaults cannot affect a deploy run.
The self-bootstrap hook in `ship-android.sh` is inert on a runner for two independent
reasons: `scripts/.env.signing-op` is gitignored so it never exists there, and `deploy.yml`
materializes both the Play cache and `.env.signing.android` in earlier steps.
Note that `deploy.yml` does **not** export `PLAY_SA_JSON_B64` into `ship-android.sh` — that
variable is scoped to the *Fetch Play credentials* step, and Actions `env:` is per-step — so
the `PLAY_SA_JSON_B64` check in that guard is for a local shell, not for CI.

---

## Path A — `./scripts/ship-ios.sh` (maintainer default)

The full pipeline. This is what the `/expo-local-ship` skill runs, and it's
the default maintainer path.

### What it does

1. **Preflight** — `scripts/preflight.sh` (Node version, Xcode CLI, etc.).
2. **Install dependencies** — auto-detects bun / pnpm / yarn / npm.
3. **Prebuild** — `npx expo prebuild --platform ios` if `ios/` is missing.
4. **Bootstrap signing** — `scripts/bootstrap-ios-signing.sh` pulls the ASC
   API key + signing config from environment variables into `.env.signing`.
   Skipped when `.env.signing` and the `.p8` are already on disk. It reads env vars only,
   so locally you get them there by running `bootstrap-local-signing-op.sh` first — see
   [Local credentials](#local-credentials--the-1password-bootstrap).
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
10. **Land version bump** — `scripts/land-version-bump.sh` commits the bump from
    the dirty tree, then admin-merges it onto `main` via `admin-merge-pr.sh`
    (no-op when `CI`/`GITHUB_ACTIONS` is set).

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

- App Store Connect signing variables set: `ASC_KEY_ID`, `ASC_ISSUER_ID`,
  `ASC_TEAM_ID`, and `ASC_AUTH_KEY_B64`.
- macOS with Xcode + CLI tools installed.
- Node version that satisfies the Expo SDK's `engines` field.

If signing env vars are not available, **stop and use fastlane (Path B) instead**
or configure them before running the maintainer pipeline.

---

## Path B — fastlane `bundle exec fastlane beta` (contributor-friendly)

Vanilla fastlane setup. No custom signing bootstrap, no polling, no App Store
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

- You don't have access to the maintainer signing env vars.
- You're setting up CI and want a single, declarative pipeline tool.
- `ship-ios.sh` is broken or behaving weirdly and you want a known-vanilla fallback.
- You're contributing from another machine and just need to get a build to
  TestFlight without configuring the full maintainer pipeline.

### Notes

- The lane never touches code signing, provisioning profiles, or entitlements —
  whatever the Xcode project already has is used as-is. (`ship-ios.sh` is the path
  that sets those up from environment variables.)
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
4. **Bootstrap signing** — `scripts/bootstrap-android-signing.sh` pulls the upload keystore + passwords from environment variables into `.env.signing.android`.
5. **Fetch Play credentials** — `scripts/fetch-play-credentials.sh` decodes `PLAY_SA_JSON_B64` to `~/.config/threadbase/play-console-sa.json` and sets `GOOGLE_APPLICATION_CREDENTIALS`.
6. **Git sync check** — same as iOS: refuses to ship if `main` is behind `origin/main` or `app.json` has uncommitted changes.
7. **Check/bump versionCode** — `scripts/check-version-code.sh` queries all Play tracks for the highest live versionCode, auto-bumps `app.json` if local ≤ remote, and commits the bump.
8. **Bundle + upload** — `scripts/bundle-and-upload-android.sh` runs `./gradlew :app:bundleRelease` then uploads the `.aab` to the chosen track via the Play Developer API (resumable upload + edits.commit).
9. **Land version bump** — `scripts/land-version-bump.sh` commits the bump from the dirty tree, then admin-merges it onto `main` via `admin-merge-pr.sh` (no-op when `CI`/`GITHUB_ACTIONS` is set).

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

1. **Android signing variables** set:
   - `ANDROID_KEYSTORE_B64` — base64 of the upload keystore (`base64 -i tb-mobile-upload.keystore`)
   - `ANDROID_STORE_PASSWORD`, `ANDROID_KEY_ALIAS` (default: `upload`), `ANDROID_KEY_PASSWORD`
2. **Play service-account JSON** available as `PLAY_SA_JSON_B64` (see `docs/google-play-mcp-setup.md`).
3. `jq` installed for credential validation.

> Locally you do not set 1 and 2 by hand — `./scripts/bootstrap-local-signing-op.sh --platform android`
> reads them from 1Password, and `ship-android.sh` calls it for you when the credentials are missing.
> The variables above are what CI supplies from repository secrets, and what the individual
> steps below expect if you run them standalone.

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

### Known gotchas (discovered during first deploy, 2026-06-12)

1. **`build.gradle` versionCode is hardcoded at prebuild time** — `expo prebuild` bakes the versionCode in when it generates `android/`. Since `android/` is committed, Gradle uses whatever value is in `build.gradle`, not `app.json`. `bundle-and-upload-android.sh` syncs the versionCode from `app.json` into `build.gradle` via `sed` before every Gradle run. Without this sync, Gradle returns UP-TO-DATE and the AAB still carries the old versionCode.

2. **Play tracks API 404 on first upload** — `GET /androidpublisher/v3/applications/{pkg}/tracks` returns 404 when no build has ever been published to the app. `check-version-code.sh` treats a 404 as remote versionCode = 0, so the local value always wins. This is expected behavior on a fresh app.

3. **Node 24 heredoc argv shift** — when running `node - arg1`, Node puts `-` at `process.argv[1]` and user args start at `[2]`. All Node scripts in `scripts/` use `process.argv.slice(2)` / `process.argv[2]`. If a script seems to ignore its arguments, this is the first thing to check.

4. **Never trust ambient `GOOGLE_APPLICATION_CREDENTIALS`** — the bootstrap step always writes a fresh credential file from `PLAY_SA_JSON_B64`. An ambient `GOOGLE_APPLICATION_CREDENTIALS` pointing at a stale gcloud ADC credential returns HTML 200 (the gcloud sign-in page) instead of JSON, causing silent parse failures downstream with no obvious error.

5. **versionCode bump rollback on upload failure** — `check-version-code.sh` exits 2 when it bumped `app.json`. `ship-android.sh` traps on exit and calls `git revert HEAD --no-edit` if the upload step fails after the bump, so `app.json` and `build.gradle` are left clean for a retry.

6. **Track name mapping** — Play Console UI names differ from the API track names used by `ship-android.sh --track`:

   | Play Console UI | `--track` value |
   |---|---|
   | Internal testing | `internal` |
   | Closed testing (Alpha) | `alpha` |
   | Open testing | `beta` |
   | Production | `production` |

7. **`--skip-bundle` is only safe when versionCode hasn't changed** — the AAB has the versionCode baked in at Gradle build time. Reusing a stale AAB after a versionCode bump will fail with `PERMISSION_DENIED: Version code N has already been used`. Always let Gradle rebuild when the versionCode changes.

---

#### Connectivity failure behaviour

Each `https.request` in `promote-android.js` carries a **30-second timeout**.

| Failure mode | What happens |
|---|---|
| No connectivity / DNS failure | Node fires `ECONNREFUSED` / `ENOTFOUND` immediately → script exits with a clear error message |
| Server connected but never responds | Timeout fires after 30 s → `req.destroy()` → `ERROR: … timed out after 30s` → exit 1 |

If the script exits with a timeout error, check your network connection and retry. No Play edit is left open — the edit is only committed in the final step, so a mid-flight timeout leaves no side effects in Play Console.

---

## GitHub Actions — iOS signing setup (CI secrets)

The CI pipeline uses **Manual code signing** with a Distribution certificate stored
as GitHub secrets. This prevents Xcode from creating new "Created via API"
Development certificates on every ephemeral runner (the cert-proliferation problem
that `CODE_SIGN_STYLE=Automatic` causes).

### How it works

`scripts/bootstrap-ios-signing.sh` runs before the archive step and:
1. Imports the Distribution cert (`.p12`) into a temporary keychain
2. Installs the app and widget provisioning profiles to `~/Library/MobileDevice/Provisioning Profiles/`
3. Copies the ASC `.p8` API key to `~/.appstoreconnect/private_keys/` for altool

`scripts/archive-and-upload.sh` then archives with:
```
CODE_SIGN_STYLE=Manual
CODE_SIGN_IDENTITY="Apple Distribution"
IOS_PROVISION_PROFILE_UUID=<app UUID>
IOS_WIDGET_PROVISION_PROFILE_UUID=<widget UUID>
CURRENT_PROJECT_VERSION=<buildNumber from app.json>
```

The app and widget Release configurations map those variables to separate
`PROVISIONING_PROFILE_SPECIFIER` values.

`ios/Threadbase/Info.plist` uses `$(CURRENT_PROJECT_VERSION)` (not a hardcoded value)
so the build number injected via the xcodebuild flag actually lands in the IPA.
Upload is via `xcrun altool --upload-app`.

### Required GitHub secrets

| Secret | What it is |
|---|---|
| `ASC_KEY_ID` | App Store Connect API key ID |
| `ASC_ISSUER_ID` | ASC API issuer ID |
| `ASC_TEAM_ID` | Apple Developer team ID |
| `ASC_AUTH_KEY_B64` | Base64 of the `.p8` API key file |
| `IOS_DIST_CERT_P12_B64` | Base64 of the Distribution cert `.p12` |
| `IOS_DIST_CERT_PASSWORD` | Password protecting the `.p12` |
| `IOS_PROVISION_PROFILE_B64` | Base64 of the main app's App Store provisioning profile |
| `IOS_PROVISION_PROFILE_UUID` | UUID of the main app's provisioning profile |
| `IOS_WIDGET_PROVISION_PROFILE_B64` | Base64 of the widget extension's App Store provisioning profile |
| `IOS_WIDGET_PROVISION_PROFILE_UUID` | UUID of the widget extension's provisioning profile |
| `GH_PAT` | GitHub PAT used to push bump branches and admin squash-merge them onto `main` (the repo admin role bypasses the `main protection` ruleset on PR merges only — a direct push to `main` is refused for everyone) |

### Rotating the Distribution cert or provisioning profile

1. Export a new `.p12` from Keychain Access (right-click the "Apple Distribution" cert → Export)
2. `base64 -i new-cert.p12 | pbcopy` → update `IOS_DIST_CERT_P12_B64` secret
3. Update `IOS_DIST_CERT_PASSWORD` if the password changed
4. Download manually created App Store profiles for `com.ronenmars.threadbase` and `com.ronenmars.threadbase.widgets` from developer.apple.com
5. Ensure both App IDs and profiles include the `group.com.ronenmars.threadbase` App Group
6. Base64 each profile and update `IOS_PROVISION_PROFILE_B64` and `IOS_WIDGET_PROVISION_PROFILE_B64`
7. Read each profile UUID with `security cms -D -i profile.mobileprovision | grep -A1 UUID | tail -1 | tr -d ' <>/string'`, then update `IOS_PROVISION_PROFILE_UUID` and `IOS_WIDGET_PROVISION_PROFILE_UUID`

Both provisioning profiles must be linked to the same Distribution cert that's in the `.p12`.

### Why not `CODE_SIGN_STYLE=Automatic`?

Automatic signing on ephemeral CI runners creates a new Development certificate
via the ASC API on every run (because each runner has a fresh keychain with no
existing cert). With 10+ runs per day, this fills up Apple's cert quota and
requires manual cleanup. Manual signing with a stored cert avoids this entirely.

---

## GitHub Actions — manual deploy workflow

`.github/workflows/deploy.yml` adds a `workflow_dispatch` trigger so you can
ship iOS and/or Android from the GitHub Actions UI without a local machine.

**Trigger:** Actions → Deploy → Run workflow

| Input | Options | Default |
|---|---|---|
| `platform` | `ios`, `android`, `all` | `all` |
| `target` (iOS) | `testflight`, `production` | `testflight` |
| `android_track` | `internal`, `alpha`, `beta`, `production` | `alpha` |
| `release_notes` | free text (iOS production only) | — |
| `deploy_ref` | any branch/ref to build | `main` |

**Requirements:** signing secrets must be configured in the repo (Settings →
Secrets → Actions): `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_TEAM_ID`,
`ASC_AUTH_KEY_B64`, `ANDROID_KEYSTORE_B64`, `ANDROID_STORE_PASSWORD`,
`ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`, `PLAY_SA_JSON_B64`, and `GH_PAT`.

**Version bump after upload:** On success, Deploy re-derives the version bump onto a fresh `origin/main` worktree (so a non-`main` `deploy_ref` does not leak branch code), then lands it via `scripts/admin-merge-pr.sh` (open PR + admin squash-merge with `GH_PAT`). Local `scripts/land-version-bump.sh` is a no-op under `GITHUB_ACTIONS`/`CI` so CI does not also commit the dirty deploy tree.

## npm ship scripts

Convenience wrappers so you can ship without remembering script paths:

```bash
npm run ship:ios                   # → TestFlight (runs scripts/ship-ios.sh)
npm run ship:android               # → Internal testing (runs scripts/ship-android.sh)
npm run ship:all                   # → both in sequence
```

These are thin aliases; all flags supported by the underlying scripts work as
normal when you call the scripts directly.

---

## Version bumps after a ship (local + CI)

After a successful upload, version bumps land on `main` automatically via an
admin squash-merge. Local ships and GitHub Actions Deploy share one merge
primitive but build the bump commit differently.

### Shared merge primitive

`scripts/admin-merge-pr.sh <branch> <title> <body>` opens a PR (or reuses an
existing one) and runs `gh pr merge --squash --delete-branch --admin`.

- **Local:** uses your logged-in `gh` auth.
- **CI:** `gh pr create` uses `GITHUB_TOKEN`; merge uses `GH_PAT` (`GH_PUSH_TOKEN`) so the admin role can bypass the required checks. An empty or mis-scoped `GH_PAT` fails the Deploy job loudly.

The `main protection` ruleset grants the admin role a `pull_request`-mode bypass, which is exactly what this helper needs and no more: it can push the merge through despite missing contexts, but the bump can never skip the PR and land on `main` as a direct push. See `CLAUDE.md` → "Merging PRs" for the full rule list.

If that merge is ever refused with a rules/protection error, the bypass mode is the first suspect: `gh api -X PUT repos/RonenMars/threadbase-mobile/rulesets/17538234` with the admin bypass actor set back to `"bypass_mode": "always"` restores the pre-2026-09-05 behaviour. The job fails loudly rather than hanging, so a red Deploy at the "land the version bump" step — with the upload already succeeded — is what this looks like.

### Local ships — `scripts/land-version-bump.sh`

Called by `ship-ios.sh` / `ship-android.sh` after upload. Commits from the
**dirty working tree** (version files + optional `ios/Podfile.lock` or
`android/app/build.gradle`), pushes a bump branch, then calls
`admin-merge-pr.sh`. If other tracked pipeline files are still dirty, it lands a
second cleanup branch the same way.

Under `GITHUB_ACTIONS=true` or `CI=true` this script is a **no-op** — Deploy owns
the bump so CI does not leave orphan `chore/post-ship-*` branches.

### CI Deploy — main worktree bump

After a successful upload, `deploy.yml` re-derives version fields onto a
throwaway `origin/main` worktree (iOS also copies a dirty `Podfile.lock` when
present), pushes `chore/bump-<platform>-version-<N>`, then calls
`admin-merge-pr.sh`. That keeps `deploy_ref != main` from leaking feature-branch
code onto `main`.

### Branch & commit naming

Match these patterns for any manual bump too:

| Artifact | Pattern | Example |
|---|---|---|
| **Bump branch** | `chore/bump-<platform>-version-<N>` | `chore/bump-ios-version-140` |
| **Bump commit (iOS)** | `chore(ios): bump build number to <N> [skip-ci]` | `chore(ios): bump build number to 140 [skip-ci]` |
| **Bump commit (Android)** | `chore(android): bump version code to <N> [skip-ci]` | `chore(android): bump version code to 20 [skip-ci]` |
| **Cleanup branch (local only)** | `chore/post-ship-<platform>-<N>` | `chore/post-ship-ios-140` |
| **Cleanup commit (local only)** | `chore(<platform>): post-ship cleanup [skip-ci]` | `chore(ios): post-ship cleanup [skip-ci]` |

Notes:

- `<platform>` is `ios` or `android`; `<N>` is the new iOS build number or Android version code.
- `[skip-ci]` stops CI from re-running on a bump-only (or cleanup-only) commit.
- iOS bumps touch `app.json` (and `ios/Podfile.lock` when pod install drifted); Android bumps touch `app.json` **and** `android/app/build.gradle`.
- Never push the bump straight to `main` — always land via the bump branch + `admin-merge-pr.sh`.

---

## See also

- `/expo-local-ship` skill — wraps `scripts/ship-ios.sh` with conversational
  affordances (release notes prompts, etc.).
- `/ship-expo-cloud` skill — EAS cloud build/submit. Manual approval required.
- `fastlane/.env.example` — env var template for Path B.
- `scripts/ship-ios.sh` — iOS Path A entry point.
- `scripts/ship-android.sh` — Android Path E entry point.
- `scripts/land-version-bump.sh` — local post-ship version land (no-op in CI).
- `scripts/admin-merge-pr.sh` — shared open-PR + admin squash-merge helper.
- `scripts/promote-android.js` — promote an existing build between Play tracks.
- `docs/google-play-mcp-setup.md` — Play service-account credential setup.
