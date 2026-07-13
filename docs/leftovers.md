# Leftovers — Uncommitted Work in This Worktree

Snapshot of everything sitting uncommitted in
`~/Desktop/dev/ai-tools/tb-mobile-sentry` (branch `feat/sentry-crash-reporting`,
on top of already-pushed PR #303 at commit `3b6319b`). Nothing here has been
committed, staged, verified with a fresh typecheck/lint/test run, or pushed.

## Modified files

- `.env.example` — documents new env vars (`EXPO_PUBLIC_SENTRY_DEBUG`, likely
  `EXPO_PUBLIC_FEEDBACK_ENDPOINT` or similar; verify against current content).
- `__tests__/unit/services/sentry.test.ts` — extended with `reportOneShot`
  tests plus two new tests for `EXPO_PUBLIC_SENTRY_DEBUG` gating debug logging.
- `android/app/build.gradle` — modified outside this session's own edits;
  origin/purpose not yet confirmed.
- `app.json` — Sentry plugin registered without hardcoded org/project (already
  committed as `3b6319b`, but file shows further uncommitted diffs on top).
- `app/_layout.tsx` — moved `useCrashReportingSync()` into `RootLayout` (init
  ordering fix); demo Report-button wiring may also touch this.
- `app/help-feedback.tsx` — unclear if further changes beyond what's in PR #303;
  needs diff review.
- `app/index.tsx` — added dev-only bug-icon button + full-screen
  `RootErrorBoundaryFallback` preview overlay (Hub screen demo).
- `app/settings.tsx` — added "Throw uncaught exception" dev-only test button
  (`ThrowOnRender`, `handleThrowUncaught`), plus the earlier
  `handleTestCrash`/test-crash button context.
- `components/RootErrorBoundary.tsx` — extracted `RootErrorBoundaryFallback` as
  a reusable function component; added the "Report this crash" button
  (`reportOneShot`), sending/sent/failed states, and the post-report
  "turn on crash reporting?" upsell (`Alert.alert`).
- `components/sessions/hub/ProjectHubCard.tsx` — modified; unrelated to this
  session's Sentry work as far as tracked — needs its own diff review before
  assuming intent.
- `docs/proposed-privacy-policy.md` — restructured crash-reporting section to
  describe both the automatic (opt-in) and manual one-shot report paths.
- `docs/sentry-setup.md` — documents `EXPO_PUBLIC_SENTRY_DEBUG` and the
  fork-friendly `SENTRY_ORG`/`SENTRY_PROJECT` env-var config.
- `docs/store-privacy-checklist.md` — updated with manual-report disclosure
  requirements for both App Store Connect and Google Play Console.
- `hooks/useCrashReportingSync.ts` — added `[sentry] consent sync fired...`
  dev-only log line.
- `ios/Podfile.lock` — regenerated after `pod install` (links `RNSentry`,
  `ExpoMailComposer`; already partly committed in `3b6319b`, further diffs
  present).
- `locales/{ar,en,he,ru}/common.json` — added `errorBoundary.report`,
  `reportSending`, `reportSent`, `reportFailed`, and `errorBoundary.upsell.*`
  keys in all 4 locales.
- `locales/{ar,en,he,ru}/settings.json` — likely the `testThrow` key added
  during the "Throw uncaught exception" button work; verify.
- `services/feedback-screenshot.ts` — fixed the size-cap bug (resize was
  conditionally gated on `asset.width`, which can be `undefined`; now always
  resizes to `MAX_WIDTH`, with a retry-at-half-size fallback).
- `services/sentry.ts` — added `[sentry] ...` dev-only console logging
  throughout; extracted `performInit()`/`doCaptureException()` as shared
  helpers; added `reportOneShot()` (one-shot report independent of standing
  consent); added `EXPO_PUBLIC_SENTRY_DEBUG`-gated `debug` option (was
  previously hardcoded to `__DEV__`).
- `stores/settings.ts` — added `crashReportingUpsellDismissed` field (+ setter,
  default, hydrate/persist wiring) for the "don't ask again" upsell state.

## New, untracked files

- `__tests__/integration/components/ProjectHubCard.test.tsx` — new test file,
  presumably paired with the `ProjectHubCard.tsx` change above; unrelated to
  this session's Sentry work as far as tracked.
- `docs/store-console-wording.md` — draft App Store Connect / Google Play
  Console field-by-field wording (Crash Data, Diagnostics, Email, Photos
  declarations) built on the current live privacy-policy voice.

## Resolved from this note

- `.serena/memories/` — removed from the worktree and added to `.gitignore`
  as generated local Serena MCP state.

## What has NOT been done since these changes accumulated

- No fresh `tsc --noEmit` run since the last several edits landed.
- No fresh `eslint` run since the last several edits landed.
- No fresh full `jest` run since the last several edits landed (last confirmed
  green run was 25/25 in `sentry.test.ts` alone, and 936/940 for the full suite
  from an earlier point in the session — before some of the files above changed
  further).
- Nothing staged, committed, or pushed. PR #303 on GitHub only reflects
  `3b6319b` and does not include anything listed above.
- `android/app/build.gradle` and `components/sessions/hub/ProjectHubCard.tsx` +
  its new test are unexplained by this session's own work — their diffs should
  be reviewed before assuming they're safe to include in any future commit.
- The live privacy policy at `threadbase.sh/privacy` has not been updated (that
  is explicitly on the user's side, not this repo).
- Store console fields (App Store Connect / Play Console) have not been
  touched — `docs/store-console-wording.md` is drafted text only.
