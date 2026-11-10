---
name: integration-by-batches
description: Group a repo's open PRs into medium-sized, independently testable batches, build one local integration branch per batch, validate it, deploy it for QA, STOP for explicit QA approval, then land that batch's PRs one at a time (rebase + squash) before starting the next batch. Use when the user says "batch the open PRs", "integrate in batches", "group the PRs and QA each group", "bulk process the PRs", or when one big integration branch would make a QA failure impossible to attribute. Sibling of `integration-branch` (one branch, all PRs); this one trades breadth for attribution. Repo-specific QA targets and landing details live in each repo's own skill.
---

# Integration by batches (shared core)

`integration-branch` merges *every* PR into one branch. When QA finds a defect in that branch you cannot say which PR caused it. This skill cuts the open PRs into **batches of related PRs**, QAs each batch alone, and lands it before the next one starts.

Reuse `integration-branch` for the mechanics it already proves (worktree, push guard, per-PR rebase + `merge --no-ff`, sweeps, cleanup). This file states what differs.

Each repo's own `integration-by-batches` skill holds its QA targets, build and gate commands, and landing differences. Read it too. Where it is stricter than this file, follow it.

## Hard rules

1. **Nothing merges to `main` before that batch's explicit QA approval.** Not a green CI, not a quiet user.
2. **One batch at a time.** Do not build, deploy or merge batch N+1 until batch N is approved *and* landed.
3. **Never combine unrelated PRs to lower the batch count.** A batch is a unit of attribution.
4. **Never decide a product question silently.** Conflicts that are an either/or about behaviour (J-calls) stop the run and are put to the user with the options.
5. **The integration *branch* never reaches `origin`.** Push nothing unless QA needs an origin ref, and then only an annotated **test tag**, never the branch. Prove it before every report: `git ls-remote --heads origin "integration/*" | wc -l` → `0`.
6. **Never commit the plan or the log.** They are working notes. Keep them outside any repo.
7. **Preserve each PR's own history.** Land PRs individually; the batch branch is a test artifact only.
8. **Evidence over assumption.** Repo, CI and test output decide. Say "not verified" when it is not.
9. **Approval is a record, not a reading.** "QA passed", "land it" and "push" are three separate signals; each is the user's answer to its own question. A batch lands only after its `qa_verdict` line is in the log (Step 5), and `land-pr.sh` refuses without it.
10. **The tree QA saw is the tree that lands.** Every fix lives on its PR's branch before the batch is deployed. A fix that exists only on the integration branch, a cherry-pick past the tag, or a deploy run with `--force`, `--skip-tests` or a dirty tree is not QA of what will merge.
11. **Every decision for the user goes through the question tool** (`AskUserQuestion`), with options and a recommendation: drafts, QA target, J-calls, freeze, push. A question in prose is missed between status lines.

## Step 0 — Read the world, in both repos

```bash
git fetch origin --prune && git rev-parse --short origin/main        # state this SHA
gh pr list --state open --json number,title,headRefName,baseRefName,isDraft,headRefOid
```

- **Per-PR, never bulk:** a list query returns `mergeable: UNKNOWN` for almost every row. Run `gh pr view <n> --json mergeable,mergeStateStatus,isDraft` per PR. `gh api repos/<o>/<r>/pulls/<n> --jq .mergeable_state` forces the recompute.
- **Read the counterpart repo's open PRs too.** A cross-repo dependency is often declared on *one* side ("Land this streamer PR first"). Pair across repos by the **endpoint or field actually called**, never by feature name.
- Capture each PR's file set: `gh pr diff <n> --name-only`. Overlaps drive the grouping.
- **Re-scan before acting.** A plan older than a day is a hypothesis; `main` moves and the open-PR count changes.
- **Read the plans and logs already in the plan directory first.** An earlier run may own batches, worktrees or a verdict for some of these PRs; continue it, or say why it is superseded.
- **Build the cross-repo pairing table before grouping,** not after the user asks for it: counterpart PR, the call that links them, which side lands first.

