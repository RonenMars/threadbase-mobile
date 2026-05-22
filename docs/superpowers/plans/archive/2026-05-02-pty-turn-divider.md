> **Archived 2026-05-22.** This file has been moved to the archive. Active backlog/roadmap now lives in [`docs/BACKLOG.md`](../../../BACKLOG.md) and [`docs/ROADMAP.md`](../../../ROADMAP.md). The contents below are preserved verbatim for historical reference.

---

# PTY Turn Divider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Inject a styled "YOU → <text>" divider row into the terminal output each time the user sends input, appearing after the current stream goes idle.

**Architecture:** `TerminalLine` union type replaces `string[]`; `useTerminalStream` queues sent inputs and flushes them as divider entries when the stream goes idle (or at stream-start if idle never fires); `TerminalOutput` renders a `DividerRow` for divider entries and `LineRow` for plain strings.

**Tech Stack:** React Native, TypeScript, `@testing-library/react-native`, Jest

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `hooks/useTerminalStream.ts` | Modify | Add `TerminalLine` type, pending queue ref, `recordSentInput`, flush logic |
| `components/terminal/TerminalOutput.tsx` | Modify | Accept `TerminalLine[]`, add `DividerRow` component, branch in `renderItem` |
| `app/session/[id].tsx` | Modify | Call `recordSentInput(payload)` after `sendInput.mutate(payload)` |
| `__tests__/integration/components/TerminalOutput.test.tsx` | Modify | Add divider rendering tests |

---

### Task 1: Add `TerminalLine` type and update `useTerminalStream`

**Files:**
- Modify: `hooks/useTerminalStream.ts`

- [ ] **Step 1: Write the failing tests for divider injection**

Create `__tests__/unit/hooks/useTerminalStream-divider.test.ts`:

```ts
import { renderHook, act } from '@testing-library/react-native'
import { useTerminalStream } from '@/hooks/useTerminalStream'

// Minimal mocks — the hook imports these at module level
jest.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: undefined, isPending: false }),
}))

jest.mock('@/services/ws-client', () => ({
  wsManager: {
    getClient: () => null,
    onAnyStatusChange: () => () => {},
  },
}))

jest.mock('@/stores/settings', () => ({
  useSettingsStore: (sel: (s: { terminalMaxLines: number }) => unknown) =>
    sel({ terminalMaxLines: 5000 }),
}))

jest.mock('@/services/api-client', () => ({
  createApiForServer: () => ({ get: async () => ({ output: '' }) }),
  NotFoundError: class NotFoundError extends Error {},
}))

describe('useTerminalStream – recordSentInput', () => {
  it('exposes recordSentInput function', () => {
    const { result } = renderHook(() =>
      useTerminalStream('server1', 'session1', true)
    )
    expect(typeof result.current.recordSentInput).toBe('function')
  })

  it('does not immediately inject a divider when recordSentInput is called', () => {
    const { result } = renderHook(() =>
      useTerminalStream('server1', 'session1', true)
    )
    act(() => {
      result.current.recordSentInput('run the tests')
    })
    // divider should not appear yet — waiting for idle flush
    const hasDivider = result.current.lines.some(
      (l) => typeof l !== 'string' && (l as { __divider: boolean }).__divider
    )
    expect(hasDivider).toBe(false)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx jest --ci --testPathPattern='useTerminalStream-divider' --forceExit
```

Expected: FAIL — `result.current.recordSentInput` is `undefined`

- [ ] **Step 3: Add `TerminalLine` type and `recordSentInput` to the hook**

In `hooks/useTerminalStream.ts`, make these changes:

**Add the type export at the top of the file (after the imports):**

```ts
export type TerminalLine =
  | string
  | { __divider: true; text: string }
```

**Change the `lines` state type** from `string[]` to `TerminalLine[]`:

```ts
// Before:
const [lines, setLines] = useState<string[]>([])

// After:
const [lines, setLines] = useState<TerminalLine[]>([])
```

**Add the pending queue ref** after the `vtRef` declaration:

```ts
const pendingDividersRef = useRef<string[]>([])
```

**Clear the queue on history reset** — in the `useEffect` that calls `vtRef.current.reset()`, add a clear after the reset:

```ts
useEffect(() => {
  vtRef.current.reset()
  pendingDividersRef.current = []   // ← add this line
  setLines([])
  // ... rest unchanged
}, [historyQuery.data, maxLines])
```

**Flush the queue in the idle timer** — find the `idleTimer = setTimeout(...)` call and update it:

