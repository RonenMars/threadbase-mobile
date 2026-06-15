# TestFlight Distribution Setup

## Overview

`threadbase-mobile` is an **Expo SDK 51 managed app** (React Native) distributed to iOS via **EAS Build + TestFlight**.

- Bundle ID: defined in `app.json` → `expo.ios.bundleIdentifier`
- App Store Connect App ID: in `app.json` → `expo.extra.storeListing.appId` (or check App Store Connect)
- Expo project: configured in `app.json` → `expo.owner` and `eas.json`
- Apple Team: configured via EAS and `app.json` → `expo.ios.appleTeamId`

---

## Ship Pipeline (`scripts/ship-ios.sh`)

End-to-end deploy without any manual steps:

```bash
./scripts/ship-ios.sh                     # → TestFlight
./scripts/ship-ios.sh --target production # → App Store review
```

### Signing env setup

The ship pipeline calls `scripts/bootstrap-ios-signing.sh` to pull the App Store Connect
API key from environment variables and write `.env.signing`.

Required variables:

```bash
export ASC_KEY_ID="<key-id>"
export ASC_ISSUER_ID="<issuer-id>"
export ASC_TEAM_ID="<team-id>"
export ASC_AUTH_KEY_B64="<base64-auth-key>"
```

**First-time setup on a new machine:**
1. Ensure the `ASC_*` variables above are in your environment.
2. Run `./scripts/ship-ios.sh`.

### Skip bootstrap when already set up

`ship-ios.sh` detects if `.env.signing` exists and the `.p8` key is already on disk, and
skips the bootstrap step entirely. On repeat deploys from the same machine, signing is
bootstrapped from the cached files.

---

## Credentials (managed by EAS)

All signing credentials are stored on EAS servers and auto-managed:

- **Distribution Certificate** — managed by EAS; view in App Store Connect → Certificates
- **Provisioning Profile** — managed by EAS; view in Developer Portal → Profiles
- **Push Notifications Key** — Created and assigned via EAS

No manual certificate management needed.

---

## Build & Submit

```bash
# Build for App Store
eas build --platform ios --profile production

# Submit to TestFlight (after build finishes)
eas submit --platform ios
```

The `production` profile in `eas.json` uses `image: "latest"` to ensure Xcode 16+ (iOS 18 SDK) is used — required by Apple since early 2026.

### Submit timing

`eas submit` needs a finished `.ipa`, so the build must complete before submitting. Options:

1. **Wait interactively** — let the build run to completion, then run `eas submit --platform ios` (picks the latest build).

2. **One command, auto-submit** — queue the submit to run as soon as the build succeeds:
   ```bash
   eas build --platform ios --profile production --auto-submit
   ```

3. **Check status later** — if you closed the terminal:
   ```bash
   eas build:list --platform ios --limit 5
   eas submit --platform ios --id <build-id>
   ```

Option 2 is usually the least friction for TestFlight releases.

---

## Expo Account

EAS CLI must be authenticated before running builds or submits:

```bash
eas login
```

To verify which account EAS is using: `eas whoami`

---

## Local Development

Run on iPhone via Expo Go (no build needed):

```bash
npm install
npx expo start
```

Install **Expo Go** from the App Store, ensure iPhone and Mac are on the same WiFi, then scan the QR code.

---

## TestFlight Testers

Managed in App Store Connect → Threadbase → TestFlight → Internal Testing.
Testers receive an email invitation and install via the TestFlight app.
