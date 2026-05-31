# Deployment

How to ship iOS builds of this Expo / React Native app. There are four paths.
Pick one based on what you have access to and what you're trying to do.

## TL;DR — which path do I use?

| Path | Use when | Command |
| --- | --- | --- |
| **`ship.sh`** | You're the maintainer (have access to the 1Password signing vault). Full-featured: signing bootstrap, git safety checks, polls until the build is `VALID` on App Store Connect, optional App Store submission. | `./scripts/ship.sh` |
| **fastlane** | You're a contributor / running on a machine without the 1Password vault. Vanilla fastlane, configured purely via env vars. TestFlight only, no polling, no App Store submission. | `bundle exec fastlane beta` |
| **EAS cloud builds** | You want to build on Expo's servers (e.g. CI without macOS, or no local Xcode). Costs money. Opt-in only. | `/ship-expo-cloud` (skill, manual approval required) |
| **Manual Xcode** | Tooling diagnosis or a one-off where you want to see every step in the UI. | Xcode → Product → Archive → Distribute App |

All three local paths (`ship.sh`, fastlane, manual Xcode) produce the same kind
of artifact — an App Store IPA archived locally and uploaded to TestFlight.
They differ in how much automation sits around the archive step.

---

## Path A — `./scripts/ship.sh` (maintainer default)

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
./scripts/ship.sh                                     # → TestFlight (default)
./scripts/ship.sh --target testflight                 # explicit
./scripts/ship.sh --target production \
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
   — mirrors what `ship.sh` enforces.
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

(`./scripts/ship.sh` does commit the bump, because its bash pipeline is built
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

### When to prefer fastlane over `ship.sh`

- You don't have access to the 1Password signing vault.
- You're setting up CI and want a single, declarative pipeline tool.
- `ship.sh` is broken or behaving weirdly and you want a known-vanilla fallback.
- You're contributing from another machine and just need to get a build to
  TestFlight without configuring the full maintainer pipeline.

### Notes

- The lane never touches code signing, provisioning profiles, or entitlements —
  whatever the Xcode project already has is used as-is. (`ship.sh` is the path
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

## See also

- `/expo-local-ship` skill — wraps `scripts/ship.sh` with conversational
  affordances (release notes prompts, etc.).
- `/ship-expo-cloud` skill — EAS cloud build/submit. Manual approval required.
- `fastlane/.env.example` — env var template for Path B.
- `scripts/ship.sh` — Path A entry point.
