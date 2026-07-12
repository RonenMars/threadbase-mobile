# TS2: Hub, Server State, and Multi-Server

[Back to production test plan](production-test-plan.md#9-test-cases)

## Test Case Table

| Test case | Scenario | Priority | Preconditions |
|---|---|---|---|
| TC-TS2-001 | Single-server healthy hub | P0 | One paired, reachable streamer with sessions and conversations. |
| TC-TS2-002 | No servers configured | P1 | App data/keychain cleared; onboarding skipped or completed without pairing if supported. |
| TC-TS2-003 | Multi-server healthy and partial outage states | P0 | Two paired streamers; one can be stopped or network-blocked. |
| TC-TS2-004 | Hidden server behavior | P1 | Two paired streamers; filter/sort sheet can hide one server. |

## Detailed Test Cases

### TC-TS2-001: Single-server healthy hub

**Priority:** P0  
**Preconditions:** One paired, reachable streamer with sessions and conversations.

**Steps:**
1. Launch the app.
2. Wait for the initial sessions/conversations load.
3. Inspect the header status dot, hub list, FAB, and server status modal.

**Expected results:**
- Loading overlay appears only during cold-start loading.
- Header has no warning/error dot once connected and data fetch succeeds.
- Sessions and conversations render grouped by project or current selected layout.
- Server status modal shows the server as connected.

**Acceptance criteria:**
- User can identify available work without opening Settings.
- No stale error banner obscures the hub in a healthy state.
- FAB is visible and can start the new-session flow.

### TC-TS2-002: No servers configured

**Priority:** P1  
**Preconditions:** App data/keychain cleared; onboarding skipped or completed without pairing if supported.

**Steps:**
1. Enter the app with no configured servers.
2. Inspect the hub, header cloud icon, FAB, and status modal.
3. Tap FAB.

**Expected results:**
- Sessions list is empty.
- No loading overlay remains stuck.
- Status modal communicates that no servers are configured.
- Current behavior: FAB is visible and may no-op silently.

**Acceptance criteria:**
- App does not crash or hang.
- Current no-server behavior is documented as a UX gap if the FAB no-ops.

### TC-TS2-003: Multi-server healthy and partial outage states

**Priority:** P0  
**Preconditions:** Two paired streamers; one can be stopped or network-blocked.

**Steps:**
1. Launch with both streamers online.
2. Verify combined sessions/conversations appear.
3. Open server status modal.
4. Stop one streamer or block its network path.
5. Return to the app and observe header/status modal.
6. Restore the streamer.

**Expected results:**
- Both healthy: no header warning dot; both modal rows connected.
- One degraded: header shows partial/degraded state; healthy server remains usable; stale sessions from failed server may remain visible according to current design.
- Restored server reconnects and returns to healthy status.

**Acceptance criteria:**
- Healthy server workflows remain available during partial outage.
- Failed server details are visible from `ServerStatusModal`.
- No cross-server data is mixed under the wrong server identity.

### TC-TS2-004: Hidden server behavior

**Priority:** P1  
**Preconditions:** Two paired streamers; filter/sort sheet can hide one server.

**Steps:**
1. Hide one server from the visible hub list.
2. Refresh or relaunch the app.
3. Observe loading indicators and visible sessions.
4. Open new-session server picker.

**Expected results:**
- Hidden server sessions do not appear in the visible list.
- Current behavior: hidden servers may still be paginated and available in the picker.
- Header health reflects active servers, including hidden ones.

**Acceptance criteria:**
- Hidden-server behavior matches current documented logic.
- QA records any confusion as product feedback, not a release blocker unless data appears under the wrong server.
