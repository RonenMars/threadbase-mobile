# TS4: Conversation, Terminal, and Rendering

[Back to production test plan](production-test-plan.md#9-test-cases)

## Test Case Table

| Test case | Scenario | Priority | Preconditions |
|---|---|---|---|
| TC-TS4-001 | Live conversation rendering | P0 | Live session produces text, thinking, tool use, tool result, and diff blocks. |
| TC-TS4-002 | Raw terminal view | P0 | Live PTY session emits ANSI/VT100 output and terminal-heavy content. |
| TC-TS4-003 | Historical conversation view | P0 | Streamer has indexed conversation history with text, code, and tool blocks. |

## Detailed Test Cases

### TC-TS4-001: Live conversation rendering

**Priority:** P0  
**Preconditions:** Live session produces text, thinking, tool use, tool result, and diff blocks.

**Steps:**
1. Open live session detail in conversation view.
2. Let the agent produce mixed content.
3. Expand/collapse thinking/tool/diff cards.
4. Scroll up and down while new output arrives.

**Expected results:**
- Text bubbles, code blocks, tool cards, thinking cards, and diffs render in the correct order.
- Expand/collapse state does not bleed between recycled rows.
- Auto-scroll keeps recent output visible without preventing manual scroll inspection.

**Acceptance criteria:**
- No clipped text, overlapping UI, broken horizontal scroll, or blank rows in normal and long-output cases.
- Last message remains reachable and visually stable after streaming.

### TC-TS4-002: Raw terminal view

**Priority:** P0  
**Preconditions:** Live PTY session emits ANSI/VT100 output and terminal-heavy content.

**Steps:**
1. Open the session detail.
2. Switch to terminal/raw output view if available.
3. Produce colored output, progress output, and prompt text.
4. Rotate or background/foreground the app if supported.

**Expected results:**
- ANSI/TUI decorations are stripped or rendered according to app design.
- Terminal output remains readable and scrollable.
- Question fallback parsing remains available in raw terminal mode.

**Acceptance criteria:**
- Output does not corrupt the conversation view.
- App remains responsive with long terminal history.

### TC-TS4-003: Historical conversation view

**Priority:** P0  
**Preconditions:** Streamer has indexed conversation history with text, code, and tool blocks.

**Steps:**
1. Open a historical conversation from the hub/history/search.
2. Observe cold-load skeleton behavior.
3. Scroll through the conversation.
4. Open a conversation that may still be live or missing JSONL.

**Expected results:**
- Skeleton/loading states clear when data is ready.
- Conversation content renders through the shared `MessageItem` path.
- 404/live-edge cases redirect or recover according to current app logic.

**Acceptance criteria:**
- Historical view never displays a permanent skeleton for valid data.
- Read-only history does not show live-only composer controls.
