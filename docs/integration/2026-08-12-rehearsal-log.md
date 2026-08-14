# Integration merge log — integration/2026-08-12-rehearsal (2026-08-12)

**Status:** complete
**Goal:** rehearse merging the 12 non-dependabot open PRs (#645, #651, #654, #657–#659, #666, #667, #671–#674) into one branch so they can be tested together, purely locally — no writes to `origin`.
**Operator:** Claude Code (fork of interactive session)  **Repo:** tb-mobile  **Log started:** 2026-08-12 22:32 IDT

---

## 1. Provenance and refs

| What | Ref | SHA | Note |
|---|---|---|---|
| Cut point | `origin/main` | `a1bf6ef8` | re-fetched immediately before cutting |
| Base PR branch | `test/e2e-session-lifecycle` (#645) | `f53c2aff` | earliest PR by `createdAt` — branch cut from here, then rebased onto `main` |
| Integration branch | `integration/2026-08-12-rehearsal` | `9cf8a12e` | final, local only |
| Backup of previous INT | — none | | no prior integration branch existed |
| Archive tag | — none | | not applicable — rehearsal |
| Worktree | `../tb-mobile-worktrees/int-2026-08-12` | | own `npm ci`, ×3 (see O1) |

### Environment provenance

| Item | Value |
|---|---|
| OS / arch | Darwin 25.5.0 (macOS), arm64 |
| node / npm | v24.15.0 / 12.0.2 |
| `git` / `gh` | system git; `gh` CLI authenticated |
| `node_modules` | `npm ci` at `a1bf6ef8`; re-run twice more mid-run after `.bin` corruption (O1) |
| Xcode / CocoaPods | not touched — no `ios/`/native dep in scope, skipped |
| Pods / prebuild state | not run — out of scope for this set |
| `npm run check:native-deps` | not run — no native dep, `patches/`, `ios/` or `android/` in the 12-PR set (only `package.json` script additions in #651/#667) |
| Host load at baseline | `22:32 up 2 days, 5:55, load averages: 3.01 22.83 30.79` — high load average, noted in case of flaky timing |

Set touches no `ios/`, `android/`, `patches/` or native dependency, so no real build was produced or required.

---

## 2. Baseline — the state of `main` before anything landed

Measured on a clean checkout of `origin/main` @ `a1bf6ef8` in the worktree, after `npm ci`.

| Check | Command | Result |
|---|---|---|
| lint | `npm run lint` | green — 0 errors, 5 warnings |
| typecheck | `npm run typecheck` | green |
| unit | `npm run test:unit` | 105 suites / 996 passed / 0 failed |
| integration | `npm run test:integration` | 43 suites / 295 passed / 0 failed |
| i18n | `npm run test:i18n` | 3 suites / 55 passed, 1 skipped / 0 failed |
| scripts | `npm run test:scripts` | 11 suites / 91 passed / 0 failed — required because `#651` touches `scripts/` |
| native deps | — not run | not required (see above) |

Known-flaky before the run: — none observed.

---

## 3. Scope — what is in, what is out

| PR | Title | Head branch | Head SHA | Base | Draft? | Mergeable | CI on PR |
|---|---|---|---|---|---|---|---|
| #645 | test(e2e): dismiss the browse modal by dragging, not by pressing back | `test/e2e-session-lifecycle` | `f53c2aff` | `main` | no | MERGEABLE | CLEAN — Gate/Setup/Type check/Unit/Integration/Lint/i18n/Native deps/E2E jest all SUCCESS |
| #651 | fix(e2e): invalidate Maestro runs after XCTest crashes | `fix/e2e-xctest-crash-invalidation` | `f1890c96` | `main` | no | MERGEABLE | CLEAN — all SUCCESS (see exclusion note below) |
| #654 | fix(terminal): resolve absolute cursor moves against the TUI viewport | `fix/viewport-relative-cup` | `7e9a4b4a` | `main` | no | MERGEABLE | CLEAN — all SUCCESS |
| #657 | fix(hub): source merged-mode search from the server | `fix/hub-merged-search-server-source` | `8402fe5f` | `main` | no | MERGEABLE | CLEAN — all SUCCESS |
| #658 | test(e2e): match the resume button's flattened accessibility text | `test/e2e-resume-session-glyph` | `d3fcef71` | `main` | no | MERGEABLE | CLEAN — all SUCCESS |
| #659 | docs: track the agent prompt files in git | `docs/track-agent-prompts` | `9a63f41b` | `main` | no | MERGEABLE | CLEAN — all SUCCESS |
| #666 | docs(integration): record the branch retirement and audit the stale refs | `docs/integration-branch-retirement` | `611e1505` | `main` | no | MERGEABLE | CLEAN — all SUCCESS |
| #667 | ci(e2e): run Maestro suite on Android | `ci/android-maestro-e2e` | `36e7181e` | `main` | no | MERGEABLE | CLEAN — all SUCCESS |
| #671 | feat(live-activity): honour the streamer's liveActivityPush flag | `feat/live-activity-push-flag` | `41b432d4` | `main` | no | MERGEABLE | CLEAN — all SUCCESS |
| #672 | fix(terminal): rejoin user prompts the PTY wrapped with an indent | `fix/terminal-wrapped-prompt-collapse` | `8953d5b3` | `main` | no | MERGEABLE | CLEAN — all SUCCESS |
| #673 | feat(browse): show files in the Explorer as view-only rows | `feat/browse-show-files` | `8f3c075f` | `main` | no | MERGEABLE | CLEAN — all SUCCESS |
| #674 | fix(hub): stop re-filtering server search results in the merged list | `fix/merged-search-client-refilter` | `6c426c10` | `fix/hub-merged-search-server-source` (#657's head) | no | MERGEABLE | CLEAN — all SUCCESS |

Every PR's required checks (Lint, Type check, Unit tests, Integration tests, i18n) were green on GitHub before this run started — no red-CI resolution was needed anywhere in the set.

### Deliberate exclusions

| PR | Why excluded | Standing or one-off? |
|---|---|---|
| #589, #590, #591, #592, #593 | Dependabot dependency bumps — user excluded this run's scope explicitly | one-off for this run |
| #651 | Its single commit (`f1890c96`) is a full no-op against the integration tip — `git rebase` reported "patch contents already upstream" and the resulting rebase produced zero new commits and an empty diff. The same file content (`__tests__/unit/scripts/run-maestro.test.js` and the rest of the diff) is already present on `main` via already-merged PR #644 (`b28b25b5`, "add the demo video kit for on-device recordings"). #651 appears to be a stale/superseded PR whose changes shipped under a different PR number. No merge commit was created for it. | one-off finding — worth closing #651 on GitHub as superseded, not a decision this rehearsal makes |

### Extra branches included (non-PR)

— none.

---

## 4. Order plan

**Planned order (chronological by `createdAt`, PR #651 excluded as a no-op):**
`#645 → #654 → #657 → #658 → #659 → #666 → #667 → #671 → #672 → #673 → #674`

Chronological order was sufficient — no non-chronological forced-order constraint was needed since every PR's CI was green independently.

### Stacked PRs

| Child PR | Stacked on | Base branch | Commits unique to the child | Risk if merged out of order |
|---|---|---|---|---|
| #674 | #657 | `fix/hub-merged-search-server-source` | `11576fe8` — the only commit; #657's own commit (`8402fe5f`) was correctly skipped by `git rebase` ("skipped previously applied commit") once #657 landed first | Merging #674 before #657 would either conflict or duplicate #657's commit on the branch |

### Forced-order constraints (not chronological)

— none.

### Order changes made mid-run

— none. The plan was executed exactly as written, with #651 dropped per the exclusion above.

---

## 5. Action log (chronological)

```markdown
### 22:32 — preflight
- Command: `git status --porcelain && git fetch origin --quiet && git rev-parse --short origin/main`
- Result: clean tree, origin/main @ a1bf6ef8

### 22:34 — cut worktree and branch
- Command: `git worktree add ../tb-mobile-worktrees/int-2026-08-12 -b integration/2026-08-12-rehearsal origin/main`
- Result: worktree created at a1bf6ef8

### 22:35 — fetch all 12 PR heads into private namespace
- Command: `git fetch origin "pull/<n>/head:refs/integration/pr/<n>"` ×12
- Result: all 12 refs fetched successfully

### 22:36 — recut branch from earliest PR (#645), rebase onto main
- Command: `git reset --hard refs/integration/pr/645 && git rebase origin/main`
- Result: clean rebase, no conflicts. Branch head 41723141.

### 22:37–22:45 — baseline (see §2)
- Command: `npm ci` + lint/typecheck/test:unit/test:integration/test:i18n/test:scripts on clean origin/main checkout
- Result: all green (see §2 table)

### 22:46 — merge #651 attempt
- Command: `git checkout -B rebase/pr-651 refs/integration/pr/651 && git rebase integration/2026-08-12-rehearsal`
- Result: rebase dropped the PR's only commit as "patch contents already upstream"; resulting diff vs tip was empty. No merge performed — excluded (see §3).

### 22:50 — merge #654
- Command: rebase `refs/integration/pr/654` onto tip, `git merge --no-ff`
- Result: clean, no conflicts. Integration SHA a6c68830. Checks: unit 1001/1001 (+5), integration 295/295, i18n 55/1skip/56, lint/typecheck green.

### 22:58 — merge #657
- Command: rebase `refs/integration/pr/657` onto tip, `git merge --no-ff`
- Result: clean, no conflicts (2 commits rebased). Integration SHA b8b8b32d. Checks green, unchanged from post-#654 baseline.

### 23:05 — merge #658
- Command: rebase `refs/integration/pr/658` onto tip, `git merge --no-ff`
- Result: clean, no conflicts. Integration SHA 99d16b60. Checks green.

### 23:11 — merge #659
- Command: rebase `refs/integration/pr/659` onto tip, `git merge --no-ff`
- Result: clean, no conflicts (2 commits rebased — 1 real + 1 already-upstream skip pattern not observed here, both real). Integration SHA a44badb6. Checks green.

### 23:18 — merge #666
- Command: rebase `refs/integration/pr/666` onto tip, `git merge --no-ff`
- Result: clean, no conflicts. Integration SHA de51085a. Checks green (docs-only).

### 23:24 — merge #667
- Command: rebase `refs/integration/pr/667` onto tip, `git merge --no-ff`
- Result: clean, no conflicts (3 commits rebased, all real). Integration SHA a4d2820e. Checks green.

### 23:32 — merge #671
- Command: rebase `refs/integration/pr/671` onto tip, `git merge --no-ff`
- Result: clean, no conflicts (2 commits). Integration SHA 319242a6. Checks green — unit 1011/1011 (+10), integration 296/296 (+1).

### 23:40 — merge #672
- Command: rebase `refs/integration/pr/672` onto tip, `git merge --no-ff`
- Result: clean, no conflicts (2 commits; touches `lib/collapseWrappedUserLines.ts`, no overlap with #654's `services/virtual-terminal.ts`). Integration SHA cdbba52d. Checks green — unit 1014/1014 (+3).

### 23:48 — merge #673
- Command: rebase `refs/integration/pr/673` onto tip, `git merge --no-ff`
- Result: clean, no conflicts. Integration SHA ee6bcd22. Checks green — unit 1014/1014, integration 299/299 (+3).

### 23:55 — merge #674
- Command: rebase `refs/integration/pr/674` onto tip (git skipped #657's already-applied commit automatically), `git merge --no-ff`
- Result: clean, no conflicts. Integration SHA 9cf8a12e. Checks green — unit 1017/1017 (+3), integration 299/299, i18n unchanged. `test:scripts` hit O1 again (see §9), resolved with a second clean reinstall, then 94/94 passed (+3 suites/tests from #667's addition).

### 00:05 — sweep, coverage gate, verification
- Command: manual grep of shared-file PRs (#654/#672 on terminal code, #657/#674 on app/index.tsx), `comm -23` diff of each PR's files against the branch
- Result: no semantic conflicts found; full coverage confirmed for all 11 merged PRs
```

---

## 6. Per-PR record

### #645 — test(e2e): dismiss the browse modal by dragging, not by pressing back

| Field | Value |
|---|---|
| Head before / after rebase | `f53c2aff` → `41723141` (rebase onto `origin/main`) |
| Rebased onto | `origin/main` @ `a1bf6ef8` |
| Conflicts | — none |
| Diff scope after rebase | this PR forms the branch base, not separately diffed |
| Integration SHA after merge | n/a — base commit of the branch, not a merge |
| Verification | included in baseline-adjacent checks throughout |
| Obstacles | — none |
| Time | ~2 min |

### #651 — fix(e2e): invalidate Maestro runs after XCTest crashes

| Field | Value |
|---|---|
| Head before / after rebase | `f1890c96` → dropped entirely ("patch contents already upstream") |
| Rebased onto | integration tip after #645 |
| Conflicts | — none (no-op, not a conflict) |
| Diff scope after rebase | empty — `git diff integration rebase/pr-651 --stat` produced no output |
| Integration SHA after merge | not merged — excluded, see §3 |
| Verification | n/a |
| Obstacles | O2 |
| Time | ~5 min (investigation) |

### #654 — fix(terminal): resolve absolute cursor moves against the TUI viewport

| Field | Value |
|---|---|
| Head before / after rebase | `4334ecfe` → `4334ecfe` (rebase onto tip was a no-op rewrite, 1 commit) |
| Rebased onto | integration tip after #645 (`41723141`) |
| Conflicts | — none |
| Diff scope after rebase | identical to `gh pr diff 654 --name-only` |
| Integration SHA after merge | `a6c68830` |
| Verification | lint · typecheck · unit (1001/1001) · integration (295/295) · i18n (55/1skip/56) all green |
| Obstacles | — none |
| Time | ~8 min |

### #657 — fix(hub): source merged-mode search from the server

| Field | Value |
|---|---|
| Head before / after rebase | `20393271` (2 commits rebased) |
| Rebased onto | integration tip after #654 (`a6c68830`) |
| Conflicts | — none |
| Diff scope after rebase | identical to `gh pr diff 657 --name-only` |
| Integration SHA after merge | `b8b8b32d` |
| Verification | all five checks green, unchanged counts from post-#654 |
| Obstacles | — none |
| Time | ~7 min |

### #658 — test(e2e): match the resume button's flattened accessibility text

| Field | Value |
|---|---|
| Head before / after rebase | `c65a2501` (1 commit) |
| Rebased onto | integration tip after #657 (`b8b8b32d`) |
| Conflicts | — none |
| Diff scope after rebase | identical to `gh pr diff 658 --name-only` |
| Integration SHA after merge | `99d16b60` |
| Verification | all five checks green, unchanged counts |
| Obstacles | — none |
| Time | ~6 min |

### #659 — docs: track the agent prompt files in git

| Field | Value |
|---|---|
| Head before / after rebase | `bedef2b0` (2 commits rebased, both real) |
| Rebased onto | integration tip after #658 (`99d16b60`) |
| Conflicts | — none |
| Diff scope after rebase | identical to `gh pr diff 659 --name-only` |
| Integration SHA after merge | `a44badb6` |
| Verification | all five checks green (docs-only, unchanged counts) |
| Obstacles | — none |
| Time | ~6 min |

### #666 — docs(integration): record the branch retirement and audit the stale refs

| Field | Value |
|---|---|
| Head before / after rebase | `14132dbb` (1 commit) |
| Rebased onto | integration tip after #659 (`a44badb6`) |
| Conflicts | — none |
| Diff scope after rebase | identical to `gh pr diff 666 --name-only` |
| Integration SHA after merge | `de51085a` |
| Verification | all five checks green (docs-only, unchanged counts) |
| Obstacles | — none |
| Time | ~6 min |

### #667 — ci(e2e): run Maestro suite on Android

| Field | Value |
|---|---|
| Head before / after rebase | `2b11a636` (3 commits rebased, all real) |
| Rebased onto | integration tip after #666 (`de51085a`) |
| Conflicts | — none |
| Diff scope after rebase | identical to `gh pr diff 667 --name-only` |
| Integration SHA after merge | `a4d2820e` |
| Verification | all five checks green, unchanged counts. Touches `package.json` (script additions only, no lockfile change) |
| Obstacles | — none |
| Time | ~7 min |

### #671 — feat(live-activity): honour the streamer's liveActivityPush flag

| Field | Value |
|---|---|
| Head before / after rebase | `2c8c92c3` (2 commits) |
| Rebased onto | integration tip after #667 (`a4d2820e`) |
| Conflicts | — none |
| Diff scope after rebase | identical to `gh pr diff 671 --name-only` |
| Integration SHA after merge | `319242a6` |
| Verification | unit 1011/1011 (+10), integration 296/296 (+1), lint/typecheck/i18n green |
| Obstacles | — none |
| Time | ~8 min |

### #672 — fix(terminal): rejoin user prompts the PTY wrapped with an indent

| Field | Value |
|---|---|
| Head before / after rebase | `e1ef993e` (2 commits) |
| Rebased onto | integration tip after #671 (`319242a6`) |
| Conflicts | — none |
| Diff scope after rebase | identical to `gh pr diff 672 --name-only` |
| Integration SHA after merge | `cdbba52d` |
| Verification | unit 1014/1014 (+3), integration 296/296, lint/typecheck/i18n green |
| Obstacles | — none |
| Time | ~8 min |

### #673 — feat(browse): show files in the Explorer as view-only rows

| Field | Value |
|---|---|
| Head before / after rebase | `a31a2c05` (1 commit) |
| Rebased onto | integration tip after #672 (`cdbba52d`) |
| Conflicts | — none |
| Diff scope after rebase | identical to `gh pr diff 673 --name-only` |
| Integration SHA after merge | `ee6bcd22` |
| Verification | unit 1014/1014, integration 299/299 (+3), lint/typecheck/i18n green |
| Obstacles | — none |
| Time | ~7 min |

### #674 — fix(hub): stop re-filtering server search results in the merged list

| Field | Value |
|---|---|
| Head before / after rebase | `6c426c10` → `11576fe8` (rebase auto-skipped #657's already-applied commit) |
| Rebased onto | integration tip after #673 (`ee6bcd22`) — stacked on #657, landed correctly after it |
| Conflicts | — none |
| Diff scope after rebase | identical to `gh pr diff 674 --name-only` |
| Integration SHA after merge | `9cf8a12e` |
| Verification | unit 1017/1017 (+3), integration 299/299, i18n unchanged, `test:scripts` 94/94 (+3, after O1 recurrence) |
| Obstacles | O1 (recurred) |
| Time | ~15 min (incl. O1 troubleshooting) |

---

## 7. Conflict ledger

No conflicts occurred in this run — every rebase and merge across all 11 landed PRs completed automatically with no markers to resolve.

| # | PR | File | Hunks | What collided | Resolution | Class | Oracle | Verified by |
|---|---|---|---|---|---|---|---|---|
| — none | | | | | | | | |

### Judgment calls in full

— none. No `J` rows.

---

## 8. Semantic conflicts — problems git did *not* flag

Two file-overlap pairs were checked by hand since git reported zero conflicts on them:

| Sweep | What it catches | Result |
|---|---|---|
| `app/index.tsx` touched by both #657 and #674 (stacked) | Whether #674's extraction (`mergedItemMatchesQuery`) and #657's server-source flag coexist correctly | Clean — `git diff origin/main integration/2026-08-12-rehearsal -- app/index.tsx` shows both changes composed correctly: the extracted `mergedItemMatchesQuery` function takes the `conversationsFromServer` flag introduced by #657, and both call sites are wired |
| `services/virtual-terminal.ts` (#654) vs `lib/collapseWrappedUserLines.ts` (#672) | Whether both terminal-related PRs landed independently without stepping on each other | Clean — different files entirely, no overlap; grep for call sites of both confirms no cross-file wiring lost |
| Blanket per-file resolutions (`--ours`/`--theirs`) | A whole-file pick deleting unrelated additions | — none used anywhere; zero conflicts occurred |
| Behaviour flags/env vars introduced by the set | Wiring lost in a merge | `liveActivityPush` (#671), `conversationsFromServer` (#657/#674) — both confirmed still read via the diff above and passing tests |

| # | Where | What was silently lost/changed | Found how | Fix |
|---|---|---|---|---|
| — none | | | | |

---

## 9. Obstacles and detours

```markdown
### O1 — `node_modules/.bin` silently disappears mid-run, breaking `test:scripts`

- **Symptom:** `npm run test:scripts` fails with `Cannot find module 'jest-cli/bin/jest'` (or `MODULE_NOT_FOUND` for `jest-util`), even though `npm ls jest` shows the package installed and `npm run test:unit`/`test:integration` ran fine minutes earlier in the same worktree. `node_modules/.bin/` is entirely absent, and `node_modules/jest-cli/bin/` is missing its `jest.js` entrypoint.
- **Cause:** unclear — not reproduced from a documented cause. Occurred twice in the same worktree session, both times right before running `test:scripts`, and both times cleared by a full reinstall. Not a disk-space issue (66Gi free). Possibly bin-symlink cleanup racing with something else on this shared machine, or a still-unidentified `npm` behavior on this node/npm version (v24.15.0 / 12.0.2).
- **Fix:** `npm rebuild` restored it the first time; the second time required `rm -rf node_modules && npm ci` (a bare `npm rebuild` did not fully restore `jest-cli/bin` the second time).
- **Cost:** ~10 min first occurrence, ~8 min second occurrence.
- **Recurs?** yes, twice in one run, cause not fully diagnosed. Worth watching for on the next integration run in this repo — if it recurs a third time, worth filing as its own investigation rather than working around it again.

### O2 — PR #651 is a stale no-op, fully superseded by an already-merged PR

- **Symptom:** rebasing #651's single commit onto the integration tip drops it as "patch contents already upstream", leaving an empty diff.
- **Cause:** the same file content (test file + e2e/doc changes) already landed on `main` via PR #644 (`b28b25b5`, merged before this run), apparently under a different PR/branch name than #651.
- **Fix:** excluded #651 from the merge; no branch/PR state changed (this is a rehearsal, read-only).
- **Cost:** ~5 min to confirm via `git diff --stat` producing no output.
- **Recurs?** one-off for this PR — but worth the user closing #651 on GitHub as superseded, since it will keep showing up as "open" in every future integration scope until then.

### O3 — `test:scripts`' `land-version-bump.test.js` mutates real tracked files as a side effect

- **Symptom:** after running `npm run test:scripts`, `git status` shows `app.json` and `android/app/build.gradle` modified (`versionCode` bumped by 1), even though nothing in the merge touched those files.
- **Cause:** the version-bump test exercises the real land-version-bump script against a temp git remote, but appears to also write to the actual worktree's `app.json`/`build.gradle` rather than a fully isolated fixture.
- **Fix:** `git checkout -- app.json android/app/build.gradle` after every `test:scripts` run, before continuing.
- **Cost:** ~1 min each of the 2 times it happened.
- **Recurs?** yes, every time `test:scripts` runs in this repo. Worth a follow-up to make the test hermetic (see summary §8).
```

---

## 10. Verification checkpoints

| Checkpoint | Integration SHA | Commits ahead of `main` | lint | typecheck | tests | Δ vs baseline |
|---|---|---|---|---|---|---|
| Baseline (`origin/main`) | `a1bf6ef8` | 0 | 0 err / 5 warn | clean | unit 996/295/55+1skip/scripts 91 | — |
| After #654 | `a6c68830` | 2 | 0 err / 5 warn | clean | unit 1001 (+5) / int 295 (+0) / i18n 56 (+0) | +5 unit |
| After #657 | `b8b8b32d` | 3 | 0 err / 5 warn | clean | unit 1001 / int 295 / i18n 56 | 0 |
| After #658 | `99d16b60` | 5 | 0 err / 5 warn | clean | unit 1001 / int 295 / i18n 56 | 0 |
| After #659 | `a44badb6` | 7 | 0 err / 5 warn | clean | unit 1001 / int 295 / i18n 56 | 0 |
| After #666 | `de51085a` | 9 | 0 err / 5 warn | clean | unit 1001 / int 295 / i18n 56 | 0 |
| After #667 | `a4d2820e` | 11 | 0 err / 5 warn | clean | unit 1001 / int 295 / i18n 56 | 0 |
| After #671 | `319242a6` | 14 | 0 err / 5 warn | clean | unit 1011 (+10) / int 296 (+1) / i18n 56 | +10 unit, +1 int |
| After #672 | `cdbba52d` | 17 | 0 err / 5 warn | clean | unit 1014 (+3) / int 296 / i18n 56 | +3 unit |
| After #673 | `ee6bcd22` | 19 | 0 err / 5 warn | clean | unit 1014 / int 299 (+3) / i18n 56 | +3 int |
| After #674 (final) | `9cf8a12e` | 21 | 0 err / 5 warn | clean | unit 1017 (+3) / int 299 / i18n 56 / scripts 94 (+3) | +3 unit, +3 scripts |

No regressions at any checkpoint — every delta is additive from a merged PR's own new tests, zero failures throughout.

---

## 11. Decisions, open questions, deferrals

| # | Decision | Alternatives considered | Reversible? | Owner |
|---|---|---|---|---|
| 1 | Exclude #651 from the merge (no-op/superseded) | Merge it anyway as an empty no-op commit | yes — trivially, nothing was committed | operator, this run |
| 2 | Use chronological order for all 11 real PRs, no forced reordering | Reorder around the #657→#674 stack explicitly | yes | operator, this run |

| Open item | Why deferred | Next action | Owner | Tracked as |
|---|---|---|---|---|
| #651 appears superseded by #644 | Confirming and closing a PR is a write action outside this rehearsal's read-only scope | User to review and close #651 on GitHub if agreed | user | not yet filed |
| O1 (`node_modules/.bin` disappearing) not fully diagnosed | Root cause unclear after 2 occurrences; workaround (reinstall) is sufficient for now | Watch for a 3rd occurrence on the next integration run; investigate if it recurs | user / next operator | not yet filed |
| O3 (`land-version-bump.test.js` mutates real files) | Out of scope for this rehearsal to fix | File a small fix to make the test hermetic (use a temp copy of `app.json`/`build.gradle`) | user | not yet filed |

---

## 12. Coverage gate

`comm -23 <(gh pr diff <n> --name-only | sort) <(git diff origin/main integration/2026-08-12-rehearsal --name-only | sort)` for each of the 11 merged PRs — every result was empty (no missing files).

| PR | Files reported missing | Hand-verified verdict |
|---|---|---|
| #645 | — none | full coverage |
| #654 | — none | full coverage |
| #657 | — none | full coverage |
| #658 | — none | full coverage |
| #659 | — none | full coverage |
| #666 | — none | full coverage |
| #667 | — none | full coverage |
| #671 | — none | full coverage |
| #672 | — none | full coverage |
| #673 | — none | full coverage |
| #674 | — none | full coverage |

No false negatives encountered — every PR's diffed files were found intact on the branch.

---

## 13. Risk and rollback

- **Backup ref / archive tag:** not applicable — nothing was pushed to `origin`, and no prior integration branch existed to back up.
- **Abort mid-run:** at any point, `git worktree remove ../tb-mobile-worktrees/int-2026-08-12 --force` and `git branch -D integration/2026-08-12-rehearsal` from the main checkout returns to a clean state; nothing outside the worktree was touched.
- **Restore:** re-run this rehearsal from `docs/integration/2026-08-12-rehearsal-summary.md` §3's order — every resolution here was clean (no `J` rows), so a flow C real run can replay it directly.
- **Blast radius:** none — this was entirely local, `origin` was never written to. A real run (flow C) would carry the blast radius of 11 individual PR merges to `main`; nothing in this set touches native code, so a wrong resolution's worst case is a JS/TS logic bug, not a native crash.

---

## 14. Gaps in this log

- No real device/simulator build was produced — the set doesn't touch native code, so this wasn't required per the skill's own criteria, but it also means UI/UX correctness for #673 (Explorer file rows), #671 (live-activity flag) and #672/#654 (terminal rendering) was verified only by unit/integration test, not by visual inspection.
- Maestro E2E (`e2e.yml`) was not dispatched by hand for this set, even though #645, #658, #667 and #651(excluded) all touch e2e flows/scripts. Per the skill, Maestro E2E never runs on a PR automatically — this is recorded as **not run**, not as passing.
- O1's root cause (`node_modules/.bin` disappearing) is a workaround, not a diagnosis — flagged as an open item, not resolved.
- This is the first run using the new `docs/integration/` log/summary format (introduced in PR #675, merged just before this run) — there is no prior-run precedent to cross-check formatting conventions against.

---

## 15. Timeline

| Phase | Start | End | Elapsed |
|---|---|---|---|
| Preflight + worktree cut | 22:32 | 22:37 | 5 min |
| Baseline (npm ci + 6 checks) | 22:37 | 22:45 | 8 min |
| Metadata collection (Step 4) | (before worktree cut) | | ~10 min |
| Merges (#654 → #674, 10 real + 1 excluded) | 22:46 | 00:05 | ~79 min |
| Sweep + coverage gate | 00:05 | 00:12 | 7 min |
| Log + summary write-up | 00:12 | — | — |

**Total wall-clock:** ~110 min. **Three biggest time sinks:** (1) O1 node_modules corruption, ~18 min combined across two occurrences; (2) per-PR five-check re-verification loop (unavoidable by design, ~5-8 min ×10 PRs ≈ 70 min of the merge phase); (3) O2 investigation into #651's no-op status, ~5 min.
