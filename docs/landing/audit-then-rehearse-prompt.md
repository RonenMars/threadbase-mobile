# Landing prompt — audit, then rehearse

One prompt, two phases, with a **hard stop between them**. Paste the whole fenced block into a
fresh Claude Code session at the repo root.

Phase A re-audits [`LANDING-integration-to-main.md`](../../LANDING-integration-to-main.md) against
reality and reports. **The agent then stops and waits.** Only after you read the report and reply
`approved` does Phase B run a full local rehearsal of the landing.

Keeping both phases in one session is deliberate: Phase B needs Phase A's output — the re-resolved
slice tips, the corrected commit counts, the orphan-commit list — and re-deriving them in a fresh
session wastes the audit. If the session does die between phases, the fenced block splits cleanly
at the `PHASE B` header and can be pasted as two prompts.

## Before you run this

- **The live runbook is on `land/integration-prep`, not `main`.** `main` carries a stale 13 KB copy
  last touched 2026-07-31 by a revert; prep's is 20 KB and current. Check out
  `land/integration-prep` before starting, or the agent audits the wrong document.
- **Worktrees go outside the repo** — `../tb-mobile-worktrees/<slug>`, never nested. A nested copy
  makes Jest discover a second `__tests__/` and report phantom failures from a stale branch. This
  matters here because the rehearsal runs the suites once per slice.
- **Node 24.15.0** (`.nvmrc`). The rehearsal runs Jest seven-plus times; a mismatched Node produces
  failures that have nothing to do with the landing.
- **Give it a long session.** Seven slices, each with a rebase and five verification commands.
- Expect ~19 existing worktrees; `git worktree list` before starting.

---

