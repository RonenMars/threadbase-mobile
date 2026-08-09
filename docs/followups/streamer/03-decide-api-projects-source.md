# streamer 03 — decide what `/api/projects` should read from

**Not a bug report — an open design question.** The deliverable is a recorded decision, even if the decision is "leave it".

Do this after PR #461 lands: its approach (resolve from the recorded cwd) may already settle it.

## The situation

There are now two endpoints answering overlapping questions from different sources:

| endpoint | source | covers |
|---|---|---|
| `/api/projects` | `readdirSync(~/.claude/projects)` | Claude only, no counts, no activity |
| `/api/projects/summary` (PR #460) | `GROUP BY` over `conversation_meta` | all providers, counts, `MAX(last_activity)` |

`/api/projects` being a filesystem scan of `~/.claude/projects` means it structurally **cannot see Codex rollouts or configured scan profiles**. A Codex-only project is invisible to it no matter how the decode is fixed.

The summary endpoint measured at **1 ms** on a 679-conversation cache using the existing `idx_meta_project`, so cost is not an argument for keeping the readdir.

## The question

Should `/api/projects` be re-pointed at `conversation_meta` like the summary endpoint, making both consistent by construction and fixing the Codex blind spot for free?

Arguments to weigh:

- **For:** one source of truth; paths that join by construction; Codex visible; the decode problem disappears rather than being fixed.
- **Against:** it changes what the endpoint means. A project directory that exists on disk with *no* conversations yet would vanish from the list. If anything relies on "directory exists" rather than "has history", that is a behaviour break.

## Before deciding, find the consumers

In tb-mobile: `hooks/useProjects.ts` via `services/projects-api.ts`. The grouped views no longer use it — they moved to `/api/projects/summary` in mobile PR #576 — so its remaining callers may be few or zero. Check for other clients (web, CLI, internal tooling) before assuming mobile is the only one.

## Done when

The decision is written down — in an ADR, the endpoint's own comment, or a PR description. A deliberate "leave it, here's why" closes this properly; silence does not.
