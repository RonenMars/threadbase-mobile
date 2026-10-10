---
name: integration-by-batches
description: Group a repo's open PRs into medium-sized, independently testable batches, build one local integration branch per batch, validate it, deploy it to QA through a pushed test tag, STOP for explicit QA approval, then land that batch's PRs one at a time (rebase + squash) before starting the next batch. Use when the user says "batch the open PRs", "integrate in batches", "group the PRs and QA each group", "bulk process the PRs", or when one big integration branch would make a QA failure impossible to attribute. Sibling of `integration-branch` (one branch, all PRs); this one trades breadth for attribution.
---

# Integration by batches

`integration-branch` merges *every* PR into one branch. When QA finds a defect in that branch you cannot
say which PR caused it. This skill cuts the open PRs into **batches of related PRs**, QAs each batch alone,
and lands it before the next one starts. Origin: a 24-PR, 8-batch run on tb-mobile (2026-10-03 → 10-08).

Reuse `integration-branch` for the mechanics it already proves (worktree, push guard, per-PR rebase +
`merge --no-ff`, coverage gate, sweeps, cleanup). This file only states what differs and what the batched run
taught. Read it first: `~/dotfiles/ai-tools/claude/skills/integration-branch/SKILL.md`.

## Hard rules

1. **Nothing merges to `main` before that batch's explicit QA approval.** Not a green CI, not a quiet user.
2. **One batch at a time.** Do not build, deploy or merge batch N+1 until batch N is approved *and* landed.
3. **Never combine unrelated PRs to lower the batch count.** A batch is a unit of attribution.
4. **Never decide a product question silently.** Conflicts that are an either/or about behaviour (J-calls)
   stop the run and are put to the user with the options.
5. **The integration *branch* never reaches `origin`.** Only an annotated **test tag** does (see Step 5).
   Prove it before every report: `git ls-remote --heads origin "integration/*" | wc -l` → `0`.
6. **Never commit the plan or the log.** They are working notes. Keep them outside any repo.
7. **Preserve each PR's own history.** Land PRs individually; the batch branch is a test artifact only.
8. **Evidence over assumption.** Repo, CI and test output decide. Say "not verified" when it is not.

## Step 0 — Read the world, in both repos

```bash
git fetch origin --prune && git rev-parse --short origin/main        # state this SHA
gh pr list --state open --json number,title,headRefName,baseRefName,isDraft,headRefOid
```

- **Per-PR, never bulk:** a list query returns `mergeable: UNKNOWN` for almost every row. Run
  `gh pr view <n> --json mergeable,mergeStateStatus` per PR (24 PRs = 24 calls; budget it).
  `gh pr view` can also return `UNKNOWN`; `gh api repos/<o>/<r>/pulls/<n> --jq .mergeable_state` forces the recompute.
- **Read the companion repo's open PRs too.** A cross-repo dependency is often declared on *one* side
  ("Land this streamer PR first" in the streamer PR body; nothing on the app PR). Pair across repos by the
  **endpoint or field actually called**, never by feature name — "terminate" matched "terminate" and was
  unrelated (the app called the old `/stop`).
- Capture each PR's file set: `gh pr diff <n> --name-only`. Overlaps are what drive the grouping.
- **Re-scan before acting.** Between plan and execution `main` moved 4 commits and the open-PR count went
  24 → 35. A plan older than a day is a hypothesis.

## Step 1 — Group

Group by **subsystem + shared files**, then check each group against four questions:

| Question | If "no" |
|---|---|
| Can one QA pass of one screen/flow cover the whole batch? | split it |
| Do the PRs share files (so rebasing separately costs the same conflicts)? | they probably belong together |
| Would a failure be attributable to a PR or a small pair? | split it |
| Does anything in it affect the app binary? | if not, it needs CI only — no device QA build |

Rules of thumb that held:

- **Forced pairs:** two PRs rewriting the same screen, test and e2e yamls cannot be separated across
  batches without one going `DIRTY`. Keep them together, and keep them *out of* a larger batch if their
  conflict is a product question — it should fail in a 2-PR batch, not a 6-PR one.