```ts
idleTimer = setTimeout(() => {
  // Flush any pending dividers before marking idle
  if (pendingDividersRef.current.length > 0) {
    const dividers: TerminalLine[] = pendingDividersRef.current.map(
      (text) => ({ __divider: true as const, text })
    )
    pendingDividersRef.current = []
    setLines((prev) => [...prev, ...dividers])
  }
  setIsStreaming(false)
}, 1500)
```

**Flush the queue at stream-start** — in the `terminal_output` handler, add a flush before `vtRef.current.feed(msg.data)`:

```ts
unsubOutput = client.on('terminal_output', (msg) => {
  if (msg.type !== 'terminal_output' || msg.sessionId !== sessionId) return

  // Flush pending dividers before the first line of a new response
  if (pendingDividersRef.current.length > 0) {
    const dividers: TerminalLine[] = pendingDividersRef.current.map(
      (text) => ({ __divider: true as const, text })
    )
    pendingDividersRef.current = []
    setLines((prev) => [...prev, ...dividers])
  }

  setIsStreaming(true)
  vtRef.current.feed(msg.data)
  const visible = vtRef.current.getLines()
  setLines(visible.slice(-maxLines))   // NOTE: this replaces prev — see step below
  // ... rest unchanged
})
```

> **Important:** `setLines(visible.slice(-maxLines))` replaces the entire array, which would wipe the just-flushed dividers. Fix this by making the lines state track VT lines and dividers separately via the flush approach: after flushing dividers, the VT lines are appended. Change the set after `vtRef.current.feed` to preserve dividers:

```ts
setLines((prev) => {
  const vtLines = vtRef.current.getLines()
  // Keep any divider entries from prev, replace VT string lines
  const dividerEntries = prev.filter(
    (l): l is { __divider: true; text: string } =>
      typeof l !== 'string' && (l as { __divider: boolean }).__divider
  )
  return [...dividerEntries, ...vtLines].slice(-maxLines)
})
```

**Add `recordSentInput` to the return value:**

```ts
const recordSentInput = useCallback((text: string) => {
  pendingDividersRef.current.push(text)
}, [])

// In the return object:
return { lines, isStreaming, isLoadingHistory: historyQuery.isPending, clear, recordSentInput }
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx jest --ci --testPathPattern='useTerminalStream-divider' --forceExit
```

Expected: PASS — both tests green

- [ ] **Step 5: Commit**

```bash
git add hooks/useTerminalStream.ts __tests__/unit/hooks/useTerminalStream-divider.test.ts
git commit -m "feat: add TerminalLine type and recordSentInput to useTerminalStream"
```

---

### Task 2: Add `DividerRow` to `TerminalOutput` and update props

**Files:**
- Modify: `components/terminal/TerminalOutput.tsx`
- Modify: `__tests__/integration/components/TerminalOutput.test.tsx`

- [ ] **Step 1: Write the failing tests for divider rendering**

Add a new `describe` block to `__tests__/integration/components/TerminalOutput.test.tsx`:

```ts
import type { TerminalLine } from '@/hooks/useTerminalStream'

describe('TerminalOutput – divider rows', () => {
  it('renders YOU label for a divider entry', () => {
    const lines: TerminalLine[] = [
      'normal line',
      { __divider: true, text: 'run the tests' },
    ]
    const { getByText } = render(
      <TerminalOutput lines={lines} isStreaming={false} />
    )
    expect(getByText('YOU')).toBeTruthy()
    expect(getByText('run the tests')).toBeTruthy()
  })

  it('renders mixed string and divider lines without crash', () => {
    const lines: TerminalLine[] = [
      'line one',
      { __divider: true, text: 'hello' },
      'line two',
    ]
    expect(() =>
      render(<TerminalOutput lines={lines} isStreaming={false} />)
    ).not.toThrow()
  })

  it('does not render a line number for divider entries', () => {
    const lines: TerminalLine[] = [
      { __divider: true, text: 'only divider' },
    ]
    const { queryByText } = render(
      <TerminalOutput lines={lines} isStreaming={false} />
    )
    // Line number "1" should not appear — divider has no gutter
    expect(queryByText('1')).toBeNull()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx jest --ci --testPathPattern='TerminalOutput' --forceExit
```

Expected: FAIL — TypeScript error on `lines` prop type, `YOU` not found

- [ ] **Step 3: Update `TerminalOutput` to accept `TerminalLine[]` and render `DividerRow`**

In `components/terminal/TerminalOutput.tsx`:

**Add the import for `TerminalLine`** at the top:

```ts
import type { TerminalLine } from '@/hooks/useTerminalStream'
```