## Step 1 — Group

Group by **subsystem + shared files**, then check each group against four questions:

| Question | If "no" |
|---|---|
| Can one QA pass of one flow cover the whole batch? | split it |
| Do the PRs share files (so rebasing separately costs the same conflicts)? | they probably belong together |
| Would a failure be attributable to a PR or a small pair? | split it |
| Does anything in it change what a user, a client or the counterpart repo can observe? | if not, CI alone — no QA deploy |

- **Forced pairs:** two PRs rewriting the same code and its tests cannot be separated across batches without one going `DIRTY`. Keep them together, and keep them *out of* a larger batch if their conflict is a product question — it should fail in a 2-PR batch, not a 6-PR one.
- **A "tooling/docs" batch is legitimate** even when the PRs are unrelated, if none changes observable behaviour and the files are disjoint. State that reasoning in the plan.
- **Dependency bumps:** lockfile-only bumps share a batch. A platform or test-runner major upgrade is **alone and last** so a regression is attributable.
- **Order batches:** behaviour first (conflict-dense PRs go stale fastest), tooling/docs next, deps last.
- **Drafts are the user's call.** List them and ask. A draft cannot be squash-merged; that stop is the author's.
- **Hold, don't merge, any PR with an unresolved security finding.** Report it, don't repair someone's PR without approval of the exact diff, and rebuild the batch without it. A batch QA'd with a local patch validates code that differs from what merges.

## Step 2 — Write the plan, then wait

Write `<date>-batched-qa-plan.md` **outside any repo** with: the PR table (PR, title, subsystem, key files), the overlap list, the ordering constraints, one block per batch (**goal · PRs in order · why together · order rationale · QA scenarios · risks**), the execution table (batch, PRs, QA deploy?, cross-repo dependency, blocking?), and the stop-and-ask list. Open with the decisions the user must answer (drafts, QA target), a legend for every abbreviation the plan uses, and the batch table first. **Each QA scenario names the PR and the changed file it exercises**; a scenario with no line in the diff behind it is invented, so cut it. **Send it and stop.** A local rehearsal is neither a deploy nor a merge and may start early; the deploy may not.

Keep a second file, the **engineering log** (`<date>-batched-qa-log.md`): §1 artifacts (every worktree, branch, ref, tag, with created/removed), §2 baseline, §3 scope, §4 order/constraints, §5 timestamped actions, §6 per-PR records (head before → rebased to → tip after), §7 conflicts (M mechanical / J judgment), §8 sweeps, §9 obstacles & numbered findings, §10 checkpoints, §11 decisions (who, why). Append after every action; obstacles are the first thing memory loses. Concise facts, no chain-of-thought.

Create the log and a `HANDOFF.md` (goal, current step, next exact command) **before the first build command**, not after the first compaction. A batch run spans days and several context resets; the files are the only state that survives them.

## Step 3 — Build the batch (local)

Per `integration-branch`: fresh worktree at an **absolute path outside the repo**, `git fetch` immediately before the cut, push guard armed (`branch.<b>.pushRemote=no_push_integration_branch`), a real install in the worktree, **baseline on untouched `main` first**, PR heads fetched to `refs/integration/pr/<n>`, each PR rebased onto the tip then `merge --no-ff`, one at a time.

