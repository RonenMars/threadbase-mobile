# Threadbase Cursor Implementation Plan Prompt

## Role

You are the primary React Native, mobile UX, client-state, and frontend implementation agent for Threadbase. Resolve the highest-impact mobile reliability, onboarding, diagnostics, degraded-mode, accessibility, and review-workflow pain points identified against Orca and Tactic Remote.

Use Cursor Ask mode for investigation before Agent edits. Work one task at a time. Review every generated diff. Each task gets a separate worktree, branch, commits, PR, and integration cherry-pick. Avoid broad formatting and unrelated refactors.

## Primary ownership

You own:

- `threadbase-mobile`
- Expo Router navigation
- React Native screens/components
- Zustand and TanStack Query client state
- WebSocket client behavior
- Onboarding and pairing UX
- Diagnostics/server-health UI
- Multi-server degraded states
- Conversation/terminal presentation
- Accessibility, themes, localization, responsive layout
- Maestro and mobile integration tests

Do not independently redesign backend contracts. Use the API-contract lock and consume Claude Code's documented contracts.

## Task queue

### U1. Core mobile session lifecycle

Fix and test:

- New-session modal flashing/closing
- File browser remaining in the stack
- Interaction-locked browser state
- Empty sessions left after backing out
- “Session not found” entry paths
- Incorrect reconnect restoration
- Jumpy/incorrect scroll positions
- Stale query/cache state
- Duplicate resumed-conversation representations

Use explicit idempotent navigation transitions, avoid timing hacks, separate server data from UI state correctly, and add Maestro coverage on iOS and Android.

### U2. Onboarding and pairing

Create a flow that:

- Makes QR pairing primary
- Keeps manual setup secondary
- Explains local versus remote connectivity plainly
- Detects malformed/unreachable URLs
- Handles camera denial and scanner cancellation
- Shows pairing progress and precise errors
- Verifies connectivity before completion
- Allows server naming
- Provides retry/support paths
- Removes developer defaults from production

### U3. Diagnostics and remediation screen

Consume Claude Code's versioned diagnostics contract. Show independent health for host, streamer, auth, database, provider, PTY, WebSocket, LAN/tunnel, push, filesystem scope, and version compatibility.

Each failure needs a human explanation, diagnostic code, recommended action, retry, and copyable sanitized report. Never show secrets.

### U4. Session/conversation mental model

Create consistent terminology and visual treatment for managed live, external live, historical, resumed, on-hold, completed, unavailable, and stale sessions.

Show provider, server, project, live-control capability, activity time, state source/confidence, and only actions the streamer can actually perform.

### U5. Multi-server resilience

Implement:

- Partial results
- Per-server health and retry
- Stable cached content
- Server attribution
- Offline sections
- No global failure from one bad server
- Correct cancellation after configuration changes
- Per-server empty states
- Duplicate-project disambiguation

Test one healthy, one slow, one offline, and one malformed mock server.

### U6. Terminal/conversation rendering resilience

Implement:

- Clear terminal versus conversation modes
- Unsupported-sequence fallback
- Rendering error containment
- Large-output virtualization
- Stable scroll anchoring
- Replay without duplicates
- Copy/search
- Provider-specific decoration adapters
- Raw-terminal fallback when normalization is uncertain
- Long-output performance tests

Do not present normalized chat as authoritative when parsing confidence is low.

### U7. Provider capability UI

Read capabilities from the server, hide unsupported actions, explain generic-terminal mode, show compatibility warnings, provide provider setup guidance, handle unknown providers, and remove hard-coded Claude/Codex assumptions from shared components.

### U8. Focused mobile review workflow

Build a deliberately scoped review surface, not a full IDE:

- Changed-files list
- Diff summary
- Read-only unified/split diff
- Status filters
- Large-diff safeguards
- Desktop handoff
- Send review note to agent
- Warnings for incomplete/oversized diffs
- Stage/commit only if backend permissions explicitly support it

### U9. Notification health UX

Consume Claude Code's notification-health API. Add test notification, last success/failure, token state, quiet-hours preview, per-server status, re-registration, clear detection-versus-delivery errors, and duplicate suppression.

### U10. Permissions and paired-device UI

Consume scoped-capability/device APIs. Add device naming, last-used state, capability summary, revoke action, read-only mode, project access, warnings before shell/process control, and re-pair after rotation. Never display full credentials.

