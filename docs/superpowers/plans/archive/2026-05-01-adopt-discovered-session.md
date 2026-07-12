> **Archived 2026-05-22.** This file has been moved to the archive. Active backlog/roadmap now lives in [`docs/BACKLOG.md`](../../../BACKLOG.md) and [`docs/ROADMAP.md`](../../../ROADMAP.md). The contents below are preserved verbatim for historical reference.

---

# Adopt Discovered Session Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a user opens a `disc_` (discovered) session, show a prompt to kill and resume it as a managed PTY session, then poll until the new session is live and navigate to it.

**Architecture:** Two repos involved — `tb-streamer` gets a new `POST /api/sessions/disc_:pid/adopt` endpoint that kills the external process and starts a managed resume session, returning `{ sessionId }` immediately. The mobile app polls `GET /api/sessions/:id` on the returned session ID until `ptyAttached === true`, then navigates to it. The existing `PendingSessionScreen` WS pattern is reused for the waiting state.

**Tech Stack:** TypeScript, Node.js http (tb-streamer), React Native + Expo Router + TanStack Query (tb-mobile)

---

## File Map

### tb-streamer (server)
- **Modify:** `src/server.ts` — add route + `handleAdopt` method
- **Modify:** `src/pty-manager.ts` — add `killPid(pid)` helper (kills arbitrary OS pid, not a managed session)

### tb-mobile (app)
- **Modify:** `hooks/useSessionActions.ts` — add `adoptSession` mutation
- **Modify:** `app/session/[id].tsx` — replace dead `disc_` screen with `DiscoveredSessionScreen` component

---

## Task 1: Add `killPid` to PTYManager (tb-streamer)

**Files:**
- Modify: `tb-streamer/src/pty-manager.ts`

The existing `cancel(sessionId)` only kills managed sessions. We need to kill an arbitrary OS pid (the discovered process).

- [ ] **Step 1: Add `killPid` method**

In `tb-streamer/src/pty-manager.ts`, add after the `cancel` method (around line 166):

```typescript
killPid(pid: number): void {
  try {
    process.kill(pid, "SIGTERM");
  } catch {
    // Process may already be gone
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/ronenmars/Desktop/dev/ai-tools/tb-streamer
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/ronenmars/Desktop/dev/ai-tools/tb-streamer
git add src/pty-manager.ts
git commit -m "feat: add killPid helper to PTYManager"
```

---

## Task 2: Add `POST /api/sessions/:id/adopt` endpoint (tb-streamer)

**Files:**
- Modify: `tb-streamer/src/server.ts`

This endpoint:
1. Parses `disc_<pid>` from the session ID
2. Looks up the discovered process from `sessionStore`
3. Kills the OS process via `ptyManager.killPid(pid)`
4. Calls the existing `handleResume` logic inline (kill discoveryCache, start PTY with conversationId+projectPath)
5. Returns `201 { sessionId: <new ses_ id> }` immediately — PTY startup is async

- [ ] **Step 1: Add the route**

In `tb-streamer/src/server.ts`, find the parameterized routes block (around line 344). Add before the closing `json(res, 404, ...)`:

```typescript
const adoptMatch = path.match(/^\/api\/sessions\/(disc_[^/]+)\/adopt$/);
if (method === "POST" && adoptMatch)
  return await this.handleAdopt(adoptMatch[1], res);
```

- [ ] **Step 2: Add `handleAdopt` method**

Add after `handleCancel` (around line 1004):

```typescript
private async handleAdopt(sessionId: string, res: ServerResponse): Promise<void> {
  if (!sessionId.startsWith("disc_")) {
    json(res, 400, { error: "Not a discovered session" });
    return;
  }

  const pid = Number.parseInt(sessionId.slice(5), 10);
  if (Number.isNaN(pid)) {
    json(res, 400, { error: "Invalid disc_ session id" });
    return;
  }

  // Refresh discovery so we have the latest metadata
  const discovered = discoverClaudeProcesses();
  this.sessionStore.setDiscovered(discovered);
  this.discoveryCache = null;

  const discSession = this.sessionStore.get(sessionId);
  if (!discSession) {
    json(res, 404, { error: "Discovered session not found" });
    return;
  }

  const { projectPath, projectName, branch, conversationId } = discSession;

  // Kill the external process
  this.ptyManager.killPid(pid);

  // Start a new managed session, resuming the conversation if we have an ID
  const session = await this.ptyManager.start({
    conversationId: conversationId || undefined,
    projectPath,
    projectName,
    branch,
  });

  this.sessionStore.addManaged(session);
  if (conversationId) {
    this.watchConversationFile(session.id, conversationId);
  }

  this.wsHub.broadcast({ type: "session_list", sessions: this.sessionStore.list() });

  json(res, 201, { sessionId: session.id });
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/ronenmars/Desktop/dev/ai-tools/tb-streamer
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Manual smoke test**

```bash
# Check a disc_ id from the running server
curl -s -H "Authorization: Bearer tb_123" https://tb-example.rbv1000.win/api/sessions \
  | python3 -c "import json,sys; [print(s['id']) for s in json.load(sys.stdin) if s['id'].startswith('disc_')]"

