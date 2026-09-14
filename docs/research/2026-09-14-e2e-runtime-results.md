# E2E runtime optimization results

**Date:** 2026-09-14

**Implementation worktree:** `/Users/ronenmars/dev/ai-tools/tb-mobile-worktrees/e2e-runtime-optimization` on `ci/e2e-runtime-optimization`

**Planning baseline:** `origin/main` at `72fd39709eee638ae8582f0ba903fbb1a9e202c5` (merged PR #1080).

**Local working tree at start:** clean (planning file stayed in the separate docs worktree; the root checkout's unrelated `handoff/` was not copied here).

## Local readiness

This file records local implementation and script-test evidence only.
It is not a CI performance result.

Focused script suites covering the planner, workflow YAML contracts, Android APK cache, iOS binary/native caches, Maestro wrapper, Maestro pin, and script-shard registry passed after the edits (52 tests).
Repository standard checks on this worktree: `npm run lint`, `npm run typecheck`, `npm run test:scripts` (253 tests), and `npm run test:ci` (3213 passed, 1 skipped) all succeeded.

No native iOS/Android compile, Maestro device run, GitHub workflow dispatch, or cache-hit experiment has been executed from this worktree.

## Intended live comparisons (not yet run)

Do not treat the plan's 32–40 minute iOS / 26–28 minute Android targets as measured.

After publication, compare:

| Experiment | What to hold fixed | What should happen |
|---|---|---|
| arm64-only iOS | same tested SHA as baseline [34788807171](https://github.com/RonenMars/threadbase-mobile/actions/runs/34788807171) | `lipo -archs` is `arm64`; no x86_64 compile entries |
| three weighted shards | same `package.json` flow set | each flow once; custom `flows=` stays one shard in supplied order |
| iOS binary miss then hit | same tested SHA and workflow revision | first builds; second skips prebuild/CocoaPods/xcodebuild |
| native reuse | same app SHA, workflow revision that only comments `e2e.yml` | binary key misses; Ccache/DerivedData/Gradle restore |
| Android grace skip | explicit `E2E_PLATFORM=android` | no one-minute post-Maestro tail; iOS still waits |

Record run URL, workflow SHA, tested SHA, toolchain, runner architecture, binary/native cache state, queue time, build time, per-shard times, longest shard, total elapsed, exact flows, failure class, and retry count.
Collect three comparable successful full-suite runs before claiming a median.
Include failed attempts in the reliability record.

## Decisions already in the implementation

- iOS simulator compile is `ARCHS=arm64` with `lipo` enforcement; `ONLY_ACTIVE_ARCH` is not used.
- Downstream checkouts pin `needs.resolve.outputs.sha`; a moving branch cannot drift a shard.
- Shard membership still comes only from `package.json`; `e2e/mock-suite-durations.json` is historical seconds.
- iOS binary cache is exact-match (`e2e-ios-app-v1-…`) with no restore prefixes.
- Android APK cache is `e2e-android-apk-v2-…` and includes `github.workflow_sha`.
- Ccache and DerivedData restore only on the same runner OS/arch/Xcode build.
- Explicit Android skips XCTest grace; unset platform keeps iOS detection.

## Live results

None yet.