### U11. Backup/restore/migration UX

Consume backend export/restore support. Provide export, restore, validation, progress, conflict explanation, server identity replacement, rollback messaging, and a clear distinction between provider-native history and Threadbase metadata.

### U12. Accessibility, localization, theme, and performance

Audit/fix Dynamic Type, VoiceOver/TalkBack, touch targets, focus order, reduced motion, contrast, dark/light consistency, RTL, Hebrew/Arabic, long translations, large lists, accordion performance, and terminal/diff screen-reader behavior. Add visual and Maestro regressions.

## Deliverables per task

1. Reproduction and UX analysis
2. State/screen diagram when useful
3. Focused implementation
4. Unit/component tests
5. Maestro E2E tests
6. iOS verification
7. Android verification
8. Accessibility verification
9. Performance notes
10. Screenshots/recordings for visual changes
11. PR description
12. Final commit SHA list
13. Confirmation of application to `integration-merge-354-355-376`

## Mandatory Git/worktree workflow

Apply this process to **every task**. Never combine unrelated tasks in one branch or worktree.

### Required integration bases

- `tb-streamer`: `integration/missing-prs-2026-07-23`
- `tb-mobile`: `integration-merge-354-355-376`
- Every public PR must target `main`.

### Per-task workflow

1. Fetch and verify a clean source checkout:

```bash
git fetch origin --prune
git status --short
git worktree list
```

2. Create a unique worktree and branch from the correct integration branch.

For `tb-streamer`:

```bash
git worktree add ../.worktrees/<tool>-streamer-<task> \
  -b <tool>/streamer/<task> \
  origin/integration/missing-prs-2026-07-23
```

For `tb-mobile`:

```bash
git worktree add ../.worktrees/<tool>-mobile-<task> \
  -b <tool>/mobile/<task> \
  origin/integration-merge-354-355-376
```

Use unique names such as:

```text
cc/streamer/durable-session-runtime
cursor/mobile/onboarding-diagnostics
```

Claude Code and Cursor must never share a worktree, branch, or uncommitted checkout.

3. Implement only that task. Keep unrelated refactors out.

4. Before final validation, rebase the task branch on the latest integration branch:

```bash
git fetch origin
git rebase origin/<integration-branch>
```

Rebase only private task branches. Never rebase the shared integration branch.

5. Run the complete relevant test suite after the rebase.

6. Commit focused changes:

```bash
git add -A
git commit -m '<type>(<scope>): <summary>'
```

7. Push the task branch:

```bash
git push -u origin HEAD
```

### Clean PR requirement

A development branch created from an integration branch may contain integration commits not yet present in `main`. Before opening the PR, check:

```bash
git fetch origin
git merge-base --is-ancestor origin/<integration-branch> origin/main
```

- If the command succeeds, the task branch may be opened directly against `main`.
- If it fails, **do not** open the integration-based branch directly against `main`; it would include unrelated integration commits.

Instead, create a clean publication branch from `origin/main` and cherry-pick only the task commits:

```bash
git worktree add ../.worktrees/<tool>-pr-<task> \
  -b <tool>/pr/<task> \
  origin/main

cd ../.worktrees/<tool>-pr-<task>
git cherry-pick <task-sha-1> [<task-sha-2> ...]
git push -u origin HEAD
```

Open the PR from the clean publication branch with `main` as base.

The PR must include:

- Problem and root cause
- Scope and non-goals
- Design decisions
- Test evidence
- Manual verification
- Security/migration considerations
- Exact task commit SHAs
- Target integration branch

### Cherry-pick into the integration branch after opening the PR

After the PR is open, cherry-pick the final PR commits into the appropriate integration branch. Include later review-fix commits too.

Do this only while holding the repository integration lock described below.

Create a temporary integration-apply worktree from the latest remote tip:

```bash
git fetch origin
git worktree add ../.worktrees/integrate-<task> \
  -b integrate/<task>-$(date +%Y%m%d%H%M%S) \
  origin/<integration-branch>

cd ../.worktrees/integrate-<task>
git cherry-pick <final-pr-sha-1> [<final-pr-sha-2> ...]
```

Run relevant tests, then push only as a fast-forward:

```bash
git push origin HEAD:<integration-branch>
```

If rejected, do not force-push. Fetch the latest integration branch, recreate or rebase the temporary apply branch, rerun the cherry-pick and tests, and retry.

