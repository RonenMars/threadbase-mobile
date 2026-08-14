# Request to tb-streamer — a project summary endpoint for lazy Hub loading

This is a request from the Threadbase **mobile** app to the **streamer**.
It describes a need, the evidence behind it, and the constraints a solution has to satisfy.
It deliberately does **not** dictate an implementation — please investigate the codebase and choose the best design; the shape sketched at the end is a starting proposal, not a spec, and pushback on it is welcome.

Related mobile documents: [ADR 0001](../../adr/0001-hub-data-layer-lazy-pagination.md) (the decision), [the kick-off brief](../mobile/ADR-0001-KICKOFF.md) (the implementation plan).

## The need in one paragraph

Mobile's Hub currently loads its conversation list by **eager-draining every page of every server on every refresh** — a `/api/conversations/count` call plus ~13 sequential `/api/conversations?limit=50&offset=…` fetches for a server with 600+ conversations.
We are replacing that with lazy, demand-driven loading.
For the flat Classic list that is straightforward infinite scroll and needs nothing new from the streamer.
For the two **grouped** views (a directory tree and a project hub) it is blocked: to draw the group structure at all, mobile needs to know every project's path, its conversation count, and its most recent activity — and no current endpoint returns that combination.
We are asking for one cheap call that does.

## Why the group structure needs the full project set

The grouped views are not "a list with headers." Mobile builds a **path-prefix tree** from every item's `projectPath`, and the following are all derived from the complete set:

- the node shape (which directories exist, and their nesting);
- each node's `totalCount`, aggregated up the tree from its descendants;
- the sibling sort order (by `totalCount`, descending);
- single-child path compaction (`/Users/me` + `/dev` collapse into one row);
- a heuristic that auto-expands a top-level directory holding ≥80% of items.

Seeding this from live sessions alone does not work: a server with 600 conversations typically has single-digit sessions, so the tree would render a handful of directories and then visibly restructure as data arrived — a wrong tree, not a skeleton.
Once the structure is known, fetching a single project's conversations on expand is already possible today (see below), and that is the part we want to make lazy.

So the ask is narrow: **one call that describes the projects, so the per-project conversation fetches can be deferred until a user expands a group.**

## What we found in the streamer (so you don't have to re-derive it)

We read the source before asking. Three existing pieces are close but none is sufficient:

**`/api/projects` → `handleListProjects` (`src/handlers/handleListProjects.ts`)** — a `readdirSync` of `~/.claude/projects`, returning `{name, path, dirName}` + `total`, sorted by directory mtime (the mtime is used for ordering and then dropped, never sent).
Three problems, any one of them disqualifying for our use:
1. No conversation count and no last-activity timestamp.
2. **Claude-only** — it never sees Codex rollouts or configured scan profiles, so Codex projects are invisible.
3. **The path decode is lossy.** `decodeProjectPath` does `dirName.replace(/-/g, "/")`, so `-Users-me-tb-mobile` decodes to `/Users/me/tb/mobile`. Any project whose path has a hyphen inside a segment — including our own repos — produces a path that can never be joined against a conversation's `project_path`. We believe this is a latent bug independent of our request, and worth a look on its own.

**`/api/projects/popular` → `cache.getPopularProjects(limit)`** — `SELECT project_path, project_name, COUNT(*) … GROUP BY project_path ORDER BY cnt DESC LIMIT ?` over `conversation_meta`.
This one has the right *source*: correct paths, all providers, real counts, and it reads the same table `/api/conversations` serves from.
Missing for our purposes: a last-activity value, pagination (`offset`/`total`), and completeness — it is top-N-by-popularity, and we need every project.

**The `projects` SQLite table** (`src/db/migrations/001_create_projects.sql`, `ProjectsRepository`) — has `path`, `name`, and a `latest_message_at` that `ensureProjectsForConversations` keeps current on each cache refresh, plus a `listProjects()` that already exists.
It is **not exposed over HTTP**.
Note its `message_count` column is written as `0` on insert and never updated by `upsertProjectByPath` — as far as we can tell it is dead. If that table is the right basis for the answer, that column probably needs to become real or be dropped.

Our reading is that the data already exists on your side and simply is not served, which is why we think this is a small addition rather than a feature.

## What already works, and must keep working

`/api/conversations?project=<path>&limit=&offset=` is exactly what we need for the per-group fetch, and we plan to lean on it hard — one paginated query per expanded group, keyed by `(serverId, projectPath)`:

- exact `project_path = ?` match, `ORDER BY last_activity DESC`, with `total` and `hasMore` in the response;
- `provider` is honored;
- `sort` is parsed but ignored on the cache path (only the legacy scanner fallback applies it). That is fine for us — `last_activity DESC` is the within-group order the Hub wants, and our other sort modes are group-level, not within-group. Flagging it only so nobody "fixes" it on our behalf and changes the order underneath us.
- `dateFrom` / `dateTo` / `profileId` are sent by mobile today and read by nobody. Pre-existing, not something we are asking about here.

**The consistency constraint that matters most to us:** whatever the new endpoint reports as a project's count and last-activity must agree with what `/api/conversations?project=<that path>` actually returns — same rows, same filters, same canonicalization of the path.
A summary sourced from a different place than the pages is how a group ends up saying "12 conversations" and then rendering 9.
That is the main reason we would lean toward the aggregate coming from `conversation_meta` rather than from the `projects` table, but you are better placed to judge that.

## Requirements

1. **Completeness** — every project with at least one conversation, across all providers (Claude and Codex) and all enabled scan profiles. Not a top-N.
2. **Per project**: canonical `path` (joinable against `project_path` on conversations), a display `name`, a conversation **count**, and a **last-activity** timestamp.
3. **Consistent with `/api/conversations?project=`** as described above.
4. **Cheap** — this runs on Hub open and on refresh, per server. It should be an indexed aggregate, not a disk scan. If it can only be answered by scanning, tell us and we will redesign around that instead.
5. **Paginated or bounded sensibly**, with a `total`, following the conventions of the existing list endpoints.
6. **Ordered by last-activity descending** by default, or at least ordered deterministically — mobile sorts groups itself, but a stable order keeps pagination coherent.
7. **Warm-up behavior** consistent with the other list endpoints (`rejectIfWarmingUp` and the `scan_progress` broadcasts) so mobile's existing "building history" state keeps working unchanged.

## A proposed shape — please push back

```
GET /api/projects/summary?limit=100&offset=0

{
  "projects": [
    { "path": "/Users/me/dev/tb-mobile", "name": "tb-mobile", "conversationCount": 74, "lastActivity": "2026-08-08T21:14:03.000Z" }
  ],
  "total": 38
}
```

Roughly the `getPopularProjects` statement with `MAX(last_activity)` added, `LIMIT`/`OFFSET` instead of top-N, and a `COUNT(DISTINCT project_path)` for `total`.

If you would rather extend `/api/projects/popular`, fix `/api/projects` in place (which would also address the hyphen bug and the Codex blind spot), or serve it from the `projects` table with a real `message_count`, any of those work for us — we care about the four fields and the consistency guarantee, not the URL.
**Please tell us the final path and response shape before you merge**, since mobile is blocked on that contract.

## Rollout

Mobile is **requiring the new streamer** for the grouped views rather than carrying a fallback path — a server without this endpoint will surface an "update your streamer" state rather than silently reverting to the eager drain.
That means once this lands and rolls out, the eager multi-page drain disappears from mobile entirely, and the streamer stops serving ~13 sequential page requests per server per refresh.
It also means a version-negotiation or capability signal would be useful if one is cheap; if not, mobile will detect a 404 and show the upgrade state.
