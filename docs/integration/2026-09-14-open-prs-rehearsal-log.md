# Integration merge log — integration/2026-09-14-open-prs (2026-09-14)

**Status:** complete
**Goal:** local rehearsal of the green open mobile product PRs onto today's `main`, with a conflict ledger and verified command sequence. Nothing is pushed.
**Operator:** operator  **Repo:** tb-mobile  **Log started:** 2026-09-14 20:09 IDT

## 1. Provenance and refs

| What | Ref | SHA | Note |
|---|---|---|---|
| Cut point | `origin/main` | `72fd3970` | re-fetched immediately before cutting (`72fd39709eee638ae8582f0ba903fbb1a9e202c5`) |
| Base PR branch | `feat/web-e2ee-webcrypto` (#1085) | `b359c2bf` | earliest included PR by `createdAt` |
| Integration branch | `integration/2026-09-14-open-prs` | `d9918adb` | 5 PRs + 1 INT follow-up; 12 commits ahead of cut-point `72fd3970`; local only; upstream unset |
| Backup of previous INT | `—` | `—` | flow A does not push backups. Prior local INT `integration/2026-09-12-open-prs` remains at `../tb-mobile-worktrees/int-2026-09-12` (`139062db`). It was never on origin; this run does not replace it there. |
| Archive tag | `—` | `—` | flow A, local only |
| Worktree | `../tb-mobile-worktrees/int-2026-09-14` | | own `npm ci` (already completed; node_modules not copied) |

### Environment provenance

| Item | Value |
|---|---|
| OS / arch | Darwin arm64 |
| node / npm | v24.15.0 / 12.0.2 — matches `.nvmrc` (`24.15.0`) |
| `git` / `gh` | git 2.55.0 / gh 2.100.0 |
| `node_modules` | `npm ci` at `72fd3970` (before baseline); re-run after #1090 lock change (`react-dom` 19.2.8 → 19.2.3) |
| Xcode / CocoaPods | not run — set does not touch `ios/`, `android/`, `patches/`, or native deps (#1090 is JS-only `react-dom` pin) |
| Pods / prebuild state | not run |
| `npm run check:native-deps` | skipped at baseline; pass after #1090 (`✓ no duplicate native modules`) |
| Host load at baseline | `uptime`: load averages 12.12 15.59 16.11 — saturated box; timing is not diagnostic |

## 2. Baseline — the state of `main` before anything landed

| Check | Command | Result |
|---|---|---|
| lint | `npm run lint` | green (0 errors, `--max-warnings=0`) |
| typecheck | `npm run typecheck` | green |
| unit | `npm run test:unit` | `212 suites / 2147 passed` |
| integration | `npm run test:integration` | `71 suites / 531 passed` |
| i18n | `npm run test:i18n` | green — 1211 keys, no unused; jest `4 suites / 460 passed / 1 skipped` |
| scripts | `npm run test:scripts` | `39 suites / 235 passed` — baseline for #1088 |
| native deps | `npm run check:native-deps` | skipped at baseline — no native-dep files until after #1090 |

Known-flaky before the run: — none

## 3. Scope — what is in, what is out

| PR | Title | Head branch | Head SHA | Base | Draft? | Mergeable | CI on PR |
|---|---|---|---|---|---|---|---|
| #1085 | feat(e2ee): pair and connect encrypted from the web client | `feat/web-e2ee-webcrypto` | `b359c2bf` | main | no | MERGEABLE / CLEAN | all required checks pass |
| #1088 | ci(e2e): speed mock suite with arm64 builds, caches, and weighted shards | `ci/e2e-runtime-optimization` | `86b38a67` | main | no | MERGEABLE / CLEAN | all required checks pass |
| #1089 | feat(alerts): add the AlertHost arbiter and cause-keyed store | `feat/alert-host-arbiter` | `bcddf5ef` | main | no | MERGEABLE / CLEAN | all required checks pass |
| #1090 | fix(deps): pin react-dom to 19.2.3 to match react | `fix/react-dom-pin` | `e060bed3` | main | no | MERGEABLE / CLEAN | all required checks pass |
| #1091 | docs(providers): record cursor-cli history indexing [skip-ci] | `feat/cursor-cli-history` | `029bf7d8` | main | no | MERGEABLE / CLEAN | all required checks pass |

Drafts in the set: **none**.

### Deliberate exclusions

| PR | Why excluded | Standing or one-off? |
|---|---|---|
| #952 `chore(deps-dev): bump @react-native/jest-preset 0.86.3 → 0.87.1` | CI red (Unit, Integration, i18n, E2E). Nothing in the included set repairs an RN 0.87 bump. Same exclusion as the 2026-09-12 rehearsal. | one-off — revisit once green |
| #1039 `chore(deps): bump react-native 0.86.3 → 0.87.1` | CI red (Type check, Unit, Integration, and more). Same as #952; pairing a red RN bump with product PRs would make every checkpoint uninterpretable. | one-off — revisit once green |

### Extra branches included (non-PR)

| Branch | SHA | Why included | Has a PR? |
|---|---|---|---|
| — none | | | |

## 4. Order plan

**Planned order:** `#1085 → #1088 → #1089 → #1090 → #1091` — chronological by `createdAt`. All five heads are not ancestors of each other (`git merge-base --is-ancestor` pairwise false). All `baseRefName=main`. No stacking.

File overlap (not stacking; sweep required even if git does not flag):

- #1085 ∩ #1089: `components/servers/ServerStateMessage.tsx`, `__tests__/unit/components/servers/ServerStateMessage.i18n.test.tsx`

### Stacked PRs

| Child PR | Stacked on | Base branch | Commits unique to the child | Risk if merged out of order |
|---|---|---|---|---|
| — none | | | | |

### Forced-order constraints (not chronological)

| Must land | Before/after | Reason | What breaks if ignored |
|---|---|---|---|
| — none | | | chronological already puts the overlapping #1089 after #1085, so its rebase absorbs the collision |

### Order changes made mid-run

| When | Moved | From → to | Trigger |
|---|---|---|---|
| — none | | | |

## 5. Action log (chronological)

### 20:06 — worktree already at `origin/main`

- **Command:** `git status --porcelain && git rev-parse HEAD`
- **Result:** porcelain empty; HEAD `72fd3970` (`72fd39709eee638ae8582f0ba903fbb1a9e202c5`). Branch `integration/2026-09-14-open-prs`, upstream unset.
- **Note:** flow A — rehearsal, origin read-only. `npm ci` already completed with Node v24.15.0.

### 20:09 — re-fetched origin; confirmed stacking

- **Command:** `git fetch origin && git rev-parse origin/main`
- **Result:** still `72fd39709eee638ae8582f0ba903fbb1a9e202c5`
- **Command:** pairwise `git merge-base --is-ancestor refs/integration/pr/<a> refs/integration/pr/<b>` for {1085,1088,1089,1090,1091}
- **Result:** none are ancestors of any other. No stacks.
- **Command:** `git ls-remote --heads origin | grep -c "integration/2026-09-14-open-prs"`
- **Result:** `0`

### 20:09 — fetched PR heads already present in private namespace

| PR | Ref | SHA |
|---|---|---|
| #1085 | `refs/integration/pr/1085` | `b359c2bfeab19604fa506e4f1d72ecfa170e0f9f` |
| #1088 | `refs/integration/pr/1088` | `86b38a67d2f044daae2f3351ec49c670aaf27df6` |
| #1089 | `refs/integration/pr/1089` | `bcddf5ef53847530b1dc3379b0123f3df12efc2b` |
| #1090 | `refs/integration/pr/1090` | `e060bed3492dc1fda2c889a10ace8a528a446aaa` |
| #1091 | `refs/integration/pr/1091` | `029bf7d84f921ff49b5cbd5000c3b00460b9961c` |

### 20:09 — baseline lint + typecheck + unit + integration + i18n + scripts on `main`

- **Command:** `npm run lint && npm run typecheck && npm run test:unit && npm run test:integration && npm run test:i18n && npm run test:scripts`
- **Result:** all green. Unit 2147 / 212 suites, integration 531 / 71, i18n 460 passed / 1 skipped (1211 keys, no unused), scripts 235 / 39. Host load was high; worker force-exits noted (known jest leak, not failures).

### 20:13 — #1085 CI re-read immediately before cut

- **Command:** `gh pr view 1085 --json statusCheckRollup,mergeStateStatus`
- **Result:** MERGEABLE / CLEAN. Required Lint, Type check, Unit tests, Integration tests, i18n, Native deps, E2E jest all SUCCESS. Head still `b359c2bf`. `git ls-remote --heads origin feat/web-e2ee-webcrypto` present.

### 20:13 — cut INT from #1085 and rebase onto `origin/main`

- **Command:** `git checkout -B integration/2026-09-14-open-prs refs/integration/pr/1085 && git rebase origin/main`
- **Result:** rebased 2/2, no conflict. Head `b359c2bf` → `98a80d6e`. Two commits: `b9df8974 feat(e2ee): pair and connect encrypted from the web client`, `98a80d6e fix(e2ee): name a protocol mismatch on the server row`. Upstream still unset.

### 20:13 — checkpoint after #1085

- **Command:** `npm run lint && npm run typecheck && npm run test:unit && npm run test:integration && npm run test:i18n`
- **Result:** all green. Unit 2175 / 214 suites (+28 tests, +2 suites vs baseline), integration 533 / 71 (+2), i18n 1218 keys / 460 passed / 1 skipped. Diff scope identical to `gh pr diff 1085 --name-only` (41 files).

### 20:16 — #1088 CI re-read immediately before rebase

- **Command:** `gh pr view 1088 --json statusCheckRollup,mergeStateStatus`
- **Result:** MERGEABLE / CLEAN. Required checks SUCCESS. Head still `86b38a67`. Remote `ci/e2e-runtime-optimization` present.

### 20:16 — rebase #1088 onto INT tip, then merge

- **Command:** `git checkout -B rebase/pr-1088 refs/integration/pr/1088 && git rebase integration/2026-09-14-open-prs`
- **Result:** conflict-free (1/1). `86b38a67` → `19d989a0`. Diff scope identical to `gh pr diff 1088 --name-only` (15 files).
- **Command:** `git merge --no-ff rebase/pr-1088 -m "integrate PR #1088: ci(e2e): speed mock suite with arm64 builds, caches, and weighted shards"`
- **Result:** `Merge made by the 'ort' strategy.` 15 files. Hook accepted.
- **Branch SHA after:** `ed471d0d`

### 20:16 — checkpoint after #1088

- **Command:** `npm run lint && npm run typecheck && npm run test:unit && npm run test:integration && npm run test:i18n && npm run test:scripts`
- **Result:** all green. Unit 2175 / 214 (same as #1085), integration 533, i18n unchanged, scripts 253 / 40 suites (+18 tests, +1 suite vs baseline 235/39).

### 20:19 — #1089 CI re-read immediately before rebase

- **Command:** `gh pr view 1089 --json statusCheckRollup,mergeStateStatus`
- **Result:** MERGEABLE / CLEAN. Required checks SUCCESS. Head still `bcddf5ef`. Remote `feat/alert-host-arbiter` present.

### 20:19 — rebase #1089 onto INT tip, then merge

- **Command:** `git checkout -B rebase/pr-1089 refs/integration/pr/1089 && git rebase integration/2026-09-14-open-prs`
- **Result:** conflict-free (1/1) despite overlapping files — git auto-merged distinct hunks. `bcddf5ef` → `f28fff65`. Diff scope identical to `gh pr diff 1089 --name-only` (36 files).
- **Command:** `git merge --no-ff rebase/pr-1089`
- **Result:** `Merge made by the 'ort' strategy.` 36 files.
- **Branch SHA after:** `b040e81d`

### 20:20 — semantic sweep of overlap (git did not flag)

- `components/servers/ServerStateMessage.tsx`: #1085 `e2eeProtocolMismatch` / `protocolMismatch` / `e2ee_protocol_mismatch` **and** #1089 `useAlertSync` + AlertSpec wiring both present. `useToastSync` from the #1085 head is correctly gone (replaced by #1089).
- `__tests__/unit/components/servers/ServerStateMessage.i18n.test.tsx`: #1085 protocol-mismatch test **and** #1089 `useAlertStore` + `ToastViewport` both present.
- `app/_layout.tsx` mounts `<AlertHost />`. Locale keys `stateMessage.e2eeProtocolMismatch*` remain in en/he/ar/ru `servers.json`.

### 20:20 — checkpoint after #1089

- **Command:** `npm run lint && npm run typecheck && npm run test:unit && npm run test:integration && npm run test:i18n && npm run test:scripts`
- **Result:** lint green; typecheck **red** — `ServerStateMessage.tsx` TS2741: `namedId` missing on the two `e2eeProtocolMismatch` returns that #1085 added and #1089's required return type did not cover. Git raised no marker.

### 20:21 — INT follow-up: supply `namedId` on those returns

- **Command:** edit `components/servers/ServerStateMessage.tsx` to add `namedId: only` (all-unhealthy) and `namedId: protocolMismatch.length === 1 ? protocolMismatch[0] : null` (partial), matching sibling `unreachable`/`fetchFailed` returns. Commit `e8795ed1` `fix(alerts): pass namedId through e2ee protocol-mismatch returns`.
- **Command:** `npm run typecheck` after the edit → green.

### 20:22 — checkpoint after #1089 + namedId follow-up

- **Command:** `npm run lint && npm run typecheck && npm run test:unit && npm run test:integration && npm run test:i18n && npm run test:scripts`
- **Result:** all green. Unit 2187 / 215 (+12 tests, +1 suite vs #1088), integration 533, i18n 1222 keys / 460 passed / 1 skipped, scripts 253 / 40.

### 20:24 — #1090 CI re-read immediately before rebase

- **Command:** `gh pr view 1090 --json statusCheckRollup,mergeStateStatus`
- **Result:** required checks still SUCCESS. `mergeStateStatus` **UNKNOWN**. PR **MERGED** at 17:28 UTC (`58bbd07a` on origin/main). Head branch `fix/react-dom-pin` deleted on origin. Local `origin/main` left at cut point `72fd3970` (did not fetch mid-run). Rehearsal still replays the fetched `refs/integration/pr/1090` (`e060bed3`) onto INT.

### 20:24 — rebase #1090 onto INT tip, then merge

- **Command:** `git checkout -B rebase/pr-1090 refs/integration/pr/1090 && git rebase integration/2026-09-14-open-prs`
- **Result:** conflict-free (1/1). `e060bed3` → `95e259df`. Diff scope identical to `gh pr diff 1090 --name-only` (2 files: `package.json`, `package-lock.json`).
- **Command:** `git merge --no-ff rebase/pr-1090`
- **Result:** `Merge made by the 'ort' strategy.` 2 files. `react-dom` 19.2.8 → 19.2.3. Hook accepted.
- **Branch SHA after:** `68aa7d39`

### 20:24 — `npm ci` after lock change + native-deps

- **Command:** `npm ci && npm run check:native-deps`
- **Result:** 1437 packages added; `react-dom` now 19.2.3; `✓ no duplicate native modules`. No `pod install` (JS-only pin).

### 20:25 — checkpoint after #1090

- **Command:** `npm run lint && npm run typecheck && npm run test:unit && npm run test:integration && npm run test:i18n && npm run test:scripts`
- **Result:** all green. Same counts as after #1089 follow-up: unit 2187 / 215, integration 533, i18n 1222 keys / 460p/1s, scripts 253 / 40. `check:native-deps` green.

### 20:27 — #1091 CI re-read immediately before rebase

- **Command:** `gh pr view 1091 --json statusCheckRollup,mergeStateStatus`
- **Result:** OPEN. Required checks SUCCESS. `mergeStateStatus` UNKNOWN (GitHub). Head `029bf7d8` still on `feat/cursor-cli-history`. Docs/skills only.

### 20:27 — rebase #1091 onto INT tip, then merge

- **Command:** `git checkout -B rebase/pr-1091 refs/integration/pr/1091 && git rebase integration/2026-09-14-open-prs`
- **Result:** conflict-free (2/2). `029bf7d8` → `8a790913`. Diff scope identical to `gh pr diff 1091 --name-only` (2 files).
- **Command:** `git merge --no-ff rebase/pr-1091`
- **Result:** `Merge made by the 'ort' strategy.` 2 files.
- **Branch SHA after:** `d9918adb`

### 20:27 — checkpoint after #1091

- **Command:** `npm run lint && npm run typecheck && npm run test:unit && npm run test:integration && npm run test:i18n && npm run test:scripts`
- **Result:** all green. Same counts as after #1090: unit 2187 / 215, integration 533, i18n 1222 keys / 460 passed / 1 skipped, scripts 253 / 40.

### 20:39 — coverage gate + no-push proof

- **Command:** for each PR, `gh pr diff <n> --name-only` vs `git cat-file -e HEAD:<file>`
- **Result:** #1085 41/41 present; #1088 15/15; #1090 2/2; #1091 2/2. #1089 reports two "missing" deleted paths (`__tests__/unit/stores/toasts.test.ts`, `hooks/useToastSync.ts`) — false negatives; the PR deleted them in favour of `alerts.test.ts` / `useAlertSync.ts`, both present.
- **Command:** `git ls-remote --heads origin | grep integration/2026-09-14-open-prs`
- **Result:** count **0**. Branch is 12 commits ahead of cut-point `72fd3970`. During the run origin/main advanced to `58bbd07a` (`fix(deps): pin react-dom to 19.2.3 to match react (#1090)`); this flow did not fetch or push. Prior local INT `integration/2026-09-12-open-prs` was left in place and was never on origin.

## 6. Per-PR record

### #1085 — feat(e2ee): pair and connect encrypted from the web client

| Field | Value |
|---|---|
| Head before / after rebase | `b359c2bf` → `98a80d6e` |
| Rebased onto | `origin/main` `72fd3970` |
| Conflicts | none — `Successfully rebased` (2/2) |
| Diff scope after rebase | identical to `gh pr diff 1085 --name-only` (41 files) |
| Integration SHA after merge | `98a80d6e` (the cut itself) |
| Verification | lint · typecheck · unit 2175 · integration 533 · i18n green |
| Obstacles | — none |
| Time | ~2 min cut + ~2 min suite |

### #1088 — ci(e2e): speed mock suite with arm64 builds, caches, and weighted shards

| Field | Value |
|---|---|
| Head before / after rebase | `86b38a67` → `19d989a0` |
| Rebased onto | INT tip `98a80d6e` (after #1085) |
| Conflicts | none — `Successfully rebased` (1/1) |
| Diff scope after rebase | identical to `gh pr diff 1088 --name-only` (15 files) |
| Integration SHA after merge | `ed471d0d` |
| Verification | lint · typecheck · unit 2175 · integration 533 · i18n green · scripts 253 |
| Obstacles | — none |
| Time | ~2 min rebase + ~2 min suite |

### #1089 — feat(alerts): add the AlertHost arbiter and cause-keyed store

| Field | Value |
|---|---|
| Head before / after rebase | `bcddf5ef` → `f28fff65` |
| Rebased onto | INT tip `ed471d0d` (after #1088) |
| Conflicts | none — `Successfully rebased` (1/1); silent type hole caught at checkpoint |
| Diff scope after rebase | identical to `gh pr diff 1089 --name-only` (36 files) |
| Integration SHA after merge | `b040e81d`; after INT follow-up `e8795ed1` |
| Verification | lint · typecheck (after follow-up) · unit 2187 · integration 533 · i18n green · scripts 253 |
| Obstacles | O1 — silent missing `namedId` on e2ee returns |
| Time | ~1 min rebase + typecheck fail + follow-up + ~2 min suite |

### #1090 — fix(deps): pin react-dom to 19.2.3 to match react

| Field | Value |
|---|---|
| Head before / after rebase | `e060bed3` → `95e259df` |
| Rebased onto | INT tip `e8795ed1` (after #1089 namedId follow-up) |
| Conflicts | none — `Successfully rebased` (1/1) |
| Diff scope after rebase | identical to `gh pr diff 1090 --name-only` (2 files) |
| Integration SHA after merge | `68aa7d39` |
| Verification | lint · typecheck · unit 2187 · integration 533 · i18n green · scripts 253 · native-deps pass |
| Obstacles | O2 — PR merged to origin/main mid-rehearsal; head branch deleted; still replayed from private ref |
| Time | ~1 min rebase + 25s `npm ci` + ~2 min suite |

### #1091 — docs(providers): record cursor-cli history indexing [skip-ci]

| Field | Value |
|---|---|
| Head before / after rebase | `029bf7d8` → `8a790913` |
| Rebased onto | INT tip `68aa7d39` (after #1090) |
| Conflicts | none — `Successfully rebased` (2/2) |
| Diff scope after rebase | identical to `gh pr diff 1091 --name-only` (2 files) |
| Integration SHA after merge | `d9918adb` |
| Verification | lint · typecheck · unit 2187 · integration 533 · i18n green · scripts 253 |
| Obstacles | — none |
| Time | ~1 min rebase + ~2 min suite |

## 7. Conflict ledger

— none (git raised zero markers)

### Judgment calls in full

— none. The `namedId` hole was not a conflict marker; it is recorded in §8. The fix matched sibling returns (`unreachable` / `fetchFailed`) and discarded nothing from either PR.

## 8. Semantic conflicts — problems git did *not* flag

Overlap existed and git produced a union that did not typecheck. Sweep of the two overlapping files confirmed both sides' additions survived; typecheck then found the hole.

| # | Where | What was silently lost/changed | Found how | Fix |
|---|---|---|---|---|
| S1 | `components/servers/ServerStateMessage.tsx` | #1085's two `e2eeProtocolMismatch` returns omitted `namedId`, which #1089 made required on the `useMemo` return type | `npm run typecheck` after #1089 (TS2741) | INT follow-up `e8795ed1`: add `namedId: only` and `namedId: protocolMismatch.length === 1 ? protocolMismatch[0] : null` |

No whole-file `--ours`/`--theirs`. No functions moved/extracted. `useToastSync` → `useAlertSync` is #1089's intended replacement, not a loss.

## 9. Obstacles and detours

### O1 — silent missing `namedId` on e2ee protocol-mismatch returns

- **Symptom:** typecheck red after a conflict-free rebase of #1089 onto #1085.
- **Cause:** git auto-merged distinct hunks; #1085 added two return objects without a field #1089 later required.
- **Fix on INT:** `e8795ed1`. Real run (Flow C) must replay this after #1089, or land an equivalent on #1085/#1089 first.
- **Recurs?** yes — any later PR that tightens a return type while an earlier overlapping PR added new branches.

### O2 — #1090 merged to origin while the rehearsal was in flight

- **Symptom:** immediately before taking #1090, `mergeStateStatus` UNKNOWN, head branch gone, PR MERGED at 17:28 UTC. origin/main on the remote became `58bbd07a`.
- **Cause:** someone else squash-merged #1090. Shared-repo `origin/main` later showed that SHA; this flow did not fetch as a write and did not push.
- **Fix:** replayed `refs/integration/pr/1090` onto the cut-point INT anyway so the rehearsal still contains the pin against `72fd3970`.
- **Recurs?** yes — Dependabot/small PRs land during a long rehearsal.

## 10. Verification checkpoints

Ahead counts are vs cut-point `72fd3970`, not vs origin/main after #1090 landed.

| Checkpoint | Integration SHA | Commits ahead of cut-point | lint | typecheck | unit | integration | i18n | scripts | native-deps | Δ vs baseline |
|---|---|---|---|---|---|---|---|---|---|---|
| baseline `main` | `72fd3970` | 0 | green | green | 2147 | 531 | 460p/1s | 235 / 39 | skipped | — |
| after #1085 | `98a80d6e` | 2 | green | green | 2175 | 533 | same | not run | skipped | +28 unit, +2 integration, +7 i18n keys |
| after #1088 | `ed471d0d` | 4 | green | green | 2175 | 533 | same | 253 / 40 | skipped | +28 unit, +2 integration, +18 scripts |
| after #1089 | `b040e81d` | 6 | green | **red** TS2741 namedId | — | — | — | — | skipped | typecheck fail; did not continue |
| after #1089 + namedId follow-up | `e8795ed1` | 7 | green | green | 2187 | 533 | same | 253 / 40 | skipped | +40 unit, +2 integration, +18 scripts, +11 i18n keys |
| after #1090 | `68aa7d39` | 9 | green | green | 2187 | 533 | same | 253 / 40 | pass | same as previous; react-dom 19.2.3 |
| after #1091 | `d9918adb` | 12 | green | green | 2187 | 533 | same | 253 / 40 | not re-run | same as #1090 |

## 11. Decisions, open questions, deferrals

| # | Decision | Alternatives considered | Reversible? | Owner |
|---|---|---|---|---|
| D1 | Flow A (rehearsal). Do not push, merge on GitHub, or rewrite PR heads. | B | yes | operator |
| D2 | Exclude #952 and #1039 (red RN 0.87 Dependabot). Include #1085, #1088, #1089, #1090, #1091. | include the red bumps and halt at first red checkpoint | yes | operator |
| D3 | Run `test:scripts` at baseline and from #1088 onward. Run `check:native-deps` after #1090. Do not `pod install` unless native lock actually changes. | skip scripts at baseline | yes | operator |
| D4 | After #1090 landed on origin mid-run, still replay it onto the cut-point INT from the private ref. | skip #1090 because it is already on origin/main | yes | operator |
| D5 | Commit INT follow-up `e8795ed1` so later rebases see a green tree. | leave the namedId fix uncommitted | yes | operator |

## 12. Coverage gate

| PR | `gh pr diff --name-only` vs branch | Verdict |
|---|---|---|
| #1085 | all 41 files present | included. `ServerStateMessage.tsx` / i18n test later edited by #1089 + `e8795ed1` (false negative if comparing content to the #1085 head) |
| #1088 | all 15 files present | included |
| #1089 | 34/36 path names present; two "missing" are deletions (`toasts.test.ts`, `useToastSync.ts`) | included. Replacements `stores/alerts.ts`, `hooks/useAlertSync.ts`, `alerts.test.ts` present |
| #1090 | all 2 files present | included (also now on origin/main as `58bbd07a`) |
| #1091 | all 2 files present | included |

`git ls-remote --heads origin | grep integration/2026-09-14-open-prs` → **0** (flow A held).

