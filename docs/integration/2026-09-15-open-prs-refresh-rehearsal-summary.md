# Integration summary — integration/2026-09-14-open-prs (2026-09-15 refresh) — REHEARSAL

**Verdict:** locally composable; #1094 is BLOCKED on GitHub; #952/#1039 still out
**Branch:** `integration/2026-09-14-open-prs` — refresh of the 2026-09-14 rehearsal plus #1092/#1093/#1094 and unique commits on #1088/#1091
**CI:** not run on this branch. Local after INT follow-up: lint + typecheck green. Unit 2212 after follow-up (3 tests were red until the follow-up). Integration 513, i18n 460 passed / 1 skipped, scripts 254.
**Full log:** [2026-09-15-open-prs-refresh-rehearsal-log.md](2026-09-15-open-prs-refresh-rehearsal-log.md)

Refresh of [2026-09-14-open-prs-rehearsal-summary.md](2026-09-14-open-prs-rehearsal-summary.md). New stacked alert PRs #1092→#1093, session-list #1094, and cursor/e2e updates. Standing exclusions #952 and #1039 unchanged. Nothing pushed.

## 1. Final refs

| What | Ref | SHA |
|---|---|---|
| Integration branch | `integration/2026-09-14-open-prs` | follow-up + docs on top of `14ab6248` |
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
| INT | ProviderMark/FAB tests | cursor id + ThemeProvider; FAB RTL assertion on the positioned parent |

### Not included

#952, #1039 — red RN 0.87 Dependabot, same as 2026-09-12/14.

## 3. The order that actually worked

`#1088 unique → #1091 unique → #1092 → #1093 → #1094 → INT follow-up`

## 4. Conflicts that mattered

One judgment call: #1092 vs #1085 `ServerStateMessage` — keep per-server rows, keep e2ee protocol-mismatch classification. Rest mechanical (`app/index.tsx` pill + spec-gap FAB; locale All/Some drop).

## 5. Silent problems found

#1094's ProviderMark test used `cursor-cli` and no ThemeProvider; FAB test still targeted the inner hit style. Both are why GitHub can stay BLOCKED while INT is green after the follow-up.

## 6. Verification

| | 2026-09-14 INT | After refresh (follow-up) |
|---|---|---|
| lint | green | green |
| typecheck | green | green (red after #1094 until follow-up) |
| unit | 2187 | 2212 (3 failed until follow-up; isolated re-run passed) |
| integration | 533 | 513 (SessionCard suites removed by #1094; DrillView added) |
| i18n | 460 / 1 skipped | 460 / 1 skipped |
| scripts | 253 | 254 |

## 7. Next

Ask before Flow C. Replay ledger 1 if #1092 is rebuilt. Keep excluding #952/#1039.
