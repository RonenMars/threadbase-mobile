# Integration merge log — integration/2026-08-14-rebuild (2026-08-14)

**Status:** complete
**Goal:** rebuild the 2026-08-12 rehearsal onto today's `main`, adding the PRs that were missing from it, so the whole non-dependabot open-PR set can be tested together. Done means: every non-dependabot open PR is on one branch, all five required checks green, nothing pushed.
**Operator:** Claude Code session (flow A — local rehearsal)  **Repo:** threadbase-mobile  **Log started:** 2026-08-14 17:11 IDT

This run supersedes [`2026-08-12-rehearsal-log.md`](2026-08-12-rehearsal-log.md).
It is a fresh cut, not a continuation of that branch — `main` had advanced two days and the old branch's 11 aggregate merge commits would only have been replayed.

---

## 1. Provenance and refs

| What | Ref | SHA | Note |
|---|---|---|---|
| Cut point | `origin/main` | `e7de5df3` | re-fetched immediately before cutting; `main` moved twice during the audit that preceded this run (`a1bf6ef8` → `85310543` → `e7de5df3`) |
| Base PR branch | `test/e2e-session-lifecycle` (#645) | `f53c2aff` | earliest PR — branch cut here, then rebased onto `main` → `ff32123e` |
| Integration branch | `integration/2026-08-14-rebuild` | `0984f89a` | local only, never pushed; `5c8d01e7` at end of the merge loop, rebased onto `2580f910` at 18:01 — see §5 |
| Pre-rebase tip | `backup/int-2026-08-14-pre-rebase` | `5c8d01e7` | local backup ref taken before the rebase |
| Rebase target | `origin/main` | `2580f910` | `main` advanced by #681 and #682 during the run |
| Prior rehearsal branch | `integration/2026-08-12-rehearsal` | `9cf8a12e` | untouched; left in place as the record of the 08-12 run |
| Backup of previous INT | — | — | not applicable: the prior branch is local-only and was not modified |
| Worktree | `../tb-mobile-worktrees/int-2026-08-14` | | own `npm ci`, never a copied `node_modules` |

PR heads were fetched into `refs/integration/pr/<n>` rather than `origin/pr/*`, so a `git fetch --prune` mid-run cannot delete them.

### Environment provenance

| Item | Value |
|---|---|
| OS / arch | darwin 25.5.0, arm64 |
| `node_modules` | `npm ci` in the worktree at `ff32123e` |
| Xcode / CocoaPods | not exercised — no `ios/`, `android/`, `patches/` or native dependency in the set |
| Pods / prebuild state | not run, not needed |
| `npm run check:native-deps` | not run — no native input in the set |

No member of the set touches `ios/`, `android/`, `patches/` or a native dependency, so Jest green is the whole answer here; no real build was required.

---

## 2. Baseline — the state of `main` before anything landed

Run on a detached `origin/main` @ `e7de5df3` in the worktree, before the first merge.

| Check | Command | Result |
|---|---|---|
| lint | `npm run lint` | green |
| typecheck | `npm run typecheck` | green |
| unit | `npm run test:unit` | green |
| integration | `npm run test:integration` | green |
| i18n | `npm run test:i18n` | green |
| scripts | `npm run test:scripts` | not run — `scripts/` not in the set |
| native deps | `npm run check:native-deps` | not run — no native input in the set |

Known-flaky before the run: — none observed. `main` was green on all five, so every later count is an absolute, not a delta against a red baseline.

---

## 3. Scope — what is in, what is out

Mode: **all open PRs, minus a standing dependabot exclusion.** 13 non-dependabot PRs.

`mergeable`/`mergeStateStatus` were queried per PR; all but #674 returned `UNKNOWN` (GitHub computes it lazily), so the column below reports what each query actually returned rather than pretending to a verdict. Every PR is non-draft.

| PR | Title | Head branch | Head SHA | Base | Draft? | Mergeable | CI on PR |
|---|---|---|---|---|---|---|---|
| #645 | test(e2e): dismiss the browse modal by dragging, not by pressing back | `test/e2e-session-lifecycle` | `f53c2aff` | `main` | no | UNKNOWN | all 5 required green |
| #651 | fix(e2e): invalidate Maestro runs after XCTest crashes | `fix/e2e-xctest-crash-invalidation` | `f1890c96` | `main` | no | UNKNOWN | all 5 required green |
| #654 | fix(terminal): resolve absolute cursor moves against the TUI viewport | `fix/viewport-relative-cup` | `7e9a4b4a` | `main` | no | UNKNOWN | all 5 required green |
| #657 | fix(hub): source merged-mode search from the server | `fix/hub-merged-search-server-source` | `8402fe5f` | `main` | no | UNKNOWN | all 5 required green |
| #658 | test(e2e): match the resume button's flattened accessibility text | `test/e2e-resume-session-glyph` | `d3fcef71` | `main` | no | UNKNOWN | all 5 required green |
| #659 | docs: track the agent prompt files in git | `docs/track-agent-prompts` | `9a63f41b` | `main` | no | UNKNOWN | all 5 required green |
| #666 | docs(integration): record the branch retirement and audit the stale refs | `docs/integration-branch-retirement` | `611e1505` | `main` | no | UNKNOWN | all 5 required green |
| #667 | ci(e2e): run Maestro suite on Android | `ci/android-maestro-e2e` | `36e7181e` | `main` | no | UNKNOWN | all 5 required green |
| #671 | feat(live-activity): honour the streamer's liveActivityPush flag | `feat/live-activity-push-flag` | `41b432d4` | `main` | no | UNKNOWN | all 5 required green |
| #672 | fix(terminal): rejoin user prompts the PTY wrapped with an indent | `fix/terminal-wrapped-prompt-collapse` | `8953d5b3` | `main` | no | UNKNOWN | all 5 required green |
| #673 | feat(browse): show files in the Explorer as view-only rows | `feat/browse-show-files` | `8f3c075f` | `main` | no | UNKNOWN | all 5 required green |
| #674 | fix(hub): stop re-filtering server search results in the merged list | `fix/merged-search-client-refilter` | `6c426c10` | `fix/hub-merged-search-server-source` (#657) | no | MERGEABLE / CLEAN | all 5 required green |
| #676 | fix(test): let the jest scripts exit instead of stalling on open handles | `fix/jest-query-client-exit` | `5ffe7bd1` | `main` | no | UNKNOWN | all 5 required green |

Maestro E2E (`e2e.yml`) never runs on a PR in this repo — monthly schedule and manual dispatch only. #645, #651, #658 and #667 all touch Maestro flows or the E2E workflow, so **their E2E status is unknown, not green.** Not dispatched in this run.

### Deliberate exclusions

| PR | Why excluded | Standing or one-off? |
|---|---|---|
| #589 | dependabot — `chore(deps-dev): bump tailwindcss from 3.4.19 to 4.3.3` | standing, by user instruction |
| #590 | dependabot — `chore(deps): bump react-native-gesture-handler from 2.32.0 to 3.1.0` | standing |
| #591 | dependabot — `chore(deps): bump react-native-pager-view from 8.0.2 to 8.0.4` | standing |
| #592 | dependabot — `chore(deps-dev): bump eslint from 9.39.4 to 10.8.1` | standing |
| #593 | dependabot — `chore(deps): bump react-dom from 19.2.3 to 19.2.8` | standing |

### Extra branches included (non-PR)

— none.

---

## 4. Order plan

**Planned order:** `#645 → #651 → #654 → #657 → #658 → #659 → #666 → #667 → #671 → #672 → #673 → #674 → #676`

Chronological by PR number, which already satisfies the one stack constraint (#657 before #674).

### Stacked PRs

| Child PR | Stacked on | Base branch | Commits unique to the child | Risk if merged out of order |
|---|---|---|---|---|
| #674 | #657 | `fix/hub-merged-search-server-source` | 1 — extracts `mergedItemMatchesQuery` out of the filter #657 introduced | Merged first, it would carry #657's commits in duplicate and the extraction would have nothing to extract from |

#674's rebase onto the tip (#657 already in) dropped the duplicated base commits and kept its own — verified in §12.

### Forced-order constraints (not chronological)

— none. No PR in the set was red, so no member needed another to clear it.

### Order changes made mid-run

— none.

---

## 5. Action log (chronological)

### 17:11 — preflight

- **Command:** `git status --porcelain`, `git fetch origin`, `git rev-parse --short origin/main`
- **Result:** working tree carries only untracked docs from the 08-12 run; `origin/main` = `e7de5df3`
- **Note:** `main` had moved twice since the audit that motivated this run — this is exactly the stale-cut-point trap, caught by re-fetching.

### 17:12 — fetch PR heads, cut branch

- **Command:** `git fetch origin pull/<n>/head:refs/integration/pr/<n>` ×13; `git worktree add ../tb-mobile-worktrees/int-2026-08-14 -b integration/2026-08-14-rebuild refs/integration/pr/645`; `git rebase origin/main`
- **Result:** branch at `ff32123e` (#645 on top of `e7de5df3`)

### 17:13 — worktree `npm ci`

- **Result:** clean install, exit 0

### 17:14 — baseline on detached `origin/main`

- **Result:** all five required checks green — see §2

### 17:14–17:26 — merge loop, one PR at a time

Each PR: `git checkout -B rebase/pr-<n> refs/integration/pr/<n>` → `git rebase <integration branch>` → `git merge --no-ff rebase/pr-<n>` → five required checks. Per-PR detail in §6, checkpoints in §10.

### 17:26 — #676 rebase conflicted in `package.json`

- **Command:** `git rebase integration/2026-08-14-rebuild` on `rebase/pr-676`
- **Result:** `CONFLICT (content): Merge conflict in package.json` → ledger #1
- **Note:** the automated loop aborted here by design; resolved by hand, then continued.

### 17:28 — #676 resolved, merged, final checkpoint

- **Command:** `git add package.json && git rebase --continue`; `git merge --no-ff rebase/pr-676`
- **Branch SHA after:** `5c8d01e7`
- **Result:** all five required checks green

### 17:29 — coverage gate and semantic sweep

- **Result:** 4 false-negative "missing" rows, all hand-cleared — see §12; sweeps clean — see §8

### 18:01 — rebase onto current `main`

- **Command:** `git branch -f backup/int-2026-08-14-pre-rebase 5c8d01e7`; `git rebase --rebase-merges origin/main`
- **Result:** no conflicts. Branch SHA `5c8d01e7` → `0984f89a`, onto `origin/main` `2580f910`.
- **Why `--rebase-merges`:** a plain `git rebase` flattens the 11 merge commits, collapsing thirteen separately-attributable PRs into one undifferentiated line and destroying the bisect chain §6 exists to provide.
- **Verified:** structure preserved (25 commits, 11 merges, unchanged); `git diff 5c8d01e7 0984f89a` is exactly #681 + #682 — 5 files, all under `docs/` — so nothing from the integration set shifted; `git merge-base --is-ancestor origin/main HEAD` true; all five required checks re-run green.
- **Note:** `main` moved twice during the run itself (`23c60160` #681, `2580f910` #682), on top of the two moves during the preceding audit. The per-PR and checkpoint SHAs in §6 and §10 are **pre-rebase and deliberately not rewritten** — they record the run as it happened, and rewriting them would make the log fiction. Each has an equivalent commit on the rebased branch.

---

## 6. Per-PR record

### #645 — test(e2e): dismiss the browse modal by dragging, not by pressing back

| Field | Value |
|---|---|
| Head before / after rebase | `f53c2aff` → `ff32123e` |
| Rebased onto | `origin/main` `e7de5df3` |
| Conflicts | none |
| Diff scope after rebase | `e2e/session_lifecycle.yaml` — identical to `gh pr diff 645 --name-only` |
| Integration SHA after merge | `ff32123e` (branch base, not a merge commit) |
| Verification | folded into the #651 checkpoint |
| Obstacles | — |

### #651 — fix(e2e): invalidate Maestro runs after XCTest crashes

| Field | Value |
|---|---|
| Head before / after rebase | `f1890c96` → `ff32123e` — **rebase produced zero commits** |
| Rebased onto | `ff32123e` |
| Conflicts | none |
| Diff scope after rebase | empty |
| Integration SHA after merge | `ff32123e` (unchanged) |
| Verification | lint · typecheck · unit · integration · i18n all green |
| Obstacles | O1 |

The PR's substantive change is already on `main`: `e2e/run-maestro.js` and `__tests__/unit/scripts/run-maestro.test.js` are byte-identical between the branch and `refs/integration/pr/651`. See O1 — this PR reads as large-but-unlanded to every tool that measures it against its own stale merge-base.

### #654 — fix(terminal): resolve absolute cursor moves against the TUI viewport

| Field | Value |
|---|---|
| Head before / after rebase | `7e9a4b4a` → `cf78ebe5` |
| Rebased onto | `ff32123e` |
| Conflicts | none |
| Diff scope after rebase | unchanged |
| Integration SHA after merge | `798a3c4b` |
| Verification | all five green |

### #657 — fix(hub): source merged-mode search from the server

| Field | Value |
|---|---|
| Head before / after rebase | `8402fe5f` → `98c3fb3b` |
| Rebased onto | `798a3c4b` |
| Conflicts | none |
| Diff scope after rebase | unchanged |
| Integration SHA after merge | `853823c8` |
| Verification | all five green |

### #658 — test(e2e): match the resume button's flattened accessibility text

| Field | Value |
|---|---|
| Head before / after rebase | `d3fcef71` → `0d150d19` |
| Rebased onto | `853823c8` |
| Conflicts | none |
| Diff scope after rebase | unchanged |
| Integration SHA after merge | `0a0112fb` |
| Verification | all five green |

### #659 — docs: track the agent prompt files in git

| Field | Value |
|---|---|
| Head before / after rebase | `9a63f41b` → `60e2eb03` |
| Rebased onto | `0a0112fb` |
| Conflicts | none |
| Diff scope after rebase | unchanged |
| Integration SHA after merge | `38c8c9d1` |
| Verification | all five green |

### #666 — docs(integration): record the branch retirement and audit the stale refs

| Field | Value |
|---|---|
| Head before / after rebase | `611e1505` → `1f78a42a` |
| Rebased onto | `38c8c9d1` |
| Conflicts | none |
| Diff scope after rebase | unchanged |
| Integration SHA after merge | `4c10e962` |
| Verification | all five green |

### #667 — ci(e2e): run Maestro suite on Android

| Field | Value |
|---|---|
| Head before / after rebase | `36e7181e` → `7ad742e5` |
| Rebased onto | `4c10e962` |
| Conflicts | none |
| Diff scope after rebase | unchanged |
| Integration SHA after merge | `0485afec` |
| Verification | all five green |

Introduces the `E2E_MOCK_SERVER_URL` env var and threads it through `package.json`'s `test:e2e:mock`. That line is one half of ledger #1.

### #671 — feat(live-activity): honour the streamer's liveActivityPush flag

| Field | Value |
|---|---|
| Head before / after rebase | `41b432d4` → `d5adb7ca` |
| Rebased onto | `0485afec` |
| Conflicts | none |
| Diff scope after rebase | unchanged |
| Integration SHA after merge | `ecf6b8bf` |
| Verification | all five green |

### #672 — fix(terminal): rejoin user prompts the PTY wrapped with an indent

| Field | Value |
|---|---|
| Head before / after rebase | `8953d5b3` → `f3fb219e` |
| Rebased onto | `ecf6b8bf` |
| Conflicts | none |
| Diff scope after rebase | unchanged |
| Integration SHA after merge | `09f4b86c` |
| Verification | all five green |

### #673 — feat(browse): show files in the Explorer as view-only rows

| Field | Value |
|---|---|
| Head before / after rebase | `8f3c075f` → `a1e0b4d7` |
| Rebased onto | `09f4b86c` |
| Conflicts | none |
| Diff scope after rebase | unchanged |
| Integration SHA after merge | `9d879069` |
| Verification | all five green |

Adds 3 lines to `types/api.ts` that #671's head does not have — the source of one false negative in §12.

### #674 — fix(hub): stop re-filtering server search results in the merged list

| Field | Value |
|---|---|
| Head before / after rebase | `6c426c10` → `33c1731c` |
| Rebased onto | `9d879069` |
| Conflicts | none — the stack rebased without incident |
| Diff scope after rebase | unchanged; #657's duplicated commits dropped, the child's own commit kept |
| Integration SHA after merge | `1213b895` |
| Verification | all five green |

### #676 — fix(test): let the jest scripts exit instead of stalling on open handles

| Field | Value |
|---|---|
| Head before / after rebase | `5ffe7bd1` → `0caffec3` |
| Rebased onto | `1213b895` |
| Conflicts | `package.json` ×1 hunk → ledger #1 |
| Diff scope after rebase | `docs/troubleshooting.md`, `package.json` — identical to `gh pr diff 676 --name-only` |
| Integration SHA after merge | `5c8d01e7` |
| Verification | all five green |

---

## 7. Conflict ledger

| # | PR | File | Hunks | What collided | Resolution | Class | Oracle | Verified by |
|---|---|---|---|---|---|---|---|---|
| 1 | #676 | `package.json` | 1 | #676 adds `--forceExit` to `test:unit`, `test:integration`, `test:e2e`, `test:i18n`; #667 prefixes `test:e2e:mock` with `E2E_MOCK_SERVER_URL=${E2E_MOCK_SERVER_URL:-http://localhost:7071}; export …`. The two edits land in one adjacent block, so git could not auto-merge them despite touching different lines. | Union — took #676's four `--forceExit` lines and #667's `test:e2e:mock` line. Neither side lost anything. | **M** | none needed; the two sides edit disjoint script entries | `node -e "JSON.parse(…)"` for validity, then all five required checks, then `git grep E2E_MOCK_SERVER_URL` to confirm the env var is still read |

One conflict in thirteen merges. No whole-file (`--ours`/`--theirs`) resolutions were used anywhere in this run.

### Judgment calls in full

— none. The single conflict was mechanical.

---

## 8. Semantic conflicts — problems git did *not* flag

| Sweep | Result |
|---|---|
| `mergedItemMatchesQuery` — the function #674 extracts out of #657's filter — call sites | present and wired: defined `app/index.tsx:78`, called `app/index.tsx:670`, covered by `__tests__/unit/merged-search-filter.test.ts`. The extraction survived the merge of its own base. |
| `liveActivityPush` flag introduced by #671 — still read? | yes: `services/live-activity-enabled.ts:20` (`FLAG_ID = 'liveActivityPush'`), exercised by `__tests__/unit/services/live-activity-enabled.test.ts` |
| `E2E_MOCK_SERVER_URL` introduced by #667 — still read after the ledger-#1 resolution? | yes: `.github/workflows/e2e.yml:129`, `e2e/setup.yaml:31`, `package.json:29` |
| Blanket per-file resolutions (`--ours`/`--theirs`) | — none used |
| `git diff <pr-head> <integration> -- <pr's files>` per PR | run for all 13 — see §12 |

| # | Where | What was silently lost/changed | Found how | Fix |
|---|---|---|---|---|
| — | — | — none found | — | — |

---

## 9. Obstacles and detours

### O1 — a PR whose branch is behind `main` measures as huge and unlanded, when its real delta is zero

- **Symptom:** #651 shows 31 changed files against its own merge-base and every coverage tool reports it "missing" from the integration branch. It is not missing; it is empty.
- **Cause:** its head branch was cut from an old `main`, so `git diff <merge-base> <head>` includes everything that has landed since. Content-equivalence checks compare the branch against that inflated file set and find differences that belong to *other*, already-landed work.
- **Fix:** the only reliable oracle is the rebase itself. `git rebase <tip>` on the PR head produced **zero commits**, which is definitive. `git cherry` disagreed (reported the commit as `+`, not upstream) because it patch-ids the whole commit against its stale base — do not trust it here.
- **Cost:** ~10 min, and one wrong conclusion published earlier in the session before the rebase settled it.
- **Recurs?** yes, for any long-lived PR branch. Rebase first, then judge.

### O2 — `git diff <a> <b> -- $files` silently matches nothing in zsh

- **Symptom:** the hand-verification of the coverage gate reported an empty residual diff for all four flagged PRs — which reads as "perfect coverage" and is exactly the answer you want to see.
- **Cause:** this session's shell is zsh, which does **not** word-split unquoted variables. `files="a.ts b.ts"; git diff … -- $files` passes one pathspec that matches no file, so git returns nothing and exits 0.
- **Fix:** `git diff --name-only $b $h | xargs git diff --stat $TIP $h --`. Re-running that way produced four non-empty residuals, each of which then had a real explanation.
- **Cost:** ~5 min, and it very nearly produced a clean bill of health that had verified nothing.
- **Recurs?** yes, in every zsh-hosted verification loop. Already recorded as a standing trap; it still landed.

### O3 — the automated merge loop aborts the rebase on conflict

- **Symptom:** the loop exited at #676 with `REBASE-CONFLICT`, having already run `git rebase --abort`, so the conflicted state was gone by the time it was inspected.
- **Cause:** the script aborts to leave a clean tree rather than a half-rebased one.
- **Fix:** re-create it deliberately (`git checkout -B rebase/pr-676 refs/integration/pr/676 && git rebase <tip>`), resolve, continue. Cheap, but a loop that preserved the conflict would have saved a step.
- **Cost:** ~2 min.
- **Recurs?** whenever a set has a conflict — i.e. most runs.

---

## 10. Verification checkpoints

All five required checks (`lint`, `typecheck`, `test:unit`, `test:integration`, `test:i18n`) were run at every checkpoint. Baseline was green, so "green" below is absolute.

| Checkpoint | Integration SHA | Commits ahead of `main` | lint | typecheck | tests | Δ vs baseline |
|---|---|---|---|---|---|---|
| baseline (`origin/main`) | `e7de5df3` | 0 | green | green | green | — |
| after #645 + #651 | `ff32123e` | 1 | green | green | green | 0 |
| after #654 | `798a3c4b` | 3 | green | green | green | 0 |
| after #657 | `853823c8` | 6 | green | green | green | 0 |
| after #658 | `0a0112fb` | 8 | green | green | green | 0 |
| after #659 | `38c8c9d1` | 10 | green | green | green | 0 |
| after #666 | `4c10e962` | 12 | green | green | green | 0 |
| after #667 | `0485afec` | 14 | green | green | green | 0 |
| after #671 | `ecf6b8bf` | 16 | green | green | green | 0 |
| after #672 | `09f4b86c` | 18 | green | green | green | 0 |
| after #673 | `9d879069` | 20 | green | green | green | 0 |
| after #674 | `1213b895` | 22 | green | green | green | 0 |
| after #676 (end of merge loop) | `5c8d01e7` | 25 | green | green | green | 0 |
| after rebase onto `2580f910` | `0984f89a` | 25 | green | green | green | 0 |

No red checkpoint at any point in the run.

---

## 11. Decisions, open questions, deferrals

| # | Decision | Alternatives considered | Reversible? | Owner |
|---|---|---|---|---|
| 1 | Cut a fresh branch off today's `main` rather than merging the missing PRs into `integration/2026-08-12-rehearsal` in place | merge in place onto the 08-12 branch | yes — the old branch is untouched | user (confirmed in-session) |
| 2 | Do not open a PR for the integration branch, and do not push it | push the branch; open a PR against `main` | yes | user (confirmed in-session) |
| 3 | Resolve ledger #1 as a union rather than picking a side | take #676's block whole; take #667's block whole | yes | this session |
| 4 | Treat #651 as already-landed rather than merging it | force the merge anyway | yes | this session, on the rebase-is-empty evidence |

| Open item | Why deferred | Next action | Owner | Tracked as |
|---|---|---|---|---|
| Maestro E2E never dispatched for #645, #651, #658, #667 | `e2e.yml` does not run on PRs; a dispatch costs a macOS runner and a Release build | `gh workflow run E2E -f ref=<n>` before landing any of the four | user | this log, §3 |
| #651 is an effective no-op | its content is on `main` already | close it, or confirm what it still intends to change | user | this log, §6 |
| Dependabot #589–593 untested against this set | excluded by standing instruction | separate run if a bump is wanted | user | this log, §3 |

---

## 12. Coverage gate

`gh pr diff <n> --name-only` per PR, compared against the same paths on `5c8d01e7` (the end-of-merge-loop tip; the 18:01 rebase changed only `docs/`, so the gate stands unchanged on `0984f89a`).

The automated audit reported **9 missing**: #589–593 (the deliberate dependabot exclusions) plus #651, #667, #671, #676. All four non-dependabot rows are false negatives, each hand-cleared below.

| PR | Files reported missing | Hand-verified verdict |
|---|---|---|
| #645 | none | present (patch-id match) |
| #651 | 31 files | **present.** Rebase onto the tip produced zero commits; `e2e/run-maestro.js` and `__tests__/unit/scripts/run-maestro.test.js` are byte-identical to the PR head. The 31-file diff is against its own stale merge-base — see O1. |
| #654 | none | present (content-equivalence) |
| #657 | none | present (patch-id match) |
| #658 | none | present (content-equivalence) |
| #659 | none | present (content-equivalence) |
| #666 | none | present (content-equivalence) |
| #667 | `package.json` (4 lines) | **present.** The residual is exactly #676's four `--forceExit` additions, which #667's head predates. |
| #671 | `types/api.ts` (3 lines) | **present.** The residual is exactly #673's browse-files type addition, which #671's head predates. |
| #672 | none | present (content-equivalence) |
| #673 | none | present (patch-id match) |
| #674 | none | present (content-equivalence) |
| #676 | `package.json` (1 line) | **present.** The residual is #667's `E2E_MOCK_SERVER_URL` prefix on `test:e2e:mock`, which #676's head predates — the other half of ledger #1. |

**The pattern to expect next run:** every false negative here is a PR whose head predates a *later* PR in the same set that edited the same file. #667↔#676 (`package.json`) and #671↔#673 (`types/api.ts`) will false-negative again on any rerun until both sides land.

### Branch-only content

`branch_only_vs_all_prs.unique_non_doc_commits` lists 5 commits — #645, #667, #671, #673, #676 — all of which are the merged PR work itself, appearing branch-only for the same head-drift reason. 11 aggregate merge commits, 0 docs-only commits. **No code on this branch lacks a PR home.**

---

## 13. Risk and rollback

- **Backup ref / archive tag:** none needed — flow A wrote nothing to `origin`. Verified: `git ls-remote --heads origin | grep -c "integration/2026-08-14-rebuild"` → `0`.
- **Abort mid-run:** `git worktree remove --force ../tb-mobile-worktrees/int-2026-08-14 && git branch -D integration/2026-08-14-rebuild backup/int-2026-08-14-pre-rebase`
- **Undo the rebase:** `git reset --hard backup/int-2026-08-14-pre-rebase` (→ `5c8d01e7`)
- **Restore:** nothing to restore. `main`, every PR head, and `integration/2026-08-12-rehearsal` are all untouched.
- **Blast radius:** zero for production. The branch is a local test artifact; the only way this run reaches users is if someone lands it, which is a separate, explicitly-requested operation.

---

## 14. Gaps in this log

- **Maestro E2E was never run.** Four PRs in the set touch Maestro flows or `e2e.yml`. Their E2E status is *unknown*, not green, and this branch does not establish otherwise.
- **No real build was produced.** Justified — nothing in the set touches `ios/`, `android/`, `patches/` or a native dependency — but it means "green" here is a Jest claim, not an app-builds claim.
- **`check:native-deps` and `test:scripts` were not run**, for the same reason. #667 and #676 do edit `package.json` scripts, so `test:scripts` was arguably in scope and was skipped.
- **Timings are approximate.** Wall-clock came from the log's own timestamps, not from instrumented measurement.
- **#651's "already landed" verdict rests on two pieces of evidence** — an empty rebase and two byte-identical files — not on locating the commit that landed it on `main`. `git cherry` actively disagrees. The conclusion is well-supported but the landing commit was never named.
- **Per-PR diff-scope checks were done by comparing residuals**, not by a literal set-difference of `gh pr diff --name-only` against the branch for all 13. The four flagged PRs got the full treatment; the other nine were cleared by the audit's content-equivalence/patch-id match alone.

---

## 15. Timeline

| Phase | Start | End | Elapsed |
|---|---|---|---|
| Preflight + fetch + cut | 17:11 | 17:13 | ~2 min |
| `npm ci` in worktree | 17:13 | 17:14 | ~1 min |
| Baseline (five checks) | 17:14 | 17:15 | ~1 min |
| Merge loop, #651 → #674 | 17:15 | 17:26 | ~11 min |
| #676 conflict, resolve, final checkpoint | 17:26 | 17:29 | ~3 min |
| Coverage gate + semantic sweep | 17:29 | 17:32 | ~3 min |
| Rebase onto `2580f910` + re-verify | 18:01 | 18:05 | ~4 min |
| Post-run integration of #684 + re-verify | 18:21 | 18:27 | ~6 min |
| **Total** | 17:11 | 18:27 | **~31 min active** |

Three biggest time sinks: the twelve five-check checkpoints (unavoidable and the point of the exercise), the O2 zsh pathspec detour, and the O1 investigation of #651.

---

## 16. Post-run integration — PR #684 (18:21–18:27)

Added after the run above had concluded, so §3's checkpoint table, §5's conflict ledger and §14's caveats all describe the thirteen-PR run and were deliberately **not** rewritten. This section is the fourteenth entry.

| What | Value |
|---|---|
| PR | [#684](https://github.com/RonenMars/threadbase-mobile/pull/684) — `fix(auth): send the scoped device token instead of the shared admin key` |
| Branch merged | `origin/fix/review-defects` @ `b5151418` |
| Onto | `0984f89a` |
| Result | `601c116c` |
| Conflicts | none |
| Command | `git merge --no-ff origin/fix/review-defects -m "integrate PR #684: …"` |

The merge also brought the branch level with `main` @ `3035773e` (one docs commit, `[skip-ci]`), because #684's own base already contained it. The branch went from 25 commits / 11 merge commits to **27 / 12**.

### Checkpoint

All five required checks re-run on `601c116c`:

| Check | Result |
|---|---|
| `npm run lint` | green — 5 warnings, 0 errors, all pre-existing |
| `npm run typecheck` | green |
| `npm run test:unit` | green — 108 suites, 1023 tests |
| `npm run test:integration` | green — 44 suites, 299 tests |
| `npm run test:i18n` | green — 3 suites, 55 passed, 1 skipped |

### One trap worth recording

The first lint attempt used `npx eslint .` and reported **398 problems (384 errors)**. None were in the merged change: bare `eslint .` walks `design/`, `scripts/` and `design/ui_kits/`, which the repo's actual `lint` script excludes — it globs `"**/*.{ts,tsx}" "e2e/**/*.js" "__tests__/unit/scripts/**/*.js"`. Reading that failure as a regression would have been wrong in both directions: it is not caused by the merge, and it is not what CI gates on. **Run `npm run lint`, never bare `eslint .`.**

### Status of the branch after this

Still a test artifact with an expiry, not a landing vehicle. #684 reaches `main` through its own PR, exactly like the thirteen before it.
