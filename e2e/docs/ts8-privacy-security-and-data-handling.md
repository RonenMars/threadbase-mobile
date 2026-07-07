# TS8: Privacy, Security, and Data Handling

[Back to production test plan](production-test-plan.md#9-test-cases)

## Test Case Table

| Test case | Scenario | Priority | Preconditions |
|---|---|---|---|
| TC-TS8-001 | Local-first traffic audit | P0 | Device traffic can be observed through proxy/router logs; paired streamer URL is known. |
| TC-TS8-002 | Server removal and credential cleanup | P0 | One paired server with push registration enabled. |

## Detailed Test Cases

### TC-TS8-001: Local-first traffic audit

**Priority:** P0  
**Preconditions:** Device traffic can be observed through proxy/router logs; paired streamer URL is known.

**Steps:**
1. Pair a server.
2. Start and inspect a live session.
3. Search history and send prompts.
4. Capture outbound network destinations.

**Expected results:**
- Session content, prompts, terminal output, history, and provider metadata go only to configured streamer endpoints.
- Expo push endpoints are contacted only for notification token handling.
- No analytics/telemetry endpoint receives session content.

**Acceptance criteria:**
- Any unexpected third-party destination is treated as a release blocker until explained and approved.

### TC-TS8-002: Server removal and credential cleanup

**Priority:** P0  
**Preconditions:** One paired server with push registration enabled.

**Steps:**
1. Remove the server from Settings.
2. Relaunch the app.
3. Attempt to access previous server sessions.
4. Inspect status/modal/server list.

**Expected results:**
- Removed server no longer appears as active.
- Credentials are no longer usable through app UI.
- Push token is revoked or no longer associated where the streamer supports it.

**Acceptance criteria:**
- Removing a server prevents accidental future requests to that server.
