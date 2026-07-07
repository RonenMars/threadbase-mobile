# TS10: Non-Functional Production Quality

[Back to production test plan](production-test-plan.md#9-test-cases)

## Test Case Table

| Test case | Scenario | Priority | Preconditions |
|---|---|---|---|
| TC-TS10-001 | Performance and long-list behavior | P1 | Streamer fixture or real corpus with hundreds of sessions/conversations and long messages. |
| TC-TS10-002 | Accessibility and localization smoke | P1 | Device supports dynamic text and RTL/localized language settings. |

## Detailed Test Cases

### TC-TS10-001: Performance and long-list behavior

**Priority:** P1  
**Preconditions:** Streamer fixture or real corpus with hundreds of sessions/conversations and long messages.

**Steps:**
1. Launch app on lower-end supported device.
2. Scroll hub/history/search lists rapidly.
3. Open long conversation with code and diff-heavy messages.
4. Background/foreground during load.

**Expected results:**
- UI remains responsive.
- List virtualization does not show recycled-row content bleed.
- Loading indicators clear.

**Acceptance criteria:**
- No sustained freeze, crash, or memory warning on supported devices.

### TC-TS10-002: Accessibility and localization smoke

**Priority:** P1  
**Preconditions:** Device supports dynamic text and RTL/localized language settings.

**Steps:**
1. Increase text size.
2. Navigate onboarding, hub, session detail, and settings.
3. Switch to an RTL language where supported.
4. Verify key controls with screen reader focus where feasible.

**Expected results:**
- Text remains readable and does not overlap controls.
- Critical controls have accessible labels/roles.
- RTL layout remains navigable.

**Acceptance criteria:**
- No P0/P1 workflow is blocked by text size, RTL, or missing control accessibility.
