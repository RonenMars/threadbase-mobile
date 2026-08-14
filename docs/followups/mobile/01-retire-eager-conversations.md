# 01 — Retire `useEagerConversations` (finish ADR 0001 step 2)

**Repo:** tb-mobile · **Base:** `feat/lazy-project-summary-groups` (or `main` once PR #576 lands)
**Owns:** `app/index.tsx`, `hooks/useConversations.ts` — no other task may touch these while this runs
**Blocks:** 02, 03

## Goal

Delete the eager conversation full-drain. It is the last remaining source of the ~13-sequential-page fetch per server per refresh.

## State of play

The tree and hub already run lazily (PR #576): they build structure from `/api/projects/summary` and fetch a project's conversations on expand. `useEagerConversations` is gated off for those layouts via `enabled: !isGroupedLayout`.

Classic still uses it. Two classic surfaces exist and only one is migrated:

| surface | source | status |
|---|---|---|
| History tab | `paginatedConversations` ← infinite `useConversations` (`app/index.tsx:510`) | done (PR #568) |
| Merged list | `mergedClassicItems` ← eager `conversations` (`app/index.tsx:289`) | **the remaining work** |

## The task

Migrate `mergedClassicItems` off the eager array, then delete:

- `useEagerConversations` and `fetchAllConversationPagesForServer` from `hooks/useConversations.ts`
- the throttled progress plumbing PR #563 added (`useThrottledCallback` around the loaded/total writes) — it exists only to pace this drain
- the now-dead `convLoaded` / `convTotal` / `convCounting` / `showConvProgress` wiring in `app/index.tsx`, and the `enabled: !isGroupedLayout` gate along with it

Sessions stay eager. They are single-digit counts on real servers and must always sort to the top.

`convLoaded` / `convTotal` / `convDone` / `convCounting` are not internal state — they render the conversations row of `LoadingOverlay` (`app/index.tsx:586-595`, `components/ui/LoadingOverlay.tsx:114-119`), whose sessions row is fed by the session drain and stays. So deleting them is a UI decision, not dead-wiring removal: settle what the overlay shows once conversations no longer drain (drop the row and keep the sessions row alone, or replace it with a determinate-free spinner) before writing the deletion. Only the conversation half of that plumbing is in scope here — the session half stays, per `docs/adr/0001-hub-data-layer-lazy-pagination.md` → "Why sessions stay eager".

## The constraint that will bite

`mergedClassicItems` has a sort contract: **live sessions cluster to the top regardless of conversation recency**, then idle sessions, then conversations chronologically. Comment at `app/index.tsx:~283` explains why. Row pagination must not break it — a conversation arriving on page 3 must still sort below every session, and a session must never be pushed off-screen by conversation loading.

Also check the loading-state derivations that currently read `convDone`: `hasCachedData`, `isStillFetching`, `showLoadingModal`, `isBackgroundRefreshing`. A hook that no longer exists cannot report "done", and a stale `false` there leaves the Hub in a permanent syncing state.

## Done when

- `rg -n "useEagerConversations" --glob '*.ts*' -g '!node_modules'` returns nothing
- no `/api/conversations/count` in the network trace for any layout
- `npx jest --ci --runInBand --testPathPattern "(hub|tree|Conversations)"` green
- typecheck at baseline (14 pre-existing `expo-router` path-typing errors — count them, don't assume zero)

## Reading

`docs/adr/0001-hub-data-layer-lazy-pagination.md` (steps 1–2).