**Add the `DividerRow` component** after the `LINE_STYLE` constant and before `LineRowProps`:

```ts
const DividerRow = memo(({ text }: { text: string }) => (
  <View style={styles.dividerRow}>
    <Text style={styles.dividerLabel}>YOU</Text>
    <Text style={styles.dividerText} numberOfLines={1}>{text}</Text>
  </View>
))
```

**Update the `Props` interface:**

```ts
interface Props {
  lines: TerminalLine[]   // was: string[]
  isStreaming: boolean
}
```

**Update `renderItem` to branch on divider entries:**

```ts
const renderItem = useCallback(({ item, index }: { item: TerminalLine; index: number }) => {
  if (typeof item !== 'string' && item.__divider) {
    return <DividerRow text={item.text} />
  }
  return <LineRow line={item as string} index={index} />
}, [])
```

**Update `keyExtractor`** to distinguish divider keys:

```ts
keyExtractor={(item, i) =>
  typeof item !== 'string' && (item as { __divider: boolean }).__divider
    ? `d-${i}`
    : String(i)
}
```

**Add styles for `DividerRow`** to the `StyleSheet.create` call:

```ts
dividerRow: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
  paddingHorizontal: 8,
  paddingVertical: 5,
  backgroundColor: 'rgba(31, 111, 235, 0.10)',
  borderLeftWidth: 3,
  borderLeftColor: '#58a6ff',
  marginVertical: 2,
},
dividerLabel: {
  color: '#58a6ff',
  fontSize: 10,
  fontWeight: '700',
  fontFamily: 'monospace',
  letterSpacing: 0.6,
},
dividerText: {
  color: '#cdd9e5',
  fontSize: 12,
  fontFamily: 'monospace',
  flex: 1,
},
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx jest --ci --testPathPattern='TerminalOutput' --forceExit
```

Expected: PASS — all existing tests plus 3 new divider tests green

- [ ] **Step 5: Commit**

```bash
git add components/terminal/TerminalOutput.tsx __tests__/integration/components/TerminalOutput.test.tsx
git commit -m "feat: add DividerRow to TerminalOutput for turn separation"
```

---

### Task 3: Wire `recordSentInput` in the session screen

**Files:**
- Modify: `app/session/[id].tsx`

- [ ] **Step 1: Destructure `recordSentInput` from the hook**

In `app/session/[id].tsx`, find the line:

```ts
const { lines, isStreaming, isLoadingHistory } = useTerminalStream(serverId, id, skipLiveStream)
```

Update it to:

```ts
const { lines, isStreaming, isLoadingHistory, recordSentInput } = useTerminalStream(serverId, id, skipLiveStream)
```

- [ ] **Step 2: Call `recordSentInput` after each send**

There are three places where `sendInput.mutate(payload, ...)` is called. Update all three:

**In `handleSendInput`** (user hits send button or return key):

```ts
const handleSendInput = () => {
  const payload = buildPayload()
  if (!payload) return
  if (wsManager.getClient(serverId)?.status() !== 'connected') {
    Alert.alert('Not connected', 'Waiting for connection — try again in a moment.')
    return
  }
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
  recordSentInput(payload)   // ← add this line
  sendInput.mutate(payload, {
    onError: (err) =>
      Alert.alert('Send failed', err instanceof Error ? err.message : String(err)),
  })
  resetComposer()
}
```

**In `handleSlashCommandSelect`** (slash command without args):

```ts
Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
recordSentInput(payload)   // ← add this line
sendInput.mutate(payload, {
  onError: (err) =>
    Alert.alert('Send failed', err instanceof Error ? err.message : String(err)),
})
```

**In `handleSlashArgConfirm`** (slash command with args):

```ts
Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
recordSentInput(payload)   // ← add this line
sendInput.mutate(payload, {
  onError: (err) =>
    Alert.alert('Send failed', err instanceof Error ? err.message : String(err)),
})
```

- [ ] **Step 3: Run the full test suite to verify no regressions**

```bash
npx jest --ci --forceExit
```

Expected: PASS — all tests green including the new divider tests

- [ ] **Step 4: Commit**

```bash
git add app/session/[id].tsx
git commit -m "feat: wire recordSentInput in session screen for PTY turn dividers"
```

---

## Done

After Task 3 is complete, every time the user sends input the session screen queues it via `recordSentInput`. Once the PTY stream goes idle (1500ms no output), or just before the next stream starts, a styled `DividerRow` reading `YOU → <text>` is injected into the terminal lines above Claude's response.
