# TestFlight Distribution Setup

## Overview

`threadbase-mobile` is an Expo SDK 57 app with committed `ios/` and `android/` directories, shipped to TestFlight by `scripts/ship-ios.sh` from a local machine or the GitHub Deploy workflow.
Every build path (fastlane, EAS cloud, manual Xcode, CI signing) is compared in [`docs/deployment.md`](docs/deployment.md); this file covers the TestFlight side only.

- Bundle ID: `app.json` → `expo.ios.bundleIdentifier` (`com.ronenmars.threadbase`)
- Apple Team: `ASC_TEAM_ID` in `.env.signing`

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

## TestFlight Testers

App Store Connect → Threadbase → TestFlight.
Testers install through the TestFlight app, and every build in both groups reports to Sentry as `staging`.

| | Internal testing | External testing |
|---|---|---|
| Who | Members of the App Store Connect team, up to 100 | Anyone, up to 10,000 per app, split into up to 100 groups |
| How they join | Added in App Store Connect; email invitation | Email invitation, or a **public link** anyone can open |
| Review | None; available once processing finishes (usually minutes) | **Beta App Review** for the first build of each version (typically 24–48 hours); later builds of the same version usually clear within an hour |
| Use for | The maintainer and teammates | QA and the public beta |

### Running the public beta

1. Create an external group and turn on its public link; cap the tester count on the link if you want a ceiling.
2. Fill in Test Information: what to test, a feedback email, and **sign-in details**. Beta App Review cannot use the app without a reachable streamer, the same problem App Review had; see [`docs/app-review-demo-setup.md`](docs/app-review-demo-setup.md).
3. Submit the first build of a new version for review **before** announcing it, so the 24–48 hours isn't on the critical path.
4. Keep shipping: a build expires 90 days after upload, and a beta whose newest build has expired stops working for everyone.

### Known limits

- Internal, external and public-link installs all carry the same sandbox receipt, so Sentry can't tell them apart; they are all `staging`.
- Builds are one linear stream per app. To test a branch before merge, use the QA channel (`scripts/ship-qa.sh`, [`docs/deployment.md`](docs/deployment.md) → "Path F") once it lands, or a dev-client build.
- The TestFlight build shares its bundle ID with the dev client and the App Store build, so a device holds one at a time; see [`docs/dev-on-physical-device-ios.md`](docs/dev-on-physical-device-ios.md) → "Coexistence with TestFlight Threadbase".
