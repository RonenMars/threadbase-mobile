# TS6: Notifications

[Back to production test plan](production-test-plan.md#9-test-cases)

## Test Case Table

| Test case | Scenario | Priority | Preconditions |
|---|---|---|---|
| TC-TS6-001 | Notification permission and push registration | P1 | Release build with push entitlement; paired streamer; notifications not yet granted. |
| TC-TS6-002 | Input-needed, completed, and failed notifications | P1 | Push registration complete; app backgrounded. |

## Detailed Test Cases

### TC-TS6-001: Notification permission and push registration

**Priority:** P1  
**Preconditions:** Release build with push entitlement; paired streamer; notifications not yet granted.

**Steps:**
1. Reach notification step or Settings notification controls.
2. Grant permission.
3. Verify registration with the paired streamer.
4. Remove the server.

**Expected results:**
- Permission request appears with production app identity.
- Push token is registered with the streamer.
- Removing server revokes or cleans up push registration where supported.

**Acceptance criteria:**
- No push token is registered to the wrong server.
- Revocation/removal leaves no visible stale server notification state.

### TC-TS6-002: Input-needed, completed, and failed notifications

**Priority:** P1  
**Preconditions:** Push registration complete; app backgrounded.

**Steps:**
1. Trigger a session that asks for input.
2. Trigger a session that completes.
3. Trigger a session that fails.
4. Tap notifications and inspect deep links.

**Expected results:**
- Notifications arrive for each configured event.
- Tapping a notification opens the correct session/server where supported.
- Quiet hours/settings behavior is respected.

**Acceptance criteria:**
- Notification content is useful but does not expose excessive sensitive content on lock screen beyond product policy.
