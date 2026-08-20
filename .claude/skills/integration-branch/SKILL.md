---
name: integration-branch
description: Build an integration branch that merges open PRs together, one at a time, with a live merge log and a final summary. Runs as a local rehearsal, then — only ever replaying that rehearsal — as an execution run that writes to origin. Defaults to every open PR; accepts a PR range or explicit list, and can additionally merge named local/remote branches that have no PR. Use when the user says "create an integration branch", "merge all open PRs into one branch", "integration branch for PRs 441-456", "rehearse the integration merge", "combine the open PRs so we can test them together", or asks to rebuild/refresh an existing integration branch.
---

# Integration branch

Merges a set of PRs into one branch so they can be tested together, in dependency-correct order,
recording the run as it happens. Two documents come out of it:

- a **log** written continuously — [`docs/integration/log-format.md`](../../../docs/integration/log-format.md)
- a **summary** written at the end from the log — [`docs/integration/summary-format.md`](../../../docs/integration/summary-format.md)

Read both formats before starting. The log is not a write-up at the end; it is appended after every
action, because the obstacles are the part worth keeping and they are the first thing memory loses.

**This skill never pushes to `main` directly and never force-pushes it, and the integration branch is
never what lands.** The branch exists to prove the set works together; each PR then lands on its own,
based on `main`, so `main` keeps one squashed commit per PR and every PR keeps its own review. Flow A
produces the branch and two documents and writes nothing outside the worktree. Flow C may additionally
land the PRs, and may push the integration branch itself — each behind its own approval, neither
implied by approving the run.

## The branch has an expiry — this repo retired the other kind

This repo deleted its long-lived integration branch on 2026-08-12 and landed all 20 open PRs onto `main`
individually instead. The decision and the stale-ref audit behind it are in
`docs/integration-branch-retirement-2026-08-12.md` — open in PR #666, so link it once that lands — and
the rule it states is the one this skill operates under:

> An integration branch is a staging area with an expiry, not a parallel trunk.

