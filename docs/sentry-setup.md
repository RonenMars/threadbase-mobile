# Anonymous Diagnostics (Sentry) — Setup & Privacy

Threadbase Mobile has **optional, opt-in Anonymous Diagnostics** built on
[`@sentry/react-native`](https://docs.sentry.io/platforms/react-native/), off
**by default**. See `docs/specs/anonymous-diagnostics-consent-v0.1.md` for the
full spec — this doc covers local configuration and the manual Sentry/EAS
dashboard steps only. **Never commit a real DSN or auth token.**

The Sentry SDK becomes ready (`Sentry.init` runs) at app startup whenever a
DSN is configured and the build environment permits it — that alone
authorizes nothing. Passive/automatic transmission (crash/error events,
breadcrumbs, session tracking) is gated separately on the **Anonymous
diagnostics** setting (Settings → Anonymous diagnostics), off by default.
Explicit user actions — tapping "Report this crash" or submitting feedback —
work independent of that setting and send only that one report (see
`services/sentry.ts` module doc and
`docs/audits/anonymous-diagnostics-transmission-proof.md`).

## What is (and isn't) sent

Everything that leaves the device passes through the centralized sanitizer
(`services/sanitize.ts`) via `beforeSend` / `beforeBreadcrumb`. See
`docs/privacy-policy/proposed-privacy-policy.md` for the authoritative list. In short:

- **Sent (once Anonymous Diagnostics is on, or for an explicit one-shot
  report/feedback submission):** app version, build number, platform, OS
  major/minor, JS engine, environment/channel, Expo runtime version, EAS update
  id, an anonymous per-install UUID (for issue grouping only), a derived generic
  connection-mode enum (`local`/`remote`/`unknown`), scrubbed exception
  type/message/stack frames, and (once diagnostics is on) anonymous
  session/release-health pings (start/end timestamp + ok/errored/crashed
  status only).
- **Never sent:** prompts, terminal output, source code, file contents,
  credentials, tokens, headers, server URLs, hostnames, IPs, repository
  names/paths, absolute/home paths, session names/titles, WebSocket payloads,
  request/response bodies, clipboard contents, or device names.

Session Replay, screenshots, view-hierarchy attachment, console capture,
network breadcrumbs, and default PII are all **disabled** in
`services/sentry.ts` — except under `EXPO_PUBLIC_ENFORCE_SENTRY_TRACKING` (see below), which a
production ship refuses.

## Configuration (fork-friendly — no org/project hardcoded)

`app.json` registers the Sentry Expo plugin with no `organization`/`project`
props, so this repo carries no Sentry account details. `app.config.js` forwards
`SENTRY_ORG` / `SENTRY_PROJECT` into those plugin props when they are set
(local `.env`, ship shell, or EAS). Without them the plugin warns and
`sentry-cli` falls back to the same env vars at upload time.

| Variable | Where | Purpose |
|---|---|---|
| `EXPO_PUBLIC_SENTRY_DSN` | `.env` | Runtime DSN the app sends events to. Public by design (not a secret). |
| `EXPO_PUBLIC_ENFORCE_SENTRY_TRACKING` | `.env` / `.env.local` | Internal QA only. Set to `1` or `true` (any case) to always report once the tester agrees to the launch notice: Anonymous Diagnostics is forced on and Session Replay (default text/image masking), screenshots, view hierarchy, tracing, profiling, stall/app-hang/watchdog tracking, TTID, failed-request capture, logs and API request metrics (count, in-flight gauge, duration; method and status only) are enabled. It requires `EXPO_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` and `SENTRY_PROJECT`: `app.config.js` throws, stopping `expo start/run/prebuild`, if any is missing, and `services/sentry.ts` throws at load if a bundle still arrives without a DSN. `check-sentry-env.sh` fails any production ship that carries it. See [`privacy-and-verifiable-builds.md`](./privacy-and-verifiable-builds.md). |
| `EXPO_PUBLIC_SENTRY_ALLOW_DEV` | `.env` | Optional local QA override. Set to `1` only when you want a development build to transmit Sentry events. |
| `EXPO_PUBLIC_SENTRY_DEBUG` | `.env` | Optional SDK troubleshooting flag. Set to `1` only when you need verbose Sentry SDK logs in Metro. |
| `EXPO_PUBLIC_QA_FORCE_DIAGNOSTICS_CONSENT_UI` | `.env` / `.env.local` | Development/QA-only override that forces diagnostics-consent UI surfaces (hub banner + onboarding toggle) to render regardless of the persisted onboarding experiment assignment. It does not enable diagnostics, modify persisted consent, or bypass Sentry transmission gates. Honoured only in a `__DEV__` Metro bundle; production builds ignore it. |
| `SENTRY_ORG` | `.env` / shell env / EAS env | Org slug. Silences the Expo plugin warning and is used at build time to upload source maps. |
| `SENTRY_PROJECT` | `.env` / shell env / EAS env | Project slug. Same as `SENTRY_ORG`. |
| `SENTRY_AUTH_TOKEN` | shell env / EAS env (**sensitive**) | Secret. Authenticates the source-map upload. Never committed. |

Without `SENTRY_ORG`/`SENTRY_PROJECT`/`SENTRY_AUTH_TOKEN`, Anonymous Diagnostics
still works end-to-end (events transmit with `EXPO_PUBLIC_SENTRY_DSN` + consent
on, or via an explicit one-shot report/feedback submission) — stack traces
just show up unsymbolicated in the Sentry dashboard.

## Environments and the launch notice

One Sentry project, split by the `environment` tag so each environment has its own issues, logs, replays and performance data:

| Environment | Build | How the app knows |
|---|---|---|
| `development` | A Metro (`__DEV__`) bundle | `__DEV__` |
| `testing` | Enforced-tracking QA builds from `scripts/ship-qa.sh` (Firebase App Distribution) | `EXPO_PUBLIC_ENFORCE_SENTRY_TRACKING` in a release bundle; it wins over the store checks below |
| `staging` | TestFlight, and the Play `internal`, `alpha` and `beta` tracks | iOS: the App Store receipt is a sandbox receipt (`modules/app-distribution`). Android: `ship-android.sh` bakes `EXPO_PUBLIC_ANDROID_PLAY_TRACK` into the bundle, because Play gives an app no way to learn its own track. |
| `production` | The App Store and the Play `production` track | Anything that is neither of the above |

Source maps are uploaded per release and shared by every environment the release runs in.
Sentry deploy markers use the same names: `ship-ios.sh` records `staging` for `--target testflight`, and `ship-android.sh` records `staging` for any track but `production`.
A build promoted with `ship-android.sh --promote` keeps the track it was bundled with, so a build promoted from `internal` to `production` still reports `staging`.
TestFlight internal testers, external testers and public-link installs all report `staging`; the receipt can't tell them apart.
`appStoreReceiptURL`, which the iOS module reads, is deprecated since iOS 18; StoreKit 2's `AppTransaction.shared.environment` is the replacement before Apple removes it.

Whenever a build can send anything (a DSN, and an environment that permits reporting), `components/diagnostics/DiagnosticsTermsGate.tsx` blocks the app on launch until the user answers the diagnostics notice.
Standard builds offer "Allow diagnostics" and "Don't allow", and the app works either way.
Enforced builds (`EXPO_PUBLIC_ENFORCE_SENTRY_TRACKING`) offer only "I agree".
Until the notice is answered, `useCrashReportingSync` holds consent off whatever the stored setting says.
The answer is stored against a terms key (`standard-1`, `enforced-1`), so bumping `DIAGNOSTICS_TERMS_VERSION` in `services/sentry.ts` asks everyone again, and moving from a test build to a store build (which keeps app data) asks again too.
Local E2E builds (`e2e/ensure-release-build.js`) blank the DSN so the notice never sits in front of a Maestro flow.

## The QA channel

Enforced tracking ships through one channel only: `scripts/ship-qa.sh --platform ios|android`, which builds with the flag on and uploads to Firebase App Distribution.
The scripted store paths refuse the flag (`check-sentry-env.sh`, run by `ship-ios.sh` and `ship-android.sh`; fastlane and manual Xcode don't check), and the QA script never talks to App Store Connect or Google Play.
The flag is inlined into the bundle, so a QA binary is enforced for good; keeping it out of every store means no promotion or TestFlight group assignment can put it in front of the public.

- **iOS** exports an Ad Hoc (`release-testing`) build, so only devices registered in the Developer portal can install it. It needs an Ad Hoc profile for each target (`com.ronenmars.threadbase` and `.widgets`) that grants the App Group; the script picks the newest installed pair, so after registering a device, regenerate both profiles and install them.
- **Android** builds a release APK signed with the upload key. It cannot upgrade a Play install (Play re-signs with the app signing key), so a tester uninstalls the Play version first.
- **Setup** (Firebase project, credentials, Ad Hoc profiles) and first-run checks: [`deployment.md`](./deployment.md) → "Path F".
- **Local only.** Under `CI`, Expo skips the Metro cache reset that release builds rely on, and the transform cache is not keyed on `EXPO_PUBLIC_*` values, so an enforced `services/sentry.ts` could be reused by a later store build on the same runner. The script refuses to run when `CI` is set.
- Builds are not bumped; they carry the current `app.json` build number (iOS) or `build.gradle` versionCode (Android), and report as `testing`.
