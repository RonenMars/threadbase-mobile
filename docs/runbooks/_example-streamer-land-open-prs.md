# Landing runbook — getting these PRs onto `main`

**Source:** [docs/postmortems/2026-07-22-merge-all-open-prs-report.md](../postmortems/2026-07-22-merge-all-open-prs-report.md). References below to "Part 1", "C1–C6" and "S1" are sections of that report.
**Status:** live procedure — edit it as PRs land.

The integration branch proves the PRs *can* coexist. It does not land them. Each still goes onto `main` one at a time under the repo's rebase + squash rule, and **the conflicts documented in Part 1 will recur** — this document maps them to the order so nobody meets them cold.

## Who should run this

Not uniform across the work: two of the five groups are mechanical, and two contain traps that are invisible unless the operator reads code that git reported as clean.

| Groups | Character of the work | Model | Effort |
|---|---|---|---|
| 1, 2, 5 — independents, dependabot, docs | Rebase, check CI, squash. No documented conflicts. The docs group has one predictable textual conflict in `BACKLOG.md`. | **Sonnet 5** (`claude-sonnet-5`) | **medium** |
| 3, 4 — the cache cluster and the live-sessions pair | Six documented conflicts, two silent-drop traps, one stacked-pair `--onto` rebase, and resolutions where the *ordering* of two blocks is a correctness decision. | **Opus 4.8** (`claude-opus-4-8`) | **high**, raised to **xhigh** for the two trap merges (#237, #253) |

**On effort.** Not `low` even for Group 1: the cheap groups still end in an irreversible squash to `main`, and `low` is where "CI is green, ship it" wins over checking *which commit* CI tested — a mistake this session made once already. Not `max` anywhere either; the hard part here is noticing that something is absent, which more deliberation per step does not buy. The one place to spend extra is the two merges where git reports success and code has gone missing — that is a "read this specific method and compare against a list" task, and `xhigh` buys the patience to actually do it rather than assume.

The model split is not about difficulty of the git commands — it is about what failure looks like. In Groups 3 and 4 the dangerous outcome is a **clean auto-merge, a green `tsc`, and silently deleted safety code**. Nothing prompts the operator to look; they have to already know to open the extracted method and check. That judgment, plus resisting the pull to accept a green signal, is where the stronger model earns its cost.

Do not use Haiku for any group. Every group ends in a squash-merge to `main`, and steps 3, 4 and 6 require deciding whether a green signal is trustworthy — this session produced three separate misattributed "flakes" and two wrong root-cause calls before the evidence was checked properly.

**Operating constraints for whoever runs it, human or model:**

- **One PR per session.** Context exhaustion mid-merge is how a resolution gets half-applied. Groups 3 and 4 in particular deserve a fresh context per PR.
- **Never parallelise.** Each merge advances `main` and stales the next; two in flight guarantees a stale rebase.
- **Verify, do not infer.** The rules that repeatedly mattered here: a blocked compound shell command runs *none* of its parts; a negative `grep` may mean the wrong working directory; a 5× jump in failures is an environment signal, not a code signal.

## Before starting — decide these once

| PR | Decision |
|---|---|
| **#223** `typescript-7.0.2` | **Excluded.** Standing instruction, carried from the 2026-07-20 round. |
| **#251** `chore/verify-open-prs-merge` | **Excluded and closeable.** It *is* the previous verification branch; `integration-dev/v1.0.0-2026-07-22` supersedes it. |
| **#245** `fix/grace-timer-flake` | **Close, do not merge.** Fully superseded by `171ee42` on `main` (C5). Optionally salvage one line first: #245's `waitFor` throws on timeout, `main`'s silently returns, so a real timeout on `main` surfaces as a confusing downstream assertion instead of naming its cause. |

That leaves **18 PRs to land**.

## Pre-flight — run this before landing anything

Sweep every open PR for mergeability and red checks first. Two blockers were sitting in the set when it looked ready, and neither was visible from the integration branch being green:

```
gh pr list --state open --limit 50 --json number,headRefName -q '.[]|"\(.number) \(.headRefName)"' |
  sort -n | while read n b; do
    gh pr view $n --json mergeable,mergeStateStatus,statusCheckRollup \
      -q '"\(.mergeable)|\(.mergeStateStatus)|\([.statusCheckRollup[]?|select(.conclusion=="FAILURE")|.name]|join(","))"'
  done
```

**Run it twice.** GitHub computes mergeability lazily; the first `gh pr view` only *triggers* the computation and returns `UNKNOWN`. A bulk `gh pr list --json mergeable` never resolves at all. This is why the first sweep reported `UNKNOWN` for 13 PRs and the second returned real values.

Expect most PRs to read `BEHIND` — that is normal and is handled by step 1 of the loop. What you are looking for is `CONFLICTING` / `DIRTY`, or a non-empty failing-checks column.

Found this way, 2026-07-22: **#234** `CONFLICTING` (orphaned stacked base — see "Stacked pairs") and **#259** failing `Lint` on `cli/prod.ts format` (its own defect, fixed at source in `801b80f`). `#245` also reads `CONFLICTING`, which is moot — it is being closed.

## The per-PR loop

Run this for one PR at a time. Never two in parallel — each merge advances `main` and stales the next.

1. `git fetch origin && git rebase origin/main` on the PR branch. **Rebase immediately before merging, not in advance** — see "Moving target" below.
2. Resolve conflicts using the matching entry in Part 1. Do not improvise a resolution that Part 1 already documents.
3. If the PR extracted code into a method, or the other side did, **read the extracted method** before continuing. See "The two silent-drop traps".
4. `npx tsc --noEmit && npm run lint`, then the affected suites.
5. `git push --force-with-lease` (never plain `--force`).
6. Wait for CI green. If red on a flake, re-run **once**; if still red, stop and report. Check what else is running on the box before calling anything a flake.
7. `gh pr merge <N> --squash --delete-branch`. Conventional title, no AI attribution.
8. If the merged PR was the base of a stacked PR, immediately `--onto` rebase the child (see "Stacked pairs").

## Stop and wait for approval

If Claude Code is running this, these are hard stops. Present the evidence and wait — do not proceed on inference, and do not batch several past a stop.

**Always stop before:**

1. **Any squash-merge to `main`** (step 7). It is the only irreversible step in the loop and it changes a shared branch. Show: the PR number, the squash title, CI state, and — for Groups 3 and 4 — the result of the trap check from step 3.
2. **Any commit.** Repo rule, no exceptions: show `git diff --staged` and the exact message, then wait. This holds even when the instruction was "just commit it".
3. **Any force-push** (step 5), including `--force-with-lease`. State what is being rewritten and why the rewrite is safe. Never plain `--force`; never force-push `main`.
4. **Closing a PR** (#245, #251). Closing is a judgment about someone's work, not a mechanical step.

**Stop and ask when the situation is not the one this runbook describes:**

5. **A conflict that Part 1 does not document.** The documented resolutions were reasoned once and verified; a novel conflict means reality diverged from this plan. Report the files and hunks rather than improvising.
6. **A trap check that comes back missing** — `withWarmup`, the pending-alert freeze, or `canonicalLivePathSet` absent after the merge. That means the resolution was wrong, and the correct fix may not be "add it back".
7. **CI red after exactly one re-run.** One re-run for a suspected flake, then stop. Before calling anything a flake, check what else is running on the machine — concurrent test suites on this box produced three misattributed flakes in one session.
8. **Pre-flight finds a blocker not listed here** (anything beyond #234's orphaned base and #259's `Lint`). A new `CONFLICTING` or a new red check means the branch set moved.
9. **A verification claim that cannot be proven mechanically.** If you cannot show that a merge is contained or a resolution is lossless — no tree-hash match, no clean reverse-apply — say so plainly rather than asserting it. Three separate containment checks gave wrong answers in this session; the honest report is "I could not verify this", not a confident yes.
10. **The suite regresses by a large multiple.** A 5× jump after a conflict-free rebase is an environment fault, not the diff. Diagnose and report before touching code.

**Do not stop for these** — they are reversible and asking for each one turns an 18-PR sequence into an interrogation: fetching, rebasing, resolving a conflict that Part 1 documents, running tests or lint, reading files, creating a worktree, or copying `node_modules`.

## Order

Grouped by risk, not by number. Within a group the order does not matter.

**Group 1 — land first, independent and green.**

`#260` `test/isolate-scanner-fixtures` — **do this one first.** It takes `main` from 35 failing tests to 7 on its own, which is what makes every later PR's local verification trustworthy. Nothing depends on it and it touches only test files.

Then `#255`, `#240`, `#241`, `#252`, `#258`, `#259`. All independent, no documented conflicts.

**Group 2 — dependabot.** `#224`, `#226`, `#227`, `#264`. Lockfile-only; dependabot rebases them itself. Land whenever; they will need no manual conflict work.

**Group 3 — the cache cluster, in this exact order.** This is where every documented conflict lives.

1. `#232` `feat/cache-integrity-alert` — clean onto `main`.
2. `#234` `feat/cache-warmup-status` — **stacked on #232** (`baseRefName`), never merge it first. Expect C1, C2, C3: 3 files, 10 hunks. C1's whole-file resolution is only safe because the file is new in #232 — re-verify that before using `--theirs`.
3. `#237` `fix/stale-conversation-history` — expect C4, 3 hunks, **plus trap S1 below**.

**Group 4 — the live-sessions pair.**

4. `#253` `feat/live-external-sessions` — expect C6, 3 hunks. One is an ordering decision, not a formatting one: `detachExternalTail` must run **before** the pending-alert freeze's early `return`, or the watcher teardown is silently skipped whenever an alert is pending.
5. `#254` `fix/adopt-resolve-cwd-from-jsonl` — **stacked on #253**; see "Stacked pairs".

**Group 5 — docs last.**

`#242` and `#257`. Every product PR edits `docs/BACKLOG.md`, and #257 rewrites item statuses wholesale. Landing it last means resolving that file once against a settled `main` instead of on every merge. Expect the same semantic conflict seen here: a PR's own entry says "Fixed" while #257's table says "In flight". Once the PR is on `main`, "Fixed" is the true statement.

## The two silent-drop traps

Both produce a **clean auto-merge with no conflict marker**, a green `tsc`, and quietly deleted safety code. Both have already happened, one of them twice.

**Trap 1 — merging #237.** #237 extracts the refresh logic into `reconcileConversationsCacheFromDisk()`. Because that method is new code, git merges it cleanly — and it does **not** inherit the protections already on `main` from #232 and #234: `withWarmup("conversation_refresh", ...)` around `rescanForRefresh()`, and the pending-alert freeze around `reconcileDeletions()`. #237 also makes that path fire automatically on `scannerStale` and freshness drift, so the unprotected version runs far more often than the protected one ever did.

*After merging #237, open `reconcileConversationsCacheFromDisk()` and confirm both are present.*

**Trap 2 — merging #253 after #237.** The same shape, opposite direction. #253 still carries the **inline** version of that block; `main` will have #237's **extracted** method. Taking `main`'s side is correct and discards #253's `canonicalLivePathSet(metas)` fix with no marker.

*After merging #253, confirm `reconcileConversationsCacheFromDisk()` calls `canonicalLivePathSet(metas)` and not a hand-rolled `new Set(metas.map(...))`.*

The general rule: **after resolving any conflict where one side extracted code into a method, read the method.** Conflict markers only ever show the call site.

## Stacked pairs

`#232 → #234` and `#253 → #254`. Identify these from `baseRefName`, never from PR number.

Two separate rebases are needed for a child, and they are not interchangeable:

- **Whenever the parent is force-pushed** (a rebase, a new commit), the child is left on orphaned commits. Replay it onto the parent's new tip:
  `git rebase --onto origin/<parent-branch> <old-parent-tip> <child-branch>`
  This already bit us once: rebasing #253 orphaned #254's base, and #254 was missing #253's three newest commits until it was replayed.
- **After the parent squash-merges**, GitHub retargets the child to `main`, but the branch still carries the parent's individual commits, which the squash collapsed into one commit git cannot match. Replay only the child's own work:
  `git rebase --onto main <parent-branch> <child-branch>`

**Diagnosing an orphaned child.** #234 sat at `CONFLICTING` / `DIRTY` because #232 had been rebased at some earlier point and #234 still carried the *pre-rebase copies* of #232's two commits. The tell is the merge-base: `git merge-base <parent> <child>` pointed at `0b1b599`, far behind the parent's actual history, and `git merge-base --is-ancestor <old-sha> <parent>` returned false for each copy. The `<old-parent-tip>` argument to `--onto` is then the last of those orphaned copies, not the parent's current tip. Resolved with `git rebase --onto origin/feat/cache-integrity-alert 7d7e8a7 feat/cache-warmup-status`.

A stacked PR also gets **no CI in this repo**: `ci.yml` triggers on `pull_request: branches: [main]`, so a PR based on a feature branch reports Snyk and nothing else until its base becomes `main`. Treat a green badge on one as meaningless — and note the consequence for the loop above: **step 6 cannot be satisfied for a stacked PR.** Verify it locally instead (`tsc`, lint, the suites its files touch), which means its worktree needs `node_modules`. Compare any failures against the pre-rebase tip before blaming the rebase; #234 showed 12 failures after its rebase and exactly the same 12 before it.

**Re-merging a rebased branch into the integration branch replays its original conflicts**, because the rebase gave its commits new SHAs. If the branch's content did not change, resolve to HEAD and then prove it: `git write-tree` after resolving should equal `git rev-parse HEAD^{tree}` from before the merge. An identical hash means the merge added nothing and the resolution was correct — cheaper and more reliable than re-reading every hunk.

## Moving target

`main` took five auto-merged scanner bumps in a few hours (`0.11.1` → `0.11.5`). Any branch rebased more than a few minutes ahead of its merge will be behind again. Rebase as step 1 of the merge, not as preparation the day before.

These bumps are lockfile-only and conflict with nothing, so being behind is cheap — but branch protection may still block the merge until it is resolved.

## Content that exists in no PR

The integration branch carries changes that belong to no individual PR and therefore **cannot be landed by merging PRs**. They are consequences of combining the branches:

- `b972dcd` — import order in `src/server.ts`, only wrong once #232's and #237's import blocks are combined. Biome sorts `./services/cache/cacheMetadata` **before** `./services/cache-integrity/cacheIntegrityMonitor`; the 2026-07-20 report's rule for this is wrong.
- ~~`e2ac107` — formatting in `cli/prod.ts` after #259's edits meet the existing ones.~~ **Wrong — this was #259's own defect, not merge glue.** Biome reports #259's copy of `cli/prod.ts` unformatted in isolation on that branch, and its `Lint` job was already red for it. Fixed at source on #259 (`801b80f`). Listing it here would have sent whoever lands #259 into a red Lint job with no idea it had been diagnosed. **Before filing something as merge-only glue, check whether the source branch fails on it alone.**
- Six merge commits carrying conflict resolutions (9–80 lines each), the largest being #237's.

Expect to re-derive equivalents while landing. If `npm run lint` fails after a merge with nothing obviously wrong, this is why — run `npx biome check --write <file>` on the file the merge touched.

## Definition of done

`main` green, and `integration-dev/v1.0.0-2026-07-22` reduced to nothing but the postmortem file. Any code still unique to the integration branch at that point is a change that was never landed.