- **A clean three-way merge is the case that produces wrong code silently.** Hand-read the composed result for any file touched by 2+ PRs (is each PR's addition *defined and wired*?). Log "checked, clean".
- **Suite counts:** reconcile new test files with `git diff --name-status` (`A` files).
- **Confirm any failure alone** before classifying it: passes alone = load artifact, fails alone = real. Both mistakes occurred.
- **Re-verify head SHAs** of every PR before each (re)build; a moved head invalidates that PR's record only.
- **Register new test files** in the repo's shard manifest, if it has one, or CI goes red while the code is fine.

## Step 4 — Validate

Typecheck, lint, and the full test suite on the baseline and on the batch; compare the **delta**, not the absolute. A batch with no observable impact is validated by CI plus one local run of its own tooling.

## Step 5 — Deploy to QA, then STOP

**Ask which QA target** (and which platform, where there is more than one). Never assume.

- **Pin the deployment identity to the batch** in the log: target, tip SHA, run id or version, deploy time. At the start of **every** QA conversation re-establish *which build is running* before reading any result as a verdict on the batch.
- **A cross-repo dependency is satisfied by a binary, not a merge:** it is met when the running counterpart contains it. Ask what is running before declaring a batch blocked.
- **Pairs.** A pair is a server half plus a client half behind a capability flag, so the client is inert until the flag appears. QA the pair **both ways** — new client on old server, old client on new server. For paired fixes, QA the **degrade-gracefully half first, against the unfixed counterpart**; against the fixed one the symptom is gone before the guard runs. Land the server half afterwards.
- **One checkpoint per pair batch, one approval for both halves.** Do not land one half while the other is untested.
- Report: batch, target, tip SHA, PRs, what to test (the plan's scenarios), caveats. **Stop and wait.**
- **Record the heads at deploy time,** one line per PR in log §10, full SHAs (`land-pr.sh` reads them):

  ```
  qa_head: B2 #1320 3f9c...<40 hex>
  ```

  A PR whose head moves after this line needs a redeploy and a new line, or it is held.

### Closing QA: the freeze

QA ends with one `AskUserQuestion`, never with an inference from a quiet user or a "looks good" about one item:

| Option | Effect |
|---|---|
| **Freeze and land** (record the verdict) | append `qa_verdict: <batch> approved <ISO time> build <run id/version> "<the user's words>"` to log §10, then Step 7 |
| **Fix first** | Step 6; the fix goes on its PR's branch, then rebuild, redeploy, new `qa_head` lines |
| **Add a PR** | it goes to the **next** batch; a frozen batch takes nothing new |

Scope the verdict to what was tested. "Yes, it works" about one flow approves that flow; ask about the rest.

## Step 6 — Handling QA findings

1. **Is the code path in the batch's file set?** `git diff --name-only <main>..<batch>` before accepting a finding against a batch.
2. **Cheap proof a defect predates the batch:** `git log <deployedSha>..<head> -- <paths>` and `git diff` over the same paths both empty → it is on `main`, not the batch.
3. A genuine `main` defect becomes its **own PR**, not a patch inside the batch. Trace it to `file:line`; fix the **root cause** where all callers route.
4. **Mutation-check every guard test:** revert the fix, confirm red, restore. A test that cannot fail is deleted. Test at the layer where the mechanism lives.
5. **A shared mock that degrades every dependency uniformly removes the asymmetry a bug lives in.** Model the healthy case explicitly.
6. QA failure → nothing merges; diagnose, update the integration branch, rebuild, redeploy.

## Step 7 — Land the batch (only on explicit approval)

`main` is protected with strict status checks: **every merge makes every remaining PR `BEHIND`**, and another session may merge in the gap, so green-and-current can go stale *during CI*. Land with **`land-pr.sh`, beside this file**, one PR at a time in plan order, from the PR's own worktree. The script is the procedure; its header lists every flag and `RESULT=` word. Hand-rolled landing loops were rewritten four times and pushed `main`'s tip onto a PR branch once, closing the PR.

1. **Preflight once before the first PR, and again before leaving any run unattended:** `land-pr.sh --preflight` (gh auth, SSH, a signed test commit, disk). A signer that needs a human stalls an overnight loop for hours; ask the user to unlock it before they leave, or stop the run.
2. **Stacks:** retarget every child PR to `main` before its parent merges (`gh pr edit <child> --base main`). The script refuses with `CHILDREN` while any open PR is based on the branch.
3. **First pass without `--yes`:** guards, `git fetch`, rebase, the PR's tests, then `RESULT=READY`. Show the user the result and ask before the push. Then re-run with `--yes`: it pushes with a lease pinned to the checked head, waits and merges in one loop (`--match-head-commit`), and reads the PR state rather than `gh`'s exit code.
4. **Act on the result word:**

   | `RESULT=` | Next |
   |---|---|
   | `MERGED` | log the squash SHA in §6; next PR |
   | `STALE` | another merge moved `main`; run the script again |
   | `HELD` | no verdict, a draft, or a head that changed since QA; report it |
   | `RED` | re-run a flaky check **once**, then stop and report |
   | `CONFLICT`, `EMPTY`, `TESTS`, `DIRTY`, `TIMEOUT`, `NOT_MERGED` | stop and report; nothing to retry blindly |

5. **Squash defeats ancestry checks.** `--is-ancestor <branch>` reads "unmerged" for every landed branch and `--is-ancestor <squash>` is tautological. Test content with `git diff --numstat origin/main <branch>`.
6. **Branch delete:** never unasked. Where the repo auto-deletes merged heads, do nothing. Otherwise gate any manual delete on `gh pr view <n> --json state` = `MERGED` (deleting after a *refused* merge **closes the open PR**).
7. After the last PR: verify `main` is green, delete the batch's test tag if one was pushed, log it, then clean up (Step 9).

**Unattended landing** (a background agent or a loop): one unnamed background agent, checked for first output within a few minutes; a named teammate that never started reads exactly like a slow one. Report on change only, never on a timer, and put one line in every status: `CI red on main: <check> since <time>` or `CI red on main: none`.

For a pair, land in the pair's order and record both PR numbers, both squash SHAs and the running QA build in one log row.

The dependabot trap: after `main` moves, a bot may rewrite its branch and retarget a newer or major version. `land-pr.sh` compares the PR's patch with the QA'd one and returns `HELD` on any difference; that hold is the answer, not something to route around.

## Step 8 — Next batch

Re-fetch `main`, **re-scan open PRs in both repos**, re-validate the next batch's plan (new PRs may now contend for its files — cost of delay compounds), rebuild it on the new `main`, repeat from Step 3.

## Step 9 — Cleanup (list first, approval, then delete)

Cleanup closes every session that built anything, including one that landed nothing or stopped mid-batch. Inventory from log §1 + `git worktree list`: worktrees, local integration/scratch branches, `refs/integration/pr/*`, test tags (local and remote), untracked docs (ask). Exclude any worktree with uncommitted or unpushed work and any this run did not create. `git worktree remove` (never `rm -rf`), `git branch -D` only for approved branches, `git update-ref -d`, `git worktree prune`. Verify `git ls-remote --heads origin "integration/*"` → `0`, and that no QA target is left running an integration build.

## Traps that recurred

| Trap | Guard |
|---|---|
| "Never push the branch" vs needing something to QA | deploy from the worktree, or push a **tag**, never the branch |
| Bulk `mergeable` → `UNKNOWN` | per-PR query; REST API forces recompute |
| Every PR already `BEHIND` before any merge | budget one rebase + CI cycle per PR |
| `gh` exit status ≠ merge landed | read PR state |
| Squash commit is tautologically an ancestor | content diff, not `--is-ancestor` |
| zsh does not word-split unquoted vars | run multi-item logic as a `bash` script |
| `rebase && push` in one command after a conflict pushes `main`'s tip and closes the PR | `land-pr.sh` aborts the rebase and refuses an empty branch |
| A signing agent waiting for a human stalls an overnight loop | `land-pr.sh --preflight` before leaving it |
| A worktree borrowing another checkout's `node_modules` reports phantom type errors | a real install in every worktree |
| Re-keying a plan by PR number across days | PR numbers are stable; heads and `main` are not — re-scan |

## Report format (every checkpoint)

Batch · QA target · integration tip SHA · PRs in order · typecheck/lint/test delta vs baseline · what to test · caveats/holds · **the decision needed from the user, stated plainly**. Link PRs as full URLs.
