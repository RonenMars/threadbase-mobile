# Anonymous Diagnostics — transmission-proof evidence

**Spec:** `docs/specs/anonymous-diagnostics-consent-v0.1.md` §2, §16 — the core invariant: *initializing Sentry must not itself authorize network transmission, event capture, session tracking, persistent diagnostic identification, breadcrumbs, or other passive telemetry.*

**Method.** Not a live device/network capture — the SDK is fully mocked at the module boundary in this environment (`jest.setup.js`, `@sentry/react-native` mock), so there is no real network path to sniff. Instead, the proof is a **transport spy against the real production gate**: `services/sentry.ts`'s `Sentry.init()` call installs `beforeSend`/`beforeBreadcrumb` hooks that are the single point through which every event or breadcrumb must pass before the SDK's own `sendEnvelope()` (verified against `@sentry/core` source — `_isEnabled()` and `sendEnvelope()`, see Phase 0 notes) will transmit anything. The test captures those exact hook functions off the mocked `Sentry.init` call, then feeds them the exact event shapes the corresponding service functions produce, and asserts `null` (dropped, zero envelopes) vs. non-`null` (would transmit) at each step.

Primary artifact: `__tests__/integration/anonymous-diagnostics-transmission-proof.test.ts` — one narrative test exercising the full sequence end to end. Supporting evidence: `__tests__/unit/services/sentry.test.ts` (34 tests) isolates each mechanism individually.

## Evidence by scenario

| # | Scenario | What was exercised | Result | Reference |
|---|---|---|---|---|
| 1 | **Launch** | `setAnonymousDiagnosticsEnabled(false)` (simulating boot with default/hydrated consent OFF) | `Sentry.init` called exactly once; `enableAutoSessionTracking: false` (consent was OFF at the moment the SDK became ready — see §16 native-init-once limitation in Phase 0); no `{id}` identity object ever passed to `setUser` | proof test lines 40–51; `sentry.test.ts:52` "initializes even when consent is OFF" |
| 2 | **Navigation** (`setConnectionModeTag`) | Simulated a server URL change | Only `scope.setTag('connection.mode', …)` — zero calls to `captureException`/`captureMessage`/`captureFeedback` | proof test lines 53–57; `sentry.test.ts:289` |
| 3 | **Caught error, consent OFF** (`RootErrorBoundary.componentDidCatch` → `captureHandledError`) | Replayed the real event shape (no `type` field) through the real `beforeSend` | `beforeSend` returned `null` — **zero envelopes** | proof test lines 59–65; `sentry.test.ts:188` "drops a plain event entirely while consent is OFF" |
| 4 | **Explicit one-shot report** (`reportOneShot`, e.g. "Report this crash") | Confirmed the captured `Sentry.captureException` scope-callback sets the `diagnostics.one_shot` marker tag; replayed a tagged event through `beforeSend` (passes) and an untagged one (still blocked) | **Exactly one** envelope-equivalent authorized; everything else still dropped | proof test lines 67–75; `sentry.test.ts:214,302,315` |
| 5 | **Feedback submission** (`submitFeedbackViaSentry`) | Confirmed it succeeds with consent OFF, without closing/re-initializing the client | Feedback delivered independent of consent — architecturally guaranteed by the SDK itself: `captureFeedback` builds a `type: "feedback"` event, and `@sentry/core`'s `processBeforeSend()` only invokes `beforeSend` when `isErrorEvent(event)` (`event.type === undefined`), so feedback **never reaches our consent gate at all** (verified directly against `@sentry/core/build/cjs/client.js`, not re-derivable from the mock) | proof test lines 77–81; `sentry.test.ts:380` |
| 6 | **Consent → ON** | `setAnonymousDiagnosticsEnabled(true)` | `{id}` identity object attached via `setUser`; a plain error event now passes `beforeSend`; a lifecycle breadcrumb now passes `beforeBreadcrumb` | proof test lines 83–89; `sentry.test.ts:152,194,232` |
| 7 | **Consent → OFF again** | `setAnonymousDiagnosticsEnabled(false)` | `setUser(null)` clears identity; `Sentry.close()` is **never** called (the client stays ready — readiness and consent are independent by design); subsequent error and breadcrumb both blocked again — **zero further envelopes** | proof test lines 91–97; `sentry.test.ts:240` |

## What this does not cover

- **Native fatal crashes.** `_initNativeSdk()` arms the native (Cocoa/Java) crash handler unconditionally at process start, regardless of consent — this is explicitly out of scope per spec §8/§21 (next-launch crash recovery is a non-goal). `services/sanitize.ts`'s own header notes a `platform: cocoa` event was observed arriving without going through the JS `beforeSend` path at all.
- **A live network capture.** No `mitmproxy`/Charles/`chrome://net-export` run was performed against a real device or simulator. If independent verification against real traffic is wanted, that's a manual follow-up (boot a dev build with `EXPO_PUBLIC_SENTRY_ALLOW_DEV=1`, watch the request log for `ingest.sentry.io` calls at each of the 7 steps above) — not performed here.

## Full suite result

All 270 test suites / 2973 tests pass as of this audit, including the 34-test `sentry.test.ts` suite and the new integration proof (`npx jest --ci --runInBand`, run 2026-09-07).
