# TestFlight Distribution Setup

## Overview

`threadbase-mobile` is an **Expo SDK 51 managed app** (React Native) distributed to iOS via **EAS Build + TestFlight**.

- Bundle ID: `com.ronenmars.threadbase`
- App Store Connect App ID: `6762130307`
- Expo project: `@ronenmars/threadbase-mobile` (project ID: `35430e75-2718-4261-a46c-d6f6ff1e27c3`)
- Apple Team: `GUW6BN8X57` (Ronen Bakhteev, Individual)

---

## Credentials (managed by EAS)

All signing credentials are stored on EAS servers and auto-managed:

- **Distribution Certificate** — Serial `17ABEEA468D49F53D630889C3D4BDAE3`, expires Apr 13 2027
- **Provisioning Profile** — Developer Portal ID `HY7993X576`, expires Apr 13 2027
- **Push Notifications Key** — Created and assigned via EAS

No manual certificate management needed.

---

## Build & Submit

```bash
# Build for App Store
eas build --platform ios --profile production

# Submit to TestFlight
eas submit --platform ios
```

The `production` profile in `eas.json` uses `image: "latest"` to ensure Xcode 16+ (iOS 18 SDK) is used — required by Apple since early 2026.

---

## Expo Account

EAS CLI is authenticated under the **old Expo account**:
- Username: `ronenmars`
- Email: `ronen@cdi-negev.com`

> Note: There is also a newer account with username `ronemmars` (typo) linked to `ronenmars@gmail.com`.
> Long-term fix: update the old account's email to `ronenmars@gmail.com` and delete the duplicate.

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
