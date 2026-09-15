# Integration summary — integration/2026-09-14-open-prs (2026-09-15 refresh) — REHEARSAL

**Verdict:** locally composable; #1094 BLOCKED and #1095/#1096 UNSTABLE on GitHub; #952/#1039 still out
**Branch:** `integration/2026-09-14-open-prs` — 2026-09-15 refresh plus stacked alerts through #1096
**CI:** not run on this branch. Local after second INT follow-up: lint + typecheck green. Unit 2223. Integration: the two real #1095/#1096 holes pass isolated after follow-up; `conversation-live-view` batch fail was a load artifact. i18n 460 passed / 1 skipped. Scripts: integration-shards green after assigning the new file; `run-maestro` batch fail isolated-pass; `ci-lint-shards` red locally from gitignored `expo-env.d.ts` (host, not these PRs).
**Full log:** [2026-09-15-open-prs-refresh-rehearsal-log.md](2026-09-15-open-prs-refresh-rehearsal-log.md)

Refresh of [2026-09-14-open-prs-rehearsal-summary.md](2026-09-14-open-prs-rehearsal-summary.md). Stacked alerts #1089→#1096, session-list #1094, cursor/e2e updates. Standing exclusions #952 and #1039 unchanged. Nothing pushed.

## 1. Final refs

| What | Ref | SHA |
|---|---|---|
| Integration branch | `integration/2026-09-14-open-prs` | `24616675` plus INT follow-up / docs commits |
| Cut from | `origin/main` | `58bbd07a` (#1090 already on main) |
| Worktree | `../tb-mobile-worktrees/int-2026-09-14` | restored from `14ab6248` after directory loss |

`git ls-remote --heads origin | grep -c integration/2026-09-14-open-prs` → **0**.

## 2. What is in the branch

| PR | Title | Effect in one line |
|---|---|---|
| #1085–#1091 | (already on 2026-09-14 INT) | plus #1088 Android SDK skip, #1091 cursor rename |
| #1092 | feat(alerts): route errors and warnings to a header status pill | header StatusPill; per-server alert rows |
| #1093 | feat(alerts): replace ErrorRecoverySheet with the Status sheet | Status sheet replaces ErrorRecoverySheet |
| #1094 | feat(sessions): close the session-list spec gaps | hub/now/tree spec gaps, title recovery, coloured marks |
| #1095 | feat(alerts): report in-scope failures inline first | inline server failure panels; stale-scope banner; drop ServerOfflineBanner |
| #1096 | feat(alerts): route blocking decisions through CriticalDialog | CriticalDialog for blocking decisions |
| INT | ProviderMark/FAB + alert test mocks | cursor id + ThemeProvider; FAB parent; lastError/AuthError mocks; shard assignment |

### Not included

#952, #1039 — red RN 0.87 Dependabot, same as 2026-09-12/14.

## 3. The order that actually worked

`#1088 unique → #1091 unique → #1092 → #1093 → #1094 → INT follow-up → #1095 → #1096 → INT follow-up`

## 4. Conflicts that mattered

Two judgment calls: #1092 vs #1085 `ServerStateMessage` (per-server rows + e2ee protocol-mismatch); #1095 vs #1094 NowList (warming/CantResume/FAB + inline failure panels). Rest mechanical (locale hashes, prop unions).

## 5. Silent problems found

#1094's ProviderMark test used `cursor-cli` and no ThemeProvider; FAB test still targeted the inner hit style. #1095's hub test omitted `wsManager.lastError`. #1096's `instanceof AuthError` broke search-anchor's partial api-client mock. GitHub can stay UNSTABLE/BLOCKED while INT is green after the follow-ups.

## 6. Verification

| | 2026-09-14 INT | After refresh + #1095/#1096 |
|---|---|---|
| lint | green | green |
| typecheck | green | green |
| unit | 2187 | 2223 |
| integration | 533 | 520 in batch (3 failed); 2 real, 1 load artifact; both real pass isolated after follow-up |
| i18n | 460 / 1 skipped | 460 / 1 skipped |
| scripts | 253 | 254 tests; integration-shards green after follow-up; lint-shards host `expo-env.d.ts` |

## 7. Next

Ask before Flow C. Replay ledger 1 if #1092 is rebuilt; replay ledger 8–16 if #1095 is rebuilt. Keep excluding #952/#1039.