```
Repo: /Users/ronenmars/dev/ai-tools/tb-mobile

Two phases with a mandatory stop between them. Do not begin Phase B until I reply "approved".

## Guardrails (both phases)

- `origin` is READ-ONLY except `git fetch` and pushing your own docs branch. Never `git push` to
  `main`, `land/integration-prep`, or `archive/26-07-2026.18-44-integration`.
- Never `gh pr merge|close|edit` on anyone else's PRs. `gh pr view` / `gh pr list` are fine.
- Use `/opt/homebrew/bin/git` — a zsh function shadows `git` on this machine.
- Create worktrees as SIBLINGS: `../tb-mobile-worktrees/<slug>`. Never nested inside the repo —
  a nested worktree makes Jest report phantom failures from a stale branch.
- Use Node 24.15.0 (`.nvmrc`) for every test run.
- The authoritative runbook is `LANDING-integration-to-main.md` on `land/integration-prep`.
  `main`'s copy is stale — do not read it, and record the divergence as a finding.

═══════════════════════════════════════════════════════════════════════════
PHASE A — Re-audit the runbook against reality
═══════════════════════════════════════════════════════════════════════════

Analysis only. Do not slice, rebase, or merge anything in this phase.

### A1 — Re-measure every number the doc asserts

The status line claims prep is "a straight main + 92 commits (`0 92`)". Verify it; it is known to
be wrong, and the doc itself warns this recurs on every ship.

    G=/opt/homebrew/bin/git
    $G fetch origin --prune
    $G rev-list --left-right --count origin/main...origin/land/integration-prep
    $G rev-list --count --merges origin/main..origin/land/integration-prep   # doc claims 0

Re-derive each of these and record old vs new:
- commits ahead / behind, and whether `main` is still an ancestor
- merge-commit count — the whole contiguous-slice strategy collapses if this is no longer 0
- the same-subject runs: the doc says 9 commits across 7 subjects are STILL unsquashed. Confirm,
  and re-run the patch-id check on each pair — the doc's SHAs predate a re-rebase and will not
  resolve. Use the doc's own `pid()` helper.
- the hotspot file table
- `main`'s current buildNumber (`app.json`) and versionCode (`android/app/build.gradle`); the doc
  says 187/39 and warns they move on every ship
- whether the broken-window heal still holds — re-walk every commit touching
  `app/conversation/[id].tsx` and confirm `broken=0`

Pay particular attention if the ahead-count has GROWN rather than shrunk. The doc's model says it
shrinks as already-landed work replays empty. Growth means something reached prep after the last
re-rebase, and A3 must explain it.

### A2 — PR sweep

    gh pr list --state all --limit 200 --json number,title,state,baseRefName,headRefName,mergedAt,closedAt,createdAt

For every PR merged, closed, or opened since the doc's last update:
- Is its content on `main`, on `land/integration-prep`, on both, or on neither? Use `git cherry`
  and `git patch-id --stable`. Prep is a REBASE, so SHAs never match and subject lines lie — the
  doc documents nine commits that share subjects but not patches.
- Does the doc account for it anywhere — a slice row, slice 7's trailing-commits list, or the
  Step 0/1 narrative?
- A PR merged onto `archive/26-07-2026.18-44-integration` after the Step 0 freeze is a freeze
  violation. Check explicitly and report it loudly if found.

Also check every branch and file path the doc names by hand and report which no longer resolve:
- `chore/bump-babel-preset-expo-57.0.4` (Step 0) is already known to be gone from `origin`
- `docs/runbooks/2026-08-01-rebase-integration-prep-conflicts.md`, which Step 1a links to, is
  absent from `main` — confirm where it actually lives

### A3 — Orphan hunt: content that exists only on land/integration-prep

The highest-value output, and the part the doc has no procedure for.

Prep was produced by rebasing the archive onto `main`, so in principle every prep commit has a
patch-id twin in the archive. A prep commit with NO twin in the archive that is also not on `main`
is unrecorded content — pushed directly to prep after the rebase, or a conflict-resolution
artifact that changed the tree.

    $G cherry origin/main origin/land/integration-prep
    $G cherry origin/archive/26-07-2026.18-44-integration origin/land/integration-prep

For every commit reported `+` against BOTH: show it, date it, list its files, and decide whether
it is real content that must reach `main` or a rebase artifact. Do the reverse sweep too —
archive commits with no twin in prep would mean the rebase dropped something. Then re-run the
doc's own whole-tree check and report if it has grown beyond the two version files:

    $G diff origin/archive/26-07-2026.18-44-integration origin/land/integration-prep -- . \
      ':!app.json' ':!android/app/build.gradle'

Report every finding even where you conclude it is benign. "Verified and harmless" is a result;
silence is not.

### A4 — Re-resolve the slice table

The doc identifies slice tips by subject line precisely because SHAs do not survive a rebase.
Re-resolve all seven against current history and report:
- which tips still resolve to exactly one commit, and their current SHAs
- current commit count per slice vs the doc's n column (23/21/10/26/3/12/16, total 111 — which no
  longer matches the measured ahead-count and needs reconciling)
- any commit falling outside every slice range, which means the table has a gap

### A5 — STOP

Write the report as a single message to me, structured as:
1. Numbers: every doc claim, its measured value, and whether it changed
2. PR sweep: what the doc misses, what moved, any freeze violation
3. Orphans: each commit found, with your carry/artifact verdict and reasoning
4. Slice table: re-resolved tips, revised counts, any gap
5. Recommended edits to LANDING-integration-to-main.md, stated but NOT YET APPLIED
6. Anything that makes you doubt the slicing strategy is still sound

Then STOP. Do not edit the doc. Do not start Phase B. Do not open a PR.
Wait for me to reply "approved".

If I reply with corrections instead, apply them and re-report — still without starting Phase B.

═══════════════════════════════════════════════════════════════════════════
PHASE B — Full local rehearsal of the landing  (ONLY after I say "approved")
═══════════════════════════════════════════════════════════════════════════

Replay the entire landing locally, using Phase A's corrected slice table, and prove the result
reproduces `land/integration-prep`. Nothing is pushed; `origin` stays read-only.

### B1 — Backup and trunk

    $G branch backup/prep-rehearsal-<today> origin/land/integration-prep
    $G tag archive/prep-<today> origin/land/integration-prep
    $G worktree add -b rehearsal/main-<today> ../tb-mobile-worktrees/rehearsal origin/main

Record every SHA. `rehearsal/main-<today>` stands in for `main` for the whole run.

### B2 — Squash the same-subject runs first

The doc's Step 2 is explicit that this must happen BEFORE slicing, so a duplicate run does not
land split across a slice boundary. It has never been done.

Use `fixup`, never `drop`. Only `be419a59`/`4cc8e758` (by subject: `test(cache): extend modal
render timeout in CI`) is patch-identical; every other same-subject pair carries distinct content
and dropping it silently discards work. Phase A re-verified the pairs — use those results.

Afterwards, prove nothing was lost:

    $G diff <pre-squash-tip> <post-squash-tip> -- . ':!app.json' ':!android/app/build.gradle'
    # expect: empty

A non-empty diff means a drop got in. Stop and investigate rather than continuing.

### B3 — Cut and land the seven slices in order

For each slice i, using Phase A's re-resolved tips:

    $G checkout -b rehearsal/slice-$i <tip-sha>
    $G rebase rehearsal/main-<today>
    # conflicts in app.json / android/app/build.gradle: take main's HIGHER values.
    # Read main's live numbers; never assume. Taking the branch's older numbers is the exact
    # regression trap the doc records from PR #434.

Then land it with a REBASE-MERGE, not a squash:

    $G checkout rehearsal/main-<today>
    $G merge --ff-only rehearsal/slice-$i

This is deliberate and the doc's Step 3 explains why: squashing slice 1 puts a commit on the trunk
that is not patch-identical to its constituents, so slice 2's rebase cannot skip them as already
applied and every later slice inherits conflicts. Do not "simplify" it to a squash.

Verify each slice before moving on (Node 24.15.0):

    npm run typecheck
    npm run test:unit
    npm run test:integration
    npm run test:i18n
    npm run lint

Scope Jest to the repo root so sibling worktrees do not pollute results:

    npx jest --ci --roots=$PWD/__tests__ --testPathPattern='__tests__/integration'

Record, per slice: conflicts hit, files, how resolved, whether the resolution was mechanical
(repeatable blind) or a judgement call (a human must re-make it), and any verification failure
with its output.

Write your notes to disk after every slice, with the trunk SHA, so an interrupted run resumes.

### B4 — The comparison that makes this worth doing

    $G diff --stat rehearsal/main-<today> backup/prep-rehearsal-<today>
    $G diff rehearsal/main-<today> backup/prep-rehearsal-<today>
    $G rev-list --left-right --count rehearsal/main-<today>...backup/prep-rehearsal-<today>

The doc's final verification target is `0  0`. You will not hit it exactly — the trunk started
from a `main` that prep had not yet absorbed. Classify every differing file:
- EXPECTED — `app.json` / `android/app/build.gradle` version values, and anything Phase A
  identified as legitimately main-only
- DRIFT — content the replay lost or invented
- UNEXPLAINED — investigate before writing it off

An UNEXPLAINED difference is the most valuable thing this rehearsal can produce. Do not round it
off to EXPECTED.

### B5 — Deliverable

Write `../tb-mobile-landing-rehearsal/REHEARSAL-NOTES.md` — OUTSIDE the repo, so it cannot
contaminate the B4 comparison. It complements the runbook rather than restating it:

1. Provenance — every SHA: backup, tag, starting `main`, per-slice trunk checkpoints, final trunk
2. Squash result — what was squashed, the empty-diff proof, anything that resisted
3. Conflict ledger — per slice: file, what collided, resolution, mechanical vs judgement
4. Verification results — per slice, per command, with failures quoted verbatim
5. B4 classification
6. Corrections to LANDING-integration-to-main.md the rehearsal proved necessary — quote the wrong
   line, give the correction
7. The replay script for `origin` — the exact ordered commands, now that the unknowns are known

Then apply Phase A's approved edits plus these corrections to
`LANDING-integration-to-main.md` **on a branch cut from `land/integration-prep`** (not `main` —
main's copy is the stale one), commit with a conventional title and no AI attribution, one
sentence per line in the body, push, and open a PR against `land/integration-prep`.
Show me the diff and the message before committing.

### Rules of engagement (Phase B)

- Never skip a slice to make progress. A blocked slice gets a BLOCKED entry saying exactly what
  blocked it and what you tried, then continue with the next.
- Time-box any single conflict to ~15 minutes, then record the full conflict state and move on.
  A precise BLOCKED note beats a guessed resolution.
- Never merge a slice whose verification failed. Record the failure and mark the slice RED.
- Do not "improve" any code you touch. Resolutions preserve the original commit's intent only.
- Report after each slice, not only at the end.
```

---

## Why the gate exists

Phase B acts on Phase A's conclusions — the re-resolved slice tips, the verified same-subject
pairs, the orphan verdicts. If any of those are wrong, the rehearsal replays the error for seven
slices and produces a confident, useless result. The stop is the cheapest place to catch it.

It also keeps the destructive-looking half opt-in. Phase A only reads; Phase B creates branches,
squashes history and runs the suites repeatedly. Approving them separately means a surprising
audit result can change the plan before any of that starts.