- **A "tooling/docs" batch is legitimate** even when the PRs are functionally unrelated, if the shared property
  is "none affect the binary" and the files are disjoint. State that reasoning in the plan.
- **Dependency bumps:** lockfile-only bumps share a batch (smoke test); a platform upgrade (React Native +
  its jest preset) is **alone and last** so a regression is attributable. `jest-expo` pins jest 29 — if a bump
  drags jest 30 in, stop.
- **Order batches:** app-code first (conflict-dense PRs go stale fastest), tooling/docs next (cheap to
  re-rebase), deps last.
- **Drafts are the user's call.** List them and ask. Including one does not require flipping it ready — but it
  cannot be squash-merged while draft; that stop is the author's, not yours.
- **Hold, don't merge, any PR with an unresolved security finding.** Report it, don't repair someone's PR
  without approval of the exact diff, and rebuild the batch without it (a batch QA'd with a local patch
  validates code that differs from what merges).

## Step 2 — Write the plan, then wait

Write `<date>-batched-qa-plan.md` **outside any repo** with: the PR table (PR, title, subsystem, key files),
the overlap list, the ordering constraints, one block per batch (**goal · PRs in order · why together · order
rationale · QA scenarios · risks**), the execution table (batch, PRs, QA build?, cross-repo dependency,
blocking?), and the stop-and-ask list. Open with the decisions the user must answer (drafts, QA route).
**Send it and stop.** A local rehearsal is neither a deploy nor a merge and may start early; the tag push
may not.

Keep a second file, the **engineering log** (`<date>-batched-qa-log.md`): §1 artifacts (every worktree,
branch, ref, tag, with created/removed), §2 baseline, §3 scope, §4 order/constraints, §5 timestamped actions,
§6 per-PR records (head before → rebased to → tip after), §7 conflicts (M mechanical / J judgment), §8
sweeps, §9 obstacles & numbered findings, §10 checkpoints, §11 decisions (who, why). Append after every
action; obstacles are the first thing memory loses. Concise facts, no chain-of-thought.

## Step 3 — Build the batch (flow A, local)

Per `integration-branch` Steps 2–8: fresh worktree **at an absolute path outside the repo**
(`../<repo>-worktrees/int-<date>-bN`), `git fetch` immediately before the cut, push guard armed
(`branch.<b>.pushRemote=no_push_integration_branch`), `npm ci` in the worktree, **baseline on untouched
`main` first**, PR heads fetched to `refs/integration/pr/<n>`, each PR rebased onto the tip then
`merge --no-ff`, one at a time.

Add for batches:

