# Integration summary — integration/2026-08-12-rehearsal (2026-08-12)

**Verdict:** ready to land
**Branch:** `integration/2026-08-12-rehearsal` @ `9cf8a12e` (local only) — 11 PRs merged, 21 commits ahead of `main` @ `a1bf6ef8`
**CI:** all five required checks green at every checkpoint (Lint, Type check, Unit tests, Integration tests, i18n) — no red CI encountered anywhere in the set
**Full log:** [2026-08-12-rehearsal-log.md](2026-08-12-rehearsal-log.md)

Rehearsed merging the 12 non-dependabot open PRs (dependabot PRs #589–593 excluded by user choice) into a single local branch, entirely without touching `origin`. Eleven landed cleanly with zero merge conflicts; one (#651) turned out to be a stale no-op already shipped under a different PR. The branch is a straightforward candidate for a flow C real run — every resolution here was mechanical or a clean rebase, there are no judgment calls to re-litigate.

---

## 1. Final refs

| What | Ref | SHA |
|---|---|---|
| Integration branch | `integration/2026-08-12-rehearsal` (local worktree only) | `9cf8a12e` |
| Cut from | `origin/main` | `a1bf6ef8` |
| Backup / archive | not applicable — nothing pushed, no prior integration branch |

---

## 2. What is in the branch

| PR | Title | Effect in one line |
|---|---|---|
| #645 | test(e2e): dismiss the browse modal by dragging, not by pressing back | Fixes a Maestro flow to drag-dismiss instead of pressing back |
| #654 | fix(terminal): resolve absolute cursor moves against the TUI viewport | Absolute CUP cursor moves now resolve against the TUI viewport, not the whole scrollback |
| #657 | fix(hub): source merged-mode search from the server | Conversation search in merged mode now queries `/api/search` instead of filtering only paged-in results |
| #658 | test(e2e): match the resume button's flattened accessibility text | Fixes a Maestro assertion for the resume button's accessibility text |
| #659 | docs: track the agent prompt files in git | Adds three previously-untracked prompt docs |
| #666 | docs(integration): record the branch retirement and audit the stale refs | Documents the 2026-08-12 integration-branch retirement decision and its stale-ref audit |
| #667 | ci(e2e): run Maestro suite on Android | Extends the Maestro E2E workflow to run on Android in addition to iOS |
| #671 | feat(live-activity): honour the streamer's liveActivityPush flag | Live Activity now respects a server-provided enablement flag |
| #672 | fix(terminal): rejoin user prompts the PTY wrapped with an indent | Fixes line-rejoining for PTY-wrapped user prompts with indentation |
| #673 | feat(browse): show files in the Explorer as view-only rows | Explorer now lists files (not just directories) as view-only rows |
| #674 | fix(hub): stop re-filtering server search results in the merged list | Extracts the merged-list search filter into a named function that respects server-sourced results (composes with #657) |

### Not included

| PR / branch | Why | Standing exclusion? |
|---|---|---|
| #589, #590, #591, #592, #593 (dependabot) | User excluded from this run's scope | one-off for this run |
| #651 | Full no-op — its only commit is already present on `main` via already-merged PR #644; rebasing it produced an empty diff | one-off finding; recommend closing #651 on GitHub as superseded |

---

## 3. The order that actually worked

**Final order:** `#645 → #654 → #657 → #658 → #659 → #666 → #667 → #671 → #672 → #673 → #674`

Chronological by `createdAt` was sufficient for every PR — all had green CI independently, so no forced-order constraint was needed.

| Constraint | Kind | Reason |
|---|---|---|
| #674 after #657 | stacked | #674's base branch is `fix/hub-merged-search-server-source`, which is #657's own head branch. `git rebase` correctly auto-skipped #657's already-applied commit when rebasing #674, leaving only #674's own commit (`11576fe8`) |

The executed order matched the plan exactly; #651 was dropped rather than reordered.

---

## 4. Conflicts that mattered

None. Zero merge conflicts occurred across all 11 landed PRs — every rebase and `git merge --no-ff` completed automatically with no markers to resolve.

| Conflict | Kept | Discarded | Rule applied | How you would know it was wrong |
|---|---|---|---|---|
| — none | | | | |

---

## 5. Silent problems found (and the ones still possible)

None found. Two file-overlap pairs were hand-checked given git reported zero conflicts:

| Found | Where | How it was caught |
|---|---|---|
| — none | `app/index.tsx` (#657 + #674, stacked) | Manual diff review — confirmed #674's extracted `mergedItemMatchesQuery` correctly composes with #657's `conversationsFromServer` flag |
| — none | terminal code (#654 `services/virtual-terminal.ts` vs #672 `lib/collapseWrappedUserLines.ts`) | Confirmed disjoint files, no cross-file wiring lost |

**Sweeps run clean:** call-site grep for both terminal PRs; diff review of the #657/#674 shared file; behaviour-flag wiring check (`liveActivityPush`, `conversationsFromServer`). **Sweeps not run:** none applicable — no refactor/extraction PR in the set had call sites outside the files already checked above.

---

## 6. Verification

| | Baseline (`main`) | Final (integration) | Δ |
|---|---|---|---|
| Lint | 0 errors, 5 warnings | 0 errors, 5 warnings | 0 |
| Type check | clean | clean | 0 |
| Unit tests | 996 passed / 105 suites | 1017 passed / 107 suites | +21 tests, +2 suites |
| Integration tests | 295 passed / 43 suites | 299 passed / 44 suites | +4 tests, +1 suite |
| i18n | 55 passed, 1 skipped / 3 suites | 55 passed, 1 skipped / 3 suites | 0 |
| Scripts (extra — `scripts/` in set) | 91 passed / 11 suites | 94 passed / 12 suites | +3 tests, +1 suite |
| Native deps / build | not run — no native dep/`ios`/`android`/`patches` in scope | not run | n/a |

**Not verified:** no real iOS/Android build was produced (not required — the set has zero native-code changes). Maestro E2E (`e2e.yml`) was not dispatched by hand for this set despite #645, #658 and #667 touching e2e flows/scripts — recorded as **not run**, not as passing, per the skill's own rule that Maestro never runs automatically on a PR.

---

## 7. Obstacles worth remembering

| # | Obstacle | Fix | Recurs? | Automate? |
|---|---|---|---|---|
| O1 | `node_modules/.bin` silently disappears mid-run (twice), breaking `test:scripts` with `MODULE_NOT_FOUND` | `npm rebuild`, or (2nd time) full `rm -rf node_modules && npm ci` | yes, 2× in one run, cause undiagnosed | worth a 3rd-occurrence investigation before automating a workaround |
| O2 | PR #651 is a stale no-op already shipped under PR #644 | Excluded from merge; recommend closing #651 | one-off for this PR | no — but scope-collection step should flag empty-diff rebases automatically next time |
| O3 | `test:scripts`' `land-version-bump.test.js` mutates real `app.json`/`android/app/build.gradle` as a side effect | `git checkout -- app.json android/app/build.gradle` after every `test:scripts` run | yes, every `test:scripts` run in this repo | yes — fix the test to use a fully isolated fixture copy |

---

## 8. Follow-ups

| Item | Why it is open | Next action | Owner | Issue |
|---|---|---|---|---|
| #651 appears superseded | Closing a PR is a write action, outside this rehearsal's read-only scope | Review and close #651 on GitHub if agreed | user | not yet filed |
| O1 node_modules corruption undiagnosed | Root cause unclear after 2 occurrences in one session | Watch for a 3rd occurrence; investigate if it recurs | user / next operator | not yet filed |
| O3 `land-version-bump.test.js` not hermetic | Out of scope for this rehearsal | File a fix to isolate the test's file writes | user | not yet filed |
| Maestro E2E not dispatched for #645/#658/#667 | Costs ~$3/run on a macOS runner, not automatic | Dispatch by hand if this set proceeds to a real merge: `gh workflow run E2E -f ref=<pr-number>` per touched flow | user | not yet filed |

---

## 9. Rules learned

- Always check whether a PR's rebase produces an **empty diff** against the integration tip before assuming it needs a merge commit — a "patch contents already upstream" message from `git rebase` means the PR is likely stale/superseded, not merge-ready. Confirm with `git diff <tip> <rebased-branch> --stat` before creating any merge commit.
- `test:scripts` in this repo has a side effect (O3) — always `git status --porcelain` immediately after running it and discard any `app.json`/`android/app/build.gradle` drift before continuing the run, so it doesn't get mistaken for real integration-caused changes.
- A stacked-PR rebase (#674 onto #657) needs no special handling beyond landing the base first — `git rebase` correctly auto-skips the base's already-applied commit ("skipped previously applied commit") with no manual intervention.
- This is the first integration run to use the new `docs/integration/log-format.md` / `summary-format.md` convention (from PR #675) — no prior-run precedent existed to cross-check against; this run's log/summary can now serve as the reference example for future runs in this repo.

---

## 10. Cost

**Wall-clock:** ~110 min total. **PR count:** 12 in scope, 11 merged, 1 excluded (no-op). **Conflicts resolved:** 0. **Three biggest time sinks:** (1) O1 `node_modules` corruption troubleshooting, ~18 min across two occurrences; (2) the per-PR five-check re-verification loop, ~70 min across 10 real merges (inherent to the procedure, not overhead); (3) confirming #651's no-op status, ~5 min.
