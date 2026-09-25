# Privacy promise and verifiable builds

Threadbase never uses a user's personal information or diagnostics data without that user's permission.
This document states that promise and explains how anyone can check it against the app they installed.

Commit that introduced this document: [`619aa802`](https://github.com/RonenMars/threadbase-mobile/commit/619aa802eb1ed41e4e3a7f178354ea8d8272dd5f)

## The promise

- **Nothing is collected before the user answers.**
  On first launch, and again whenever the diagnostics terms change, the app shows a full-screen notice explaining what Anonymous Diagnostics sends and asks the user to allow it or not.
  The app works the same either way, and the answer can be changed later in Settings.
  Until the user answers, nothing is sent, whatever an earlier setting said.
- **Every other send is a deliberate act by the user.**
  Tapping "Report this crash" sends that one report; submitting feedback sends that one message. Neither turns on standing collection.
- **What is sent is scrubbed.**
  Every event passes through an allowlist sanitizer (`services/sanitize.ts`), and prompts, terminal output, source code, credentials, server URLs, hostnames and file paths are never sent.
  The full list is in [`sentry-setup.md`](./sentry-setup.md#what-is-and-isnt-sent).
- **Session content never leaves the user's own machines.**
  There is no Threadbase-run server in the path (see [`no-hosted-service.md`](./no-hosted-service.md)).

## The one switch that removes the choice, and why it cannot ship

`EXPO_PUBLIC_ENFORCE_SENTRY_TRACKING` (`1` or `true`) turns on full Sentry telemetry (replay, tracing, profiling, logs, metrics, unmasked screenshots on error) and forces diagnostics on.
It exists only for internal QA builds, such as TestFlight or a Play testing track.
Even there it does not collect silently: the launch notice spells out what the test build sends, and the only way past it is "I agree".
A tester who does not agree is told to install the store version instead.

A build with the flag cannot start without a DSN, a Sentry auth token, an organization and a project, so a test build never runs half-configured.

It cannot reach a store build:

- `scripts/check-sentry-env.sh` runs at the start of every ship, and in production it fails the build if the flag is set in the shell environment or in `.env`, `.env.local`, `.env.production` or `.env.production.local`.
- The Deploy workflow (`.github/workflows/deploy.yml`) never sets it, and the repository holds no `.env` file for it to read.

## How a user can verify a store build

Production releases to the App Store and Google Play are made only by the Deploy workflow, from this public repository.
That makes each store build traceable to the exact source it was built from:

1. **Find your build number.**
   Open Settings → About in the app; the number in parentheses after the version is the iOS build number or the Android versionCode, e.g. `Threadbase Mobile v1.2.3 (236)`.
2. **Find the matching tag.**
   Every successful deploy tags the shipped commit and publishes a GitHub Release: `ios-v<build number>` for iOS and `android-v<versionCode>` for Android.
   See the [releases page](https://github.com/RonenMars/threadbase-mobile/releases).
3. **Read the source at that tag.**
   The data-collection code lives in `services/sentry.ts`, `services/sanitize.ts`, `hooks/useCrashReportingSync.ts` and the launch notice, `components/diagnostics/DiagnosticsTermsGate.tsx`; any collection that is not described here would have to appear there, in public history.
4. **Read the build that produced it.**
   The Deploy run for that release is public under the repository's Actions tab, with every step's log, including the `check-sentry-env.sh` result.

The binaries are built on GitHub's runners and signed with the publisher's store keys, so a user cannot reproduce them byte for byte.
What a user can check is that the store build carries a tag, that the tag points to public source, and that this source contains no collection beyond what this document describes.

## When this document must change

Any change that adds a new kind of data, a new recipient, or a new way to send without the user's action must update this document in the same pull request.
