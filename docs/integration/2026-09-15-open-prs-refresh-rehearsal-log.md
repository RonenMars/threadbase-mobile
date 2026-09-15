# Integration merge log — integration/2026-09-14-open-prs (2026-09-15 refresh)

**Status:** complete
**Goal:** refresh the 2026-09-14 local rehearsal with new commits and new open PRs (except standing RN 0.87 exclusions). Nothing is pushed.
**Operator:** operator  **Repo:** tb-mobile  **Log started:** 2026-09-15 07:16 IDT

Prior rehearsal: [2026-09-14-open-prs-rehearsal-log.md](2026-09-14-open-prs-rehearsal-log.md)

## 1. Provenance and refs

| What | Ref | SHA | Note |
|---|---|---|---|
| Cut point (2026-09-14) | `origin/main` | `72fd3970` then `58bbd07a` | #1090 squash landed on main during the first rehearsal |
| Prior INT product tip | `integration/2026-09-14-open-prs` | `d9918adb` / docs `33aeb275` | |
| Integration branch after refresh | `integration/2026-09-14-open-prs` | see §6 | local only; worktree restored from `14ab6248` after a mid-run directory loss |
| Worktree | `../tb-mobile-worktrees/int-2026-09-14` | | `npm ci` again after restore |

## 2. Baseline — INT at 2026-09-14 docs tip

Final 2026-09-14 checkpoint at `d9918adb`: lint green, typecheck green, unit 2187, integration 533, i18n 460/1 skipped, scripts 253.

## 3. Scope

| PR | Title | Head SHA | Base | Draft? | Mergeable | CI |
|---|---|---|---|---|---|---|
| #1085 | feat(e2ee): pair and connect encrypted from the web client | `b359c2bf` unchanged | main | no | MERGEABLE / BEHIND | skip |
| #1088 | ci(e2e): speed mock suite with arm64 builds, caches, and weighted shards | `f9706d72` (was `86b38a67`) | main | no | MERGEABLE / CLEAN | unique `f9706d72` |
| #1089 | feat(alerts): add the AlertHost arbiter and cause-keyed store | `bcddf5ef` unchanged | main | no | MERGEABLE / BEHIND | already on INT |
| #1090 | fix(deps): pin react-dom to 19.2.3 to match react | merged | main | no | MERGED | already on INT |
| #1091 | feat(conversations): canonicalize cursor and send list import filters | `e513e49f` (was `029bf7d8`) | main | no | MERGEABLE / BEHIND | unique `e513e49f` |
| #1092 | feat(alerts): route errors and warnings to a header status pill | `d265535b` **new** | #1089 | no | MERGEABLE / CLEAN | stacked |
| #1093 | feat(alerts): replace ErrorRecoverySheet with the Status sheet | `ed866281` **new** | #1092 | no | MERGEABLE / CLEAN | stacked |
| #1094 | feat(sessions): close the session-list spec gaps | `2bb27339` **new** | main | no | MERGEABLE / BLOCKED | included anyway |

### Deliberate exclusions

| PR | Why excluded | Standing or one-off? |
|---|---|---|
| #952 jest-preset 0.87.1 | CI red; nothing in the set repairs an RN 0.87 bump | one-off until green (same as 2026-09-12 / 2026-09-14) |
| #1039 react-native 0.87.1 | CI BLOCKED | same |

**Drafts:** none.

## 4. Order plan

**Planned / actual:** `#1088` unique → `#1091` unique → `#1092` → `#1093` → `#1094` → INT follow-up

Stacked: #1093 on #1092 on #1089. #1091 before #1094 because both touch `ProviderMark` / `types/api.ts`.

## 5. Action log

### 07:16 — #1088 unique commit

