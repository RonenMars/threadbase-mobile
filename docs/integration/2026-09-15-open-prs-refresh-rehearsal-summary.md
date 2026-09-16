# Integration summary — integration/2026-09-14-open-prs (2026-09-15 refresh) — REHEARSAL

**Verdict:** locally composable; #1094 BLOCKED and #1095–#1099 UNSTABLE on GitHub; #1100 and #1101 green; #952/#1039 still out
**Branch:** `integration/2026-09-14-open-prs` @ `f341bc57` — 2026-09-15 refresh plus stacked alerts through #1099 plus #1094 wait-duration unique plus INT pathTail plus #1100 plus #1101
**CI:** not run on this branch. After #1101: targeted `ProviderMark|providers.test` 5/5. After #1100: targeted `NowList|rowTitle|displayTitle` 70/70. Prior full checkpoint (wait-duration unique): lint + typecheck green. Unit 2239. Integration 522 / 71 suites. i18n 460 passed / 1 skipped.
**Full log:** [2026-09-15-open-prs-refresh-rehearsal-log.md](2026-09-15-open-prs-refresh-rehearsal-log.md)

Refresh of [2026-09-14-open-prs-rehearsal-summary.md](2026-09-14-open-prs-rehearsal-summary.md). Stacked alerts #1089→#1099, session-list #1094, quiet-row unify #1100, provider-color unify #1101. Standing exclusions #952 and #1039 unchanged. Nothing pushed.

## 1. Final refs

| What | Ref | SHA |
|---|---|---|
| Integration branch | `integration/2026-09-14-open-prs` | `f341bc57` plus docs |
| Cut from | `origin/main` | `58bbd07a` (#1090 already on main) |
| Worktree | `../tb-mobile-worktrees/int-2026-09-14` | restored from `14ab6248` after directory loss |

`git ls-remote --heads origin | grep -c integration/2026-09-14-open-prs` → **0**.

## 2. What is in the branch

| PR | Title | Effect in one line |
|---|---|---|
| #1085–#1091 | (already on 2026-09-14 INT) | plus #1088 Android SDK skip, #1091 cursor rename |
| #1092 | feat(alerts): route errors and warnings to a header status pill | header StatusPill; per-server alert rows |
| #1093 | feat(alerts): replace ErrorRecoverySheet with the Status sheet | Status sheet replaces ErrorRecoverySheet |
| #1094 | feat(sessions): close the session-list spec gaps | hub/now/tree spec gaps, title recovery, coloured marks, Needs-you wait duration |
| #1100 | feat(sessions): render command and identity titles as normal history rows | drop QuietRow; command/identity titles use compact EarlierRow; quiet tail still folds ≥6 |
| #1101 | refactor(sessions): unify provider colors on PROVIDER_COLOR | one `PROVIDER_COLOR` object; theme.brand re-exports it |
| #1095 | feat(alerts): report in-scope failures inline first | inline server failure panels; stale-scope banner; drop ServerOfflineBanner |
| #1096 | feat(alerts): route blocking decisions through CriticalDialog | CriticalDialog for blocking decisions |
| #1097 | feat(alerts): demote host-pressure, server status, and raw-mode | those surfaces become Status-sheet rows / toasts |
| #1098 | feat(alerts): drop viewport now that toasts are a single surface | ToastViewport no longer a second alert surface |
| #1099 | feat(alerts): fold leftover surfaces into the routed system | delete ServerErrorBanner / AlertDetailsModal; route SlowQuery/CacheAlert |
| INT | ProviderMark/FAB + alert test mocks | cursor id + ThemeProvider; lastError/AuthError mocks; drop `onViewDetails` |
| INT | pathTail | null-safe `pathSegments` / `basename` / `shortPath` |

### Not included

#952, #1039 — red RN 0.87 Dependabot, same as 2026-09-12/14.

## 3. The order that actually worked

`#1088 unique → #1091 unique → #1092 → #1093 → #1094 → INT follow-up → #1095 → #1096 → INT follow-up → #1097 → #1098 → #1099 → INT follow-up → #1094 wait-duration unique → INT pathTail → #1100 → #1101`

## 4. Conflicts that mattered

Three judgment calls: #1092 vs #1085 `ServerStateMessage`; #1095 vs #1094 NowList; #1099 delete of unused `ServerErrorBanner` (INT lastError patch dies with it). #1100 vs #1095 NowList is mechanical: keep stale opacity, drop `quiet`. #1101 vs #1091 is mechanical: keep `cursor` / `CURSOR_PROVIDER` and switch colors to `PROVIDER_COLOR`. #1097/#1098 clean. Rest mechanical.

## 5. Silent problems found

#1094 ProviderMark/FAB tests. #1095 hub `lastError` mock. #1096 search-anchor `AuthError`. #1097 dropped `onViewDetails` while INT i18n test still passed it. #1101 `providers.test.ts` still said `CURSOR_CLI_PROVIDER` after a clean auto-merge. GitHub can stay UNSTABLE/BLOCKED while INT is green after the follow-ups.

## 6. Verification

| | 2026-09-14 INT | After #1094 wait-duration unique |
|---|---|---|
| lint | green | green |
| typecheck | green | green |
| unit | 2187 | 2239 |
| integration | 533 | 522 / 71 suites |
| i18n | 460 / 1 skipped | 460 / 1 skipped |
| scripts | 253 | 254 tests; lint-shards host `expo-env.d.ts`; `run-maestro` batch flake |

## 7. Next

Ask before Flow C. Replay ledger 1 if #1092 is rebuilt; 8–16 if #1095; 17 if #1099; 18 if #1100; 19–23 if #1101. Keep excluding #952/#1039.
