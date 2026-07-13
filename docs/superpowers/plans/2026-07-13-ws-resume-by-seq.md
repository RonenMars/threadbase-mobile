# WS Resume-by-Seq (Item 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Live WS messages carry a real server `message_index` when the streamer supplies one (so the overlay orders correctly and future deltas dedupe cleanly), and an after_index delta whose `etag` changes mid-drain strips the cross-read page and stops the drain — never discarding the cache.

**Architecture:** Additive, back-compatible extension of the delta-sync feature (items 1/2/4/5, already on this branch). A new plural `conversation_events` WS frame is consumed alongside the existing singular `conversation_event`; seqs feed `Message.messageIndex`. The Task 6 drain loop gains a drain-local etag check as its first per-hop gate, reusing the existing first-page strip surgery.

**Tech Stack:** TypeScript, React Native, `@tanstack/react-query`, Jest + `@testing-library/react-native`.

## Global Constraints

- **NO `any`/`unknown` in new code** without explicit approval (project rule). Use concrete types / type guards / generics.
- **Additive + back-compatible:** every new field is optional; old servers and codex sessions must degrade to today's behavior (no error, non-empty overlay).
- **The emission is the contract, not `contracts/mobile.schema.json`.** All server-shape facts below are verified against streamer **1.28.1+e8232bf** (guard rails #199 + offset index #202 + provider hotfixes #205/#206).
- **Feature branch + PR**, conventional-commit titles, NO AI attribution / `Co-Authored-By` (a git hook rejects it). Use `/opt/homebrew/bin/git` (a shell function shadows `git` on this machine).
- **Lint before commit:** `npx eslint <staged .ts/.tsx files>`; fix errors (warnings OK).
- **Do NOT stage** `.serena/project.yml` (pre-existing unrelated MCP artifact) or `docs/superpowers/plans/*.md`.
- **Jest:** if a run hangs use `--runInBand --forceExit`; `pkill -f jest` before re-running to clear stray workers.
- **This stacks on `feat/persistent-cache-delta-sync` (#306).** The Task 6 effect, `deriveCursor`, `stripEmptyFirstPage`, `Message.messageIndex`, and the merge in `LiveConversationView` all already exist from #306.

## Verified server contract (from the spec §2)

- **`conversation_events` (plural) WS frame:** `{ type: "conversation_events"; sessionId: string; lines: string[]; seqs?: (number | null)[] }`. `seqs` is **positional** — `seqs[i]` is the `message_index` of `lines[i]`, or **`null`** for a non-message line. The field is **absent** when the offset index assigned nothing.
- The old singular **`conversation_event`** (no seq) is **still broadcast alongside**, plural FIRST then the per-line singulars.
- **seqs are claude-code-only.** Codex live sessions never carry seqs. Absent seqs are normal, never an error.
- **`message_pagination.etag`** (string) is emitted on **every** after_index delta response (both the first `{ resume }` hop and continuation `{ after }` hops route through the server's `usedAfterIndex` branch). It is a whole-conversation token that changes on **every append** — so it can ONLY detect a file changing between two reads, never validate cursor continuity.

## The load-bearing rule (spec §5) — strip-then-break, never discard

On a mid-drain etag change, **strip the just-prepended mismatched page and break** — never `resetQueries`. The etag buys exactly one guarantee: never merge two hops read across a file change. A false strip costs one hop's re-fetch on the next trigger.

**Per-hop order in the drain loop (spec constraint — the three checks share strip surgery and must not fight). Against the just-prepended page, in this exact order:**
1. **etag mismatch?** → strip + `break`. (The page was read across a file change; do NOT inspect its `total`/emptiness — a cross-read page's fields are meaningless, and letting its `total` reach check 3 could trigger a spurious `resetQueries`. Shrink detection belongs to the NEXT drain's `total <= cursor` gate.)
2. **empty?** → strip + `return` (stop). (Existing empty-200 husk behavior.)
3. **total <= cursor?** → `resetQueries` (discard + refetch). (Existing cursor-invalidation behavior.)
4. **shouldContinueDrain?** → next hop.

---

## File Structure

- **Modify** `services/ws-client.ts` — add the `conversation_events` member to the `WSMessage` union.
- **Modify** `hooks/conversationCursor.ts` — rename `stripEmptyFirstPage` → `stripFirstPage` (it drops `pages[0]`/`pageParams[0]` regardless of *why*; the etag path reuses it, so the empty-specific name now under-describes). Add an `etagOf(page)` helper for reading the delta etag. `isEmptyFirstPage` stays (genuinely empty-specific).
- **Modify** `hooks/useConversations.ts` — add `etag?: string` to `ConversationMessagePagination`; update the `stripEmptyFirstPage` import/call to `stripFirstPage`; insert the drain-local etag check as the FIRST per-hop gate in the Task 6 drain loop.
- **Modify** `hooks/useConversationStream.ts` — extend `parseLineToMessage(line, seq?)` to set `messageIndex`; add the plural `conversation_events` subscription (same `sessionId` filter, shared `seenIds`); keep the singular subscription with a double-parse comment.
- **Test (modify)** `__tests__/unit/hooks/conversationCursor.test.ts` — rename references; add `stripFirstPage`/`etagOf` coverage.
- **Test (modify)** `__tests__/unit/hooks/useConversations.test.tsx` — add drain etag tests (e) strip-then-break and (f) append-across-drains-no-discard.
- **Test (modify)** `__tests__/unit/hooks/useConversationStream.statusRefetch.test.tsx` (or a sibling) — add plural-frame + seq + plural-wins-race + old-server-fallback + codex-absent-seqs tests.
- **No change** to `components/conversation/LiveConversationView.tsx` (spec §4).

---

## Task 1: Rename `stripEmptyFirstPage` → `stripFirstPage`; add `etag?` type + `etagOf`

Prepare the shared helpers before wiring the drain check. The rename makes the strip helper reusable by the etag path without a second copy; `etagOf` centralizes reading the delta token; the additive `etag?: string` on the pagination type is what `etagOf` reads.

**Files:**
- Modify: `hooks/conversationCursor.ts`
- Modify: `hooks/useConversations.ts` (add `etag?` to `ConversationMessagePagination`; rename import + call site)
- Test: `__tests__/unit/hooks/conversationCursor.test.ts`

**Interfaces:**
- Consumes: `RawConversationDetail`, `ConversationPageParam`, `InfiniteData` (existing).
- Produces:
  - `ConversationMessagePagination` gains additive `etag?: string`.
  - `stripFirstPage(data: ConvData): ConvData` — renamed from `stripEmptyFirstPage`; identical body (drops `pages[0]`/`pageParams[0]`). Same signature.
  - `etagOf(page: RawConversationDetail): string | undefined` — returns `page.message_pagination?.etag`. Returns `undefined` when absent.
  - `isEmptyFirstPage` unchanged.

- [ ] **Step 1: Add `etag?: string` to the pagination type**

In `hooks/useConversations.ts`, in `interface ConversationMessagePagination` (around line 210-220), add the field so `etagOf` and the drain gate can read it:

```typescript
export interface ConversationMessagePagination {
  total: number
  before_index: number
  from_index: number
  has_more_older: boolean
  next_before_index: number | null
  // Present only on anchored/after windows (newer streamers).
  anchor_index?: number
  has_more_newer?: boolean
  next_after_index?: number | null
  // After_index delta-validity token (streamer #202). Whole-conversation etag —
  // changes on every append, so it detects a file changing between reads, not
  // cursor continuity. Read only on after_index responses.
  etag?: string
}
```

- [ ] **Step 2: Update the rename in the test first**

In `__tests__/unit/hooks/conversationCursor.test.ts`, replace every `stripEmptyFirstPage` with `stripFirstPage` (import at line 5, the `describe` title at line 45, and the call at line 52). Also add an `etagOf` test block:

```typescript
import {
  deriveCursor,
  isEmptyFirstPage,
  stripFirstPage,
  etagOf,
  shouldContinueDrain,
  isCursorValid,
  canTrigger,
  stampTrigger,
  __resetTriggerGuardForTests,
  type ConversationPageParam,
} from '@/hooks/conversationCursor'
```

Rename the existing describe/call:
```typescript
describe('isEmptyFirstPage / stripFirstPage', () => {
  it('detects an empty first page', () => {
    expect(isEmptyFirstPage(infinite([page([])], [{ resume: 82 }]))).toBe(true)
    expect(isEmptyFirstPage(infinite([page([83])], [{ resume: 82 }]))).toBe(false)
  })
  it('strips pages[0] and pageParams[0]', () => {
    const data = infinite([page([]), page([80])], [{ resume: 82 }, -1])
    const out = stripFirstPage(data)
    expect(out.pages).toHaveLength(1)
    expect(out.pageParams).toEqual([-1])
    expect(data.pages).toHaveLength(2) // original untouched (pure)
  })
})

describe('etagOf', () => {
  it('returns the page etag when present', () => {
    expect(etagOf(page([83], { etag: '"v9"' }))).toBe('"v9"')
  })
  it('returns undefined when absent', () => {
    expect(etagOf(page([83]))).toBeUndefined()
  })
})
```

Note: the existing `page(...)` fixture helper in this file builds a `message_pagination` from a `Partial<RawConversationDetail['message_pagination']>`, so passing `{ etag: '"v9"' }` flows through cleanly now that Step 1 added `etag?` to the type — no cast needed.

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx jest __tests__/unit/hooks/conversationCursor.test.ts`
Expected: FAIL — `stripFirstPage` and `etagOf` are not exported yet.

- [ ] **Step 4: Rename + add `etagOf` in the helper module**

In `hooks/conversationCursor.ts`, rename the function and add `etagOf`:

```typescript
export function stripFirstPage(data: ConvData): ConvData {
  return {
    pages: data.pages.slice(1),
    pageParams: data.pageParams.slice(1),
  }
}

// The after_index delta's whole-conversation etag (present only on after_index
// responses). Changes on every append, so it can only detect a file changing
// between two reads — never validate cursor continuity.
export function etagOf(page: RawConversationDetail): string | undefined {
  return page.message_pagination?.etag
}
```

(Delete the old `stripEmptyFirstPage` definition — the rename replaces it. `isEmptyFirstPage` stays as-is.)

- [ ] **Step 5: Update the call site in `useConversations.ts`**

In `hooks/useConversations.ts`:
- In the import block from `@/hooks/conversationCursor` (around line 12-20), replace `stripEmptyFirstPage` with `stripFirstPage`. Do NOT add `etagOf` here — it's unused until Task 4, and an unused import fails ESLint. Task 4 adds `etagOf` to this import.
- At the drain-loop call site (around line 500), change `stripEmptyFirstPage(data)` to `stripFirstPage(data)`.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx jest __tests__/unit/hooks/conversationCursor.test.ts`
Expected: PASS (all, including the new `etagOf` block).

- [ ] **Step 7: Confirm no stale references + the big suite still green**

Run: `grep -rn "stripEmptyFirstPage" hooks/ __tests__/` → expect NO output.
Run: `npx jest __tests__/unit/hooks/useConversations.test.tsx --runInBand --forceExit`
Expected: PASS (the drain tests still pass — the rename is behavior-preserving).

- [ ] **Step 8: Lint + commit**

```bash
npx eslint hooks/conversationCursor.ts hooks/useConversations.ts __tests__/unit/hooks/conversationCursor.test.ts
/opt/homebrew/bin/git add hooks/conversationCursor.ts hooks/useConversations.ts __tests__/unit/hooks/conversationCursor.test.ts
/opt/homebrew/bin/git commit -m "refactor(conversations): rename stripEmptyFirstPage to stripFirstPage, add etagOf"
```

---

## Task 2: Add `conversation_events` to the `WSMessage` union

Type-only change so the hook (Task 4... actually Task 3) can subscribe to the plural frame. Kept as its own tiny task because it's a shared type other tasks consume.

**Files:**
- Modify: `services/ws-client.ts`

**Interfaces:**
- Produces: `WSMessage` union gains `{ type: 'conversation_events'; sessionId: string; lines: string[]; seqs?: (number | null)[] }`.

- [ ] **Step 1: Add the union member**

In `services/ws-client.ts`, in the `WSMessage` union (the singular `conversation_event` is currently at line 21), add directly below it:

```typescript
  | { type: 'conversation_event'; sessionId: string; line: string }
  // Additive batched variant (streamer #202): one frame carries all lines from
  // a single watcher read. `seqs`, when present, is parallel to `lines` —
  // seqs[i] is the message_index of lines[i], or null for a non-message line.
  // Absent for non-claude providers. Old clients ignore this and rely on the
  // singular conversation_event.
  | { type: 'conversation_events'; sessionId: string; lines: string[]; seqs?: (number | null)[] }
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep "ws-client" || echo "no ws-client type errors"`
Expected: `no ws-client type errors`. (The union is additive; the `onmessage` dispatch keys on `msg.type` and needs no change.)

- [ ] **Step 3: Lint + commit**

```bash
npx eslint services/ws-client.ts
/opt/homebrew/bin/git add services/ws-client.ts
/opt/homebrew/bin/git commit -m "feat(ws): add conversation_events plural frame to WSMessage union"
```

---

## Task 3: Live message indexing — plural subscription + `seq` on parse

Consume the plural frame in `useConversationStream`, mapping `seqs[i]` to `Message.messageIndex`, while keeping the singular subscription for old/codex servers. This is the largest task.

**Files:**
- Modify: `hooks/useConversationStream.ts`
- Test: `__tests__/unit/hooks/useConversationStream.statusRefetch.test.tsx`

**Interfaces:**
- Consumes: `WSMessage` (Task 2), `Message.messageIndex?: number` (existing on `types/api.ts`).
- Produces:
  - `parseLineToMessage(line: string, seq?: number | null): Message | null` — sets `messageIndex: typeof seq === 'number' ? seq : undefined` on the returned message; singular callers pass no `seq`.
  - `useConversationStream` now subscribes to BOTH `conversation_event` and `conversation_events`; both dedupe via the shared `seenIds`.

- [ ] **Step 1: Write the failing tests for seq mapping + both-frames**

Add to `__tests__/unit/hooks/useConversationStream.statusRefetch.test.tsx` a new describe block. First extend the existing `jest.mock('@/services/ws-client', ...)` so the mock's `getClient().on` captures handlers per-type and the `__wsTest` emitter can emit both frame types (the file already mocks per-type handlers — reuse that machinery; if the current mock only supports one handler type, extend it to a `Map<string, Set<Handler>>` keyed by type, and add an `emit(type, msg)` that fires that type's handlers).

```typescript
import type { WSMessage } from '@/services/ws-client'

// A plural conversation_events frame with two message lines, seqs [10, 11].
function pluralFrame(sessionId: string, texts: string[], seqs: (number | null)[]): Extract<WSMessage, { type: 'conversation_events' }> {
  return {
    type: 'conversation_events',
    sessionId,
    lines: texts.map((t, i) => JSON.stringify({ type: 'assistant', uuid: `u${i}`, message: { role: 'assistant', content: [{ type: 'text', text: t }] } })),
    seqs,
  }
}
function singularFrame(sessionId: string, uuid: string, text: string): Extract<WSMessage, { type: 'conversation_event' }> {
  return {
    type: 'conversation_event',
    sessionId,
    line: JSON.stringify({ type: 'assistant', uuid, message: { role: 'assistant', content: [{ type: 'text', text }] } }),
  }
}

describe('useConversationStream — seq indexing (item 3)', () => {
  function setup() {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>
    )
    return renderHook(() => useConversationStream('srv-1', 'sess-1', 'conv-1'), { wrapper })
  }

  it('sets messageIndex from seqs on plural-frame messages; null seq → no index', async () => {
    const { result } = await setup()
    await act(() => __wsTest.emit('conversation_events', pluralFrame('sess-1', ['a', 'b'], [10, null])))
    expect(result.current.liveMessages).toHaveLength(2)
    expect(result.current.liveMessages[0].messageIndex).toBe(10)
    expect(result.current.liveMessages[1].messageIndex).toBeUndefined()
  })

  it('plural wins the race: the seq-carrying copy is kept, the trailing singular (same uuid) dedupes away', async () => {
    const { result } = await setup()
    // Plural first (as the server broadcasts), then the singular for the same uuid.
    await act(() => __wsTest.emit('conversation_events', pluralFrame('sess-1', ['hello'], [7])))
    await act(() => __wsTest.emit('conversation_event', singularFrame('sess-1', 'u0', 'hello')))
    expect(result.current.liveMessages).toHaveLength(1)
    expect(result.current.liveMessages[0].messageIndex).toBe(7)
  })

  it('old server (singular only) → message has no index, overlay is non-empty', async () => {
    const { result } = await setup()
    await act(() => __wsTest.emit('conversation_event', singularFrame('sess-1', 'u9', 'hi')))
    expect(result.current.liveMessages).toHaveLength(1)
    expect(result.current.liveMessages[0].messageIndex).toBeUndefined()
  })

  it('codex (plural frame without seqs field) → messages have no index, no error', async () => {
    const { result } = await setup()
    const frame: Extract<WSMessage, { type: 'conversation_events' }> = {
      type: 'conversation_events',
      sessionId: 'sess-1',
      lines: [JSON.stringify({ type: 'assistant', uuid: 'c0', message: { role: 'assistant', content: [{ type: 'text', text: 'x' }] } })],
    }
    await act(() => __wsTest.emit('conversation_events', frame))
    expect(result.current.liveMessages).toHaveLength(1)
    expect(result.current.liveMessages[0].messageIndex).toBeUndefined()
  })

  it('ignores plural frames for other sessions', async () => {
    const { result } = await setup()
    await act(() => __wsTest.emit('conversation_events', pluralFrame('other-sess', ['a'], [1])))
    expect(result.current.liveMessages).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/unit/hooks/useConversationStream.statusRefetch.test.tsx -t "seq indexing" --runInBand`
Expected: FAIL — no plural subscription; `messageIndex` never set.

- [ ] **Step 3: Extend `parseLineToMessage` with an optional seq**

In `hooks/useConversationStream.ts`, change the signature and set `messageIndex`:

```typescript
function parseLineToMessage(line: string, seq?: number | null): Message | null {
  try {
    // ...existing parse body unchanged, up to the return...
    return {
      id: entry.uuid ?? `${entry.timestamp ?? ''}-${entry.type ?? ''}-${entry.message?.role ?? ''}`,
      uuid: entry.uuid ?? null,
      role: entry.message.role,
      content,
      timestamp: entry.timestamp ?? new Date().toISOString(),
      is_sidechain: entry.isSidechain ?? false,
      parent_uuid: entry.parentUuid ?? null,
      messageIndex: typeof seq === 'number' ? seq : undefined,
    }
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Add the plural subscription (shared seenIds, same sessionId filter, double-parse comment)**

In `useConversationStream`'s effect, alongside the existing `conversation_event` subscription, add a `conversation_events` subscription. Keep the singular one. Both funnel through the same `seenIds` dedup and `setLiveMessages`:

```typescript
    // Singular per-line frame. Old/codex servers send only this. Double-parse
    // with the plural frame below is accepted: on modern servers the plural
    // (seq-carrying) copy arrives first and wins the seenIds race, so the
    // singular dedupes away after parsing. Do NOT drop this subscription to
    // avoid the double-parse — it is the old-server/codex fallback; without it
    // a pre-#202 server leaves the overlay completely empty.
    const unsub = wsManager.getClient(serverId)?.on('conversation_event', (msg) => {
      const evt = msg as { type: 'conversation_event'; sessionId: string; line: string }
      if (evt.sessionId !== sessionId) return
      const message = parseLineToMessage(evt.line)
      if (!message) return
      if (seenIds.current.has(message.id)) return
      seenIds.current.add(message.id)
      setLiveMessages((prev) => [...prev, message])
    })

    // Additive batched frame (streamer #202): carries seqs so live messages get
    // a real message_index. Same sessionId filter as the singular handler.
    const unsubBatch = wsManager.getClient(serverId)?.on('conversation_events', (msg) => {
      const evt = msg as { type: 'conversation_events'; sessionId: string; lines: string[]; seqs?: (number | null)[] }
      if (evt.sessionId !== sessionId) return
      const next: Message[] = []
      for (let i = 0; i < evt.lines.length; i++) {
        const message = parseLineToMessage(evt.lines[i], evt.seqs?.[i] ?? null)
        if (!message) continue
        if (seenIds.current.has(message.id)) continue
        seenIds.current.add(message.id)
        next.push(message)
      }
      if (next.length > 0) setLiveMessages((prev) => [...prev, ...next])
    })
```

Update the cleanup return to unsubscribe both:
```typescript
    const seenIdsRef = seenIds.current
    return () => {
      unsub?.()
      unsubBatch?.()
      setLiveMessages([])
      seenIdsRef.clear()
    }
```

- [ ] **Step 5: Run the seq-indexing tests to verify they pass**

Run: `npx jest __tests__/unit/hooks/useConversationStream.statusRefetch.test.tsx -t "seq indexing" --runInBand`
Expected: PASS (5 tests).

- [ ] **Step 6: Run the full stream + LiveConversationView suites (regression)**

Run: `npx jest __tests__/unit/hooks/useConversationStream.reconnect.test.tsx __tests__/unit/hooks/useConversationStream.statusRefetch.test.tsx __tests__/integration/components/LiveConversationView.test.tsx --runInBand --forceExit`
Expected: PASS — the singular path is byte-for-byte unchanged; the merge already reads `messageIndex`.

- [ ] **Step 7: Lint + commit**

```bash
npx eslint hooks/useConversationStream.ts __tests__/unit/hooks/useConversationStream.statusRefetch.test.tsx
/opt/homebrew/bin/git add hooks/useConversationStream.ts __tests__/unit/hooks/useConversationStream.statusRefetch.test.tsx
/opt/homebrew/bin/git commit -m "feat(conversation): index live messages from conversation_events seqs"
```
(Task 3 touches ONLY `useConversationStream.ts` + its test — the `etag?` type was added in Task 1. Do not stage `useConversations.ts` here; it has no Task 3 change.)

---

## Task 4: Drain-loop etag check — strip-then-break

Insert the drain-local etag check as the FIRST per-hop gate in the Task 6 drain loop. This is the one change to the Task 6 effect.

**Files:**
- Modify: `hooks/useConversations.ts` (drain loop, around lines 487-518)
- Test: `__tests__/unit/hooks/useConversations.test.tsx`

**Interfaces:**
- Consumes: `etagOf` (Task 1), `stripFirstPage` (Task 1), `ConversationMessagePagination.etag` (Task 1).
- Produces: no new exports. The drain loop captures the first hop's etag drain-locally and strips+breaks on a later mismatch.

- [ ] **Step 1: Write the two failing tests**

Add to `__tests__/unit/hooks/useConversations.test.tsx` (the file already has `warmTailCache`, `wrapperWithClient`, `rawAnchoredPage`, `__resetTriggerGuardForTests`, and the ws-client mock from #306's Task 6 tests). A helper to stamp an etag on an anchored (after_index) page:

```typescript
// rawAnchoredPage already spreads an `extra` object into message_pagination,
// so pass { etag } through it.
describe('useConversation — drain etag (item 3)', () => {
  beforeEach(() => __resetTriggerGuardForTests())

  it('(e) strips the mismatched hop and stops — no resetQueries, hop-1 kept, resumable', async () => {
    setActiveServers(['srv_etag'])
    const paths: string[] = []
    // Warm cache ends at index 2 (cursor 2). Two-hop backlog, but hop 2's etag differs.
    handlers.srv_etag = (path) => {
      paths.push(path)
      if (path.includes('after_index=2')) {
        // hop 1: 80 new (3..82), more newer, etag "A".
        return Promise.resolve(rawAnchoredPage('c_et', 3, 80, 243, { has_more_newer: true, next_after_index: 83, etag: '"A"' }))
      }
      // hop 2 (after_index=83): file changed → etag "B".
      return Promise.resolve(rawAnchoredPage('c_et', 83, 80, 243, { has_more_newer: true, next_after_index: 163, etag: '"B"' }))
    }
    metaHandlers.srv_etag = () => Promise.reject(new Error('no tail fetch expected'))
    const { qc, wrapper } = wrapperWithClient()
    const resetSpy = jest.spyOn(qc, 'resetQueries')
    qc.setQueryData(['conversation', 'srv_etag', 'c_et'], warmTailCache('c_et'))

    const { result } = await renderHook(() => useConversation('srv_etag', 'c_et'), { wrapper })

    // Two hops fire, then the drain stops (no 3rd hop for after_index=163).
    await waitFor(() => expect(paths.filter((p) => p.includes('after_index'))).toHaveLength(2))
    // hop-1 (indexes 3..82) stays merged: 3 (warm) + 80 = 83 messages.
    await waitFor(() => expect(result.current.data!.messages.length).toBe(83))
    // The mismatched hop-2 page was STRIPPED — the cache is back to hop-1's page count.
    // warm cache = 1 page; after hop-1 merge = 2 pages; hop-2 prepended then stripped = 2 pages.
    const cached = qc.getQueryData(['conversation', 'srv_etag', 'c_et']) as { pages: unknown[] }
    expect(cached.pages).toHaveLength(2)
    // NEVER discarded.
    expect(resetSpy).not.toHaveBeenCalled()
    // Still resumable: cursor exists (max index 82), so a future trigger can continue.
    expect(result.current.hasNewerPage).toBe(true)
  })

  it('(f) two drains with different etags because messages were appended between them → merge proceeds, NO discard', async () => {
    jest.useFakeTimers()
    setActiveServers(['srv_grow'])
    let hop = 0
    // Each single-hop drain returns a consistent etag within itself, but the two
    // drains differ (append between them). Neither should discard.
    handlers.srv_grow = () => {
      hop += 1
      if (hop === 1) return Promise.resolve(rawAnchoredPage('c_gr', 3, 1, 4, { has_more_newer: false, next_after_index: null, etag: '"A"' }))
      return Promise.resolve(rawAnchoredPage('c_gr', 4, 1, 5, { has_more_newer: false, next_after_index: null, etag: '"B"' }))
    }
    metaHandlers.srv_grow = () => Promise.reject(new Error('no tail fetch'))
    const { qc, wrapper } = wrapperWithClient()
    const resetSpy = jest.spyOn(qc, 'resetQueries')
    qc.setQueryData(['conversation', 'srv_grow', 'c_gr'], warmTailCache('c_gr'))

    const { result } = await renderHook(() => useConversation('srv_grow', 'c_gr'), { wrapper })
    // Drain 1 merges index 3.
    await waitFor(() => expect(result.current.data!.messages.length).toBe(4))

    // Advance past the 5s guard, trigger a second drain (via AppState foreground).
    jest.advanceTimersByTime(6000)
    // Re-trigger: simplest is another mount-equivalent — use the WS/AppState path
    // the file's other tests use. If a captured AppState handler exists, fire it;
    // else re-render. (Match whatever re-trigger mechanism the file's WS-flap /
    // foreground tests already use.)
    // ...fire the second trigger...
    await waitFor(() => expect(result.current.data!.messages.length).toBe(5))
    // Different etag across drains must NOT discard.
    expect(resetSpy).not.toHaveBeenCalled()
    jest.useRealTimers()
  })
})
```

Note for (f): reuse the exact re-trigger mechanism the file's existing "WS flap" / "AppState foreground" tests use (captured `statusListener?.(...)` or the `jest.spyOn(AppState, 'addEventListener')` handler). The point of (f) is only: two drains, different etags, `resetSpy` never called. If wiring a clean second trigger is fiddly, drive it the same way the "fires a fresh delta" test does.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/unit/hooks/useConversations.test.tsx -t "drain etag" --runInBand`
Expected: FAIL — (e) currently drains all 3 hops / merges hop-2 (no etag gate); the strip+stop behavior doesn't exist.

- [ ] **Step 3: Add `etagOf` to the import**

In `hooks/useConversations.ts`, add `etagOf` to the `@/hooks/conversationCursor` value import block (alongside `deriveCursor`, `isEmptyFirstPage`, `stripFirstPage`, `shouldContinueDrain`, `isCursorValid`, `canTrigger`, `stampTrigger`).

- [ ] **Step 4: Insert the etag check as the FIRST per-hop gate**

In the drain loop (around lines 487-518), add a drain-local `drainEtag` captured on the first hop, and check it FIRST each subsequent hop — before the empty and cursor-validity checks. Final loop shape:

```typescript
      let cursor = cursorAtStart
      let drainEtag: string | undefined // captured from the first hop of THIS drain
      // eslint-disable-next-line no-constant-condition
      while (true) {
        if (cancelled) return
        await queryRef.current.fetchPreviousPage({ cancelRefetch: false })
        if (cancelled) return

        const data = queryClient.getQueryData<InfiniteData<RawConversationDetail, ConversationPageParam>>(tailKey)
        if (!data) return
        const firstPage = data.pages[0]

        // (1) etag gate — FIRST. The after_index delta's etag changes on every
        // append, so it can only mean "the file changed between this hop and the
        // drain's first hop." If it differs, this hop was read across the change:
        // strip it (do NOT merge a cross-read page) and stop. NEVER resetQueries —
        // a whole-conversation etag can't tell append from rewrite, so discarding
        // would wipe the 7-day cache on the normal live-streaming path. Shrink
        // detection is the next drain's total<=cursor gate below. Skip inspecting
        // this page's total/emptiness — a cross-read page's fields are meaningless.
        const hopEtag = etagOf(firstPage)
        if (drainEtag === undefined) {
          drainEtag = hopEtag // first hop: record, don't compare
        } else if (hopEtag !== undefined && hopEtag !== drainEtag) {
          queryClient.setQueryData(tailKey, stripFirstPage(data))
          return
        }

        // (2) Empty-200 husk → strip, stop draining.
        if (isEmptyFirstPage(data)) {
          queryClient.setQueryData(tailKey, stripFirstPage(data))
          return
        }

        // (3) Cursor validity: total <= cursor → truncation/rewrite. Discard +
        // refetch tail from -1.
        if (!isCursorValid(firstPage, cursor)) {
          void queryClient.resetQueries({ queryKey: tailKey })
          return
        }

        // (4) Continue?
        if (!shouldContinueDrain(firstPage)) return
        cursor = deriveCursor(data.pages) ?? cursor
      }
```

Rationale for the two-part guard (keep the code EXACTLY as written above — do not "simplify" it to match a shorter description):
- `hopEtag !== undefined` on the compare: if an etag-carrying hop is followed by a hop with no etag (mixed/old response), "absent" is NOT treated as a mismatch — only a present-and-different etag triggers the strip.
- `drainEtag === undefined` on the capture branch: `drainEtag` is set only from an etag-carrying hop. So if the FIRST hop has no etag, `drainEtag` stays `undefined` and the capture branch runs AGAIN on the next hop that DOES carry one — the check **re-captures** at the first etag it sees and is armed from that hop onward. This is intentional and more protective than a first-hop-only capture: a drain whose early hops lacked etags still gets mid-drain protection as soon as etags appear. Do NOT change this to a first-hop-only capture — that would silently weaken the guard.

- [ ] **Step 5: Run the drain etag tests to verify they pass**

Run: `npx jest __tests__/unit/hooks/useConversations.test.tsx -t "drain etag" --runInBand`
Expected: PASS (both (e) and (f)).

- [ ] **Step 6: Run the full conversations suite (regression — the existing drain/empty/cursor tests must still pass)**

Run: `npx jest __tests__/unit/hooks/useConversations.test.tsx --runInBand --forceExit`
Expected: PASS — the etag gate is inert when no etag is present (all pre-#202-style test fixtures omit `etag`), so the existing drain/empty-strip/cursor-invalidation tests are unaffected.

- [ ] **Step 7: Lint + commit**

```bash
npx eslint hooks/useConversations.ts __tests__/unit/hooks/useConversations.test.tsx
/opt/homebrew/bin/git add hooks/useConversations.ts __tests__/unit/hooks/useConversations.test.tsx
/opt/homebrew/bin/git commit -m "feat(conversations): strip-then-break on mid-drain etag change"
```

---

## Task 5: Full-suite verify + typecheck + PR

Final gate.

**Files:** none (verification + PR only).

- [ ] **Step 1: Typecheck the whole project**

Run: `npx tsc --noEmit`
Expected: only the 7 pre-existing errors in untouched files (`app/index.tsx`, `components/conversation/ConversationList.tsx`, `components/sessions/hub/ProjectHubList.tsx`, `components/sessions/tree/TreeSessionsList.tsx` — expo-router `router.push(string)` typing). Zero in files this feature touched. Confirm with: `npx tsc --noEmit 2>&1 | grep -E "ws-client|conversationCursor|useConversationStream|useConversations" || echo "no errors in feature files"`.

- [ ] **Step 2: Full suite in-band**

Run: `npm test -- --runInBand`
Expected: all suites pass (the #306 baseline was 807 passed / 0 failed; this adds ~7 new tests). If a full-suite-load flake appears (RNTL 5000ms timeout under load — seen on #306), re-run once; it should clear.

- [ ] **Step 3: Lint the full changed set**

Run:
```bash
/opt/homebrew/bin/git diff origin/main --name-only --diff-filter=ACMR | grep -E '\.(ts|tsx)$' | xargs npx eslint
```
Expected: no errors (warnings OK).

- [ ] **Step 4: E2E against the live 1.28.1 streamer**

With the local streamer deployed (1.28.1), run the app against a real claude-code conversation with a backlog:
- Confirm `conversation_events` frames arrive with `seqs` (log/inspect), live messages get `messageIndex`.
- Confirm plural-wins-race (no duplicate bubbles).
- Confirm `etag` is present on after_index delta responses (inspect network / add a temporary debug log; remove before commit).
- **Codex degradation (the path the both-frames decision exists for — verify live, nothing else tests it):** open a live **codex** conversation against the 1.28.1 streamer and confirm the overlay populates via the **singular** `conversation_event` path, with **index-less** messages in **arrival order**, and **no errors**. The offset index excludes non-claude providers (#205/#206), so no `seqs` should arrive for this session.

Document the e2e observations in the PR body. This step is manual — if the app can't be driven in this environment, state that and defer e2e to the reviewer with the exact checks above.

- [ ] **Step 5: Push + open PR (stacked on #306)**

```bash
/opt/homebrew/bin/git push -u origin feat/persistent-cache-delta-sync --force-with-lease
```
(The branch was rebased onto latest `origin/main`, so the push needs `--force-with-lease`; #306 is the same branch — this updates it.)

Since Item 3 is stacked on #306 (same branch), it rides in the SAME PR (#306) as additional commits, OR — if the user wants it separate — create a new branch off #306's tip for Item 3 and open a second PR based on #306. **Ask the user which:** same-PR (simplest, since it's the same branch) vs. separate stacked PR. Do not merge.

- [ ] **Step 6: Report** the PR state and the e2e observations; stop (no merge).

---

## Self-Review

**1. Spec coverage:**
- §2 contract (plural frame, positional seqs, singular-alongside, codex-no-seqs, etag-on-after_index) → Task 2 (union), Task 3 (consume + seq map + both frames + codex fallback), Task 3 Step 1 (etag on type). ✓
- §3 consume-both-dedupe → Task 3 Step 5 (both subscriptions, shared `seenIds`, sessionId filter, double-parse comment). ✓
- §4 no LiveConversationView change; cursor never advances from overlay → no task touches `LiveConversationView`; Task 3 only sets `messageIndex` on overlay messages (component never writes to cache, so cursor advance is unaffected). ✓
- §5 strip-then-break, per-hop order, drain-local etag, no cross-drain compare → Task 4 (etag gate FIRST, `stripFirstPage`, `drainEtag` local, `total<=cursor` unchanged). ✓
- §6 files + two minors → Task 3 Step 5 covers both minors (sessionId filter + double-parse comment) explicitly. ✓
- §7 tests (a)-(f) → (a)(c)(d) Task 3 Step 2; (b) Task 3 Step 2 plural-wins-race; (e)(f) Task 4 Step 1. ✓
- Shared strip helper, no duplication → Task 1 (rename, single definition reused). ✓

**2. Placeholder scan:** The (f) test's re-trigger is described by pointing at the file's existing foreground/flap mechanism rather than pasting it verbatim — this is a deliberate "match the existing pattern in this file" instruction, not a TBD, because the exact handle depends on #306's committed test scaffolding which the implementer has in front of them. All other steps show complete code. Acceptable.

**3. Type consistency:**
- `stripFirstPage` (Task 1) used in Task 4. `etagOf` defined Task 1, imported Task 4. ✓
- `parseLineToMessage(line, seq?)` signature (Task 3) — singular caller passes no seq, plural passes `seqs?.[i] ?? null`. ✓
- `ConversationMessagePagination.etag?: string` added in Task 1 Step 1 (paired with `etagOf`, which reads it), consumed by the drain gate in Task 4. No forward reference, no cast needed. ✓
- `WSMessage` `conversation_events` member (Task 2) consumed in Task 3. ✓