That rule is canonical for every Threadbase repo in
[`threadbase/docs/integration-branch-lifecycle.md`](https://github.com/RonenMars/threadbase/blob/main/docs/integration-branch-lifecycle.md),
which the tb-streamer copy of this skill cites too. The retirement doc below is its origin and stays here.

So:

- A branch this skill creates exists to **test a set of PRs together**, and is deleted once `main` holds
  its content. Deleting it costs nothing when a backup ref points at the same commit.
- **Never develop on it.** The moment a fix is committed to the integration branch rather than to the PR
  that needs it, it has become a second trunk — which is precisely the state the retirement unwound, at
  the cost of a multi-day audit. Step 7 says where a fix goes instead.
- **If the plan is to land PRs one at a time onto `main`, this is the wrong tool.** That is a different
  procedure and does not need an integration branch at all; it still deserves a log and a summary in the
  same two formats.
- Step 9 ends with the expiry: name the condition under which the branch is deleted, and who deletes it.
  Everything below assumes this, and "Retire the branch" enforces it.

## Step 0 — Pick the flow

Two flows, differing only in **what they are allowed to write**. Ask the user which one, unless they
already said.

| Flow | Writes to | Produces | Danger |
|---|---|---|---|
| **A — Rehearsal** | nothing outside the local worktree; `origin` is read-only | log + summary | none |
| **C — Execution, from a rehearsal** | `origin`: force-pushed PR heads, edited PR descriptions, deleted branches, and — each behind its own separate approval — the integration branch itself and PRs squash-merged into `main` | an **execution log + execution summary**, citing the rehearsal's | **high — every one of those writes is irreversible from the client** |

**Default: A, then C.** Run the rehearsal, report it, and ask before proceeding to the execution run.
Never chain into C automatically — C writes to `origin`, and that consent is separate from the consent
to rehearse.

**There is no flow that writes to `origin` without a rehearsal first.** The letters are A and C because
that is how the existing logs and summaries refer to them — the flow that skipped the rehearsal was
removed, not renamed. The reason it is gone: a wrong whole-file resolution deletes routes and unrelated
additions while `tsc` stays green, the rehearsal is the only thing that catches it, and every write in
flow C is one the client cannot undo. If the user asks to skip the rehearsal, say that and offer A → C.

### Flow A — Rehearsal (local, `origin` read-only)

Run every step below in a throwaway worktree, resolving conflicts for real, running the suite for real.
The output is a **conflict ledger and a verified command sequence** — the thing that makes the execution run
mechanical instead of improvised.

**First question, before the set is settled: does this run include the dependabot PRs?** Ask it
outright — never read it into "all the open PRs". A dependency bump is a different animal from a
feature branch: bumps collide with each other on the lockfile rather than on code, one bump routinely
supersedes another in the same set, and a run that quietly swallowed nine of them has a test delta that
means something other than what the summary will claim.

```bash
gh pr list --state open --json number,title,author \
  --jq '.[]|select(.author.login|test("dependabot|renovate"))|"#\(.number) \(.title)"'
```

- **No** — they are out. Do not merge them and do not count them. Every one goes into the log's §3
  exclusions table as "dependabot — user declined", by number.
- **Yes** — then ask *which*: **all** of them, **only these** (which), or **all except these** (which).
  Do not collapse "yes" into "all". The usual answer is a subset, because two bumps of the same package
  supersede one another and only the newest is worth carrying through the merge.

Record the answer and the resolved list in the log's §3, and name it again in the summary. The
execution run reads that decision back rather than asking again, so it has to be written down, with
whose decision it was.

Forbidden for the whole of flow A: `git push` (any form), `gh pr merge`, `gh pr edit`, `gh pr close`,
`git push --delete`, and deleting any remote branch. Read commands against `origin` are fine.

Name the documents `<date>-<slug>-rehearsal-log.md` and `-rehearsal-summary.md`.

Before reporting done, prove nothing escaped:

```bash
git ls-remote --heads origin "*<slug>*"    # expect no output at all
```

Check for **empty output**, not for a count: `grep -c` exits 1 when it finds nothing, so the healthy
case is the one that reads as a failed command in any `&&` chain.

<!-- ponytail: an after-the-fact assertion, not a sandbox. It catches the branch push, which is the
     likely slip; it does not catch a force-pushed PR head. Use a separate clone if that matters. -->

### Flow C — Execution run, from a rehearsal (**writes to `origin` — approval gate**)

Input is the rehearsal's log and summary. Do not re-derive the order or the resolutions; execute them.

**Warn the user in these terms before the first write, and get an explicit yes.** Do not soften it, and
do not treat "yes, do the integration" from earlier in the conversation as covering it.

- **Force-pushing a rebased PR head rewrites a branch other people, CI and review threads point at.**
  It un-restacks any child PR and can strand review comments on commits that no longer exist.
- **Merging a stack base retargets its children silently** — GitHub's auto-restack is not reliable, so
  the child goes `DIRTY` with its head unchanged and nothing announces it.
- **Merges, branch deletions and force-pushes are not undoable from the client.** Recovery is only as
  good as the backup refs pushed beforehand.
- **Landing a PR into `main` ends its review.** The rehearsal proves the set is coherent together; it
  proves nothing about whether any single PR was reviewed, and a squash-merge is not something an
  author who objects afterwards can take back.
- **Editing a PR description writes into someone else's words.** Only the checkbox markers may change
  (Step 6), never the surrounding text.

The gate:

1. Print the exact write list before the first write — every ref to be pushed, every PR head to be
   force-pushed, every PR description to be edited, every PR to be retargeted to `main`, every PR to be
   landed, every branch to be deleted.
2. Push a backup ref and an annotated tag for **every** branch that will be force-pushed or deleted.
3. Get an explicit approval for that list. A blanket yes does not carry: re-confirm immediately before
   any force-push of a PR head, any branch deletion, any merge into `main`, and any push of the
   integration branch itself.
4. Use `--force-with-lease=<branch>:<old-head>`, naming the head you actually read — never `--force`,
   and never the bare `--force-with-lease`. The bare form compares against whatever the local
   remote-tracking ref happens to hold, and a background fetch can refresh that into agreeing with a
   push you never intended to overwrite; naming the head makes the guard mean what it says. Never
   force-push `main` and never push to it directly — landing goes through `gh pr merge --squash`,
   nothing else.
5. Log every write as it happens — the log is the only record that a write occurred.

Then run it:

1. **Carry the rehearsal's dependabot decision forward** — read it out of the rehearsal log's §3
   instead of asking again. The user already answered this once.

   - **The rehearsal included them** → so does this run, on the same terms. Then check what arrived in
     the meantime, because dependabot opens PRs on a schedule and a rehearsal more than a day old is
     almost certainly missing some:
     ```bash
     gh pr list --state open --json number,title,author,createdAt \
       --jq '.[]|select(.author.login|test("dependabot|renovate"))|"#\(.number) \(.createdAt) \(.title)"'
     ```
     Anything not in the rehearsal's set is **unrehearsed**: ask whether to take all of the new ones or
     only some, and treat each one that is added as a live resolution with no ledger entry — mark every
     one as a deviation in the execution log.
   - **The rehearsal excluded them** → they stay excluded here. Do not fold them in because they happen
     to be sitting there. Ask instead whether to run a second, dependabot-only integration — a fresh
     flow A — once this run finishes. Record the answer in **both** execution documents, and if it is
     yes, come back to it at the end of Step 9 rather than reporting this run as the end of the work.

2. **Re-verify the preconditions the rehearsal assumed** — they expire:
   ```bash
   git fetch origin
   git rev-parse --short origin/main       # vs the rehearsal's cut point
   ```
   Per-PR head drift is the `headRefOid` read in Step 6; it does not need a second call here. Any SHA
   that moved invalidates the ledger **for that PR only**. Re-rehearse that PR in the worktree, or
   resolve live and mark the row as a deviation — do not silently apply a stale resolution.
3. Execute the recorded order from the rehearsal summary's §3, applying the recorded resolutions.
4. Write a **new** pair of documents — the **execution log** and **execution summary** — rather than
   editing the rehearsal's. Name them `<date>-<slug>-execution-log.md` and `-execution-summary.md`.
   Where the two runs disagree, **the execution wins** — and the disagreement itself is a log entry.
5. **Both execution documents open with a pointer to the rehearsal pair**, in the §0 header, before
   anything else:
   ```markdown
   **Rehearsal:** [<date>-<slug>-rehearsal-log.md](<date>-<slug>-rehearsal-log.md) · [<date>-<slug>-rehearsal-summary.md](<date>-<slug>-rehearsal-summary.md)
   ```
   The execution log records what happened; the rehearsal records why it was expected to. Neither is
   readable alone, and the reader who finds one of them a month from now has no other way to learn the
   other exists.
6. The execution summary folds both: what the rehearsal predicted, and where reality differed.

## Step 1 — Settle the scope

Three modes. Pick from what the user said; ask only if genuinely ambiguous.

| Mode | Trigger | Set |
|---|---|---|
| **All open** (default) | "integration branch", no qualifier | every open PR |
| **Range / list** | "PRs 441-456", "just #442, #447, #451" | exactly those |
| **All open + extra branches** | "…plus my local fix/x branch", "and the branches that have no PR yet" | open PRs ∪ named branches |

**"Every open PR" is already filtered.** The dependabot answer from the start of flow A applies to
every mode here: if they were declined, the default set is every open PR *except* those, and each one
is named in the exclusions table rather than silently absent.

In every mode, confirm the resolved list back to the user before cutting anything — a wrong set is
discovered at merge 12, not merge 1.

Carry a **standing exclusion list**. Ask the user for one if the repo has none; anything excluded goes
in the log with its reason.

Also capture one option here, because it changes whether the run can stop later: **may a red CI halt the
run?** If the user says up front that it must not — "don't stop for red CI", "merge them regardless" —
record that and honour it in Step 6's check. Absent that, the default is to stop and ask.

## Step 2 — Preflight

```bash
git status --porcelain                  # must be empty
git fetch origin
git rev-parse --short origin/main       # state this SHA in the first report
```

`origin/main` is a cached ref. **Re-fetch immediately before cutting** — a stale one silently produces
a branch that is not from today's `main`, with no error at any point.

Work in a **dedicated worktree**, never the primary checkout:

```bash
git worktree add ../<repo>-worktrees/int-<date> -b integration/<date>-<slug> origin/main
```

Give the worktree its own `npm ci`. A copied `node_modules` is a version behind by the time it matters,
and a duplicated native dependency tree produces phantom failures that belong to neither PR — run
`npm run check:native-deps` if anything in the set touches a native module or an Expo config plugin.

If an integration branch already exists and is being replaced: **push a backup first**
(`backup/<old-name>-<date>`) and an annotated archive tag. Do not delete the old one — the coverage
gate in Step 8 validates against it.

**Write the abort recipe now, into the log's §13** — while every ref name is still in front of you. It
is the one section nobody can compose at the moment it is needed: half-merged tree, backup refs already
pushed, a decision to make and no appetite for composing shell. It is four lines and it expires with
the run:

```bash
git -C <worktree> merge --abort || git -C <worktree> rebase --abort
git -C <worktree> reset --hard <integration-branch-sha-at-cut>
git worktree remove <worktree> --force
git branch -D integration/<date>-<slug>
```

Append the restore command for each backup ref as it is pushed, so §13 stays current rather than
correct-at-the-start. If the run stops here, mark the log's status `abandoned` and keep it — an
abandoned run's obstacles are exactly what makes the next attempt shorter.

## Step 3 — Baseline

Run all five required checks on `main` **before merging anything**, and record the counts in the log's
§2:

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run test:integration
npm run test:i18n
```

**`test:unit` alone is a false green.** Integration is a separate Jest run and is where a changed guard
on a shared function actually surfaces; i18n is where a missing locale key does. Maestro E2E
(`e2e.yml`) never runs on a PR at all — monthly schedule and manual dispatch only — so E2E is either
dispatched deliberately or recorded as **unknown**, never assumed. `main` being green is an assumption, not a fact; every later count is a delta against this
one. Skipping this is how a pre-existing failure gets blamed on a merge.

## Step 4 — Collect the set and find the real order

```bash
gh pr list --state open --json number,title,headRefName,headRefOid,baseRefName,isDraft,createdAt
```

Then, **per PR** (bulk mergeability is not computed — a list query returns `UNKNOWN` for every row):

```bash
gh pr view <n> --json mergeable,mergeStateStatus,isDraft,statusCheckRollup
```

- `isDraft` is invisible in the readiness fields — a draft reads as `MERGEABLE`/`CLEAN` and still will not merge.

**Drafts are the user's call, never yours.** As soon as the set is resolved, list every draft in it and
ask whether this run includes them — before cutting the branch, not at the merge that hits one:

```bash
gh pr list --state open --json number,title,isDraft --jq '.[]|select(.isDraft)|"#\(.number) \(.title)"'
```

Do not infer the answer in either direction. A PR is draft because it is unfinished, or because its
author is blocked on something with nothing to do with the code, and those want opposite treatment.
Record the answer in the log's §3 — included drafts flagged as such, declined ones in the exclusions
table as "draft — user declined".

Including a draft does **not** require flipping it ready: this skill merges the PR's head locally, and
GitHub's draft flag only gates merging on GitHub. Leave the flag alone — flipping a batch of PRs ready
so an integration branch can be built is a change to their state that nobody asked for.
- `DIRTY` means the merge ref is missing, so CI never ran on it: a lone green Snyk check is not "CI passed".

Detect two things that override chronological order:

1. **Stacked PRs** — `baseRefName` is another PR's head branch, or one PR's head is an ancestor of another:
   ```bash
   git merge-base --is-ancestor <pr-a-head> <pr-b-head>
   ```
   The base merges first. **Never drop the child's own commits** — they routinely fix the base/child
   interaction and exist in no other PR.
2. **Forced-order constraints** — a lint error one PR introduces and another clears; a refactor that
   moves code a later PR edits; a dependency bump superseded by a newer one. Chronology is the default;
   these override it.

Write the planned order, the stack table and the constraint table into the log's §4 **before merging**.

## Step 5 — Cut the branch

Per the requested procedure: start from the **earliest PR's branch**, then rebase onto `main`.
The earliest PR is the only one rebased onto `main` — every PR after it rebases onto the integration
branch (Step 6), because by then the integration branch is what it has to be correct against.

```bash
git checkout -b integration/<date>-<slug> <earliest-pr-head>
git rebase origin/main
```

Fetch every PR head into a private namespace — **not** `refs/remotes/origin/pr/*`:

```bash
git fetch origin "pull/<n>/head:refs/integration/pr/<n>"
```

`git fetch origin --prune` deletes every `origin/pr/*` ref, mid-run, silently. The private namespace
survives it.

## Step 6 — Merge, one PR at a time

### Before each merge — check that branch's CI

Applies to **every** member of the set, the earliest one included, and runs immediately before that
branch is taken.

1. **Does the head branch exist on `origin`?**
   ```bash
   git ls-remote --heads origin <head-branch>
   ```
   A local-only branch has no CI to read. Record that in the log — "no remote, unverified" is a real
   state and must not look like a pass — and continue.

2. **If it exists, read its checks.**
   ```bash
   gh pr view <n> --json statusCheckRollup,mergeStateStatus,headRefOid   # PR
   gh api repos/{owner}/{repo}/commits/<sha>/check-runs                   # branch with no PR
   ```

   **`headRefOid` is why this is not a duplicate of Step 4's read.** Compare it against the head
   recorded in the log's §4. If the author pushed in between, the planned order, the conflict ledger
   and — in flow C — the recorded resolution were all derived against a commit that no longer exists,
   and applying them silently is how a wrong resolution lands. A moved head means re-plan that PR, not
   a detail for the log's footnotes.
   Count the check **names**, not the conclusions — all five required ones must be present and passing,
   and Maestro E2E will not be among them. A `DIRTY` PR has no merge ref, so the real suite never
   ran and only a security scanner reports — that is *unverified*, not green. Compare any failure against
   the Step 3 baseline: a test already red on `main` is not this branch's fault, and the log should say so.

   **A short name list can also mean you read too early.** For a few seconds after a push the rollup still
   carries only the previous run's stale contexts, which looks identical to "the suite never ran". Confirm
   the run exists before drawing a conclusion, and re-read once it has registered:
   ```bash
   gh run list --branch <head-branch> --limit 3 \
     --json headSha,status,conclusion,workflowName
   ```

3. **If CI is red or never ran: tell the user — do not ask.** One message naming the branch, the failing
   checks, and that the run is continuing. No approval, no pause. Log it.

4. **Then look for the fix inside the integration set**, since the most common cause is a PR that another
   PR in the same set repairs — one introduces a lint error, the next clears it:
   ```bash
   gh pr view <n> --json body,comments        # "depends on #N", "fixed by #N", "needs #N first"
   gh pr diff <m> --name-only                 # per candidate: does it touch the failing file/test?
   ```
   If a member of the set fixes it, that is a **forced-order constraint**, not a problem: record it in the
   log's §4 with the reason, order the fixer accordingly — before, if it unblocks; immediately after, if
   the failure only clears once both are in — and carry on **without asking**.

5. **If nothing in the set fixes it, stop and ask.** Present the options rather than a bare question: drop
   the branch from the set, merge it and accept a red checkpoint, wait for its author, or pull in an
   out-of-set fix. Log the answer as a decision in §11.

6. **The exception:** if the user said up front that a red CI must not stop the run (Step 1), never stop.
   Steps 1–4 still run and still get logged — the opt-out removes the halt, not the check. A run that
   skipped the check entirely cannot tell later which failures it inherited.

### Before each merge — unchecked boxes in the PR description (flow C only)

```bash
gh pr view <n> --json body --jq '.body' | grep -n -E '^[[:space:]]*[-*] \[ \]'
```

An unchecked `- [ ]` under "Test plan" or any other checklist is the author saying a step is
outstanding. It is not yours to interpret — a box is unchecked because the work is undone, or because
nobody in this repo ever ticks them, and those want opposite treatment. **Flow A never asks and never
edits**: it has no write access to `origin`, so it records what it found and moves on.

In flow C, ask, offering exactly these four:

| | Answer | Effect |
|---|---|---|
| **a** | Stop — the user checks it themselves | halt at this PR and wait; the run resumes on their word |
| **b** | Tick this PR's boxes | edit **this** PR's description, `[ ]` → `[x]`, then continue; ask again at the next PR that has any |
| **c** | Tick every following PR's boxes | applies to this PR and every remaining one; do not ask again |
| **d** | Same as **c**, except named PRs | ask which PRs are exempt; each of those halts as **a** when its turn comes |

Record the answer in the log's §11 the moment it is given, with the PR that prompted it — **c** and
**d** are standing policies for the rest of the run, and a policy nobody can find later is one nobody
can revoke.

#### Boxes only a human can tick

**b**, **c** and **d** all end with this run ticking a box. Before any of them does, split the list in
two: boxes something actually backs, and boxes asserting a step that cannot be run from a shell at all
— on a device, in a simulator, against a physical machine, by looking at the screen.

Treat as human-action anything naming a device, a simulator, a build installed somewhere, a reboot, a
screenshot, a visual check, or a manual QA pass. **When in doubt it is human-action.** Over-reporting
costs one row in a table; under-reporting ships a green checklist asserting that somebody looked.

**If the PR has any such box, present the table and stop.** Not a summary of it, not a sentence — the
table, one row per box, before the edit:

> On the checkboxes — I ticked all four as asked, but you should know what actually backs each, since
> these are on-device manual steps I cannot run:
>
> | # | Backed by | Evidence |
> |---|---|---|
> | 1 successful prune still resolves | existing test | calls `onResolved` with the backup path on success, waits for destructive success |
> | 2 no red LogBox on failed resolve | new test in this PR | rejects with 502 and the error is caught — no unhandled throw |
> | 3 sheet stays open with the message | new test in this PR | asserts the exact string, and `onResolved` not called |
> | 4 error clears on retry while in flight | **inspection only** | `setActionError(null)` at the start of each action; the new test uses `mockRejectedValue` and never re-presses |

`Backed by` takes one of exactly four values: **existing test**, **new test in this PR**, **inspection
only**, **nothing**. The fixed vocabulary is the whole point — in prose, "I read the code and it looks
right" and "a test asserts this" blur into one equally confident sentence, and those are the two things
the reader most needs kept apart. A box with **nothing** behind it may still be ticked if the user says
so. It may not be ticked quietly.

Then **stop and wait for a human answer.** This gate is separate from **b**/**c**/**d**: that answer
was given before anyone knew a box needed a device, so it does not cover this one. Alongside the answer
for this PR, offer to accept every remaining one the same way and not ask again **for the rest of this
execution run** — never beyond it, and never inherited from the rehearsal.

**Suppressing the question does not suppress the table.** Once the user has said "don't ask again",
every later PR still gets its table written into the execution log's §11 — the interruption stops, the
disclosure does not. The execution summary names each PR whose human-action boxes this run ticked, with
the `Backed by` value for each, because on GitHub the tick is indistinguishable from the author's own.

**Flow A** never edits anything, but the rehearsal still records which boxes are human-action and what
backs them. That is what lets the execution run open with the table already built, instead of deriving
it while the user waits.

Editing a description is a write to `origin` and belongs on the Step 0 write list. Keep the original,
change only the marker characters, and re-read the body afterwards:

```bash
gh pr view <n> --json body --jq '.body' > <backup-dir>/pr-<n>-body.md   # keep the original
gh pr edit <n> --body-file <edited-copy>
gh pr view <n> --json body --jq '.body' | diff <backup-dir>/pr-<n>-body.md -   # only [ ] → [x] lines
```

A ticked box is a claim about testing that no human made. The log's §11 and the summary must both name
every PR whose description this run edited, and under which of **b**/**c**/**d** — that list is the
only place the record stays true, because on GitHub the edit looks like the author's own.

**Rebase first, then merge.** Every PR after the earliest one — and every extra non-PR branch — rebases
onto the *current integration tip*, not onto `main`. The tip already carries everything merged before
it, so that is the tree this change has to be correct against. Rebasing puts the conflict where it can
be resolved per-commit with the PR's own context, and leaves a merge that is trivially clean.

```bash
git checkout -B rebase/pr-<n> refs/integration/pr/<n>
git rebase integration/<date>-<slug>          # conflicts surface here, not in the merge
git checkout integration/<date>-<slug>
git merge --no-ff rebase/pr-<n> -m "integrate PR #<n>: <title>"
```

Record both SHAs in the log's §6 (`head before → head after`, and what it was rebased onto). The repo's
own merge logs read this way — "rebased `2e80a3a` → `1ff4dfc` onto `6003e18`" — and that chain is what
makes a later bisect possible.

### When the rebase will not replay

Some branches cannot be rebased onto the tip at all: one was cut from an *older integration branch* and
carries thirty-five commits of other people's work, another was cut before `main` was rebased and every
SHA it remembers is gone. From the outside both look identical — the rebase either stops on the first
commit or produces a diff many times the size of the PR.

Do not fight that conflict-by-conflict. Work out which commits are **actually this branch's own** and
replay only those. Same procedure in flow A and flow C; only the last step differs.

1. **Check what already exists** before touching anything:
   ```bash
   gh pr list --head <branch> --state all --json number,state,mergedAt
   git cherry -v origin/main <branch>
   ```
2. **`git cherry` answers "which commits are unique" by patch-id** — the hash of the change itself, not
   the commit SHA. A `-` line is a commit whose content is already upstream under some other SHA; a `+`
   line is genuinely this branch's. That is precisely why it survives the case where the base was
   rebased and every SHA changed, and why there is nothing to gain from walking commits one at a time
   or from picking a threshold of "too many missing SHAs to bother checking the rest". One call
   classifies the whole series, so there is nothing left to skip.
3. **Cherry-pick the `+` commits onto a fresh branch from the tip**, in order:
   ```bash
   git checkout -b replay/pr-<n> integration/<date>-<slug>
   git cherry-pick <each + commit, oldest first>
   ```
4. **Prove the result is the PR and nothing else** — file count and per-file line counts, against the
   PR's own diff:
   ```bash
   gh pr diff <n> --name-only
   git diff --numstat integration/<date>-<slug> replay/pr-<n>
   ```
   Write it in the log in those terms rather than as "rebased cleanly": *"a plain rebase was not
   possible — the branch was stacked on an old integration branch, 35 commits. Rebuilt by
   cherry-picking its one real commit `95be748a` onto the current tip; applied cleanly, the locale
   files auto-merged against the block that had just landed. Result is exactly the intended change:
   6 files, `CacheAlertModal.tsx` +12, its unit test +16, `resolveFailed` present in all four locales
   (en/he/ru/ar)."* A replay that silently dropped one locale file passes every check that only counts
   commits.
5. **If `git cherry` reports everything as already upstream but the content still differs**, that is
   the squash-merge case — many commits became one, so no patch-id can match. Fall back to content:
   `git diff --numstat origin/main <branch>`. Non-empty means the work is genuinely missing and the
   branch needs replaying, whatever ancestry claims.
6. **If the branch was rebased *and* its commits were edited during a conflict resolution**, `git
   cherry` marks them `+` even though a variant of them landed. `git range-diff
   origin/main...<old-head> origin/main...<new-head>` pairs the two versions of the series and shows
   what changed between them. It is the only one of these tools that separates "this commit is missing"
   from "this commit landed in a modified form" — reach for it rather than diffing whole branches or
   comparing commits by hand.

**Flow A stops at the worktree**: the replay stays local and the ledger records how it was rebuilt, so
the execution run replays the same cherry-picks instead of rediscovering them. **Flow C** publishing a
replayed branch means force-pushing the PR head, so the Step 0 gate applies in full — backup ref first,
`--force-with-lease=<branch>:<old-head>` naming the head this run actually read (Step 6's
`headRefOid`), re-confirmed immediately before.

**The rebase is local until you decide otherwise.** In flow A it never leaves the worktree. In flow C,
publishing it means force-pushing the PR's head, which is a write with every consequence listed in the
Step 0 gate — back it up, use `--force-with-lease=<branch>:<old-head>`, and re-confirm first.
Integrating a PR does not require publishing its rebase; only re-pointing the PR itself does.

After **each** merge, before moving on:

1. Resolve conflicts. Classify each one **M** (mechanical — one side is a strict superset, or the rule
   is obvious) or **J** (judgment — a real either/or). For every `J`, record the discarded side and what
   it was trying to do, not just the winner.
2. Re-run the five required checks — `lint`, `typecheck`, `test:unit`, `test:integration`, `test:i18n`
   — and compare against the **baseline**, not against zero.
3. Append to the log: action entry (§5), per-PR block (§6), any conflict rows (§7), any obstacle (§9),
   and the checkpoint row (§10) with the branch SHA and the delta.
4. Confirm the PR's diff scope is unchanged: `gh pr diff <n> --name-only` against the same paths on the
   branch. A rebase that silently widens or narrows a PR's file set survives every green check.

A `DIRTY` PR is not a special case under this order — it rebases onto the tip like every other one. Log
the resolution anyway: the conflict is usually a doc line rather than code, and that distinction is
what tells the next reader whether the PR was actually at odds with the set.

### A PR whose branch was cut from the integration branch

`baseRefName` will not tell you this. A PR can read `base=main` while its head branch was cut from the
integration branch, and then it carries every commit that branch held at cut time. Test ancestry, and
treat the commit count as the corroborating tell:

```bash
git merge-base --is-ancestor <int-tip> <pr-head> && echo "carries the integration branch"
git rev-list --count origin/main..<pr-head>          # 30+ on a two-file PR is the same finding
```

Merging one of these to `main` squash-lands the entire integration branch as a single commit —
including PRs nobody approved for `main`, drafts among them. It is not a merge candidate in any flow.
Inside a run it is worse than redundant: re-merging the set into the set produces conflicts that look
like real disagreements between PRs and are not.

Two ways out, cheapest first.

**1 — Rebuild it**, when the PR's own change is a small number of commits. This is the replay ladder
above ("When the rebase will not replay") pointed at a different target: `git cherry -v origin/main
<pr-head>` names the commits that are genuinely the PR's, and those are the ones to pick onto a fresh
checkout of the target.

```bash
git worktree add --detach ../<repo>-worktrees/rebuild origin/main
git -C ../<repo>-worktrees/rebuild cherry-pick <sha>...
git -C ../<repo>-worktrees/rebuild push --force-with-lease=<branch>:<old-head> origin HEAD:refs/heads/<branch>
```

That explicit `--force-with-lease=<branch>:<old-head>` is the required form everywhere in this skill,
never the bare one — the reason is in the Step 0 gate.

Confirm the rebuilt diff is the PR's own change and nothing else — `git diff origin/main --stat`
against `gh pr diff <n> --name-only` — before letting it merge. Publishing a head is a write: it
carries the Step 0 gate.

**2 — Re-implement it**, when the cherry-pick conflicts across many files because the ground moved
under it: the PR's version of a component landed differently through another PR, a shared type was
renamed, a file it edits was split. Do not hand-resolve that. Wide conflict resolution is exactly the
trap in the table below — take one side wholesale and additions vanish while `tsc` stays green.

Hand it to a coding agent (Claude Code, Codex, Cursor) as a fresh implementation task, and give the
user the prompt rather than running it silently — re-implementing someone's PR is their call, not the
run's. Fill every angle bracket; an unfilled one is what makes the agent invent the requirement:

```text
Re-implement PR #<n> — "<title>" — on a clean branch. Do not cherry-pick or merge the old branch.

Start from a branch cut off <origin/main | the integration tip <sha>>, which already contains
<what landed there: the PRs by number>.

Read the old work for intent only, never as a patch to apply:
  gh pr view <n> --json title,body,comments
  gh pr diff <n>

What the PR set out to do, from its body and not from its diff:
<one paragraph — the user-visible behaviour, not the implementation>

Ground that moved under it since it was written:
- <path> — now <how it looks on the target and which PR #N changed it>
- <path> — <same>

Rebuild that behaviour against the tree as it is now. Match the current shape of each file rather than
the shape the PR left it in. Keep the PR's tests, port them to the current APIs, and add one for
anything the new shape changed. Then run lint, typecheck, test:unit, test:integration and test:i18n,
and report your final file list against `gh pr diff <n> --name-only` so the difference between the old
PR's scope and the new one is visible rather than assumed.
```

The re-implementation is a new PR **based on `main`** — the integration tip may be a convenient tree to
develop against, but the PR itself is opened against `main` like every other one this run touches (see
Step 7). Close the old PR with a comment pointing at the replacement, and record the swap in the log's
§4 with both numbers: a set whose membership silently changed is not reproducible from the log.

**Do not batch.** Merging three PRs then testing turns one red suite into a three-way bisect.

## Step 7 — Sweep for what git did not flag

A clean three-way merge routinely produces wrong code: one PR extracts a function while another edits
the old body, and both sides apply without a marker. `tsc` will not catch it.

After any merge touching a refactor:

- For every function moved or extracted by a PR in the set, grep its call sites and confirm the guards
  and side effects survived.
- List every blanket per-file resolution (`--ours`/`--theirs` on a whole file) — each one deletes
  unrelated additions from the losing side.
- Confirm every flag, env var or wiring the set introduces is still read.

Record the sweeps in the log's §8 **even when clean** — "checked, empty" and "not investigated" must not
look alike.

### A fix this run has to write always goes on a branch based on `main`

Step 7 is where a defect that exists only in the combination shows up. Writing the fix is in scope.
Where it goes is not negotiable: **a new worktree, a new branch cut from `main`, and a PR based on
`main`** — never a PR based on the integration branch, not even when that branch is fifty commits ahead
and the fix only makes sense on top of all of them.

The integration branch is a test vehicle. A PR based on it shows the reviewer fifty commits of other
people's work as though it were this change, cannot merge without dragging every one of them along, and
breaks outright the next time the branch is rebuilt.

```bash
git worktree add ../<repo>-worktrees/fix-<slug> -b fix/<slug> origin/main
# write the fix against bare `main`, commit, then:
git push -u origin fix/<slug>
gh pr create --base main --head fix/<slug>
```

The fix frequently will not apply cleanly on bare `main`, because the state it repairs does not exist
there yet. That is expected, and it is not a reason to re-base it on the integration branch. Write it
against `main` and let the ordering constraint carry the rest.

**State what it must land behind, in the PR, without naming the integration branch.** That branch is
local and transient — a reviewer cannot see it and will not find it later. What they can act on is the
PR list:

> Merge after #646, #650 and #651. This was found by testing those three together: the crash only
> appears once all three are applied, so landing this ahead of them ships a fix for a state that does
> not exist yet.

Name **every** PR in the chain ahead of it, not only the one that introduced the problem, and keep the
reason to a sentence or two.

**Never put `fixes`, `closes` or `resolves` in front of one of those numbers.** GitHub reads the
keyword and ignores the sentence around it — even "does not fix #646" closes #646 on merge, and this
comment is one careless verb away from closing the three PRs it is waiting for. Bare `#646`, always.

Log it in §9 and §11: the branch, the PR number, what it repairs, and the PRs it is blocked behind. A
fix PR opened mid-run and not written down is indistinguishable from unrelated work within a week.

## Step 8 — Coverage gate

Before reporting done, prove the branch contains everything it claims:

```bash
gh pr diff <n> --name-only                                          # the PR's file set
git diff --numstat origin/main integration/<date>-<slug> -- <those paths>
```

Compare **content**, not paths. A filename appearing on both sides cannot distinguish "this PR landed"
from "a later PR happened to touch the same file", which is precisely the false negative this step
warns about. For the same reason, do not reach for `git merge-base --is-ancestor` or `git log --grep`:
a PR that was squash-merged, rebased or cherry-picked shares no commit with the branch, so ancestry
reports it absent while every one of its lines is present.

The audit's "missing" list is **not a verdict** — it false-negatives whenever a later PR edited the same
files. Hand-verify every reported miss and name the false negatives in the log; the next run hits the
same ones.

If an old integration branch is being replaced, diff the two: anything on the old branch and not the new
one is either a PR you missed or work that was never in a PR at all. Both need a line in the log.

## Step 9 — Clean up, write the summary, hand off

### Clean up what the run created — and only that

A week later the scratch state this run leaves behind is indistinguishable from someone's work in
progress. Delete what this run made; never touch what it merely used.

| Artefact | Disposition |
|---|---|
| The worktree (`../<repo>-worktrees/int-<date>`) | remove — it carries its own `node_modules` and goes stale immediately |
| Scratch rebase branches (`rebase/pr-<n>`) | delete |
| `refs/integration/pr/*` | delete |
| Backup ref whose PR has landed | delete — the landing step below retires it as its last action |
| Every other backup ref, and every archive tag | **keep** — until its own PR lands, a backup ref is the entire undo |
| The integration branch | **delete** once `main` holds its content — see "Retire the branch" below |
| A PR head, or any branch this run did not create | **never**, without asking each time — including one this run rebased |

```bash
git worktree remove ../<repo>-worktrees/int-<date>
for b in $(git branch --list 'rebase/pr-*'); do git branch -D "$b"; done
git for-each-ref --format='%(refname)' refs/integration/pr | while read -r r; do git update-ref -d "$r"; done
```

Deleting a **remote** branch is its own confirmation every time, and only ever for a branch this run
created: `git push origin --delete` cannot be undone from the client, and a branch whose PR is already
closed is often the only copy of its commits.

**Every deletion gets a log line, and so does every artefact deliberately kept.** "Removed" and "never
looked at" must not read alike.

Where the set included branches with no PR (Step 1's third mode), the log and the summary must both say
what became of each one by name: merged into the branch or not, still present locally or not, still
present on `origin` or not. A PR carries its own record on GitHub; a bare branch carries none, so one
that goes unmentioned here is simply lost.

### Stale worktrees from previous runs — only when asked, and only on proof

The section above deliberately refuses to touch anything this run did not create. That refusal is right
per-run and wrong over time: every integration run, and every PR landed from one, leaves a worktree
pinned to a branch, and nothing ever removes them. They are not free — each carries its own
`node_modules`, and `git worktree list` becomes unreadable at thirty entries.

**They accumulate for a specific mechanical reason.** `gh pr merge --delete-branch` deletes the remote
branch but *fails* to delete the local one when a worktree holds it:

```
failed to delete local branch feat/host-pressure: cannot delete branch 'feat/host-pressure'
used by worktree at '.../tb-mobile-worktrees/feat-host-pressure'
```

That is a warning on an otherwise successful merge, so it scrolls past and the worktree survives its PR
by months. Read the message rather than the exit code — the merge did succeed.

**This is never part of a run.** It touches state the run did not create, so it happens only on an
explicit request to clean up worktrees, and never as a tidy-up folded into something else.

**The predicate is two facts about each worktree, both queried, neither inferred:**

1. Its branch's PR is `MERGED` or `CLOSED` — from `gh`, per branch.
2. `git status --porcelain` in that worktree is **empty**.

Both must hold. Anything else is kept:

| Case | Disposition |
|---|---|
| PR `MERGED` or `CLOSED`, worktree clean | remove |
| Worktree dirty | **keep**, whatever the PR says — uncommitted work exists nowhere else |
| No PR found for the branch | **keep** — "no PR" is not "merged"; it is a branch nobody has proposed yet, or one whose PR was opened from a differently-named head |
| An integration branch's own worktree | **keep** unless named explicitly — the rehearsal artefact and the next run's conflict oracle. One whose branch has already been retired (below) is a leftover rather than an oracle: say so instead of sparing it by default |
| The primary checkout, or the worktree you are standing in | **never** |

Build the table first and read it, then delete — never remove inside the same loop that discovers:

```bash
git worktree list --porcelain \
  | awk '/^worktree /{w=$2} /^branch /{b=$2; sub("refs/heads/","",b); print w"\t"b}' \
  | while IFS=$'\t' read -r w b; do
      case "$w" in */tb-mobile) continue;; esac          # never the primary checkout
      pr=$(gh pr list --head "$b" --state all --json number,state --jq '.[0]|"\(.number):\(.state)"')
      printf '%-40s %-44s pr=%-14s dirty=%s\n' \
        "$(basename "$w")" "$b" "${pr:-none}" "$(git -C "$w" status --porcelain | wc -l | tr -d ' ')"
    done
