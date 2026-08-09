# RUN THIS — cut fresh integration branches from `main` and land the PRs one by one

**Paste this whole file into a fresh Claude Code session. It covers two repos — do tb-mobile first, then tb-streamer. Everything below is your instruction set, not a menu.**

## Why fresh rather than repairing

Both existing integration branches accumulated merges until they diverged from `main`, then needed rebuilding — which rewrote history and orphaned the PRs pointed at them. Repairing them means resolving conflicts that are duplicate content on both sides (tb-mobile #580 shows 83 files of it). Cutting fresh from today's `main` and merging each PR's **current head** skips every one of those conflicts.

The old branches stay untouched as the reference you validate against. Do not delete them.

## Current state (re-verify before starting — these move)

| Repo | `main` | Existing INT |
|---|---|---|
| tb-mobile | `7b7d9250` | `integration/open-prs-291-544-…-569` @ `0a4dd2d5` |
| tb-streamer | `419746d` | `integration/prs-223-441-…-456` @ `7844eb2` |

```bash
git fetch origin
git rev-parse --short origin/main
git rev-parse --short "origin/<INT branch>"
```

**Re-fetch immediately before you cut.** `origin/main` is a cached ref: a stale one produces a fresh branch that silently is not from today's `main`, with no error at any point. Both repos' `main` moved more than once during the session that wrote this prompt.

So directly before every `git worktree add`, run:

```bash
git fetch origin && git rev-parse --short origin/main
```

State that SHA in your first report. If it differs from the table above, use yours and say so — the table is a snapshot, your fetch is the truth.

Brace refs when interpolating a branch into a path — `git show "${B}:src/foo.ts"` — because zsh expands `:e`, `:s` and friends as parameter modifiers and silently returns nothing, which downstream `grep -c` scores as `0`.

## Shared rules

- **Work in a worktree, outside the repo root.** `git worktree add ../<repo>-worktrees/<slug> -b <branch> origin/main`
- **`npm ci` in every new worktree.** Never copy or hardlink `node_modules` from another checkout — it installs that branch's resolved versions, not this lockfile's, and produces green runs that CI contradicts. Print what loaded before trusting a result.
- **Never force-push `main`.** Never merge anything into `main` outside a PR.
- **Commit approval before every commit**, per `CLAUDE.md`. Conventional titles, no AI attribution.
- **Report actual command output**, not summaries.

---

# Part 1 — tb-mobile

## Step 1.1 — Back up the old INT

```bash
git branch backup/int-mobile-<date> origin/integration/open-prs-291-544-551-553-554-556-557-558-559-560-563-566-567-568-569
git push origin backup/int-mobile-<date>
```

`git tag <name> <sha>` fails on this machine with `fatal: no tag message?` — the config forces annotated tags. Pass `-m`.

## Step 1.2 — Cut the fresh branch

```bash
git fetch origin && git rev-parse --short origin/main   # confirm the cut point, print it
git worktree add ../tb-mobile-worktrees/int-fresh -b integration/fresh-2026-08-09 origin/main
cd ../tb-mobile-worktrees/int-fresh && npm ci
```

## Step 1.3 — Merge each PR's current head

Merge these, in this order. Use each PR's **current head SHA**, not a remembered one — several were rebased today.

```
544 → 551 (stacked on 544) → 553 → 554 → 556 → 558 → 559 → 560 → 563 → 566 → 567 → 568 → 569 → 574 → 576 → 572 → 585
```

`#551` is based on `fix/resumed-terminal-scrollback-disclosure`, not `main` — merge `#544` first.

**`#568` is `CONFLICTING` against `main`.** Rebase it onto `main` and push before merging it here; do not resolve its conflict inside the integration branch.

### Do not merge — mobile

| PR | Why |
|---|---|
| **#291** (TypeScript 7) | Outside `@typescript-eslint`'s peer range (`>=4.8.4 <6.1.0`); crashes the parser at load on `ts.Extension.Cjs`. `tsc --noEmit` stays green, so "Type check passes" is not evidence it is safe. |
| **#557** (jest 30) | `jest-expo@57` pins the jest 29 family; every suite dies at `resetModules`. The `--testPathPattern` rename is the visible error and masks this. |
| **#575, #580** | **Content already on `main`** via #578 and #579. Verified byte-identical. Close them rather than merging — closing is the repo owner's call, so ask first. |

Merging #291 or #557 re-breaks every PR on the branch; that is what #577 had to revert.

---

# Part 2 — tb-streamer

## Step 2.0 — Do not switch the primary checkout to `main`

`docs/pr-follow/Streamer-OPEN-PRs.md` — the log you must update in Part 5 — is tracked on the integration branch and on `docs/pr-follow-notes` (#468), but **does not exist on `main`**. Checking out `main` in the primary checkout makes it disappear from the working tree.

Leave the primary checkout where it is; all work happens in a worktree regardless. If #468 has merged by the time you read this, `docs/pr-follow/` is on `main` and this no longer applies — verify with `git cat-file -e origin/main:docs/pr-follow/Streamer-OPEN-PRs.md` rather than assuming.

## Step 2.1 — Back up, then cut

```bash
git branch backup/int-streamer-<date> origin/integration/prs-223-441-442-444-446-447-448-449-450-451-452-453-454-455-456
git push origin backup/int-streamer-<date>
git fetch origin && git rev-parse --short origin/main   # confirm the cut point, print it
git worktree add ../tb-streamer-worktrees/int-fresh -b integration/fresh-2026-08-09 origin/main
cd ../tb-streamer-worktrees/int-fresh && npm ci
```

## Step 2.2 — Merge each PR's current head

```
442 → 444 → 446 → 447 → 448 → 456 (stacked on 448) → 449 → 450 → 451 → 452 → 453 → 454 → 455 → 461 → 462 → 464
```

**`#456` is stacked on `#448`** — its base is `cursor/fix-lifecycle-outside-pty-path-2a19`. Merge #448 first. #456's second commit (`fix(sessions): scope lifecycle-starting gate to the PTY path`) is the fix for the #448/#456 interaction and must not be dropped.

**`#447` is `DIRTY` against `main`** — rebase it onto `main` first. Its conflict with `src/codex-pty-runner.ts` is #463's later edit, not a missing fix.

### Do not merge — streamer

| PR | Why |
|---|---|
| **#223** (TypeScript 7) | Standing exclusion; breaks `rollup-plugin-dts`. Already reverted from an integration branch once. The branch name still carries `prs-223-…` from that attempt. |
| **#441** (npm group bump) | **It is a downgrade.** Its `nanoid`/`postcss` bumps are already present, and it moves three packages *backwards*: `@types/node` 26.1.2 → 26.1.1, `@types/semver` 7.8.0 → 7.7.1, `tar` 7.5.22 → 7.5.21. #452/#453/#454 supersede it. |

---

# Part 3 — Validate the fresh branch against the old one

**This is the acceptance gate. Do not open PRs or merge anything until it passes.**

### 3.1 — Content diff against the old INT

```bash
git diff origin/<old-INT> HEAD --stat
```

Every difference must be explainable as either (a) something on `main` that the old INT predates, or (b) a PR head that moved since the old INT merged it. **Anything you cannot explain is content the old branch had and the fresh one lost — stop and report it.**

### 3.2 — Coverage audit

```bash
python3 ~/.claude/skills/integration-branch-pr-audit/scripts/audit_integration_branch.py \
  --branch integration/fresh-2026-08-09 \
  --exclude-pr 291 --exclude-pr 557          # mobile
  # --exclude-pr 223 --exclude-pr 441        # streamer
```

**Expect false negatives and verify each by hand — do not treat the report as the verdict.** The audit compares touched-file *state*, so a PR whose files were later edited by another PR reads as missing when its content is present. Known cases: mobile #560, #568, #572, #576; streamer #447, #461, #462. For each reported miss, diff that PR's own file set (`gh pr diff <n> --name-only`) against the branch before concluding anything.

Also check `branch_only_vs_all_prs.unique_non_doc_commits` — content on the old branch belonging to no PR at all. On the old streamer INT that found exactly one commit, which is now carried by #456.

### 3.3 — Build and test

| Repo | Commands |
|---|---|
| tb-mobile | `npm run typecheck`, `npm run lint`, `npx jest --ci --runInBand --watchman=false` |
| tb-streamer | `npm run lint`, `npm test` |

`--watchman=false` is required in a fresh worktree or jest hangs on watchman's crawl with no output.

**Baseline before attributing any failure.** The streamer suite fails ~684 tests on `main` today for pre-existing reasons. Run the same suite on `origin/main`, diff the failing *test names*, and only investigate the delta. A summary-count difference alone is noise.

If `package.json` or `package-lock.json` moved in tb-mobile, run `bundle exec pod install` from `ios/` and then `scripts/reset-podfile-lock-path-noise.sh`.

---

# Part 4 — Open the PRs

Once Part 3 passes, the integration branch is confirmed functional. Now re-point the work at `main` as individual PRs — **one PR per change, the same set that targeted the old integration branch.**

- A PR that already targets `main` and is green needs nothing — leave it.
- A PR that targeted the old INT gets `gh pr edit <n> --base main` and a rebase onto `main`.
- GitHub rejects two open PRs sharing the same head *and* base, so close any duplicate before re-targeting.

Do not open a PR whose content is already on `main` (mobile #575, #580).

---

# Part 5 — Merge to `main`, one at a time, logging as you go

**One PR at a time. Rebase onto latest `main`, wait for CI green, squash-merge, then move to the next.** A merged PR advances `main`, so the next is usually behind and must be rebased again. Never merge on red; re-run a flaky job once, then stop and report.

After **each** merge, append to the log for that repo:

| Repo | Log |
|---|---|
| tb-mobile | `docs/integration-to-main-2026-08-09.md` |
| tb-streamer | `docs/pr-follow/Streamer-OPEN-PRs.md` |

Record per PR: number and title, the squash SHA on `main`, CI result, anything that had to be rebased or resolved, and any obstacle plus how it was handled. These logs already carry that shape — match it. Write conclusions and obstacles as they happen, not at the end.

Re-verify the integration branch against `main` after every few merges; once its content is fully on `main` it should be retired, not maintained.

---

## Traps that have already produced wrong-but-plausible results

None of these error. Each returns a confident, wrong answer.

1. **Borrowed `node_modules`** verifies the wrong dependency versions — produced a green 155-suite run that CI flatly contradicted.
2. **The Bash tool is zsh; Actions `run:` steps are bash.** Unquoted list expansion splits in bash, not zsh, so CI shell logic checked locally returns a false failure. Test with an explicit `/bin/bash`.
3. **zsh parameter modifiers eat git paths.** `git show "$B:e2e/setup.yaml"` returns nothing; brace it.
4. **`cd` leaks across compound commands** — a check meant for one repo silently answers about the other. Always `cd` explicitly in each command.
5. **`e2e/ensure-release-build.js` silently reuses a stale `.app`** — one suite run tested a week-old build and reported it current.
6. **Audit false negatives** — see 3.2. Content equivalence fails when a later PR edits the same files.
7. **Branch names list intended PRs, not landed ones** — `prs-223-…` contains no #223. Check the tree, not the name.

## Deliverables

- Both fresh branch names and SHAs, and the backup refs for the old ones.
- Part 3 output in full: content diff, audit result with each false negative explained by hand, and test results with the baseline they were compared against.
- The list of PRs re-targeted, and any closed as already-merged (with approval).
- Both logs updated per merge.
- Anything left unmerged, and why.
