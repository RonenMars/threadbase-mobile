# TS1: Onboarding and Pairing

[Back to production test plan](production-test-plan.md#9-test-cases)

## Test Case Table

| Test case | Scenario | Priority | Preconditions |
|---|---|---|---|
| TC-TS1-001 | QR pairing from clean install | P0 | Release app installed fresh with cleared app data/keychain; `tb-streamer pair` displays a valid QR code; camera permission prompt can be shown. |
| TC-TS1-002 | Manual URL/token pairing | P0 | Clean app install; known reachable streamer URL; valid API key/token. |
| TC-TS1-003 | Invalid credentials and unreachable server | P0 | Clean app install; one invalid API key; one unreachable URL. |

## Detailed Test Cases

### TC-TS1-001: QR pairing from clean install

**Priority:** P0  
**Preconditions:** Release app installed fresh with cleared app data/keychain; `tb-streamer pair` displays a valid QR code; camera permission prompt can be shown.

**Steps:**
1. Launch the app.
2. Navigate through onboarding to the connection step.
3. Choose QR pairing.
4. Grant camera permission.
5. Scan the QR code from `tb-streamer pair`.
6. Finish onboarding and enter the hub.
7. Kill and relaunch the app.

**Expected results:**
- The QR scanner opens and accepts the streamer QR code.
- The app completes the pairing handshake and stores the server locally.
- The hub opens without requiring credentials again after relaunch.
- The server appears connected or connecting according to actual streamer state.

**Acceptance criteria:**
- Pairing succeeds in one attempt on a valid QR code.
- No API key or token is displayed in plain text after pairing.
- Relaunch skips onboarding and preserves the configured server.

### TC-TS1-002: Manual URL/token pairing

**Priority:** P0  
**Preconditions:** Clean app install; known reachable streamer URL; valid API key/token.

**Steps:**
1. Launch the app.
2. Select manual connection.
3. Enter the streamer URL.
4. Enter the API key/token.
5. Submit the connection.
6. Finish onboarding and open the hub.

**Expected results:**
- Valid credentials are accepted.
- The hub loads server data and session/conversation content when available.
- If iOS offers a password-save dialog, dismissing it does not break the flow.

**Acceptance criteria:**
- Manual pairing works with the exact production/demo credentials provided.
- Invalid field formatting is rejected before or during handshake with a clear error.
- Valid credentials are persisted securely.

### TC-TS1-003: Invalid credentials and unreachable server

**Priority:** P0  
**Preconditions:** Clean app install; one invalid API key; one unreachable URL.

**Steps:**
1. Attempt manual pairing with an invalid API key.
2. Observe the error.
3. Replace with a valid key but unreachable URL.
4. Observe the error.
5. Correct both values and retry.

**Expected results:**
- Invalid token and unreachable URL fail without completing onboarding.
- The user can edit and retry without restarting the app.
- Corrected credentials succeed.

**Acceptance criteria:**
- No false-positive pairing occurs.
- Error state does not leak stack traces or raw implementation details.
- Retry path succeeds without clearing app state.
