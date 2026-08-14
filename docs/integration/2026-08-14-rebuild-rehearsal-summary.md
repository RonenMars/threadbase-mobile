# Integration summary — integration/2026-08-14-rebuild (2026-08-14)

**Verdict:** ready to land
**Branch:** `integration/2026-08-14-rebuild` @ `601c116c` (pushed to `origin`) — 14 PRs, 27 commits ahead of `main` @ `3035773e`
**CI:** all five required checks green at all 13 checkpoints (Lint, Type check, Unit tests, Integration tests, i18n), green again after the rebase onto `2580f910`, and green again after the post-run integration of #684 — baseline on `main` was green, so no red was ever inherited or introduced
**Full log:** [2026-08-14-rebuild-rehearsal-log.md](2026-08-14-rebuild-rehearsal-log.md)

Rebuilds [the 2026-08-12 rehearsal](2026-08-12-rehearsal-summary.md) onto today's `main`, adding the two PRs it lacked (#676, opened after that branch was cut, and #651). Twelve of thirteen merges were conflict-free; one mechanical `package.json` conflict. The single thing to know before touching this branch: **it is a test artifact with an expiry, not a landing vehicle** — the PRs still go to `main` individually, and no PR was opened for it by explicit instruction.

---

## 1. Final refs

| What | Ref | SHA |
|---|---|---|
| Integration branch | `integration/2026-08-14-rebuild` (pushed to `origin`) | `601c116c` |
| Rebased onto | `origin/main` | `2580f910` |
| Originally cut from | `origin/main` | `e7de5df3` |
| Pre-rebase tip | `backup/int-2026-08-14-pre-rebase` | `5c8d01e7` |
| Base PR branch | `test/e2e-session-lifecycle` (#645) | `f53c2aff` → `ff32123e` after rebase |
| Worktree | `../tb-mobile-worktrees/int-2026-08-14` | own `npm ci` |
| Backup / archive | the 08-12 branch (`9cf8a12e`) is untouched |

`main` moved twice during the audit that motivated this run (`a1bf6ef8` → `85310543` → `e7de5df3`), which is why the cut point was re-fetched immediately before cutting — and moved twice more during the run itself (`23c60160`, `2580f910`), which is what the post-run rebase absorbed.

**Post-run rebase (18:01).** `git rebase --rebase-merges origin/main` from `5c8d01e7` onto `2580f910`, no conflicts. `--rebase-merges` is load-bearing: a plain rebase flattens all thirteen PRs into one undifferentiated line. Structure preserved — still 25 commits and 11 merge commits — and the content delta against the pre-rebase tip is exactly #681 and #682, 5 files, all under `docs/`. All five required checks re-run green afterwards. **The per-PR and checkpoint SHAs in §3 of the log and below are pre-rebase and were not rewritten** — they are the record of the run as it happened; every one of them has an equivalent on the rebased branch.

**Post-run integration of #684 (2026-08-14, 18:25).** `git merge --no-ff origin/fix/review-defects` onto `0984f89a`, conflict-free, producing `601c116c` with the standard `integrate PR #684:` subject. This lands **after** the run recorded below, so §3's checkpoint table and §5's conflict ledger describe thirteen PRs and were not rewritten; the branch now carries fourteen. The merge also brought the branch level with `main` @ `3035773e`, because #684's own base already included it. All five required checks were re-run on the merged result and are green: lint 0 errors, type check clean, unit 108 suites / 1023 tests, integration 44 suites / 299 tests, i18n 3 suites / 55 passed. Counts in §2 and §6 below are the thirteen-PR run; #684 is additive to both.

**Two corrections to this document's earlier state.** It described the branch as "local only, never pushed" and as living in a local worktree only. Neither is true: the branch was already on `origin` at `0984f89a` before #684 was integrated, so that line was stale independently of this addendum. And the branch is still **not** a landing vehicle — #684 goes to `main` through its own PR like every other entry here.

---

## 2. What is in the branch

| PR | Title | Effect in one line |
|---|---|---|
| #645 | test(e2e): dismiss the browse modal by dragging, not by pressing back | Maestro flow drag-dismisses the browse modal instead of pressing back |
| #651 | fix(e2e): invalidate Maestro runs after XCTest crashes | **already on `main`** — rebase produced zero commits; content byte-identical |
| #654 | fix(terminal): resolve absolute cursor moves against the TUI viewport | Absolute CUP moves resolve against the viewport, not the whole scrollback |
| #657 | fix(hub): source merged-mode search from the server | Merged-mode conversation search queries `/api/search` instead of filtering paged-in results |
| #658 | test(e2e): match the resume button's flattened accessibility text | Fixes a Maestro assertion for the resume button |
| #659 | docs: track the agent prompt files in git | Adds three previously-untracked prompt docs |
| #666 | docs(integration): record the branch retirement and audit the stale refs | Documents the 2026-08-12 integration-branch retirement and its stale-ref audit |
| #667 | ci(e2e): run Maestro suite on Android | Extends the Maestro E2E workflow to Android; introduces `E2E_MOCK_SERVER_URL` |
| #671 | feat(live-activity): honour the streamer's liveActivityPush flag | Live Activity respects a server-provided enablement flag |
| #672 | fix(terminal): rejoin user prompts the PTY wrapped with an indent | Fixes line-rejoining for PTY-wrapped indented user prompts |
| #673 | feat(browse): show files in the Explorer as view-only rows | Explorer lists files, not just directories, as view-only rows |
| #674 | fix(hub): stop re-filtering server search results in the merged list | Extracts `mergedItemMatchesQuery`, which respects server-sourced results (stacked on #657) |
| #676 | fix(test): let the jest scripts exit instead of stalling on open handles | Adds `--forceExit` to the four jest script entries |
| #684 | fix(auth): send the scoped device token instead of the shared admin key | **integrated post-run** — the app presents its scoped per-device credential instead of the owner's shared API key, gated on the streamer reporting `devicesDurable` |

### Not included

| PR / branch | Why | Standing exclusion? |
|---|---|---|
| #589–#593 | dependabot bumps — excluded by user instruction | **yes, standing** |

---

## 3. The order that actually worked

```
#645 → #651 → #654 → #657 → #658 → #659 → #666 → #667 → #671 → #672 → #673 → #674 → #676
```

Chronological by PR number, which already satisfies the one constraint in the set: **#674 is stacked on #657** and must follow it. Rebasing #674 onto the tip (with #657 already in) dropped the duplicated base commits and kept the child's own — no manual intervention.

No forced-order constraints beyond that: every PR was green on all five required checks before the run, so no member needed another to unblock it. No mid-run reordering.

Per-PR procedure, replayable as-is: `git checkout -B rebase/pr-<n> refs/integration/pr/<n>` → `git rebase <integration tip>` → `git merge --no-ff rebase/pr-<n>` → five required checks.

PR heads must be fetched to `refs/integration/pr/<n>`, not `origin/pr/*` — a mid-run `git fetch --prune` deletes the latter silently.

---

## 4. Conflicts that mattered

**One conflict in thirteen merges, mechanical.** No whole-file (`--ours`/`--theirs`) resolutions anywhere in the run, and no judgment calls.

| # | PR | File | What collided | Resolution | Class |
|---|---|---|---|---|---|
| 1 | #676 | `package.json` | #676 adds `--forceExit` to `test:unit`/`test:integration`/`test:e2e`/`test:i18n`; #667 prefixes `test:e2e:mock` with `E2E_MOCK_SERVER_URL=…; export …`. Adjacent lines in one block, so git would not auto-merge despite the edits being disjoint. | Union — both sides kept in full | **M** |

Verified by `node -e "JSON.parse(…)"`, then all five required checks, then `git grep E2E_MOCK_SERVER_URL` to confirm #667's env var is still read in `.github/workflows/e2e.yml`, `e2e/setup.yaml` and `package.json`.

**Replay note for a real run:** this conflict recurs verbatim until either #667 or #676 lands. The resolution is a union — do not pick a side.

---

## 5. Silent problems found (and the ones still possible)

Sweeps run, all clean:

| Sweep | Result |
|---|---|
| `mergedItemMatchesQuery` (extracted by #674 out of #657's filter) — call sites | wired: defined `app/index.tsx:78`, called `app/index.tsx:670`, covered by `__tests__/unit/merged-search-filter.test.ts` |
| `liveActivityPush` flag (#671) still read? | yes — `services/live-activity-enabled.ts:20` |
| `E2E_MOCK_SERVER_URL` (#667) still read after the ledger-#1 resolution? | yes — three call sites |
| Blanket per-file resolutions | none used |

**Still possible, not ruled out:** Maestro E2E was never dispatched. #645, #651, #658 and #667 all touch Maestro flows or `e2e.yml`, and `e2e.yml` does not run on PRs in this repo (monthly schedule + manual dispatch only). Their E2E status is *unknown*, not green.

---

## 6. Verification

| Check | Baseline (`e7de5df3`) | Final (`5c8d01e7`) | After rebase (`0984f89a`) |
|---|---|---|---|
| `npm run lint` | green | green | green |
| `npm run typecheck` | green | green | green |
| `npm run test:unit` | green | green | green |
| `npm run test:integration` | green | green | green |
| `npm run test:i18n` | green | green | green |

All five ran at **every** one of the 13 checkpoints, not just at the end. No red checkpoint at any point.

**Not run, and why:** no real build (nothing in the set touches `ios/`, `android/`, `patches/` or a native dependency, so `check:native-deps` and a build were out of scope); Maestro E2E (see §5); `test:scripts` (arguably in scope — #667 and #676 both edit `package.json` scripts — and skipped).

**Coverage gate:** the automated audit flagged 9 PRs "missing"; 5 are the deliberate dependabot exclusions and **all 4 remaining are false negatives**, each hand-cleared:

| PR | Residual | Verdict |
|---|---|---|
| #651 | 31 files vs its own stale merge-base | present — rebase produced zero commits; `e2e/run-maestro.js` and its test byte-identical |
| #667 | `package.json`, 4 lines | present — the residual *is* #676's `--forceExit`, which #667's head predates |
| #671 | `types/api.ts`, 3 lines | present — the residual *is* #673's browse-files type addition |
| #676 | `package.json`, 1 line | present — the residual *is* #667's `E2E_MOCK_SERVER_URL` prefix |

No code on the branch lacks a PR home: the 5 branch-only non-doc commits are the merged PR work itself, plus 11 aggregate merge commits and 0 docs-only commits.

**Nothing escaped to `origin`:** `git ls-remote --heads origin | grep -c "integration/2026-08-14-rebuild"` → `0`.

---

## 7. Obstacles worth remembering

- **O1 — a PR branch behind `main` measures as huge and unlanded when its real delta is zero.** #651 shows 31 changed files and every coverage tool calls it missing; it is empty. The only reliable oracle is the rebase itself (zero commits). `git cherry` actively disagrees, because it patch-ids the whole commit against its stale base. This produced one wrong published conclusion earlier in the session before the rebase settled it.
- **O2 — `git diff <a> <b> -- $files` matches nothing in zsh.** zsh does not word-split unquoted variables, so the pathspec becomes one non-matching string and git exits 0 with empty output — which reads as perfect coverage. Use `git diff --name-only … | xargs git diff --stat …`. This nearly certified a coverage gate that had verified nothing.
- **O3 — the merge loop aborts the rebase on conflict**, so the conflicted state is gone before it can be inspected. Re-create it deliberately and resolve.

---

## 8. Follow-ups

| Item | Next action | Owner |
|---|---|---|
| #651 is an effective no-op | close it, or confirm what it still intends to change | user |
| Maestro E2E unknown for #645, #651, #658, #667 | `gh workflow run E2E -f ref=<n>` before landing any of the four | user |
| Dependabot #589–593 untested against this set | separate run if a bump is wanted | user |
| `test:scripts` not run | run it before landing #667/#676, both of which edit `package.json` scripts | user |

---

## 9. Rules learned

- **Rebase before judging whether a PR is already landed.** File counts, `git cherry` and content-equivalence audits all mislead on a branch cut from an old `main`; an empty rebase does not.
- **A coverage audit's "missing" list is never a verdict** — every false negative in this run was a PR whose head predates a *later* PR in the same set that edited the same file. #667↔#676 (`package.json`) and #671↔#673 (`types/api.ts`) will false-negative again on any rerun until both sides land.
- **A verification that returns "clean" needs its own sanity check.** O2's empty diffs were indistinguishable from success.

---

## 10. Cost

~21 min wall-clock: 2 preflight/cut, 1 `npm ci`, 1 baseline, 11 merge loop, 3 conflict + final checkpoint, 3 coverage gate and sweeps. The twelve five-check checkpoints dominate and are the point of the exercise; the two avoidable sinks were O2 (~5 min) and O1 (~10 min).

---

## Expiry

**Delete this branch once `main` holds the content** — however it gets there. It is local-only, so deletion is `git worktree remove --force ../tb-mobile-worktrees/int-2026-08-14 && git branch -D integration/2026-08-14-rebuild`, with nothing to back up first.

Per [the retirement decision](../integration-branch-retirement-2026-08-12.md): an integration branch is a staging area with an expiry, not a parallel trunk. **Never commit a fix to it** — fix in the PR that needs it and re-merge. If it is still alive a week from now with nothing landed, that is the parallel-trunk failure starting.

**Owner of the deletion:** user.