```

Then remove only the rows that satisfy both facts:

```bash
git worktree remove "$W/$d" || git worktree remove --force "$W/$d"
```

`git worktree remove` refuses when the tree holds modified or untracked files, which is the guard doing
its job — **`--force` is for ignored build output only** (`node_modules`, `dist`), never to override a
refusal caused by real changes. Since the plain form is tried first and only a clean row is ever
attempted, a `--force` that succeeds here removed nothing but ignored files.

**Removing a worktree does not delete its branch.** The local branch survives, so the operation is
recoverable and a closed PR's only copy of its commits is not lost. Deleting those branches is a
separate decision and a separate ask.

Report the counts and name what was kept and why. "Twenty-nine removed" alone does not tell the next
reader whether the four dirty ones were considered and spared or simply missed.

### Then write it up

Write the summary from the log using the summary format, and fill the log's §14 — gaps in this log:
every check skipped, every reported miss hand-waved through, everything not investigated. Then report:

- branch name + SHA, PR count, commits ahead of `main`
- lint/test delta vs baseline
- the judgment calls, the exclusions, and anything not verified
- what was cleaned up and what was kept, including every no-PR branch by name
- every PR description this run edited, and under which checkbox answer
- paths to both documents

**Flow A stops here** — nothing was pushed. Report the result and ask whether to proceed to flow C.

### The integration branch is not what lands

Pushing or merging the integration branch is a **two-step gate**: it happens only when (1) the user
asked for it in those terms — never offered as the obvious next step, never carried over from the
approval of flow C — and (2) they approve that specific write immediately before it happens. Absent
both, the branch stays local and the two execution documents are the deliverable.

It never merges into `main` at all. Its job was to prove the set is coherent together; landing it as
one commit would collapse every PR's review into a single unattributable squash.

### Landing the PRs — one at a time, each based on `main`

Landing is its own approval, separate again from the yes to flow C. When it is given, walk the
**rehearsal's recorded order** and, for each PR:

1. **Retarget to `main`** if the PR is based on another PR's head: `gh pr edit <n> --base main`. A
   stacked child that keeps its parent's base cannot land once the parent is gone.
2. **Push the backup ref first** — `backup/<head>-<date>` and an annotated tag — *before* the rebase,
   not after. It is the only undo for the force-push in step 3.
3. **Rebase onto current `main`**, then
   `git push --force-with-lease=<branch>:<old-head> origin HEAD:refs/heads/<branch>`, naming the head
   recorded in step 2 — never `--force`, never the bare lease.
4. **Wait for that PR's checks to go green on the rebased head.** This is the one genuine wait in the
   whole run: the rebase moved the head, so every result from before it is stale.
5. `gh pr merge <n> --squash --delete-branch`.
6. **Delete that PR's backup ref, and only that one, once the merge has succeeded.** It has done its
   job, and a backup ref left behind is indistinguishable from a live branch a week later. Every other
   backup ref stays until its own PR lands.
7. Move to the next PR in the recorded order. The merge just advanced `main`, so the next one is behind
   again — step 3 is not optional for it.

A member of the set that has no PR (Step 1's third mode) cannot land this way. Open a PR for it based
on `main`, or record in the execution log that it was left unlanded and where its commits live.

Never push `main` directly and never force-push it. Log each landing as it happens: PR number, head
before and after the rebase, the squash SHA on `main`, and the backup ref retired.

### Retire the branch

The run is not finished when the branch is green; it is finished when the branch is **gone**. Once
`main` holds the content — however it got there — push a backup ref, delete the branch locally and, if
it was ever pushed, on `origin` too, and record both in the execution summary.

Audit each ref by **content, not ancestry**: ask *does it hold a file `main` has never had*, rather than
*is it merged*. Everything here lands as a squash, so no branch is ever an ancestor of `main` and
`git merge-base --is-ancestor` reports "unmerged" for work that landed in full. It is the same
principle as Step 8's coverage gate, pointed at refs instead of files — and it is the method that made
the 2026-08-12 deletions safe, recorded in the retirement doc.
The script, and two checks from that audit that return a confident wrong answer instead of an error, are in
[`integration-branch-lifecycle.md`](https://github.com/RonenMars/threadbase/blob/main/docs/integration-branch-lifecycle.md).

If the branch is still alive a week later with nothing landed, that is the parallel-trunk failure
starting. Say so rather than letting it run.

### Coordinating with tb-streamer

Integration runs across the two repos are usually the same piece of work; the merge order in one has no
bearing on the other. **Each repo logs its own half** — one document spanning both leaves each side
tracking work it cannot verify. Cross-reference by path and PR number instead.

### If a dependabot run was deferred, this is where it comes back

When flow C's step 1 recorded a yes to "run the dependabot PRs separately afterwards", say so in the
hand-off and start it — as a **fresh flow A**, with the dependabot PRs as its set, its own rehearsal
and its own pair of documents. Not an appendix to these ones: every landing above moved `main`, so
nothing in this run's ledger applies to a bump that has not been rebased onto it. Reporting this run as
finished without returning to it is how the deferral becomes a silent drop.

## Traps that recur

| Trap | Consequence | Guard |
|---|---|---|
| Stale `origin/main` | Branch is not from today's `main`, no error anywhere | `git fetch` immediately before the cut; state the SHA |
| `git fetch --prune` | Deletes `origin/pr/*` mid-run | Fetch heads to `refs/integration/pr/*` |
| Bulk `mergeable` query | Every row `UNKNOWN` | Per-PR `gh pr view` |
| Draft PRs | Read as mergeable, will not merge | Request `isDraft` explicitly, then ask the user whether the run includes them |
| Stacked child | Does not auto-restack when its base merges; goes `DIRTY` | Merge base first, verify the child's unique commits survive |
| `main` not green | Every count misattributed | Baseline in Step 3 |
| PR head pushed after planning | Order, ledger and recorded resolution were all derived against a commit that is gone | `headRefOid` in Step 6's per-PR read, compared against §4 |
| Branch stacked on an old integration branch | A rebase drags in 35 commits of other people's work, or refuses outright | `git cherry -v origin/main <branch>`, replay the `+` commits only |
| `fixes`/`closes`/`resolves` before a PR number | Closes the PR the fix was waiting for, on merge | Bare `#N` in any dependency note; the keyword ignores the sentence around it |
| Ticking a box that asserts on-device verification | A green checklist claims a human looked, and nothing records that none did | The `Backed by` table, then stop — Step 6 |
| PR branch cut from the integration branch | `base=main` hides it; a squash to `main` lands the whole branch | `git merge-base --is-ancestor <int-tip> <pr-head>` before it is merged or ordered |
| Commit hooks rejecting merge commits | The whole shell call aborts, not just the commit | Expect it; ask the user how to proceed rather than reaching for `--no-verify` |
| Copied `node_modules` | Duplicate native modules, phantom failures | `npm ci` in the worktree |
| Judging green from `test:unit` | Integration failures ship silently | Run all five required checks at every checkpoint |
| Assuming E2E ran | Maestro never runs on a PR | Dispatch it, or record E2E as unknown |
| Hand-writing `[skip-ci]` | The `commit-msg` hook exits early and skips its path check, so a real code change can skip CI | Let the hook decide — never type the tag yourself |
| Committing a fix to the integration branch | It stops being a staging area and becomes a parallel trunk — the state this repo spent an audit unwinding | Fix in the PR that needs it (Step 7), then re-merge |
| Integration branch left alive after landing | The parallel trunk it was never meant to be | Retire it in Step 9; back it up first, then delete local and remote |
| Whole-file conflict resolution | Silently deletes routes/additions; `tsc` stays green | List every one in §8 and diff the losing side |
