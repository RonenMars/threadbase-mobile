# TS9: Release, Store Review, and Cross-Platform

[Back to production test plan](production-test-plan.md#9-test-cases)

## Test Case Table

| Test case | Scenario | Priority | Preconditions |
|---|---|---|---|
| TC-TS9-001 | Store-review demo from clean install | P0 | Exact reviewer URL/API key configured; release build installed fresh. |
| TC-TS9-002 | iOS and Android parity smoke | P0 | Release builds installed on iOS and Android; same reachable streamer. |
| TC-TS9-003 | Release pipeline validation | P0 | Candidate branch ready for ship; signing credentials available to maintainer. |

## Detailed Test Cases

### TC-TS9-001: Store-review demo from clean install

**Priority:** P0  
**Preconditions:** Exact reviewer URL/API key configured; release build installed fresh.

**Steps:**
1. Delete and reinstall the app.
2. Follow the exact App Store/Play reviewer instructions.
3. Connect to demo server manually.
4. Create a new session.
5. Send a message.
6. Inspect output/history.

**Expected results:**
- Reviewer instructions are sufficient without developer intervention.
- Demo credentials work.
- Core product value is visible in under five minutes.

**Acceptance criteria:**
- A reviewer can complete the flow on a clean device with only the supplied instructions.

### TC-TS9-002: iOS and Android parity smoke

**Priority:** P0  
**Preconditions:** Release builds installed on iOS and Android; same reachable streamer.

**Steps:**
1. Pair manually on both platforms.
2. Load hub.
3. Open session detail.
4. Send a prompt.
5. Open settings and return.

**Expected results:**
- Core flows work on both platforms.
- Platform-specific permission prompts do not block progress.
- Layout remains usable with keyboard open and common screen sizes.

**Acceptance criteria:**
- No P0 platform-specific defect remains open.

### TC-TS9-003: Release pipeline validation

**Priority:** P0  
**Preconditions:** Candidate branch ready for ship; signing credentials available to maintainer.

**Steps:**
1. Confirm `app.json` version/build metadata is committed before archive/upload.
2. Run the documented local ship flow for the target platform.
3. Verify uploaded build appears in TestFlight or Play track.
4. Confirm build number/version code advanced correctly.

**Expected results:**
- Ship scripts enforce git sync and build-number/version-code safety.
- Uploaded build is visible and processable by the store.
- No uncommitted `app.json` remains after shipping path that requires commit.

**Acceptance criteria:**
- Store build can be installed by testers from the intended track.
