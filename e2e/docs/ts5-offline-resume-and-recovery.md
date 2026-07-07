# TS5: Offline, Resume, and Recovery

[Back to production test plan](production-test-plan.md#9-test-cases)

## Test Case Table

| Test case | Scenario | Priority | Preconditions |
|---|---|---|---|
| TC-TS5-001 | App resume background refresh | P0 | Paired healthy streamer; sessions/conversations loaded once. |
| TC-TS5-002 | Network loss and reconnect during live session | P0 | Active live session; device network can be toggled. |
| TC-TS5-003 | Streamer restart | P1 | Live app connected to a streamer that can be restarted. |

## Detailed Test Cases

### TC-TS5-001: App resume background refresh

**Priority:** P0  
**Preconditions:** Paired healthy streamer; sessions/conversations loaded once.

**Steps:**
1. Launch and wait for initial load completion.
2. Background the app for at least 30 seconds.
3. Change session state on the streamer.
4. Foreground the app.
5. Observe loading/cached-data UI and data refresh.

**Expected results:**
- Full-screen loading overlay does not block the already-loaded app on resume.
- Header/tree spinner and cached-data notice appear according to current layout.
- Data refreshes to the latest streamer state.

**Acceptance criteria:**
- Cold start can show full overlay; resume cannot regress to a blocking full overlay.
- Cached data remains visible until fresh data arrives.

### TC-TS5-002: Network loss and reconnect during live session

**Priority:** P0  
**Preconditions:** Active live session; device network can be toggled.

**Steps:**
1. Open live session.
2. Disable network or leave Wi-Fi/VPN.
3. Attempt to send a prompt.
4. Re-enable network.
5. Observe queued send/retry/refetch behavior.

**Expected results:**
- App communicates degraded connection through current status indicators.
- Cached content remains visible.
- Sends are paused, failed, or retried according to product behavior without data loss.
- Refetch occurs after reconnect.

**Acceptance criteria:**
- App does not crash or duplicate sends.
- User can continue once connectivity returns.

### TC-TS5-003: Streamer restart

**Priority:** P1  
**Preconditions:** Live app connected to a streamer that can be restarted.

**Steps:**
1. Open the hub and status modal.
2. Stop the streamer process.
3. Observe disconnected/unreachable state.
4. Restart the streamer with the same API key.
5. Observe reconnection and data refresh.

**Expected results:**
- Hub shows cached sessions while streamer is down.
- Status modal transitions from disconnected/unreachable back to connected.
- WebSocket and HTTP fetch recover without app restart where possible.

**Acceptance criteria:**
- User is not forced to re-pair after a normal streamer restart.
