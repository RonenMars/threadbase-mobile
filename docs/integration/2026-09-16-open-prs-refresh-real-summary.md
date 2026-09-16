# Integration summary — integration/2026-09-14-open-prs (real run) (2026-09-16)

**Verdict:** published to origin; not landed
**Branch:** `origin/integration/2026-09-14-open-prs` @ `d4a27a51` — stacked alerts through #1099, session-list #1094, #1100, #1101, INT follow-ups; 56 commits ahead of `main` @ `58bbd07a`
**CI:** not triggered by this push (no PR opened). Last rehearsal targeted suites: `NowList|rowTitle|displayTitle` 70/70; `ProviderMark|providers.test` 5/5. Prior full checkpoint after #1094 wait-duration unique: lint + typecheck green, unit 2239, integration 522 / 71 suites, i18n 460 / 1 skipped.
**Full log:** [2026-09-16-open-prs-refresh-real-log.md](2026-09-16-open-prs-refresh-real-log.md) — cites [2026-09-15-open-prs-refresh-rehearsal-log.md](2026-09-15-open-prs-refresh-rehearsal-log.md)

This run replayed the 2026-09-15 refresh rehearsal on **tb-mobile only**. `origin/main` was unchanged. #1095–#1099 origin heads moved because the stacked alert PRs absorbed INT follow-ups; unique feat content was already on INT, so the rehearsal branch was reused as-is and pushed. No PR was opened and no merge to `main` occurred — both require separate explicit consent.

---

## 1. Final refs

| What | Ref | SHA |
|---|---|---|
| Integration branch | `origin/integration/2026-09-14-open-prs` | `d4a27a513496f612f7bf96d3fe41896874704924` |
| Cut from | `origin/main` | `58bbd07a` |
| Backup / archive | — none (fresh branch push) | |

---

## 2. What is in the branch

| PR | Title | Effect in one line |
|---|---|---|
| #1085–#1091 | (already on 2026-09-14 INT) | plus #1088 Android SDK skip, #1091 cursor rename |
| #1092 | feat(alerts): route errors and warnings to a header status pill | header StatusPill; per-server alert rows |
| #1093 | feat(alerts): replace ErrorRecoverySheet with the Status sheet | Status sheet replaces ErrorRecoverySheet |
| #1094 | feat(sessions): close the session-list spec gaps | hub/now/tree spec gaps, title recovery, coloured marks, Needs-you wait duration, pathTail |
| #1100 | feat(sessions): render command and identity titles as normal history rows | drop QuietRow and the quiet-tail fold |
| #1101 | refactor(sessions): unify provider colors on PROVIDER_COLOR | one `PROVIDER_COLOR` object; theme.brand re-exports it |
| #1095 | feat(alerts): report in-scope failures inline first | inline server failure panels; stale-scope banner |
| #1096 | feat(alerts): route blocking decisions through CriticalDialog | CriticalDialog for blocking decisions |
| #1097 | feat(alerts): demote host-pressure, server status, and raw-mode | those surfaces become Status-sheet rows / toasts |
| #1098 | feat(alerts): drop viewport now that toasts are a single surface | ToastViewport no longer a second alert surface |
| #1099 | feat(alerts): fold leftover surfaces into the routed system | delete ServerErrorBanner / AlertDetailsModal |

### Not included

| PR / branch | Why | Standing exclusion? |
|---|---|---|
| #952, #1039 | Red RN 0.87 Dependabot | standing until green |

---

## 3. The order that actually worked

Unchanged from the rehearsal:

`#1088 unique → #1091 unique → #1092 → #1093 → #1094 → INT follow-up → #1095 → #1096 → INT follow-up → #1097 → #1098 → #1099 → INT follow-up → #1094 wait-duration unique → INT pathTail → #1100 → #1101 → #1100 quiet-tail unique`

No reordering. Nothing was re-merged.

---

## 4. Conflicts that mattered

None in this run. Rehearsal judgment calls still apply: #1092 vs #1085 `ServerStateMessage`; #1095 vs #1094 NowList; #1099 delete of unused `ServerErrorBanner`.

---

## 5. Silent problems found (and the ones still possible)

Carried over from the rehearsal (ProviderMark/FAB tests, hub `lastError` mock, search-anchor `AuthError`, #1097 `onViewDetails`, #1101 `CURSOR_CLI_PROVIDER` leftover). Origin later published several of those follow-ups onto the PR heads; INT already had them.

**Sweeps not run:** no new merge activity in this run.

---

## 6. Verification

| | Rehearsal (carried over) | Real-run push |
|---|---|---|
| lint | green at wait-duration checkpoint | same tree |
| typecheck | green at wait-duration checkpoint | same tree |
| unit | 2239 | same tree |
| integration | 522 / 71 suites | same tree |
| i18n | 460 / 1 skipped | same tree |

**Not verified:** no GitHub Actions run on this push; no iOS/Android device build; Maestro not dispatched.

---

## 7. Obstacles worth remembering

| # | Obstacle | Fix | Recurs? | Automate? |
|---|---|---|---|---|
| 1 | Stacked alert PR heads move when origin absorbs an INT follow-up | Compare unique patch-ids + follow-up files against INT; do not treat a rewritten child SHA as a missing unique | yes | maybe |

---

## 8. Follow-ups

| Item | Why it is open | Next action | Owner | Issue |
|---|---|---|---|---|
| Open a PR for `integration/2026-09-14-open-prs` (optional) | Not consented in this run | Ask if CI visibility on the combined branch is wanted | user | — |
| Land in-scope PRs onto `main` | This skill never merges to `main` | Rebase + squash-merge in dependency order | user | — |
| Keep excluding #952 / #1039 | Red RN 0.87 Dependabot | Wait until green | user | — |
| Expiry of this integration branch | Staging area, not a parallel trunk | Delete (local + remote) once `main` holds the in-scope PRs. **Do not develop on this branch.** | user, on request | — |

---

## 9. Rules learned

- When origin publishes an INT follow-up onto a stacked base, every child SHA moves. Unique feat patch-id plus a file-tree check against INT HEAD is enough to decide whether Flow C can still push the rehearsal tip.
- Pushing a branch with no PR does not trigger the required-checks workflow set; "CI green" for this exact push is inferred from the rehearsal's local run of the same tree, not from GitHub.

---

## 10. Cost

Wall-clock ~10 min. Zero conflicts in this run. Time sinks: none — the rehearsal already held the resolutions.
