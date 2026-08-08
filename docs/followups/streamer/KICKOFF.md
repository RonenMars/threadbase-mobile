# RUN THIS — paste this whole file into a fresh Claude Code session at the root of tb-streamer

**You are the orchestrator for the tb-streamer projects-endpoint follow-ups. Everything below is your instruction set, not a menu.**

The briefs live in the *tb-mobile* checkout at `docs/followups/streamer/` (they were written there, alongside the mobile client work that found these issues). Read them from `../tb-mobile/docs/followups/streamer/`, adjusting for wherever that checkout sits.

Do this:

1. **Check state before writing any code.** Two of the three tasks are already open PRs:
   ```bash
   gh pr view 461 --json state,mergedAt,statusCheckRollup   # path decode
   gh pr view 462 --json state,mergedAt,statusCheckRollup   # drop message_count
   ```
   If a PR is open, the task is **review and land it**, not reimplement it. If merged, the task is done — say so and skip it.
2. Read `docs/followups/streamer/00-orchestrator.md` (in the tb-mobile checkout) for the full context.
3. **Work in a worktree off the integration branch**, one per task:
   ```
   integration/prs-223-441-442-444-446-447-448-449-450-451-452-453-454-455-456
   ```
   Confirm it is still the active integration branch first. Worktrees go *outside* the repo root, then `npm ci`.
4. Branch and PR per task, conventional title, no AI attribution anywhere. One PR at a time: rebase onto the latest base, wait for CI green, squash-merge, then the next.
5. Report each task's verification command and its **actual output**, not a summary.

```
parallel:  01  ‖  02        (both are open PRs to review and land)
after 01:  03               (a decision to record, not code)
```

Mobile-side work is a separate set — see the tb-mobile checkout's `docs/followups/mobile/KICKOFF.md`. Do not do it from this session.

---

## The tasks

### 01 — land the path decode fix (PR #461)

> Read `docs/followups/streamer/01-land-path-decode-fix.md` in the tb-mobile checkout, then review and land PR #461.
>
> `decodeProjectPath` does `dirName.replace(/-/g, "/")`, which reverses every hyphen, so any project with a hyphen inside a path segment gets a path that cannot be joined against `conversation_meta.project_path`. #461 resolves from the recorded cwd instead, which is the better fix.
>
> Review specifically: projects with no recorded cwd, Windows paths surviving verbatim, and agreement with what `/api/projects/summary` reports for the same project. The client-side failure mode is silent — a correct count on a collapsed group and an empty list on expand.

### 02 — land the `message_count` removal (PR #462)

> Read `docs/followups/streamer/02-land-message-count-removal.md` in the tb-mobile checkout, then review and land PR #462.
>
> `projects.message_count` is written as `0` on insert and never updated, so it always reads zero. #462 drops it, which is right: `/api/projects/summary` already produces the real count from `conversation_meta`.
>
> Review specifically: the migration against an existing `runtime.db` (SQLite `DROP COLUMN` support depends on version — a table rebuild may be needed), and that no consumer is tolerating the zero rather than ignoring the field. `latestMessageAt` in the same table stays; it is maintained.

### 03 — decide what `/api/projects` reads from

> Read `docs/followups/streamer/03-decide-api-projects-source.md` in the tb-mobile checkout. Do this after 01 lands — its approach may already settle the question.
>
> `/api/projects` is a `readdirSync` of `~/.claude/projects`, so it structurally cannot see Codex rollouts or scan profiles. `/api/projects/summary` answers the same question from `conversation_meta` in 1 ms on a 679-conversation cache. Should the older endpoint be re-pointed at the same source?
>
> The trade-off is real: a project directory with no conversations yet would disappear from the list. Find the consumers before deciding — mobile's grouped views no longer use it.
>
> The deliverable is a written decision, including "leave it, here's why".
