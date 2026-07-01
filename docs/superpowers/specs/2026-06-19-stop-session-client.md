# Stop Session — Client-Side Implementation Spec

## Context

The streamer server (`@threadbase-sh/streamer`) just shipped `POST /api/sessions/:id/stop` on branch `feat/stop-session-stream`. This endpoint hard-kills a running PTY session and streams ndjson progress back to the caller. Previously the app had no way to forcibly stop a session — only the grace timer (4.5 min idle) or the WS `hold_session` message did that.

This spec describes what to build on the mobile side: a service function, a store action, and UI to invoke it.

---

## Server Contract

**Endpoint:** `POST /api/sessions/:id/stop`

**Auth:** `Authorization: Bearer <api_key>` (same as all other session endpoints)

**Response — session not found:**
```json
HTTP 404
{ "error": "Session not found" }
```

**Response — session already idle:**
```json
HTTP 200  Content-Type: application/json
{ "status": "already_idle", "sessionId": "<id>" }
```

**Response — live session being stopped:**
```
HTTP 200  Content-Type: application/x-ndjson  Transfer-Encoding: chunked

{"event":"stopping","sessionId":"<id>"}
{"event":"stopped","sessionId":"<id>"}
```
…or if the PTY doesn't die within 5 s:
```
{"event":"stopping","sessionId":"<id>"}
{"event":"timeout","sessionId":"<id>"}
```

The stream closes after the second line. `stopped` means clean shutdown; `timeout` means the PTY was sent SIGINT but didn't ack in 5 s (rare — treat as stopped for UI purposes).

After the stream closes, the server also broadcasts a WebSocket `session_update` with `status: "idle"` — so the session list refreshes automatically if the WS is connected.

---

## What to Build

### 1. Service function — `services/api-client.ts` (or a new `services/sessions.ts`)

Add `stopSession(serverId, sessionId)` that:

1. Calls `POST /api/sessions/:id/stop` via the existing `api(serverId).post(...)` helper.
2. Reads the response as a stream, line-by-line.
3. Returns the final event string: `"stopped"` | `"timeout"` | `"already_idle"`.
4. Throws a typed error on 404 (`SessionNotFoundError`) or network failure.

Because React Native's `fetch` doesn't support streaming body reads the same way as the browser, use one of:
- **Option A (simplest):** `response.text()` — awaits the full body, then splits on `\n`. Fine for this use case since the stream is at most 2 short lines and closes quickly.
- **Option B:** `response.body` reader loop if you want incremental progress callbacks. Only needed if you want to show a "stopping…" spinner while the stream is open.

Start with Option A unless a progress callback is needed.

```typescript
// Rough shape
export async function stopSession(
  serverId: string,
  sessionId: string,
): Promise<'stopped' | 'timeout' | 'already_idle'> {
  const res = await api(serverId).post<Response>(
    `/api/sessions/${encodeURIComponent(sessionId)}/stop`,
    undefined,
    { raw: true }, // get raw Response so we can read body
  )

  if (res.status === 404) throw new SessionNotFoundError(sessionId)
  if (!res.ok) throw new NetworkError(`stop failed: ${res.status}`)

  const text = await res.text()

  // already_idle comes back as plain JSON
  if (res.headers.get('content-type')?.includes('application/json')) {
    const body = JSON.parse(text) as { status: string }
    if (body.status === 'already_idle') return 'already_idle'
  }

  // ndjson: read last event line
  const lines = text.trim().split('\n').filter(Boolean)
  const last = lines.at(-1)
  if (!last) return 'stopped' // empty body → treat as stopped
  const event = JSON.parse(last) as { event: string }
  return (event.event === 'timeout' ? 'timeout' : 'stopped')
}
```

Adjust to match the actual shape of `api(serverId).post` — check how `services/uploads.ts` calls it for a POST that needs the raw response.

### 2. UI trigger

The natural place is the session header / toolbar in `app/session/[id].tsx`. Add a "Stop session" button that is:

- **Visible only when** `session.status === 'running' || session.status === 'waiting_input'`
- **Hidden when** `session.status === 'idle'` (session is already stopped)
- Tapping it: shows a confirmation dialog ("Stop this session? Claude will be interrupted."), then calls `stopSession`, then shows a brief toast/feedback. The WS `session_update` will update the status automatically.

If the session header already has a "Cancel" button or a kebab menu, add "Stop session" there. Match whatever pattern exists.

### 3. Loading state

While the stop call is in-flight, disable the button and show a spinner or "Stopping…" label. Use the existing `loading-state.ts` store or local component state — whichever the file already uses.

---

## Caveats

- **No new endpoints added** — this is the only change to the API contract. No mobile-compat breakage risk.
- **WS still drives status** — after `stopSession` resolves, don't manually set `session.status = 'idle'` in state; let the incoming `session_update` WS event do it. This avoids a race where the WS hasn't landed yet.
- **`timeout` outcome** — treat it the same as `stopped` in the UI. It means the process was sent a kill signal; it may still be dying. The WS `session_update` will confirm idle when the OS delivers the exit.
- **Already-idle race** — if the user taps Stop on a session that went idle between render and tap, `stopSession` returns `'already_idle'`. That's fine — no error to show, just refresh the session if needed.

---

## Files to touch

| File | Change |
|------|--------|
| `services/api-client.ts` or new `services/sessions.ts` | Add `stopSession()` |
| `app/session/[id].tsx` | Add Stop button + confirmation dialog |
| `types/api.ts` | Add `SessionNotFoundError` if not already defined |

---

## How to test

1. Start a live Claude session on the streamer.
2. Tap "Stop session" in the app.
3. Confirm the dialog.
4. Session card should transition to idle within ~1 s (WS event).
5. Tap Stop on an already-idle session — should silently no-op (no error toast).
6. Kill network mid-stop — should show an error state.
