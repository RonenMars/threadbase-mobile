# tb-streamer — orchestrator for the projects-endpoint follow-ups

Three tasks, all descending from work done while adding `GET /api/projects/summary` (PR #460, merged) for the mobile grouped views.

**Two of the three are already open PRs.** Verify before writing any code — the bugs were reported from the mobile side and someone has since acted on them.

| task | state |
|---|---|
| 01 — project path decode | **PR #461 open** — `fix/list-projects-path-decode` |
| 02 — dead `projects.message_count` | **PR #462 open** — `fix/drop-project-message-count` |
| 03 — decide the source of `/api/projects` | open question, no PR |

As of writing, `origin/main` still contains `dirName.replace(/-/g, "/")` in `src/handlers/handleListProjects.ts`, so neither has landed. Re-check both before starting:

```bash
gh pr view 461 --json state,mergedAt,statusCheckRollup
gh pr view 462 --json state,mergedAt,statusCheckRollup
```

If a PR is open, the task is **review and land it**, not reimplement it. If it has merged, the task is done — say so and move on.

## Where the work happens

Work in a worktree off the integration branch:

```
integration/prs-223-441-442-444-446-447-448-449-450-451-452-453-454-455-456
```

Confirm it is still the active integration branch first (`git branch -a --list '*integration*'`) and use whatever superseded it if it has moved.

```bash
git fetch origin
git worktree add ../tb-streamer-worktrees/<task-slug> \
  -b <type>/<slug> origin/integration/prs-223-441-…-456
cd ../tb-streamer-worktrees/<task-slug>
npm ci
```

Keep worktrees outside the repo root, same reasoning as the mobile side: nested copies get discovered by test and lint tooling and produce failures from a stale branch.

## Dependency graph

```
parallel, independent:
  01  land the path-decode fix (#461)
  02  land the message_count removal (#462)

after 01:
  03  decide whether /api/projects should read from the conversation cache
```

03 comes last because #461's approach — resolving the path from the recorded cwd rather than decoding the directory name — may already answer it.

## Why these matter

Mobile's grouped views now depend on project paths being joinable against `conversation_meta.project_path`. A path that looks plausible but does not join yields an empty conversation list under a correct-looking count, with no error anywhere. That failure mode was measured from the mobile side on a real Windows server: the verbatim path returns 37 conversations, a normalised form returns 0.

`/api/projects/summary` (PR #460) is unaffected — it aggregates from `conversation_meta` and never decodes a directory name. These three are about the older `/api/projects` path and the `projects` table.

## Rules

- Branch + PR per task, conventional title, no AI attribution anywhere.
- CI gate: only merge on green. Re-run once on a flaky infra failure; if it fails again, stop and report.
- One PR at a time — rebase onto the latest base, wait for green, squash-merge, then move to the next.
- Report the verification command and its actual output, not a summary.
