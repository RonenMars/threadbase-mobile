# E2E Runtime Optimization Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` to implement this plan task by task, inline, with review checkpoints. Steps use checkbox syntax for tracking. Do not delegate unless the user explicitly requests it.

**Goal:** Shorten Threadbase Mobile's GitHub Actions mock E2E feedback time while preserving the complete Release suite and its failure detection.

**Architecture:** Keep one Release build per platform followed by independent Maestro VMs. Reduce unused native compilation, assign existing flows by measured platform-specific duration, and distinguish reusable compiler outputs from exact-build binary caches. Keep changes confined to E2E infrastructure and its tests/documentation.

**Tech stack:** GitHub Actions, Node.js/CommonJS, Jest script tests, Expo SDK 57, React Native 0.86.3, Gradle, Xcode 26.4.1, CocoaPods, Maestro 2.8.0.

**Spec:** The [design basis](#design-basis-and-evidence) in this document captures the preceding research and recommended scope; no separate approved design file exists. The user requested this implementation plan after reviewing the research. Writing this file does not execute or publish the implementation.

**Status:** executed. Measured outcome: [`docs/research/2026-09-14-e2e-runtime-results.md`](../../research/2026-09-14-e2e-runtime-results.md).

**Planning baseline:** `origin/main` at `72fd3970` on 2026-09-14, containing merged [PR #1080](https://github.com/RonenMars/threadbase-mobile/pull/1080).

## Global constraints

- `npm run test:e2e:mock` remains the authoritative flow list and a sequential local pass.
- A nonempty `flows=` dispatch remains one shard, preserving the supplied order.
- Sunday scheduling still covers both platforms; keep the final aggregate check and failure propagation.
- Retain Release, Hermes, Android R8/resource shrinking, camera/microphone flows, and scroll regression coverage.
- Keep Maestro pinned to `e2e/maestro-version.json`; no dependency upgrades or new hosted services.
- Keep `macos-26`, Xcode 26.4.1, Android API 35/x86_64, and one device per VM for the initial implementation.
- Keep production/device build and signing settings untouched; simulator architecture overrides belong in E2E only.
- Preserve iOS delayed XCTest crash detection and existing signal/nonzero-exit behavior. Do not import the separate Android diagnosis branch.
- Do not replace condition-based waits with sleeps or shorten regression dwell periods as part of this plan.
- Use `/opt/homebrew/bin/git` locally. Preserve existing and untracked work, including the root checkout's unrelated `handoff/` directory.
- Use an isolated implementation worktree from fresh `origin/main`. If one already covers this work, follow the user's existing-worktree confirmation rule.
- No automatic commits: first show the complete staged diff, purpose, and exact commit message, then obtain explicit approval. Publication and live workflow dispatch require applicable authorization; do all available local work before that checkpoint.
- Never report an optimization as CI-validated from script tests alone. Keep local readiness, live correctness, and measured performance separate.
- No package/lockfile changes are planned. If one becomes necessary, follow the repository's CocoaPods/lockfile requirements.
- Shut down only simulators/emulators started by the implementation session; never erase a device.

## Design basis and evidence

### Measured baseline

| Platform | Build job | Test shard jobs | Important substeps | Source |
|---|---:|---|---|---|
| Android | 13.57 min | 16.00 / 12.82 / 12.15 min | Assemble 10.67 min; 1,235 actionable tasks all executed | [34803277723](https://github.com/RonenMars/threadbase-mobile/actions/runs/34803277723) |
| iOS | 25.27 min | 20.38 / 22.58 min | xcodebuild 22.65 min; Maestro steps 15.68 / 18.90 min | [34788807171](https://github.com/RonenMars/threadbase-mobile/actions/runs/34788807171) |

The comparison runs test different commits and cache states; they are historical evidence, not a controlled A/B experiment. Older sequential baselines are [Android 34765205871](https://github.com/RonenMars/threadbase-mobile/actions/runs/34765205871) and [iOS 34779633994](https://github.com/RonenMars/threadbase-mobile/actions/runs/34779633994).

The iOS log contains 621 C/Objective-C compile entries and 94 Swift compile entries for each of arm64 and x86_64. Both architectures are built although the test runners are arm64. DerivedData restored, but this did not avoid substantial recompilation; CocoaPods explicitly removed Ccache integration. Android does not enable Gradle task-output caching in the checked-in properties or assemble command. The `Build cache is disabled` lines found in the Android post-job log belong to the action's dummy cleanup project, so do not cite those as direct evidence about the app build.

The workflow caches the Android APK by tested commit, but does not implement the iOS binary cache promised by its header. It uploads the iOS tarball for downstream jobs in the same run only. The DerivedData key names Xcode 26.3 despite selecting 26.4.1 and does not advance with source changes.

Standard hosted runners are free for this public repository, including `macos-26`; artifact/cache storage is a separate consideration. Extra Mac shards compete for account concurrency: the documented normal maximum for Free/Pro/Team is five Mac jobs. Three iOS shards are the initial choice, retaining capacity for other workflows. [GitHub runner reference](https://docs.github.com/en/actions/reference/runners/github-hosted-runners), [limits](https://docs.github.com/en/actions/reference/limits).

### Scope and execution order

1. Establish revision provenance and measurements, then compile only arm64 for iOS.
2. Balance duration-weighted Android shards at three; raise iOS from two to three weighted shards.
3. Add exact-build iOS binary reuse before expensive setup.
4. Enable Gradle task-output caching and iOS Ccache; correct the DerivedData cache identity/update behavior.
5. Remove the iOS-specific post-Maestro grace period only for explicit Android runs.
6. Validate, document results, and decide whether a fourth shard is justified.

Initial targets are iOS 32–40 minutes and Android 26–28 minutes for an uncached binary with comparable dependency/compiler cache state. These are hypotheses, not acceptance guarantees. Cache-hit reruns should be reported separately and should skip native compilation entirely on iOS.

## File map

| File | Responsibility/change |
|---|---|
| `.github/workflows/e2e.yml` | Immutable checked-out revision, arm64 build, cache steps/conditions, job evidence and result artifacts |
| `e2e/mock-suite-shards.js` | Deterministic duration-weighted assignment; unchanged matrix row interface |
| `e2e/mock-suite-durations.json` (new) | Historical seconds per existing flow/platform and provenance; never suite membership |
| `e2e/run-maestro.js` | Skip delayed iOS-report waiting on explicit Android only |
| `__tests__/unit/scripts/mock-suite-shards.test.js` | Scheduling, conservation, fallback, custom-input order |
| `__tests__/unit/scripts/ios-e2e-simulator-target.test.js` | E2E architecture restriction and existing tarball/install contract |
| `__tests__/unit/scripts/e2e-android-apk-cache.test.js` | Existing APK provenance/cache and new Gradle flag coverage |
| `__tests__/unit/scripts/e2e-schedule-and-notification.test.js` | Aggregate, schedule, matrix and immutable revision wiring |
| `__tests__/unit/scripts/e2e-ios-build-cache.test.js` (new) | Exact binary cache and compiler cache boundaries |
| `__tests__/unit/scripts/run-maestro.test.js` | Platform-scoped grace behavior using the existing subprocess fixture |
| `scripts/ci-script-test-shards.json` | Register the one new cache test suite exactly once |
| `docs/e2e-testing.md`, `e2e/README.md` | Accurate shard/cache behavior, reruns and diagnostic instructions |
| `docs/research/2026-09-14-e2e-runtime-results.md` (new during execution) | Run IDs, revision/cache provenance, measurements and decisions |

Read `AGENTS.md` and any nested instructions at execution time. Existing tests sometimes inspect named shell steps; preserve their names unless there is a concrete reason to change them. Avoid extracting a general workflow framework.

## Task 1: Baseline, immutable revision, and arm64-only iOS

**Files:** `.github/workflows/e2e.yml`, `ios-e2e-simulator-target.test.js`, `e2e-schedule-and-notification.test.js`, results document from the file map.

**Interfaces:** `resolve.outputs.ref` remains the validated user ref; add `resolve.outputs.sha` from checkout. All downstream jobs consume the immutable SHA. Build output stays `e2e-ios-app.tgz` containing `Threadbase.app`.

- [ ] Read the workflow, planner, wrapper, cache tests, and simulator-target test. Record the implementation base SHA and initial working-tree status.
- [ ] Install dependencies with `npm ci` using an allowed Node runtime, then run the existing focused baseline below. Report pre-existing failures separately; do not repair unrelated code.

```sh
npx jest --config jest.config.scripts.js --runInBand --testPathPattern 'mock-suite-shards|e2e-schedule-and-notification|e2e-android-apk-cache|ios-e2e-simulator-target|run-maestro|maestro-install-pin'
```

- [ ] Extend the current simulator build test with the following assertions; run it and confirm it fails on the missing architecture override before editing the workflow.

```js
expect(buildApp).toContain('ARCHS=arm64');
expect(buildApp).toContain('-showBuildTimingSummary');
expect(buildApp).toContain('-configuration Release');
expect(buildApp).toContain("-destination 'generic/platform=iOS Simulator'");
```

- [ ] Add a checked-out SHA step after the resolve job checkout and publish it as a job output. Use that SHA for every downstream checkout so a moving branch cannot make a shard's test source disagree with its binary.

```yaml
# Under resolve.outputs:
sha: ${{ steps.head.outputs.sha }}

# After the resolve checkout:
- name: Record resolved SHA
  id: head
  run: echo "sha=$(git rev-parse HEAD)" >> "$GITHUB_OUTPUT"

# Downstream actions/checkout inputs:
ref: ${{ needs.resolve.outputs.sha }}
```

The snippet's `git` is inside the hosted runner, where the local Homebrew path does not apply. Retain the Android checked-out SHA step and assert it agrees with the resolve output. Extend the existing workflow test to parse the YAML and assert every build/shard checkout consumes `needs.resolve.outputs.sha`, while the resolve checkout still consumes its validated input ref.

- [ ] Add `ARCHS=arm64` and `-showBuildTimingSummary` to the existing iOS `xcodebuild` command. Keep `build`, Release, generic simulator destination, and tar packaging. Do not depend on `ONLY_ACTIVE_ARCH=YES`: generic destinations may ignore it.
- [ ] Validate the produced main executable with `lipo -archs "$APP_PATH/Threadbase"` in the build step and require exactly `arm64`. Preserve build failure propagation through any logging pipeline with `set -euo pipefail`.
- [ ] Re-run the focused tests. The test suite must pass and the plan must still have one iOS build before all simulator shards.
- [ ] At the publication checkpoint, propose `ci(e2e): build only the arm64 iOS simulator slice` with its full staged diff. After authorized publication, run one controlled iOS candidate against the same app revision as its baseline. Capture timing summary, architectures, and the full suite result.

**Accept:** No x86_64 compile work; all iOS flows pass on the produced arm64 app. Record actual time saved; do not substitute the 5–10 minute estimate for evidence.

## Task 2: Duration-weighted sharding, three VMs per platform

**Files:** planner, new duration JSON, existing planner tests and schedule test, E2E docs.

**Interfaces:** Extend `splitFlows(flows, shardCount, durations = {})`; keep returning `{ shard: string, total: string, flows: string }[]`. Extend `planShards` with injectable `durationWeights = { android: {}, ios: {} }` for deterministic tests. The CLI loads the JSON and supplies `durationWeights`. `package.json` alone supplies default flow membership.

- [ ] Create this seed data, retaining the measured provenance. Values are observed flow seconds, including whatever setup the flow performed in that run; they are not pure feature timings.

```json
{
  "version": 1,
  "sources": {
    "android": "https://github.com/RonenMars/threadbase-mobile/actions/runs/34803277723",
    "ios": "https://github.com/RonenMars/threadbase-mobile/actions/runs/34788807171"
  },
  "android": {
    "e2e/launch.yaml": 95,
    "e2e/browse.yaml": 93,
    "e2e/session_lifecycle.yaml": 115,
    "e2e/server_drag_reorder.yaml": 90,
    "e2e/bug6_bottom_bar_inset.yaml": 89,
    "e2e/pty_turn_divider.yaml": 86,
    "e2e/feat1_tree_drill_new_session.yaml": 97,
    "e2e/feat2_export_in_info_shelf.yaml": 89,
    "e2e/codex_parity.yaml": 90,
    "e2e/voice_dictation.yaml": 94,
    "e2e/settings_qr_scanner.yaml": 90,
    "e2e/language_direction.yaml": 95,
    "e2e/feedback_flow.yaml": 130,
    "e2e/05_chat_flow.yaml": 116,
    "e2e/06_search_anchor.yaml": 108,
    "e2e/07_conversation_scroll_gaps.yaml": 205
  },
  "ios": {
    "e2e/launch.yaml": 167,
    "e2e/browse.yaml": 185,
    "e2e/session_lifecycle.yaml": 81,
    "e2e/server_drag_reorder.yaml": 79,
    "e2e/bug6_bottom_bar_inset.yaml": 118,
    "e2e/pty_turn_divider.yaml": 87,
    "e2e/feat1_tree_drill_new_session.yaml": 92,
    "e2e/feat2_export_in_info_shelf.yaml": 69,
    "e2e/codex_parity.yaml": 67,
    "e2e/voice_dictation.yaml": 80,
    "e2e/settings_qr_scanner.yaml": 49,
    "e2e/language_direction.yaml": 44,
    "e2e/feedback_flow.yaml": 100,
    "e2e/05_chat_flow.yaml": 79,
    "e2e/06_search_anchor.yaml": 66,
    "e2e/07_conversation_scroll_gaps.yaml": 307
  }
}
```

- [ ] Replace the test requiring round-robin placement with behavioral tests. Use this concrete scheduling example, then add conservation, deterministic ties, unknown duration, and invalid weight cases.

```js
const flows = ['a.yaml', 'b.yaml', 'c.yaml', 'd.yaml'];
const weights = { 'a.yaml': 8, 'b.yaml': 7, 'c.yaml': 6, 'd.yaml': 5 };
expect(splitFlows(flows, 2, weights)).toEqual([
  { shard: '1', total: '2', flows: 'a.yaml d.yaml' },
  { shard: '2', total: '2', flows: 'b.yaml c.yaml' },
]);
expect(flows).toEqual(['a.yaml', 'b.yaml', 'c.yaml', 'd.yaml']);
```

- [ ] Implement longest-processing-time assignment: sort a copy of indexed flows by descending duration, break equal-duration ties by original list position, and assign each to the smallest total-duration bucket, breaking equal-load ties by bucket index. Unknown, zero, negative, nonnumeric or nonfinite weights use 120 seconds. Sort each completed bucket back into original suite order to minimize within-shard order changes. Clamp shard count to flow count and retain the existing empty-list rejection.
- [ ] Handle requested `flows=` as the existing one-row result without scheduling/reordering. Test both platforms with a reversed custom flow list. Add a test that a duration entry absent from the suite never creates a flow, and that a new suite flow without a weight still runs exactly once.
- [ ] Change `IOS_SHARD_COUNT` from 2 to 3. Keep Android at 3. Test scheduled output has three rows for each platform, full set equality, no duplicates, no empty rows, and the existing skipped-platform dummy row behavior.
- [ ] Print each platform's assignment and estimated seconds into `GITHUB_STEP_SUMMARY`; keep existing matrix outputs unchanged. Label estimates as historical weights.
- [ ] Upload lightweight Maestro result output on success as well as failure using per-platform/per-shard names and short retention; keep full screenshots/debug artifacts on failure only. Use the existing `e2e/_artifacts/maestro-output/` output directory. Avoid adding another reporter/parser solely for this change.
- [ ] Run focused planner/workflow tests and ESLint on changed JS. After authorized publication, validate Android and iOS full suites. Confirm exactly the package flow set executes and inspect cold onboarding behavior in every new shard.

**Accept:** Coverage and custom dispatch behavior are unchanged. Three-shard iOS is faster in measured wall clock without a new failure pattern. If changed placement reveals state coupling, keep the failing evidence and investigate the coupling; do not omit the flow or silently claim independence.

## Task 3: Exact-build iOS tarball cache

**Files:** workflow, new `e2e-ios-build-cache.test.js`, script shard registry, E2E docs.

**Interfaces:** Cache path `e2e-ios-app.tgz`; cache step ID `ios-app-cache`; binary cache uses exact matching only. Existing artifact name/path and shard extraction remain unchanged.

- [ ] In the new test suite, parse the workflow using its existing YAML dependency (`yaml`) and test these contracts before adding the cache:

```js
const fs = require('fs');
const path = require('path');
const YAML = require('yaml');
const workflow = YAML.parse(fs.readFileSync(
  path.resolve(__dirname, '../../../.github/workflows/e2e.yml'), 'utf8',
));
const steps = workflow.jobs['ios-build'].steps;
const cache = steps.find((step) => step.id === 'ios-app-cache');
expect(cache.with.path).toBe('e2e-ios-app.tgz');
expect(cache.with['restore-keys']).toBeUndefined();
expect(cache.with.key).toContain('needs.resolve.outputs.sha');
for (const name of ['Install dependencies', 'Install CocoaPods', 'Build iOS app (Release)']) {
  expect(steps.find((step) => step.name === name).if)
    .toContain("steps.ios-app-cache.outputs.cache-hit != 'true'");
}
```

- [ ] Select Xcode before computing cache identity. Add a small named identity step with ID `toolchain`. Obtain actual Xcode build number using `xcodebuild -version`; do not use the obsolete `xcode26.3` label.
- [ ] Key the tarball by schema version, runner OS/architecture, actual Xcode build number, Release/development build mode, resolved tested SHA, and the executing workflow revision (`github.workflow_sha`). Including both revisions covers `--ref` differing from `-f ref=`; bump the schema when changing cache semantics.

```yaml
- name: Cache iOS Release app
  id: ios-app-cache
  uses: actions/cache@v5
  with:
    path: e2e-ios-app.tgz
    key: e2e-ios-app-v1-${{ runner.os }}-${{ runner.arch }}-${{ steps.toolchain.outputs.xcode-build }}-Release-development-${{ needs.resolve.outputs.sha }}-${{ github.workflow_sha }}
```

- [ ] Place the lookup before Node/npm, Ruby, DerivedData/Ccache restoration, prebuild, CocoaPods, and compilation. Condition those build-only steps on a miss. Xcode selection/identity and artifact upload still run on a hit. Preserve `Resolve app env` on the build path.
- [ ] Add a cache-hit summary containing tested SHA, workflow revision, toolchain, and exact cache key. Validate tarball structure before upload and fail explicitly if `Threadbase.app/Info.plist` or its executable is missing; no fallback to another commit's binary.
- [ ] Register the new suite in shard 4 of `scripts/ci-script-test-shards.json`, then run cache tests and `ci-script-test-shards.test.js`. Extend tests to cover cache ordering, upload on both paths, both revision inputs, and absence of binary fallback prefixes.
- [ ] After authorized publication, perform two fresh dispatches with the same full tested SHA and workflow ref. First builds; second hits and skips all compilation. A different tested SHA must miss the binary cache. A changed workflow revision must also miss. Avoid claiming a warm native-cache result from this binary-hit experiment.

**Accept:** A same-build rerun installs the exact artifact and passes the requested suite without prebuild/CocoaPods/xcodebuild. Changed source/workflow cannot retrieve the prior binary through a prefix match.

## Task 4: Native task/compiler caching

**Files:** workflow, Android cache test, new iOS cache test, E2E docs. The existing Podfile already supports `USE_CCACHE=1`; prefer setting it in this workflow over changing the Podfile.

**Interfaces:** Android adds `--build-cache` to the existing assemble command. iOS sets `CCACHE_DIR` to `~/.cache/tb-e2e-ccache`, exports `USE_CCACHE=1` on cache-miss builds, and records per-build Ccache stats. Exact binary cache takes precedence over all compiler cache work.

- [ ] Extend the Android APK key to include the executing workflow revision, so workflow-only changes to assembly settings cannot reuse an old APK and the native-cache experiment below can force a binary miss without changing application code. Update the existing key assertion and retain exact matching with no restore prefixes.

```yaml
key: e2e-android-apk-v2-${{ runner.os }}-x86_64-${{ steps.head.outputs.sha }}-${{ github.workflow_sha }}
```

- [ ] Extend the Android test to require `--build-cache` while retaining `-PreactNativeArchitectures` and Release assembly. Confirm failure, then add the flag. Keep the existing `gradle/actions/setup-gradle@v5` cache; do not layer a duplicate Gradle Home cache over it.

```sh
./gradlew :app:assembleRelease --build-cache -PreactNativeArchitectures="${REACT_NATIVE_ARCHITECTURES:-x86_64}"
```

- [ ] On iOS binary misses, ensure `ccache` is installed, configure its cache directory, and run these before CocoaPods so React Native discovers it. Set `USE_CCACHE: '1'` on both pod installation and compilation; keep the main/widget Podfile structure unchanged.

```sh
command -v ccache >/dev/null || brew install ccache
export CCACHE_DIR="$HOME/.cache/tb-e2e-ccache"
echo "CCACHE_DIR=$CCACHE_DIR" >> "$GITHUB_ENV"
ccache --set-config=compiler_check=content
ccache --set-config=max_size=2G
ccache --zero-stats
```

- [ ] Persist the contents of `CCACHE_DIR` with an Actions cache keyed by schema, runner OS/architecture, actual Xcode build, dependency/native configuration hash, and tested SHA. Use compatible toolchain/architecture prefixes to reuse compilation across source changes. Include `package-lock.json`, `ios/Podfile`, `ios/Podfile.lock`, `ios/Podfile.properties.json`, and `app.json` in the configuration hash. Compiler content checks, not Actions prefix matching, decide reusable objects.
- [ ] Restore the Ccache directory after exporting its absolute path and before applying per-build configuration/resetting stats. Split the setup snippet at the export if necessary so restored `ccache.conf` and counters cannot undo the desired size/compiler settings or per-build statistics reset.
- [ ] Replace the DerivedData key with the same actual toolchain/architecture identity plus configuration hash and tested SHA. Permit only same-toolchain/architecture fallback. This lets new source revisions save new snapshots rather than repeatedly restoring a fixed dependency-only entry. Never apply these restore prefixes to the final `.app` cache.
- [ ] Capture `ccache --show-stats` after the build, including failures where available, without masking the build exit code. Assert in workflow tests that Ccache setup precedes pods, both steps enable Ccache, toolchain identity is shared, and all native-cache work is skipped on binary hits.
- [ ] Run the focused tests. For live measurements after publication, seed caches with one build, then dispatch a second workflow revision differing only in a comment in `e2e.yml` against the same fixed app SHA. The exact binary key must miss due to the workflow revision; the native caches should restore. This measures recompilation reuse without changing app behavior or deleting shared caches. Both commits still require the normal approval procedure.
- [ ] Inspect Android `FROM-CACHE` task counts and Ccache hit/miss statistics; count restore/save time in job duration. On iOS confirm the compiler settings actually use Ccache, including any source-built extension targets. Do not assume an installed executable means integration is active.

**Accept:** Full suites pass using newly assembled artifacts, warm native cache builds show actual reuse and a net time improvement, and altered source/toolchain inputs compile correctly. If Ccache has negligible hits or adds net time, report and omit that optimization rather than retaining unsupported complexity. Retain correctness-oriented cache identity fixes.

## Task 5: Remove Android's iOS-specific grace wait

**Files:** `e2e/run-maestro.js`, existing `run-maestro.test.js`.

**Interfaces:** Only explicit `E2E_PLATFORM=android` changes. Unknown/unset platform keeps current behavior because local iOS callers may omit the variable. CLI flags, batching, reports, signals, and exit-code precedence remain unchanged.

- [ ] Add a subprocess regression using the existing `makeFixture`/`runGuard` helpers: set Android plus `E2E_XCTEST_CRASH_GRACE_MS=60000`; give `spawnSync` a short timeout (for example 5 seconds) through a test-helper option; assert the successful fake Maestro finishes with status 0 and no timeout. The existing implementation should hit that timeout. Keep all temporary processes/files confined to the fixture and teardown.
- [ ] Add an Android fake-Maestro nonzero-exit case. Retain explicit-iOS and unset-platform tests that detect delayed matching reports; keep their short fixture-specific grace values so tests are fast.
- [ ] Change only the effective wait supplied to report collection:

```js
const reportGraceMs =
  terminationSignal || process.env.E2E_PLATFORM === 'android' ? 0 : graceMs;
```

Pass `reportGraceMs` to `findNewMatchingReports`. Keeping its immediate scan is acceptable; do not refactor the report classifier or weaken iOS detection.
- [ ] Run the entire wrapper suite and `maestro-flow-env.test.js`; then verify the Android live log no longer has the one-minute tail after Maestro finishes, while iOS still waits and enforces the crash guard.

**Accept:** Explicit Android runs save about one minute of shard elapsed time. iOS and platform-unspecified callers retain crash detection and nonzero/signal propagation.

## Task 6: Integration, publication checkpoint, and measured rollout

**Files:** E2E docs and results document, plus only changes required by failures in Tasks 1–5.

- [ ] Run the focused script tests after the final edits, including the new cache suite and script-shard registry test. Run ESLint on changed JS files and `git diff --check` with the required local Git binary.
- [ ] Run the repository standard checks once: `npm run lint`, `npm run typecheck`, `npm run test:ci`, and `npm run test:scripts`. Report unrelated baseline failures explicitly; do not modify unrelated files to make the plan appear complete.
- [ ] Inspect the complete diff: no package flow-list changes, no Release/security settings relaxed, no production/device workflow edits, no test omitted, and no dependency/lockfile drift.
- [ ] Complete all locally authorized work before asking for publication. Show exact staged scope and the proposed conventional commit message(s), obtain the required approval, then publish only the authorized branch/PR. Do not dispatch against uncommitted local files: GitHub cannot see them.
- [ ] For each authorized live comparison, use full tested SHAs and record both workflow revision and code revision. Example dispatch shape after setting `E2E_WORKFLOW_REF` and `E2E_TEST_SHA` to the approved published branch and full 40-character tested SHA:

```sh
gh workflow run E2E --repo RonenMars/threadbase-mobile \
  --ref "$E2E_WORKFLOW_REF" -f ref="$E2E_TEST_SHA" -f platform=ios
gh workflow run E2E --repo RonenMars/threadbase-mobile \
  --ref "$E2E_WORKFLOW_REF" -f ref="$E2E_TEST_SHA" -f platform=android
```

The current workflow concurrency group serializes dispatches for the same target, even across these platform inputs. Account for that queue time; do not change concurrency policy merely to improve a benchmark. `--ref` chooses the workflow and `-f ref=` chooses checked-out source. Planner/wrapper changes must exist in the tested source revision; a fixed pre-change app checkout cannot validate a new planner that only exists on the workflow branch.

- [ ] For build-only experiments, use the same app SHA with different approved workflow revisions. For planner/wrapper experiments, compare commits with identical application/native dependency content and only the intended infrastructure changes. Record that distinction instead of calling them identical revisions.
- [ ] Validate a full Android suite, full iOS suite, a custom-flow dispatch on each platform, scheduled two-platform planning, an iOS binary miss/hit pair, and a native-cache reuse build. Scheduled behavior can be covered by planner/workflow tests without changing the cron or waiting for Sunday.
- [ ] Collect three comparable successful full-suite runs per candidate configuration before making a dependable performance claim. Include failed attempts/retries in the reliability record; do not cherry-pick only the fastest success. Re-run a suspected infrastructure failure once; if it repeats, stop that experiment and report the evidence. A legitimately long native build is not automatically a stalled job.
- [ ] Record: run URL, workflow/tested SHAs, toolchain, runner architecture, binary/native cache state, queue duration, build duration, each shard's startup/test/teardown time, longest shard, total elapsed, exact flow membership, failure class, and retry count. Compare medians and ranges; three observations do not justify a p95 claim.
- [ ] Update `docs/e2e-testing.md` and `e2e/README.md` with measured shard counts, cache distinction, how to reproduce misses/hits, preserved local behavior, and actual runner-cost/concurrency implications. Keep one sentence per line in GitHub-bound prose.
- [ ] Report local readiness and live verification separately. If any linked issue is discovered, apply repository issue-status rules only after checking ownership/authorship and applicable authorization. PR #1080 alone is not an instruction to create or close a new issue.

**Rollback:** Keep tasks separately reviewable. Restore the previous shard count/assignment if scheduling causes failures; restore the previous simulator command if the arm64 artifact is incompatible; disable only the ineffective compiler-cache layer if it regresses timings. Invalidate a suspect binary cache by changing its schema key, never by restoring another revision's app. Preserve all evidence and do not delete shared caches without approval.

## Deferred experiments

- Four shards on either platform: consider only after measuring three weighted shards, including extra onboarding and account queueing. No new dispatch control is needed in the initial implementation.
- Onboarding setup readiness: first capture command-level evidence for the optional 30-second hub wait; design an either-hub-or-onboarding condition without lowering readiness protection.
- Faster/paid/self-hosted build runners: benchmark only if native compilation remains dominant after architecture/cache fixes; do not change runners in this plan.
- Prebuilt native shell plus rebundled JavaScript: requires a separate correctness design for fingerprints, embedded JS/assets, build-time environment, signing, and Expo Updates. A matching native fingerprint alone does not establish that a Release binary contains the tested JavaScript.
- Booting VMs early, multiple simulators per VM, or migrating to a hosted test service: additional orchestration/isolation costs are not justified by the current evidence.

## Primary technical references

- [Apple build settings: ARCHS and ONLY_ACTIVE_ARCH](https://developer.apple.com/documentation/xcode/build-settings-reference).
- [Gradle task-output build cache](https://docs.gradle.org/current/userguide/build_cache.html).
- [React Native build speed and compiler caching](https://reactnative.dev/docs/build-speed).
- [GitHub dependency cache matching and scope](https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching).
- [Maestro wait behavior](https://docs.maestro.dev/maestro-flows/flow-control-and-logic/wait-commands).

## Plan validation status

This is an implementation handoff, not an implementation result. Repository paths and current source contracts were inspected while authoring; Markdown structure, file references, seed JSON, and the scheduling example were checked. No native build, dependency installation, application test suite, commit, push, or CI dispatch was performed for this documentation-only task.
