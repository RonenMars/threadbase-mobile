# TS7: Search, History, and Navigation

[Back to production test plan](production-test-plan.md#9-test-cases)

## Test Case Table

| Test case | Scenario | Priority | Preconditions |
|---|---|---|---|
| TC-TS7-001 | Cross-session search | P1 | Indexed conversations across at least two projects and two streamers. |
| TC-TS7-002 | Project and session navigation | P1 | Hub contains multiple projects with sessions and conversations. |

## Detailed Test Cases

### TC-TS7-001: Cross-session search

**Priority:** P1  
**Preconditions:** Indexed conversations across at least two projects and two streamers.

**Steps:**
1. Open search.
2. Search for a unique term in a known conversation.
3. Search for a common term across multiple sessions.
4. Tap a result.

**Expected results:**
- Search returns relevant results with enough context to identify the session/conversation.
- Multi-server results preserve server identity.
- Tapping a result opens the correct detail screen.

**Acceptance criteria:**
- Result count and result ordering are explainable from current product behavior.
- No result opens the wrong provider/server/project.

### TC-TS7-002: Project and session navigation

**Priority:** P1  
**Preconditions:** Hub contains multiple projects with sessions and conversations.

**Steps:**
1. Expand/collapse several project cards.
2. Open a session row.
3. Navigate back.
4. Open a conversation row.
5. Use any "See all" or project-detail navigation available.

**Expected results:**
- Navigation preserves context and back behavior.
- Expanded/collapsed state behaves predictably.
- Long lists remain performant and scrollable.

**Acceptance criteria:**
- User can move from hub to detail and back repeatedly without losing current server context.
