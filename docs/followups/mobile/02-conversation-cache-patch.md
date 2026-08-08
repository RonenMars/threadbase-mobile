# 02 — Patch the conversation cache instead of invalidating (ADR 0001 step 3)

**Repo:** tb-mobile · **Base:** after 01 lands
**Owns:** `lib/eagerCacheSync.ts`, the `conversation_updated` subscription in `app/_layout.tsx`
**Depends on:** 01 (it deletes one of the caches this would otherwise patch)

## Goal

A `conversation_updated` WS frame should update one entry in the query cache. Today it invalidates and re-drains.

## State of play

Frames arrive per liveness ping and can burst. PR #565 identified the re-drain; PR #566 mitigated it with a trailing debounce in `lib/eagerCacheSync.ts` (subscription at `app/_layout.tsx:161`). That paces the churn rather than removing it — the ADR calls it out as a guard to delete once this lands.

There is already a working model in the same file: **`applySessionUpdateToEagerCache`** does exactly this surgical patch for `session_update`. Mirror its shape.

## The task

Patch the single affected conversation in place. After 01, the caches that can hold a conversation row are:

- `['project-conversations', serverId, projectPath]` — per-project, grouped views (may be several, one per opened project)
- the classic infinite conversations query

A frame carries a conversation id, not a project path, so the patch has to locate the entry. Prefer `queryClient.setQueriesData` with a predicate over guessing a key. Do not fall back to invalidation when the entry isn't cached — if it isn't cached, nothing is on screen to update, and invalidating re-introduces the drain this removes.

Delete the #565 debounce once the patch works. Keeping both means the guard silently hides a broken patch.

## Done when

- a burst of `conversation_updated` frames produces no `/api/conversations` refetch
- the affected row's timestamp/preview updates on screen
- the debounce is gone, not merely bypassed
- store setters stay idempotent — return the same state object when the value is unchanged (the PR #564 convention)

## Reading

`docs/adr/0001-hub-data-layer-lazy-pagination.md` (step 3), and `applySessionUpdateToEagerCache` in `lib/eagerCacheSync.ts`.
