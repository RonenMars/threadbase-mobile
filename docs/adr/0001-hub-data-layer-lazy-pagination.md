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

## Consequences

- Positive: removes the re-render loop and the redundant network at the source; simpler data flow (React Query owns server state, not hand-rolled counters); the interim guards (#563 throttle, #565 debounce) become unnecessary and can be deleted as their surfaces migrate.
- Cost: a real refactor of the Hub data layer, the list data sources, and the WS handlers — sequenced above so no single step is large.
- Interim: during migration the Hub may run an eager hook and an infinite hook side by side for a not-yet-migrated surface (a double fetch); acceptable and temporary, called out where it happens.

## Prototype in this change

This PR implements step 1: the Classic History tab's `ConversationList` is fed by the infinite `useConversations` with a real `onEndReached` → `fetchNextPage`, gated (`enabled`) to only fetch when that tab is visible. The eager path still backs the tree/hub/classic-sessions surfaces, so the two coexist for now — that is the documented interim state, not the destination.
