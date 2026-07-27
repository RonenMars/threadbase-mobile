# Conversation Tap-Lock Overlay

## Problem

In hub, classic (session list), and tree views, tapping a conversation/session row calls `router.push(...)` synchronously (see `components/sessions/hub/ConvRow.tsx`, `components/sessions/hub/SessionRow.tsx`, `components/sessions/tree/DrillRow.tsx`). Nothing stops the user from tapping several more rows in the brief window before the screen transitions, which can queue up multiple navigations and duplicate destination-screen data fetches, adding unnecessary traffic and memory pressure.

`router.push` itself is synchronous and makes no server call — the actual conversation data fetch happens on the destination screen (`app/conversation/[id].tsx`, `app/session/[id].tsx`), which already has its own loading/error UI (`isLoading`, skeleton overlay, etc.). That existing behavior is out of scope and unchanged.

## Approach

A global tap-lock: the instant any conversation/session row is pressed, the whole app is blocked with a full-screen overlay until the destination screen mounts.

1. **Global lock store** — `stores/navLock.ts`, a single boolean `isNavigating` (Zustand, matching existing store conventions in `stores/servers.ts` / `stores/settings.ts`).
2. **Set on press** — `ConvRow`, `SessionRow`, `DrillRow` set `isNavigating = true` immediately before calling `router.push(...)` in their existing `handlePress` callbacks.
3. **Overlay component** — new `components/ui/NavigationLockOverlay.tsx`, visually consistent with the existing `components/ui/LoadingOverlay.tsx` (scrim + spinner card), but a simpler variant: spinner + a single "Opening…" label, no progress bars. Mounted once near the root layout (`app/_layout.tsx`) so it renders above the tab bar and all screens.
4. **Clear on navigation commit** — the destination screens (`app/conversation/[id].tsx`, `app/session/[id].tsx`) clear `isNavigating` in a mount effect, as soon as they mount. Since `router.push` is synchronous, this is effectively immediate (same/next frame), but it fully blocks any double-tap during that window.
5. **Timeout safety net** — if `isNavigating` stays `true` for more than 2s (e.g. a route fails to mount), it auto-clears so the app can never get stuck fully blocked.

No pre-navigation server call is introduced. Error handling for conversation/session data loading is unchanged and stays on the destination screens.

## Out of scope

- Any change to how conversation/session data is fetched or how destination-screen loading/error states behave.
- A pre-navigation existence/health check against the server.
- Per-view (hub/classic/tree) custom overlays — one shared global overlay covers all three.

## Files touched

- New: `stores/navLock.ts`
- New: `components/ui/NavigationLockOverlay.tsx`
- Edit: `app/_layout.tsx` (mount the overlay)
- Edit: `components/sessions/hub/ConvRow.tsx`, `components/sessions/hub/SessionRow.tsx`, `components/sessions/tree/DrillRow.tsx` (set lock on press)
- Edit: `app/conversation/[id].tsx`, `app/session/[id].tsx` (clear lock on mount)

## Testing

- Unit test for `navLock` store (set/clear/timeout).
- Manual verification: rapid-tap multiple rows in each of hub/classic/tree and confirm only one navigation occurs and the overlay is visible momentarily.
