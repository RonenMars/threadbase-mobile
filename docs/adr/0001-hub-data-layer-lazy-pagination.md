# ADR 0001 — Hub data layer: lazy pagination over eager multi-server drain

- Status: Proposed
- Date: 2026-08-08
- Related: #563 (partial pacing), #564 / #565 (root-cause bugs), #566 (root-cause fixes)

## Context

The Hub (`app/index.tsx` → `ProjectsHub`) loads its sessions and conversations by **eager-draining every page of every server up front** (`useEagerSessions`, `useEagerConversations`).
For a server with 600+ conversations that is a `/count` call plus ~13 sequential page fetches, per server, on every refresh.
While that drain runs, the Hub sits in a "Showing cached data — syncing" state and re-renders continuously.

On-device tracing (a per-commit "why did this render" probe; method documented in `docs/troubleshooting.md` → "Measuring the wrong thing") found `ProjectsHub` re-rendering hundreds of times, never settling, driven by:

- a hand-rolled `loaded`/`total` progress counter written to component state on every page tick;
- `serverFetchStatus` writing a fresh object on every HTTP response even when the status was unchanged (#564);
- `conversation_updated` WS frames invalidating the whole eager query and re-draining every page per liveness ping (#565).

The fixes shipped so far are correct but symptomatic: #563 throttles the progress writes and memoizes the list roots; #566 makes the store setter idempotent and debounces the re-drain.
Each paces or guards a churn source rather than removing it.
The `ProjectsHub` component is a large root that subscribes to progress, fetch-status, WS-status, and ~15 stores, so it re-renders on any of them.

Notably, an infinite-query hook for conversations (`useConversations`, a `useInfiniteQuery`) and an infinite-scroll-capable `ConversationList` (`onEndReached` / `hasNextPage` / `isFetchingNextPage`) already exist in the codebase — but nothing wires them together; the hook currently has no callers.

## Decision

Move the Hub's conversation and session data off the eager full-drain and onto lazy, demand-driven loading, and remove the remaining churn sources by construction rather than by guards. Three principles:

1. **Lazy pagination instead of eager drain.** Use `useInfiniteQuery` (the existing `useConversations` for conversations; an equivalent for sessions) and `fetchNextPage()` on the list's `onEndReached`. This deletes the per-page progress `setState` machinery (and the throttle #563 added), removes the long-lived "syncing" state, and cuts network to what the user actually scrolls to.
2. **Colocate ephemeral, high-frequency UI state.** The sync spinner, header health dot, and any remaining progress live in small leaf components that subscribe to just their slice via atomic zustand selectors (or `useShallow`), so a status tick re-renders a chip, not the whole tree. Store setters stay idempotent — return the same state when the value is unchanged (the #564 fix, generalized to a convention).
3. **Server-driven freshness = surgical cache patch, not broad invalidation.** For `conversation_updated`, patch the single affected entry in the query cache (mirroring `applySessionUpdateToEagerCache`, which already does this for `session_update`) instead of invalidating and re-draining everything.

The target end state is `ProjectsHub` re-rendering approximately once per real, user-visible data change, verified with the `useRenderTally` / `useWhyRender` probes.

## Migration order (by leverage)

1. **Infinite-query pagination for conversations** — wire the existing `useConversations` into the Classic History `ConversationList`. This PR prototypes exactly this step.
2. **Infinite-query pagination for the tree/hub conversation and session sources**, retiring `useEagerConversations` / `useEagerSessions` once every surface is migrated.
3. **Conversation cache-patch** for `conversation_updated`, replacing the #565 debounce.
4. **Colocate the sync/status/progress subscriptions** out of the Hub root into leaf components.

Each step is independently shippable and independently measurable.

## Why step 2 needed a new server endpoint

Recorded after the fact, because the question "why does `/api/projects/summary` exist?" is not answerable from either codebase alone, and the original request document did not survive.

Step 2 reads as "paginate the tree and hub like the flat list", but that is not available to them. The grouped views are a **path-prefix tree** built from every item's `projectPath`, and all of the following are derived from the complete set:

- the node shape — which directories exist, and their nesting;
- each node's `totalCount`, aggregated up the tree from its descendants;
- the sibling sort order, by `totalCount` descending;
- single-child path compaction (`/Users/me` + `/dev` collapse into one row);
- the heuristic that auto-expands a top-level directory holding ≥80% of items.

So a lazily-appended flat page cannot be placed: it scatters items into a half-built tree. Two cheaper options were considered and rejected on evidence:

- **Seed the structure from the eager sessions alone.** A server with 600+ conversations typically has single-digit sessions, so the tree would render a handful of directories and then visibly restructure as groups loaded. That is a wrong tree, not a skeleton.
- **Build it from the first page of conversations.** Any project without a conversation in the first 50 simply would not appear.

That leaves one requirement: `(projectPath, count, lastActivity)` for **every** project on a server, in one cheap call. Nothing served that. `/api/projects` was a filesystem scan of `~/.claude/projects` — no counts, no activity, Claude-only, and its `replace(/-/g, "/")` decode mangled any path with a hyphen in a segment. `/api/projects/popular` had the right source and real counts but was top-N with no last-activity and no pagination. The `projects` SQLite table had a maintained `latest_message_at` but was never exposed, and its `message_count` was written as `0` and never updated.

Hence the request that became streamer PR #460. The hard constraint attached to it was **consistency**: the summary must aggregate the same `conversation_meta` rows that `/api/conversations?project=` pages, or a group claims one count and renders another. The streamer's own contract note in `docs/compatibility/tb-mobile.md` states that guarantee from its side.

## Consequences

- Positive: removes the re-render loop and the redundant network at the source; simpler data flow (React Query owns server state, not hand-rolled counters); the interim guards (#563 throttle, #565 debounce) become unnecessary and can be deleted as their surfaces migrate.
- Cost: a real refactor of the Hub data layer, the list data sources, and the WS handlers — sequenced above so no single step is large.
- Interim: during migration the Hub may run an eager hook and an infinite hook side by side for a not-yet-migrated surface (a double fetch); acceptable and temporary, called out where it happens.

## Prototype in this change

This PR implements step 1: the Classic History tab's `ConversationList` is fed by the infinite `useConversations` with a real `onEndReached` → `fetchNextPage`, gated (`enabled`) to only fetch when that tab is visible. The eager path still backs the tree/hub/classic-sessions surfaces, so the two coexist for now — that is the documented interim state, not the destination.
