# TS3: Session Lifecycle and Control

[Back to production test plan](production-test-plan.md#9-test-cases)

## Test Case Table

| Test case | Scenario | Priority | Preconditions |
|---|---|---|---|
| TC-TS3-001 | Start a new Claude Code session | P0 | Paired streamer has at least one project/directory available; Claude Code provider is configured. |
| TC-TS3-002 | Start or inspect a Codex session | P0 | Paired streamer supports Codex history and mobile-start capability. |
| TC-TS3-003 | Send follow-up prompt to active session | P0 | Live session is attached and in `running` or `waiting_input` state. |
| TC-TS3-004 | Structured question card answer | P0 | Live Claude Code session emits a structured `AskUserQuestion`; streamer supports `question` WS event and `/answer`. |
| TC-TS3-005 | Stop a live session | P0 | Live attached session is running or waiting for input; streamer supports stop endpoint. |

## Detailed Test Cases

### TC-TS3-001: Start a new Claude Code session

**Priority:** P0  
**Preconditions:** Paired streamer has at least one project/directory available; Claude Code provider is configured.

**Steps:**
1. Tap the FAB.
2. Select the server if a picker appears.
3. Browse to a project/directory.
4. Select Claude Code if provider selection appears.
5. Enter a prompt.
6. Start the session.
7. Open the new session detail screen.

**Expected results:**
- Browse list loads and allows directory selection.
- Session appears as pending/running, then transitions to live detail.
- Prompt reaches the streamer and the agent starts on the configured machine.

**Acceptance criteria:**
- No duplicate session cards are created.
- Session identity, server identity, project path, provider metadata, and status are correct.
- New session can be reopened from the hub after leaving detail.

### TC-TS3-002: Start or inspect a Codex session

**Priority:** P0  
**Preconditions:** Paired streamer supports Codex history and mobile-start capability.

**Steps:**
1. Browse recent/provider-capable session sources.
2. Select Codex where supported.
3. Start a new Codex session or open existing Codex history.
4. Inspect provider label/metadata in hub and detail views.

**Expected results:**
- Codex sessions are distinguishable from Claude Code sessions.
- Supported Codex actions succeed.
- Unsupported Codex parity areas are graceful and documented.

**Acceptance criteria:**
- Codex support does not present Claude-only controls as working when they are not supported.
- History and start-session paths match the current streamer contract.

### TC-TS3-003: Send follow-up prompt to active session

**Priority:** P0  
**Preconditions:** Live session is attached and in `running` or `waiting_input` state.

**Steps:**
1. Open the live session detail.
2. Type a follow-up prompt.
3. Send it.
4. Watch optimistic user bubble and streamed assistant/tool output.
5. Leave the session and return from the hub.

**Expected results:**
- Composer accepts input only when appropriate.
- User message appears immediately and is reconciled with streamed/history data.
- Assistant/tool output streams without duplicate or out-of-order user turns.
- State is preserved after navigation away and back.

**Acceptance criteria:**
- Sent prompt reaches the actual PTY session.
- No duplicate bubbles remain after REST/WS reconciliation.
- Keyboard does not cover the composer on iOS or Android.

### TC-TS3-004: Structured question card answer

**Priority:** P0  
**Preconditions:** Live Claude Code session emits a structured `AskUserQuestion`; streamer supports `question` WS event and `/answer`.

**Steps:**
1. Trigger a prompt that asks a multiple-choice question.
2. Wait for the native question card.
3. Select a non-first option.
4. Submit the answer.
5. Verify the agent continues with the selected option.

**Expected results:**
- Native question card shows header, question, options, descriptions, and disabled/loading state after submit where applicable.
- Mobile submits `{ toolUseId, answers }` through the structured answer path.
- The selected option, not a stale cursor index, is applied in the live session.

**Acceptance criteria:**
- Correct answer reaches the agent in at least three attempts with different option positions.
- Duplicate/stale answer attempts are rejected or ignored safely.
- If structured event is absent, PTY fallback still shows a usable prompt card where possible.

### TC-TS3-005: Stop a live session

**Priority:** P0  
**Preconditions:** Live attached session is running or waiting for input; streamer supports stop endpoint.

**Steps:**
1. Open session detail.
2. Tap the stop control.
3. Confirm the stop dialog.
4. Observe in-flight state.
5. Wait for status update.
6. Repeat against a session that becomes idle before confirmation completes.

**Expected results:**
- Stop is only available for live active sessions.
- Confirmation prevents accidental stop.
- In-flight state disables repeat taps.
- Session becomes idle through WebSocket/status refresh.
- Already-idle race is handled without a false error.

**Acceptance criteria:**
- User can stop a live session in production within expected streamer timeout behavior.
- Timeout and stopped outcomes do not leave the UI stuck.
- Session list and detail agree on final status.