- **A clean three-way merge is the case that produces wrong code silently.** Hand-read the composed result
  for any file touched by 2+ PRs (is each PR's addition *defined and wired*?). Log "checked, clean".
- **Suite counts:** reconcile "+N suites" with `git diff --name-status` (`A` files) and `jest --listTests`.
- **Heavy suites report false failures in a batch run.** Confirm any failure with `--runInBand` on that suite
  alone before classifying: passes alone = load artifact, fails alone = real. Both mistakes occurred.
- **Re-verify head SHAs** of every PR before each (re)build; a moved head invalidates that PR's record only.
- **New test files must be registered** in the repo's shard manifest (`scripts/ci-*-shards.json`) or CI goes red
  while the code is fine.
- After any change to `package.json`: `bundle exec pod install` (never bare), commit `ios/Podfile.lock` with it
  *except* the four path-dependent checksums; use the repo's reset script, never `git checkout --`.

## Step 4 — Validate

`tsc --pretty false` (not pretty — ANSI defeats `grep -c`), lint on changed files, full test suite vs the
**baseline delta**, i18n check when locales moved, plus the batch's own checks. A batch with no binary
impact (tooling/docs) is validated by CI plus one local run of its own tooling.

## Step 5 — Deploy to QA through a test tag, then STOP

QA builds a ref **on origin**; the integration branch must not be there. Resolve it with a tag:

```bash
git tag -a test-<env>/v<version>-<sha7>-<date> <tip> -m "<batch>: PRs ..."
git push origin refs/tags/test-<env>/v<version>-<sha7>-<date>         # explicit refspec, never bare
gh workflow run qa.yml -f deploy_ref=<tag> -f platform=<ios|android|all> -f groups=qa
```

- **Ask which platform(s)** (iOS, Android, both) before dispatching — never assume `all`.
- **Use the full SHA** if you dispatch by SHA; a short SHA dies at `actions/checkout`.
- **Pin the deployment identity to the batch** in the log: run id, ref, release ids. A QA checkpoint can span
  days; at the start of **every** QA conversation re-establish *which binary is on the device* before reading
  any result as a verdict on the batch (a tester once validated a build two deployments newer than the batch).
- **Gate satisfied by a binary, not a merge:** a cross-repo hard dependency is met when the running
  counterpart contains it (e.g. a streamer run from the dependency's branch), not when its PR merges. Ask what
  is running before declaring a batch blocked.
- Report: batch, tag, SHA, PRs, what to test (the plan's scenarios), caveats. **Stop and wait.**

### QA ordering for paired fixes

When two repos fix one bug at both ends (server stops emitting bad data; client stops trusting it), QA the
**degrade-gracefully half first, against the unfixed counterpart**. Against the fixed one the symptom is
gone before the guard runs and the PR passes without being exercised. Merge the server half afterwards.

## Step 5b — The streamer side (tb-streamer, the other half of a pair)

Streamer bulks are built and validated like mobile ones (Steps 3–4), but the streamer has its **own CLAUDE.md
rules, and they differ**. Read `tb-streamer/CLAUDE.md` before touching it; the points that bite a batched run:

**Building and validating**
- Use the Node in the streamer's `.nvmrc` (`better-sqlite3` ABI mismatch gives failures unrelated to the change).
  Verify with `npm run lint && npm test` (vitest; tests mock `node-pty`). `npm run check` is the wider gate.
- Baseline on untouched streamer `main` first, same as mobile.
- Every new feature needs a test in `__tests__/`. Docs-only PR titles carry `[skip-ci]` (CI matrix skipped).
- **Migration ordering:** runtime-store migrations are numbered files (e.g. `007`) tracked by *filename*, so two
  PRs adding migrations work in either order, but the second to merge needs a rebase of
  `__tests__/runtime-store.test.ts`. Expect it in any bulk with two storage PRs (S2).
- The repo is **public**: never commit a real identifier (hostnames, tokens, addresses) into a fixture, doc or log.

**Pairing with a mobile bulk (the "parallel feature")**
- A pair is **server half + client half behind a capability flag** (`GET /api/info` reports `savedItems`,
  `recentDirs`; `/api/providers` health reports `capabilities.multiDirectory`). Mobile is inert until the flag
  appears, so the server half can land first without a visible change, and the client half is QA'd against a
  streamer **run from the server PR's branch/tag**.
- **Compatibility is advisory, not a gate** (streamer CLAUDE.md "Backward compatibility with tb-mobile"). Tier it:
  *additive* (new optional field/endpoint/event) → no check; *rename, removal, changed status vocabulary* →
  `rg -n "<identifier>" ../tb-mobile/{services,hooks,stores,components,types}`, **report file:line and whether the
  call site is in a shipped build, then proceed**. A hit is information for the user, never a reason to block or
  rewrite the streamer PR. Client statuses that must not be reused with new meaning: `running`, `waiting_input`,
  `completed`, `failed`, `on_hold`, `idle`.
- **The mobile half owns degradation** (tb-mobile "Server contract — degrade, don't break"): an old or newer server
  must cost a degraded screen, never a crash. QA the pair **both ways** — new client on old server, old client on
  new server — not just the happy pair.
- **Match pairs by the endpoint/field actually called** (`rg` the mobile `services/api-client.ts`), never by
  feature name, and read both PR bodies: the declaration ("Server side: …#1024", "needs a streamer that…") is
  usually on one side only.

**Running a streamer for mobile QA**
- Only one streamer binds port 8766. The supervised prod instance and an ad-hoc dev one coordinate through
  `~/.threadbase/prod-suspended.json` (`--replace-prod` / `--forget`). Running a bulk's build as the QA server
  **takes over the port and shares `~/.threadbase/`** (`runtime.db`, cache): a migration from the bulk runs against
  that data. Say so before starting it, restore prod afterwards (`tb-streamer prod start`), and never leave the
  takeover marker behind.

## Step 6 — Handling QA findings

1. **Is the screen in the batch's file set?** `git diff --name-only <main>..<batch>` before accepting a finding
   against a batch.
2. **Cheap proof a defect predates the batch:** `git log <shippedSha>..<head> -- <paths>` and `git diff` over
   the same paths both empty → it is on `main`/the shipped build, not the batch. Find the shipped SHA from the
   last successful `deploy.yml`.
3. A genuine `main` defect becomes its **own PR**, not a patch inside the batch. Trace it to `file:line` before
   fixing; fix the **root cause** where all callers route (a fallback parameter with zero production callers is
   deleted, not defaulted at one call site).
4. **Mutation-check every guard test:** revert the fix, confirm red, restore. A test that cannot fail is
   deleted. Test at the layer where the mechanism lives, not the layer showing the symptom.
5. **A shared mock that degrades every dependency uniformly removes the asymmetry a bug lives in.** Model the
   healthy case explicitly.
6. **A second caller that gets it right is what makes the broken one look covered** (i18n keys exist ≠ call site
   supplies the interpolation variables; all-servers-down works ≠ some-servers-down works). Check the caller you
   are fixing, not the one that already works.
7. QA failure → nothing merges; diagnose, update the integration branch, re-tag, redeploy.

## Step 7 — Land the batch (only on explicit approval)

`main` is protected with strict status checks: **every merge makes every remaining PR `BEHIND`**, and another
session may merge in the gap, so green-and-current can go stale *during CI*. Per PR, in plan order, one at a time:

1. Confirm `OPEN` and that the head SHA equals the recorded one (a moved head is **held**, not merged).
2. Rebase onto the *current* `origin/main` in its own worktree; replay recorded resolutions; diff resolved files
   against the batch branch's copies. Re-run the PR's own tests; push with
   `--force-with-lease=refs/heads/<b>:<old-sha>` and an explicit refspec.
3. **Wait and merge in ONE loop iteration:** poll `gh pr checks <n> --json name,bucket` until **0 pending and
   ≥ ~20 checks** (absent rows and pre-push rollups read as "done"), refuse on any fail/cancel, read
   `gh api repos/<o>/<r>/pulls/<n> --jq .mergeable_state`, and if `behind` exit `STALE` (rebase again) — else
   `gh pr merge <n> --squash [--match-head-commit <sha>]` immediately. Splitting "green" and "merge" into two
   steps lost the race twice in one night.
4. **Verify the merge, not the exit code:** `gh api .../pulls/<n> --jq '"merged=\(.merged) \(.merge_commit_sha)"'`
   and `git merge-base --is-ancestor <squash> origin/main`.
5. **`--delete-branch` only on a leaf.** Check `gh pr list --state open --json number,baseRefName` for PRs based
   on the branch first; deleting a base closes its children with `mergedAt=null` and they cannot be reopened.
   Where the repo auto-deletes merged branches, do nothing. `gh` can also remove a clean local worktree + branch —
   use the API for the remote ref when the worktree matters.
6. Stop and report (don't retry blindly) on: red CI, a conflict with no recorded resolution, a moved head, a
   step hanging past ~4 minutes, any unexpected error. A red check with a fixer inside the batch is a forced
   order, not a stop.
7. After the last PR: delete the batch's test tag, log it, verify `main` green, then clean up (Step 9).

**Landing differences per repo — use each repo's own CLAUDE.md, not mobile's habits:**

| | tb-mobile | tb-streamer |
|---|---|---|
| After a squash-merge | next PR is `BEHIND`; rebase now | semantic-release pushes `chore(release): x.y.z [skip ci]` to `main` **1–3 min later**. Poll `origin/main` until it is there, *then* rebase → CI → merge, or the PR goes `BEHIND` again and burns a second CI cycle |
| Branch delete | auto-deleted by the repo | auto-deleted too; `--delete-branch` errors afterwards (harmless). Gate any manual delete on `gh pr view <n> --json state` = `MERGED` — deleting after a *refused* merge **closes the open PR** |
| Push | plain | `core.hooksPath=scripts/git-hooks` **rebases the branch onto `origin/main` on push**: SHAs come back different. Verify content with `git diff <base> <head> \| git patch-id --stable`, not SHA equality; a stacked branch needs `git rebase --onto origin/main <old-base-sha>` |
| Enforcement | `main protection` ruleset | `main protection` + `release tags` rulesets (the `merge-prs` skill explains the admin bypass) |
| CI cap | ~4 min stuck → stop | same; re-run a flaky red **once**, then stop |

For a pair, land in the order the pair rule says (server first when the client body says "merge after"; the
degrade-gracefully client first when the server half would hide its symptom — see Step 5) and record both PR numbers,
squash SHAs and the running QA binary in one log row.

The dependabot trap: after `main` moves, a bot may rewrite its branch and retarget a newer/major version. Compare
head, net changed lines and version strings; **hold** on any difference.

## Step 8 — Next batch

Re-fetch `main`, **re-scan open PRs in both repos**, re-validate the next batch's plan (new PRs may now contend
for its files — cost of delay compounds), rebuild it on the new `main`, repeat from Step 3.

## Step 9 — Cleanup (list first, approval, then delete)

Inventory from log §1 + `git worktree list`: worktrees, local integration/scratch branches, `refs/integration/pr/*`,
test tags (local and remote), untracked docs (ask). Exclude any worktree with uncommitted/unpushed work and any this
run did not create. `git worktree remove` (never `rm -rf`), `git branch -D` only for approved branches,
`git update-ref -d`, `git worktree prune`. Shut down any simulator/emulator you booted. Verify
`git ls-remote --heads origin "integration/*"` → `0`.

## Traps that recurred in this run

| Trap | Guard |
|---|---|
| Plan/skill references format docs that do not exist | carry the log format inline (Step 2) |
| "Never push the branch" vs QA needing an origin ref | push a **tag**, never the branch |
| Bulk `mergeable` → `UNKNOWN` | per-PR query; REST API forces recompute |
| Every PR already `BEHIND` before any merge | budget one rebase + CI cycle per PR |
| A `CLOSED` PR looks unlanded / a local branch looks like the PR | grep the tree; compare to `origin/<branch>` before rebasing |
| Squash commit is tautologically an ancestor | `--is-ancestor` the **branch head**, not the squash |
| `gh` exit status ≠ merge landed | read PR state |
| zsh does not word-split unquoted vars | run multi-item logic as a `bash` script |
| Shell-exported `EXPO_PUBLIC_*` in a **dev** bundle | dev reads `.env` files; **release** builds inline from `process.env` (read `babel-preset-expo/.../inline-env-vars.js`) |
| Dev client serves a cached bundle | uninstall + reinstall to force a fresh fetch |
| Edits inside a Metro-served worktree reload the phone | work in a different worktree |
| New script test not in `ci-script-test-shards.json` | register it or CI goes red twice |
| Module-scope constant reading `process.env` | tests mutate env per case — keep it inside the component |
| Re-keying a plan by PR number across days | PR numbers are stable; heads and `main` are not — re-scan |

## Report format (every checkpoint)

Batch · integration tip SHA · tag · run id/release ids · PRs in order · tsc/lint/test delta vs baseline · what to
test · caveats/holds · **the decision needed from the user, stated plainly**. Link PRs as full URLs.
