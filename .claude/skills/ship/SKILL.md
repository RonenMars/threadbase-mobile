---
name: ship
description: >
  Push a committed feature branch, open a PR, watch CI, and (only on
  explicit confirmation) squash-merge and clean up. Use when the user says
  "ship this", "push and open a PR", "is CI green yet", or asks to merge a
  PR that's already open. Assumes the branch is already committed — this
  skill does not stage or commit anything. Does not require ending at a
  merge: an open, CI-green PR is a valid stopping point.
---

# Ship

Push → PR → watch CI → ask → (optional) squash-merge → cleanup. Follows the
policy already documented in global CLAUDE.md: rebase+squash merges, one PR
at a time, no AI attribution, CI gate before merge, `--force-with-lease`
never plain `--force`.

## Preconditions

- The current branch is committed and not `main`/`master`. If there are
  uncommitted changes, stop and tell the user — committing is a separate,
  approval-gated step this skill does not perform.
- If the branch has no upstream yet, `git push -u origin <branch>` sets one
  on first push.

## Pipeline

1. **Push**

   ```bash
   git push -u origin "$(git branch --show-current)" 2>/dev/null \
     || git push
   ```

2. **Open PR** (skip if one already exists for this branch — check first
   with `gh pr view --json url,state` and only create if that fails)

   ```bash
   gh pr create --title "<type>(<scope>): <description>" --body "$(cat <<'EOF'
   ## Summary
   - <1-3 bullets>

   ## Test plan
   - [ ] <verification step>
   EOF
   )"
   ```

   Title must be conventional-commit style. Body must carry **no** AI
   attribution — no "Generated with", no Co-Authored-By naming an AI, no
   🤖 footers. Strip any default footer your tooling appends.

   If this fails with `Resource not accessible by personal access token`,
   invoke the `gh-pr-create` skill for the workaround, then retry.

3. **Poll CI**

   ```bash
   gh pr checks --watch
   ```

4. **On red:**
   - Re-run failed checks **once**. A PR's checks can span more than one
     workflow run — rerun every distinct run that has a failure, not just
     the first:
     ```bash
     run_ids=$(gh pr checks --json link -q '.[].link' \
       | grep -oE '[0-9]+$' | sort -u)
     for run_id in $run_ids; do
       gh run rerun "$run_id" --failed
     done
     gh pr checks --watch
     ```
   - If still red after that single retry: **stop**. Report which check(s)
     failed and a link to the logs (`gh pr checks` output includes URLs).
     Do not merge. Do not retry again.

5. **On green:** ask the user directly — "CI is green on PR #<N> — squash-merge
   now?" Do not proceed to Step 6 without an explicit yes in this turn. A
   prior approval in an earlier turn or session does not count.

6. **If yes:**

   ```bash
   git fetch origin
   git rebase origin/main
   # resolve conflicts only if trivial/obvious; otherwise stop and ask
   git push --force-with-lease
   gh pr merge <N> --squash --delete-branch
   ```

   Report the merged commit SHA and confirm the branch was deleted.

7. **If no, or CI never finished, or the user wants to stop earlier:**
   report the current state (PR URL, CI status, mergeable or not) and stop.
   This is a valid terminal state — not every `/ship` run needs to end in
   a merge.

## Non-goals

- No staging or committing — that's a separate, approval-gated step.
- No version bump, no deploy/release logic — those live in project-specific
  skills (e.g. `expo-local-ship`, `local-deploy`) which may call into
  `/ship` for the PR-lifecycle portion.
- No handling of multiple simultaneous PRs — one branch per invocation,
  per the "one PR at a time" rule.
- Never auto-merge without an explicit confirmation in the current turn.