# Then adopt one (replace disc_12345 with a real id)
curl -s -X POST -H "Authorization: Bearer tb_123" \
  https://tb-example.rbv1000.win/api/sessions/disc_12345/adopt
```

Expected: `{"sessionId":"ses_..."}`.

- [ ] **Step 5: Commit**

```bash
cd /Users/ronenmars/Desktop/dev/ai-tools/tb-streamer
git add src/server.ts
git commit -m "feat: add adopt endpoint to kill disc_ process and resume as managed session"
```

---

## Task 3: Add `adoptSession` mutation to mobile (tb-mobile)

**Files:**
- Modify: `tb-mobile/hooks/useSessionActions.ts`

- [ ] **Step 1: Add the mutation**

In `tb-mobile/hooks/useSessionActions.ts`, add after `respondToPlan`:

```typescript
const adoptSession = useMutation({
  mutationFn: () =>
    api.post<{ sessionId: string }>(`/api/sessions/${sessionId}/adopt`),
  onSuccess: () => {
    qc.invalidateQueries({ queryKey: ['sessions'] })
  },
})
```

And add `adoptSession` to the return object:

```typescript
return { sendInput, cancelSession, addToQueue, removeFromQueue, respondToPlan, adoptSession }
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/ronenmars/Desktop/dev/ai-tools/tb-mobile
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/ronenmars/Desktop/dev/ai-tools/tb-mobile
git add hooks/useSessionActions.ts
git commit -m "feat: add adoptSession mutation for disc_ sessions"
```

---

## Task 4: Replace dead `disc_` screen with Restart UI (tb-mobile)

**Files:**
- Modify: `tb-mobile/app/session/[id].tsx`

The current `disc_` fallback (lines 366–381) shows a dead-end "External process" screen. Replace it with a `DiscoveredSessionScreen` component that:
- Shows the prompt and two buttons
- On "Restart": calls `adoptSession`, then navigates to a polling screen for the returned `sessionId`
- On "Back": calls `router.back()`

The polling screen already exists: `PendingSessionScreen` listens on WS for `session_update` where `ptyAttached === true`. We reuse it by navigating to `/session/pending_<newId>?server=...` — but `PendingSessionScreen` already handles any `id` that starts with `pending_`. Instead we navigate to `/session/<newId>?server=...` and let the normal session screen handle it (which already polls via `useSessionDetail` + WS).

Actually the cleanest approach: after `adoptSession` returns `{ sessionId }`, navigate to `/session/<sessionId>?server=<serverId>`. The session screen will show the loading spinner until `ptyAttached` becomes true (via WS `session_update`). This requires no new polling component — the existing screen already handles the `isLoading` and WS-driven refresh.

- [ ] **Step 1: Add `DiscoveredSessionScreen` component**

In `tb-mobile/app/session/[id].tsx`, add this component after the `PendingSessionScreen` component (around line 98):

```tsx
function DiscoveredSessionScreen({
  serverId,
  sessionId,
}: {
  serverId: string
  sessionId: string
}) {
  const router = useRouter()
  const { adoptSession } = useSessionActions(serverId, sessionId)

  const handleRestart = () => {
    adoptSession.mutate(undefined, {
      onSuccess: (data) => {
        router.replace(`/session/${data.sessionId}?server=${serverId}`)
      },
      onError: (err) => {
        Alert.alert(
          'Restart failed',
          err instanceof Error ? err.message : 'Unknown error',
        )
      },
    })
  }

  return (
    <SafeAreaView style={discStyles.container} edges={['bottom']}>
      <View style={discStyles.content}>
        <Text style={discStyles.title}>Session unavailable</Text>
        <Text style={discStyles.subtitle}>
          This session is running but unavailable.{'\n'}Restart it to re-open?
        </Text>
        <View style={discStyles.buttons}>
          <TouchableOpacity
            style={[discStyles.btn, discStyles.restartBtn, adoptSession.isPending && discStyles.btnDisabled]}
            onPress={handleRestart}
            disabled={adoptSession.isPending}
          >
            {adoptSession.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={discStyles.restartBtnText}>Restart</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[discStyles.btn, discStyles.backBtn]}
            onPress={() => router.back()}
            disabled={adoptSession.isPending}
          >
            <Text style={discStyles.backBtnText}>Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  )
}

const discStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: dark.bg.primary },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.lg,
  },
  title: {
    color: dark.text.primary,
    fontSize: font.lg,
    fontWeight: '600',
  },
  subtitle: {
    color: dark.text.secondary,
    fontSize: font.base,
    textAlign: 'center',
    lineHeight: 24,
  },
  buttons: {
    width: '100%',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  btn: {
    borderRadius: 10,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  restartBtn: {
    backgroundColor: dark.text.accent,
  },
  backBtn: {
    backgroundColor: dark.bg.card,
    borderWidth: 1,
    borderColor: dark.border,
  },
  btnDisabled: { opacity: 0.5 },
  restartBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: font.base,
  },
  backBtnText: {
    color: dark.text.primary,
    fontWeight: '600',
    fontSize: font.base,
  },
})
```

- [ ] **Step 2: Replace the disc_ fallback in `SessionDetailScreen`**

Find this block in `SessionDetailScreen` (around line 365):

```tsx
  if (!session) {
    const isDisc = id?.startsWith('disc_') ?? false
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={[styles.flex, { justifyContent: 'center', alignItems: 'center', padding: spacing.lg }]}>
          <Text style={styles.discoveredTitle}>
            {isDisc ? 'External process' : 'Session not found'}
          </Text>
          <Text style={[styles.discoveredText, { textAlign: 'center', marginTop: spacing.sm }]}>
            {isDisc
              ? 'This Claude process was detected externally and has no terminal session.\nIt may have exited since the list was loaded.'
              : `No session found for ID:\n${id}`}
          </Text>
        </View>
        {infoModal}
      </SafeAreaView>
    )
  }
```

Replace with:

```tsx
  if (!session) {
    if (id?.startsWith('disc_')) {
      return <DiscoveredSessionScreen serverId={serverId} sessionId={id} />
    }
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={[styles.flex, { justifyContent: 'center', alignItems: 'center', padding: spacing.lg }]}>
          <Text style={styles.discoveredTitle}>Session not found</Text>
          <Text style={[styles.discoveredText, { textAlign: 'center', marginTop: spacing.sm }]}>
            {`No session found for ID:\n${id}`}
          </Text>
        </View>
        {infoModal}
      </SafeAreaView>
    )
  }
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/ronenmars/Desktop/dev/ai-tools/tb-mobile
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/ronenmars/Desktop/dev/ai-tools/tb-mobile
git add app/session/[id].tsx
git commit -m "feat: replace disc_ dead-end screen with Restart/Back prompt"
```

---

## Task 5: Handle the WS-driven ready transition

After `adoptSession` succeeds and the app navigates to `/session/<newId>?server=...`, the normal session screen is loaded. It calls `useSessionDetail` which fetches the session via HTTP, and `useTerminalStream` which connects the PTY. The session will initially show `ptyAttached: false` / `status: running` while the PTY is starting up — this already renders the "waking up" spinner via `isWakingUp`.

However, the WS `session_update` event that fires when PTY attaches needs to trigger a query refetch so the screen transitions from spinner → live terminal.

- [ ] **Step 1: Verify existing WS handling covers this**

In `tb-mobile/services/ws-client.ts`, check that `session_update` events invalidate `['session', serverId, sessionId]`:

```bash
grep -n "session_update\|setQueryData\|invalidateQueries" /Users/ronenmars/Desktop/dev/ai-tools/tb-mobile/services/ws-client.ts | head -30
```

If `session_update` already calls `queryClient.setQueryData(['session', serverId, s.id], s)` — no changes needed. If not, add it.

- [ ] **Step 2: If missing, add WS→query sync**

Find where `session_update` is handled in `ws-client.ts`. Add:

```typescript
case 'session_update': {
  const s = msg.session
  queryClient.setQueryData(['session', serverId, s.id], s)
  break
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/ronenmars/Desktop/dev/ai-tools/tb-mobile
npx tsc --noEmit
```

- [ ] **Step 4: Commit (only if changes were made)**

```bash
cd /Users/ronenmars/Desktop/dev/ai-tools/tb-mobile
git add services/ws-client.ts
git commit -m "fix: sync session_update WS events into query cache for ptyAttached transitions"
```

---

## Self-Review

**Spec coverage:**
- ✅ `disc_` session opens → "Restart it to re-open?" prompt with Restart / Back
- ✅ Restart → `POST /api/sessions/disc_<pid>/adopt` → kills process, starts managed PTY
- ✅ Returns 201 + `{ sessionId }` immediately (non-blocking)
- ✅ App navigates to new session, shows spinner until PTY attached (existing `isWakingUp` pattern)
- ✅ WS `session_update` drives the spinner→live transition
- ✅ No history loss when `conversationId` exists (passed to `ptyManager.start` as `--resume`)
- ✅ `conversationId: null` case handled (start fresh in same projectPath)

**Edge cases covered:**
- Process already gone when adopt fires: `killPid` is silent on error, `ptyManager.start` still works
- `disc_` not in discovered cache: refreshed at start of `handleAdopt` before lookup
- User presses Restart twice: mutation is disabled while `isPending`