- **Command:** `git rebase --onto INT 4aa4b818` (drops the merge-of-main that duplicated #1090)
- **Result:** clean. Merge `da09049e`. Unique `3b201378` skip removed Android SDK tools package.

### 07:16 — #1091 unique commit

- **Command:** `git rebase --onto INT 029bf7d8`
- **Result:** clean. Merge `01ec3601`. `cursor-cli` → `cursor` plus list import filters.

### 07:17 — #1092 rebase conflict (ledger 1–5)

- **Command:** `git rebase --onto INT bcddf5ef`
- **Result:** conflicts in `ServerStateMessage.tsx` and four `locales/*/servers.json`. Resolution in §7. Merge `eae53e87`. Rebased unique `38fa855e`.

### 07:18 — #1093 rebase conflict (ledger 6)

- **Command:** `git rebase --onto INT d265535b`
- **Result:** conflict only in `locales/.source-hashes.json`. Merge `cbfda9a9`. Rebased unique `82e5d9d7`.

### 07:19 — #1094 rebase conflict (ledger 7)

- **Command:** `git rebase --onto INT origin/main` (3 commits)
- **Result:** conflict in `app/index.tsx` on commit 1; commits 2–3 clean. Merge `14ab6248`.

### ~07:24 — worktree directory vanished

- Branch name gone from `git branch`; SHA `14ab6248` still reachable. Recreated branch + worktree. `npm ci`. Origin still has no INT ref.

### 07:28 — checkpoint

- lint green. typecheck red: `cursor-cli` leftover in #1094 ProviderMark test/story; implicit any in the test helper. Unit: ProviderMark + FAB failed (3 tests). Integration 70/513, i18n 460+1 skipped, scripts 40/254.

### 07:32 — INT follow-up

- ProviderMark: wrap ThemeProvider + i18n; `cursor-cli` → `cursor`; FAB test reads the positioned parent. typecheck green; isolated suites pass.

### 12:20 — #1095 rebase conflict (ledger 8–16)

- **Command:** `git rebase --onto 39aadf8d` (unique `7653c38a`)
- **Result:** conflicts in NowList, hub types/list, `app/index.tsx`, four `sessions.json` + hashes, NowList tests. Resolution in §7. Merge `a650de03`. Rebased unique `17017213`.

### 12:21 — #1096 rebase

- **Command:** `git rebase --onto INT 7653c38a` (unique `0d186469`)
- **Result:** clean. Merge `24616675`. Rebased unique `a4efa150`.

### 12:25 — checkpoint

- lint green. typecheck green. Unit 2223. Integration batch 3 failed / 506 passed / 71 suites; isolated: `conversation-live-view` pass (load artifact); `home-inline-failures` and `conversation-search-anchor` real. i18n 460 passed / 1 skipped. Scripts batch 3 failed / 251 passed; isolated: `run-maestro` pass (flake); integration-shards real (new file); lint-shards host-only (`expo-env.d.ts` generated and gitignored, not from these PRs).
- Origin: `git ls-remote --heads origin | grep -c integration/2026-09-14-open-prs` → **0**

### 12:28 — INT follow-up (alerts × spec-gap tests)

- `home-inline-failures`: mock `wsManager.lastError` (INT `ServerStateMessage` from #1092).
- `conversation-search-anchor`: re-export `AuthError` from the api-client mock (#1096 `instanceof AuthError`).
- `scripts/ci-integration-test-shards.json`: assign `home-inline-failures.test.tsx`. Isolated suites green; NowList 13/13 (both #1094 and #1095 cases).

## 6. Per-PR record

### #1088 update

| Field | Value |
|---|---|
| Unique commits | `f9706d72` → `3b201378` |
| Conflicts | none |
| Integration SHA | `da09049e` |

### #1091 update

| Field | Value |
|---|---|
| Unique commits | `e513e49f` → `4065437e` |
| Conflicts | none |
| Integration SHA | `01ec3601` |

### #1092

| Field | Value |
|---|---|
| Unique commits | `d265535b` → `38fa855e` |
| Conflicts | ledger 1–5 |
| Integration SHA | `eae53e87` |

### #1093

| Field | Value |
|---|---|
| Unique commits | `ed866281` → `82e5d9d7` |
| Conflicts | ledger 6 |
| Integration SHA | `cbfda9a9` |

### #1094

| Field | Value |
|---|---|
| Unique commits | `27892cde` `fc2518cf` `2bb27339` → `2a9e3ce2` `d577030d` `906fe3bc` |
| Conflicts | ledger 7 |
| Integration SHA | `14ab6248` |
| GitHub CI | BLOCKED; INT follow-up repairs the two unit holes that showed locally |

### #1095

| Field | Value |
|---|---|
| Unique commits | `7653c38a` → `17017213` |
| Conflicts | ledger 8–16 |
| Integration SHA | `a650de03` |
| GitHub CI | UNSTABLE; INT follow-up repairs the two integration holes that showed locally |

### #1096

| Field | Value |
|---|---|
| Unique commits | `0d186469` → `a4efa150` |
| Conflicts | none |
| Integration SHA | `24616675` |
| GitHub CI | UNSTABLE; `AuthError` mock hole in search-anchor is INT-only (the screen gained `instanceof AuthError` on this PR) |

## 7. Conflict ledger

| # | PR | File | What collided | Resolution | Class |
|---|---|---|---|---|---|
| 1 | #1092 | `ServerStateMessage.tsx` | #1085 aggregated e2ee `namedId` vs #1092 per-server rows | Keep #1092 rows + classify `e2ee_protocol_mismatch` as error | J |
| 2–5 | #1092 | `locales/{en,ar,he,ru}/servers.json` | All/Some keys vs per-row Named | Keep `e2eeProtocolMismatchNamed`; drop unused All/Some | M |
| 6 | #1093 | `locales/.source-hashes.json` | stale All/Some hashes vs #1093 bless | Keep Named e2ee hash; drop All/Some hashes | M |
| 7 | #1094 | `app/index.tsx` | HomeStatusPill vs spec-gap FAB/warming ids | Keep pill + `warmingServerIds` / `useHideOnScrollDown` | M |
| 8 | #1095 | `NowList.tsx` Props/destructure | warming/onNewSession/onScroll vs onRetryServer/onOpenStatus | Keep both | M |
| 9 | #1095 | `NowList.tsx` withRows | warming.has vs allFailed error rows | warming rows plus `!allFailed` error rows | J |
| 10 | #1095 | `NowList.tsx` deps | warming vs fetchStatuses | Keep both | M |
| 11 | #1095 | `NowList.tsx` renderItem | CantResume early-return vs stale opacity | CantResume first, then stale | J |
| 12 | #1095 | `app/index.tsx` imports | EmptyState/scrim/hide-on-scroll vs dropped EmptyState | Keep scrim + hide-on-scroll; drop unused EmptyState | M |
| 13 | #1095 | `app/index.tsx` list props | onNewSession/onScroll/warming vs onRetry/onOpenStatus | Keep both | M |
| 14 | #1095 | hub `types.ts` / `ProjectHubList.tsx` | same prop split as NowList | Keep both | M |
| 15 | #1095 | `locales/{en,ar,he,ru}/sessions.json` + hashes | #1094 retry copy vs #1095 stale-scope copy | Take #1095 `Can't reach any…` / hashes | M |
| 16 | #1095 | `NowList.test.tsx` | cant-resume/warming/empty vs failure-panel tests | Keep all five tests | M |

### Judgment call 1 in full

Kept #1092's per-server `classifyServer` (that is the PR). Discarded the aggregated `useMemo` that #1085/#1089 used, including INT follow-up `namedId` fields — each row now has its own `id`, so `namedId` is superseded. Re-inserted `lastError === 'e2ee_protocol_mismatch'` so the i18n test still names the machine. Signal the choice was wrong: protocol mismatch shows as generic "Disconnected from …".

## 8. Semantic conflicts

- #1091 ∩ #1094 `ProviderMark`: stories/tests still said `cursor-cli`. INT follow-up.
- #1094 FAB: `position:absolute; right:20` moved to the wrapper; test still read `fab-new-session` (the hit target). INT follow-up. testID stays on the button for Maestro.
- #1095 ∩ #1092 `home-inline-failures`: mock omitted `wsManager.lastError`. INT follow-up.
- #1096 ∩ search-anchor: `instanceof AuthError` against a mock that only re-exported `NotFoundError`. INT follow-up.
- #1095 new `home-inline-failures.test.tsx` was not in `ci-integration-test-shards.json`. INT follow-up.
- Host: gitignored `expo-env.d.ts` (mtime 2026-09-15 08:58) makes `ci-lint-shards` fail locally; not from these PRs; left alone.

### Judgment call 2 in full

#1095 vs #1094 on NowList: keep #1094 warming / CantResume / empty FAB / hide-on-scroll, and #1095 inline failure panels / stale opacity / allFailed banner. withRows includes a warming server even when every host is also in error, so history skeletons are not dropped behind the stale-scope banner.

## 10. Origin-absent proof

`git ls-remote --heads origin | grep -c integration/2026-09-14-open-prs` → **0** (re-checked after #1096)
