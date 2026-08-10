# Postmortem: Stale session state after app foreground; deploy-induced PTY kills

**Date:** 2026-05-20
**Severity:** Medium — visible to any user who backgrounded the app during an active session, especially when the streamer was redeployed or restarted while suspended.
**Status:** Resolved (mobile fix).
**Components:** `services/ws-client.ts`, `app/session/[id].tsx`.

## Symptom

Two related symptoms surfaced during the investigation of the PTY `@<path>` hang in `tb-streamer` (see [tb-streamer postmortem](https://github.com/RonenMars/threadbase-streamer/blob/main/docs/postmortems/2026-05-20-pty-bracketed-paste-fix.md)):

1. **Stuck "Running" indicator.** After backgrounding the iOS app and returning, the session detail screen continued to render the last cached state (`status: Running`, `ptyAttached: true`, "11m 38s" elapsed) even though the streamer-side session had been killed by a deploy several minutes earlier. Pulling state from server confirmed the session was no longer in the live list at all.

2. **Conversation tail cut off.** The terminal pane showed Claude's response up to the point of disconnect but no further messages, with no indication that anything was missing. The JSONL on disk had more recent content that mobile never fetched.

## Root cause

`app/session/[id].tsx` had no `AppState` listener. The React Query keys `['session', serverId, id]` and `['terminal-output', serverId, id]` have `staleTime: 30_000` and rely on WS push (`session_update`, `terminal_output`) for live freshness. When iOS suspends a backgrounded app:

- JS execution halts.
- The system WebSocket may be torn down by iOS without firing `onclose` on the JS side. On resume, the socket appears "open" to the JS layer but is in fact dead — and `WSClient` had no way to discover that without a server-initiated event.
- Even when reconnect eventually fired (via the existing 1–30s exponential backoff after the next failed `send()`), the server's `terminal_replay` only replays the ring buffer (64 KB). If more output had arrived during suspension, it was lost.
- Nothing on the session detail screen ever explicitly re-queried `/api/sessions/<id>` or `/api/conversations/<id>` on foreground, so the on-screen state stayed at whatever value the cache had at suspend time.

The PTY-kill cause was upstream: while debugging the streamer bug we redeployed the streamer mid-session. `launchctl kickstart -k` killed the live Claude PTY child, but mobile didn't learn this until much later — and even then, the session detail screen kept rendering its stale cached state because of the missing refetch.

## The fix

Two changes in `services/ws-client.ts`:

```ts
// On WSClient
forceReconnect() {
  if (!this.url) return;
  if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
  this.reconnectAttempt = 0;
  this._doConnect();
}

// On WSClientManager
forceReconnect(serverId: string) {
  this.clients.get(serverId)?.forceReconnect();
}
```

One change in `app/session/[id].tsx`:

```ts
const qc = useQueryClient();
useEffect(() => {
  if (!serverId || !id || isPending) return;
  const sub = AppState.addEventListener('change', (nextState) => {
    if (nextState !== 'active') return;
    wsManager.forceReconnect(serverId);
    qc.invalidateQueries({ queryKey: ['session', serverId, id] });
    qc.invalidateQueries({ queryKey: ['terminal-output', serverId, id] });
  });
  return () => sub.remove();
}, [serverId, id, isPending, qc]);
```

On `AppState 'active'`:
1. Force a fresh WS connection (bypasses the 1–30s exponential backoff that would otherwise apply).
2. Invalidate the two React Query keys that back the session detail screen so they refetch from the server.

`forceReconnect()` is the new path; the existing `connect()` and `_scheduleReconnect()` semantics are untouched. The early-return on missing `url` makes it safe to call before the client has ever connected.

## Why a forced reconnect (not just letting backoff handle it)

The existing reconnect logic only fires when the socket emits `onerror` or `onclose`. iOS-suspended sockets often don't surface either: the OS reaps the TCP connection silently, and the JS-side `WebSocket` object stays in `OPEN` state until the next `send()` fails. Foreground is the point where we *know* the connection might be dead even if we have no evidence of it yet, so we proactively replace the socket. The cost is one extra reconnect round-trip per foreground; the benefit is no stale-session-state UI.

## Verification

Unit tests added in `__tests__/unit/services/ws-client.test.ts`:
- `forceReconnect` opens a new socket immediately (no setTimeout delay)
- `forceReconnect` does not throw when never connected
- `forceReconnect` clears any pending backoff timer (advancing fake timers 60s after a forced reconnect does not produce another connect attempt)

All 341 mobile unit tests pass.

## Lessons

1. **AppState transitions are a real lifecycle event in React Native, not an edge case.** Any screen that displays "live" data from a server must subscribe to `AppState 'active'` and refetch. This is doubly true for screens backed by WebSocket because of how iOS handles long-lived sockets in background.
2. **A `staleTime` of 30 seconds is a UX optimization, not a correctness guarantee.** It assumes WS push will arrive before the user notices stale data — but it won't, if the WS itself is dead.
3. **`isPending` (session not yet created) is the right gate.** Don't invalidate or reconnect during the pending state — there's nothing to refetch and the WS isn't bound yet.

## Out of scope (deferred)

- **WS subscribe-with-cursor**: a long-running suspension can lose terminal output past the server's 64 KB ring buffer. The fix here recovers session/conversation state but not arbitrary missed terminal chunks. A proper fix would have the client pass its last-seen byte offset on `subscribe_session` and the server would replay from there. Not implemented in this change — the React Query invalidations rehydrate everything important (conversation messages) from `/api/conversations/<id>` so the user-visible content is correct; only the ANSI/raw terminal scrollback may have a gap.
- **Background reconnect**: this fix only triggers on `active`. We don't try to keep the WS alive while backgrounded (which iOS would block anyway).

## References

- Streamer-side root cause for the same incident: [tb-streamer postmortem](https://github.com/RonenMars/threadbase-streamer/blob/main/docs/postmortems/2026-05-20-pty-bracketed-paste-fix.md).
- Mobile API surface that triggered the bug discovery: `app/session/[id].tsx`, called from the home screen's session list.