After the PR is merged, verify the intended paths exist in both `main` and the integration branch.

Clean up worktrees only after verification.


## Parallel Claude Code + Cursor coordination

Use parallel execution only with explicit ownership.

### Default ownership boundary

- **Claude Code:** `tb-streamer`, runtime/process lifecycle, provider adapters, API/WebSocket contracts, persistence, search backend, authentication, authorization, diagnostics backend, backend tests.
- **Cursor:** `tb-mobile`, React Native screens, navigation, Zustand/TanStack Query client state, onboarding, diagnostics UI, multi-server UX, accessibility, visual polish, mobile tests.

A tool must not edit paths owned by the other tool unless the task is declared as a coordinated contract change.

### Shared coordination registry

Create a directory outside all repositories:

```bash
export TB_COORD_ROOT="${TB_COORD_ROOT:-$HOME/.threadbase-agent-coordination}"
mkdir -p "$TB_COORD_ROOT/locks" "$TB_COORD_ROOT/status"
```

Maintain:

```text
$TB_COORD_ROOT/status/active-tasks.md
```

Every active task must record:

- Tool
- Repository
- Task slug
- Branch
- Worktree
- Owned paths
- Expected API/schema changes
- Status: planning / implementing / testing / PR-open / integrating / done
- PR URL
- Final commit SHAs

Each agent must read the registry before editing. Do not start work that overlaps active files or contracts.

### Atomic lock directories

Use atomic `mkdir` locks, not plain lock files:

```text
$TB_COORD_ROOT/locks/tb-streamer-integration.lock
$TB_COORD_ROOT/locks/tb-mobile-integration.lock
$TB_COORD_ROOT/locks/threadbase-api-contract.lock
```

Acquire a lock:

```bash
LOCK="$TB_COORD_ROOT/locks/tb-streamer-integration.lock"
if ! mkdir "$LOCK" 2>/dev/null; then
  echo "Lock already held: $LOCK"
  exit 1
fi

printf '%s\n' \
  'owner=<tool>' \
  'task=<task>' \
  "pid=$$" \
  "started=$(date -u +%FT%TZ)" \
  > "$LOCK/owner"

trap 'rm -rf "$LOCK"' EXIT
```

A stale lock may be removed only after checking the recorded PID, task registry, worktrees, and remote branch state.

### Serialize integration updates

Implementation may happen in parallel. Cherry-picks into a given integration branch may not.

For each repository:

1. Acquire its integration lock.
2. Fetch the latest remote integration branch.
3. Create a temporary integration-apply worktree from that exact tip.
4. Cherry-pick the final task commits.
5. Resolve conflicts.
6. Run tests.
7. Push without force.
8. Verify the remote tip.
9. Release the lock.

### Contract changes

For REST endpoints, WebSocket events, schemas, session states, or shared types:

1. Acquire `threadbase-api-contract.lock`.
2. Write/update a versioned contract document first.
3. Record producer and consumer changes.
4. Claude Code implements the server side and tests.
5. Cursor implements the mobile consumer against that documented contract.
6. Prefer additive, backward-compatible changes.
7. Keep old fields/events until both integration branches contain the new implementation.
8. Release the contract lock only after both sides pass integration tests.

Never let both tools independently invent the same API shape.

### Path ownership and conflict prevention

Each task must declare owned paths. If two tasks need the same file, stop parallel execution and sequence them.

Avoid while parallel work is active:

- Repository-wide formatting
- Mass renaming
- Dependency upgrades
- Shared-type refactors
- Broad folder moves

Schedule those in a separate maintenance window.

### Recommended waves

**Wave 1 — independent work**

Claude Code:
- Durable runtime design
- Provider fixtures
- Security inventory
- Diagnostics contracts

Cursor:
- Existing navigation bugs
- Onboarding audit
- Multi-server degraded states
- Accessibility/theme defects

**Wave 2 — contract-dependent work**

Claude Code defines and implements:
- Session lifecycle v2
- Diagnostics API
- Device capability APIs
- Notification-health API

Cursor then consumes those contracts.

**Wave 3 — hardening**

- Cross-repository E2E tests
- Migration tests
- Manual iOS/Android verification
- Security review
- Documentation
- Release checks


## Final instruction

Do not implement backend architecture inside the mobile repository. When blocked by an API/schema dependency, record it in the shared registry, acquire the contract lock, and coordinate with Claude Code rather than creating an incompatible private solution.
