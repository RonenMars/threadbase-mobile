# Persistent Cache + Cursor Delta Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On any conversation open (cold start, foreground resume, or reopening an ended session) the app renders instantly from its 7-day on-device store, then fetches only the messages newer than its last cached cursor — never re-downloading history it already has.

**Architecture:** Extend the existing `useConversation` `useInfiniteQuery` (`hooks/useConversations.ts`) rather than build new fetch machinery. Retention gets a per-root `gcTime` override plus a widened persist `maxAge`. Delta-on-open adds a fourth `{ resume }` page-param shape whose cursor is *derived* from cached pages (`max(message_index)`), triggered by a single consolidated effect inside `useConversation` observing four sources (mount, AppState foreground, WS `connected`, WS `running→not-running`). `useConversationStream` loses all three of its `invalidateQueries` sites and becomes a pure live-overlay hook. The ETag map becomes durable via its own AsyncStorage entry.

**Tech Stack:** TypeScript, React Native, `@tanstack/react-query` `^5.101.2`, `@tanstack/query-async-storage-persister` `^5.100.9`, `@react-native-async-storage/async-storage`, Jest + `@testing-library/react-native`.

## Global Constraints

- **No new heavyweight deps** — extend existing `@tanstack/react-query`, `@tanstack/query-async-storage-persister`, `@react-native-async-storage/async-storage` only.
- **No `any` / `unknown` in new code** without explicit approval (project rule). Use interfaces, type guards, generics. The `ConversationPageParam` union is the type boundary; extend it, don't erase it.
- **Feature branch + PR**, conventional-commit titles, no AI attribution anywhere.
- **Lint before commit:** `npx eslint <staged .ts/.tsx files>`; fix errors (warnings OK).
- **Full test suite** runs `--runInBand` (see `package.json` `"test"`). Per-file runs during TDD are fine; run the full suite before the final commit.
- **This PR ships items 1, 2, 4, 5 only.** Item 3 (WS resume-by-`seq`) is a separate follow-up gated on streamer PR 2. Do **not** add `seq` handling or feed client-guessed indexes into the cache.
- **Comments:** non-trivial-only (project rule). No comment that restates code.
- **No inline multi-branch conditional text in JSX** (project rule) — irrelevant here (no JSX changes), noted for completeness.
- **Server contract facts (verified against tb-streamer):**
  - `after_index` / anchored windows **always return `200`**, never `304`, regardless of `If-None-Match`. Only the plain tail page (`pageParam === -1`) participates in ETag/`If-None-Match`.
  - "Nothing new past the cursor" is a **`200` with `messages: []`**, not a `304`.
  - `msg_limit=80` bounds each `after_index` page; a backlog larger than 80 needs a drain loop.
  - `message_pagination.total` is the overall message count; `message_index` is **0-based** (a message at index N exists iff `total >= N + 1`).

---

## Key existing facts (read before you touch code)

- `hooks/useConversations.ts` **already has a forward-cursor lane**: `ConversationPageParam = number | { after: number }`, a `getPreviousPageParam` that returns `{ after: next_after_index }` for anchored pages, and `fetchNewerPage`/`hasNewerPage`/`isFetchingNewerPage` aliases (`query.fetchPreviousPage`/`hasPreviousPage`/`isFetchingPreviousPage`). It is reachable **only** from an anchored first page today. This plan extends that lane to the tail view.
- `useConversation(serverId, id, opts?)` builds `queryKey` = `['conversation', serverId, id]` for the tail, or `['conversation', serverId, id, 'anchor-${anchorIndex}']` when `opts.anchorIndex != null` (`useConversations.ts:347-350`).
- The tail-page fetch uses `api.getWithMeta` with `If-None-Match` and handles `304` (`useConversations.ts:391-415`). The `{ after }` branch uses plain `api.get` (`:359-364`).
- `firstPageEtags = new Map<string, string>()` is module-level, keyed `${serverId}::${id}` (`useConversations.ts:334`), in-memory only.
- `services/query-client.ts`: `QUERY_GC_TIME = 5 min` (`:9`), global `staleTime: 0` + `gcTime: QUERY_GC_TIME` + `refetchOnReconnect: true` defaults (`:41-43`). `refetchOnWindowFocus` is unset (RQ default `true`); `refetchOnMount` unset (default `true`).
- `app/_layout.tsx:347`: `PersistQueryClientProvider` `maxAge: 1000 * 60 * 60 * 24` (24h). This is the outer ceiling on the whole persisted snapshot — 7-day `gcTime` is inert unless this moves too.
- `services/ws-client.ts`: `wsManager.onAnyStatusChange((serverId, status) => …)` fires `'connecting' | 'connected' | 'disconnected'` for all present+future clients; `wsManager.getClient(serverId)?.on('session_update', …)` gives per-server session updates. `Session['status']` includes `'running'`, `'idle'`, `'waiting_input'`, etc. A `running → not-running` transition = previous status was `'running'` and new status is anything else.
- `components/conversation/LiveConversationView.tsx:85` mounts `useConversationStream`; `:81` mounts `useConversation`. They are **separate hook instances** — `useConversationStream` cannot reach the other's `fetchPreviousPage`. That is why all triggering must move into `useConversation`.
- `app/conversation/[id].tsx:512-519`: the scroll handler already calls `fetchNewerPage()` when `nearBottom && !nearTop && hasNewerPage && !isFetchingNewerPage`. Once `hasNewerPage` is permanently `true` on the tail view, this becomes an uncoordinated second caller — must be gated to anchored views.
- Jest already mocks `@react-native-async-storage/async-storage` (`jest.setup.js:99-110`): `getItem→null`, `setItem→undefined`, etc. `services/` and `hooks/` are already in `scripts/git-hooks/ci-paths.txt` — **no ci-paths change needed** for the new store module.

---

## File Structure

- **Create** `services/etag-store.ts` — durable ETag map backed by a dedicated AsyncStorage key (`threadbase-etag-cache-v1`). Hydrates once at module init, debounced write-back on set/delete. Owns the `Map` that `useConversations.ts` currently declares inline.
- **Create** `hooks/conversationCursor.ts` — pure helpers with no React/RQ imports: derive cursor from cached pages, detect empty first page, strip the empty husk, decide drain continuation, and the module-level per-`queryKey` trigger guard. Keeping these pure makes them unit-testable without rendering and keeps `useConversations.ts` focused.
- **Modify** `hooks/useConversations.ts` — the bulk of the work: `{ resume }` page-param, `getPreviousPageParam` fallback branch, `queryFn` `{ resume }` branch, per-root `gcTime`, `staleTime: 15_000`, `refetchOnMount/WindowFocus/Reconnect: false`, the consolidated trigger effect (mount + AppState + WS observer) with drain loop + strip + cursor-validity, and swap the inline ETag map for `services/etag-store.ts`.
- **Modify** `hooks/useConversationStream.ts` — remove all three `invalidateQueries` sites (`:72`, `:90`, `:102`) and the now-unused `useQueryClient`; keep only live-overlay parsing.
- **Modify** `services/query-client.ts` — export `SEVEN_DAYS` constant.
- **Modify** `app/_layout.tsx:347` — `maxAge` 24h → 7 days.
- **Modify** `app/conversation/[id].tsx:512-519` — gate the scroll `fetchNewerPage()` branch to `anchorIndex != null`.
- **Modify** `components/conversation/LiveConversationView.tsx:87-116` — establish the `(message_index, uuid)`-aware merge-key contract (uuid stays primary; index-less live messages never persist).
- **Test (extend)** `__tests__/unit/hooks/useConversations.test.tsx` — all delta-trigger, cursor, drain, guard, WS-status coverage.
- **Test (create)** `__tests__/unit/services/etag-store.test.ts` — hydrate/write round-trip.
- **Test (create)** `__tests__/unit/hooks/conversationCursor.test.ts` — pure-helper coverage.
- **Test (shrink)** `__tests__/unit/hooks/useConversationStream.reconnect.test.tsx`, `useConversationStream.statusRefetch.test.tsx` — assert `useConversationStream` no longer touches the conversation query cache.
- **Test (extend)** `__tests__/integration/components/LiveConversationView.test.tsx` — merge-key contract.

---

## Task 1: Durable ETag store

Move `firstPageEtags` out of `useConversations.ts` into a dedicated module backed by AsyncStorage. Same `Map` semantics for callers; adds hydrate-on-init and debounced persistence.

**Files:**
- Create: `services/etag-store.ts`
- Test: `__tests__/unit/services/etag-store.test.ts`

**Interfaces:**
- Consumes: `@react-native-async-storage/async-storage` default export (`getItem`, `setItem`).
- Produces:
  - `getEtag(key: string): string | undefined`
  - `setEtag(key: string, etag: string): void`
  - `deleteEtag(key: string): void`
  - `hydrateEtags(): Promise<void>` (idempotent; awaited by tests, fire-and-forget at module load)
  - `__resetEtagStoreForTests(): void` (clears the in-memory map + pending write; test-only)
  - Keys are the existing `${serverId}::${id}` strings. Storage key constant: `ETAG_STORAGE_KEY = 'threadbase-etag-cache-v1'`.

- [x] **Step 1: Write the failing test**

Create `__tests__/unit/services/etag-store.test.ts`:

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  getEtag,
  setEtag,
  deleteEtag,
  hydrateEtags,
  ETAG_STORAGE_KEY,
  __resetEtagStoreForTests,
} from '@/services/etag-store'

const mockGetItem = AsyncStorage.getItem as jest.Mock
const mockSetItem = AsyncStorage.setItem as jest.Mock

beforeEach(() => {
  jest.useFakeTimers()
  mockGetItem.mockReset().mockResolvedValue(null)
  mockSetItem.mockReset().mockResolvedValue(undefined)
  __resetEtagStoreForTests()
})

afterEach(() => {
  jest.runOnlyPendingTimers()
  jest.useRealTimers()
})

describe('etag-store', () => {
  it('hydrates the map from AsyncStorage on init', async () => {
    mockGetItem.mockResolvedValue(JSON.stringify({ 'srv::c1': '"v9"' }))
    await hydrateEtags()
    expect(mockGetItem).toHaveBeenCalledWith(ETAG_STORAGE_KEY)
    expect(getEtag('srv::c1')).toBe('"v9"')
  })

  it('treats corrupt stored JSON as an empty map (graceful)', async () => {
    mockGetItem.mockResolvedValue('{not json')
    await hydrateEtags()
    expect(getEtag('srv::c1')).toBeUndefined()
  })

  it('debounces a write after set, persisting the serialized map', async () => {
    setEtag('srv::c1', '"v1"')
    setEtag('srv::c2', '"v2"')
    expect(mockSetItem).not.toHaveBeenCalled() // debounced, not yet flushed
    jest.advanceTimersByTime(1000)
    expect(mockSetItem).toHaveBeenCalledTimes(1)
    const [key, payload] = mockSetItem.mock.calls[0]
    expect(key).toBe(ETAG_STORAGE_KEY)
    expect(JSON.parse(payload)).toEqual({ 'srv::c1': '"v1"', 'srv::c2': '"v2"' })
  })

  it('debounces a write after delete', async () => {
    setEtag('srv::c1', '"v1"')
    jest.advanceTimersByTime(1000)
    mockSetItem.mockClear()
    deleteEtag('srv::c1')
    jest.advanceTimersByTime(1000)
    expect(mockSetItem).toHaveBeenCalledTimes(1)
    expect(JSON.parse(mockSetItem.mock.calls[0][1])).toEqual({})
  })
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/unit/services/etag-store.test.ts`
Expected: FAIL — `Cannot find module '@/services/etag-store'`.

- [x] **Step 3: Write minimal implementation**

Create `services/etag-store.ts`:

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage'

export const ETAG_STORAGE_KEY = 'threadbase-etag-cache-v1'
const WRITE_DEBOUNCE_MS = 1000

// First-page ETags, keyed `${serverId}::${id}`. Durable across launches via a
// dedicated AsyncStorage entry — kept separate from the RQ persist cycle
// because a per-conversation validator string isn't a message-payload concern
// and shouldn't inherit persistBuster/maxAge semantics.
const etags = new Map<string, string>()
let writeTimer: ReturnType<typeof setTimeout> | null = null

function scheduleWrite(): void {
  if (writeTimer) clearTimeout(writeTimer)
  writeTimer = setTimeout(() => {
    writeTimer = null
    const obj: Record<string, string> = {}
    for (const [k, v] of etags) obj[k] = v
    void AsyncStorage.setItem(ETAG_STORAGE_KEY, JSON.stringify(obj))
  }, WRITE_DEBOUNCE_MS)
}

export async function hydrateEtags(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(ETAG_STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as Record<string, string>
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === 'string') etags.set(k, v)
    }
  } catch {
    // Corrupt/missing → treat as no known ETags (graceful degradation).
  }
}

export function getEtag(key: string): string | undefined {
  return etags.get(key)
}

export function setEtag(key: string, etag: string): void {
  etags.set(key, etag)
  scheduleWrite()
}

export function deleteEtag(key: string): void {
  etags.delete(key)
  scheduleWrite()
}

export function __resetEtagStoreForTests(): void {
  etags.clear()
  if (writeTimer) {
    clearTimeout(writeTimer)
    writeTimer = null
  }
}

// Fire-and-forget hydration at module load. A tail fetch that races this read
// simply sees no known ETag and sends no If-None-Match (benign — gets 200).
void hydrateEtags()
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/unit/services/etag-store.test.ts`
Expected: PASS (4 tests).

- [x] **Step 5: Rewire `useConversations.ts` to use the store**

In `hooks/useConversations.ts`:
- Delete the inline `firstPageEtags` map and its comment block (`:328-334`).
- Add import at top: `import { getEtag, setEtag, deleteEtag } from '@/services/etag-store'`.
- In the tail-page `queryFn` branch, replace the three call sites:
  - `const knownEtag = firstPageEtags.get(etagKey)` → `const knownEtag = getEtag(etagKey)`
  - `if (res.etag) firstPageEtags.set(etagKey, res.etag)` → `if (res.etag) setEtag(etagKey, res.etag)`
  - `else firstPageEtags.delete(etagKey)` → `else deleteEtag(etagKey)`

- [x] **Step 6: Run the ETag conditional-fetch suite to confirm no regression**

Run: `npx jest __tests__/unit/hooks/useConversations.test.tsx -t "ETag conditional fetch"`
Expected: PASS (4 tests) — behavior is unchanged; the map just moved.

- [x] **Step 7: Lint + commit**

```bash
npx eslint services/etag-store.ts hooks/useConversations.ts __tests__/unit/services/etag-store.test.ts
git add services/etag-store.ts hooks/useConversations.ts __tests__/unit/services/etag-store.test.ts
git commit -m "feat(conversations): make first-page ETag map durable via AsyncStorage"
```

---

## Task 2: Cursor + drain + guard pure helpers

Extract the non-React logic — deriving the cursor, detecting/stripping the empty husk, deciding drain continuation, validity check, and the per-`queryKey` trigger guard — into pure functions. This makes the tricky logic unit-testable without rendering and keeps the hook effect readable.

**Files:**
- Create: `hooks/conversationCursor.ts`
- Test: `__tests__/unit/hooks/conversationCursor.test.ts`

**Interfaces:**
- Consumes: `RawConversationDetail`, `ConversationMessagePagination` (both exported from `useConversations.ts` — export `RawConversationDetail` as part of this task if not already; it is currently a private interface, so **add `export`** to `interface RawConversationDetail` at `useConversations.ts:210`). Import it **type-only** — `import type { RawConversationDetail } from '@/hooks/useConversations'` — never a bare `import { … }`: Metro/Babel is file-by-file and would preserve a bare import as a runtime value edge, reintroducing the `useConversations ⇄ conversationCursor` cycle. `import type` is erased, so the only runtime edge stays one-way. `InfiniteData` from `@tanstack/react-query`.
- Produces:
  - `deriveCursor(pages: RawConversationDetail[] | undefined): number | undefined` — `max(message_index)` over all pages' messages; `undefined` if no pages or no indexed messages. **Takes the raw pages array**, not the `InfiniteData` wrapper, so both `getPreviousPageParam` (via its `allPages` arg) and the trigger effect (via `query.data.pages`) call this one function — no second inline copy.
  - `isEmptyFirstPage(data): boolean` — true iff `pages[0].messages.length === 0`.
  - `stripEmptyFirstPage(data): InfiniteData<RawConversationDetail, ConversationPageParam>` — returns a new `InfiniteData` with `pages[0]` and `pageParams[0]` dropped (pure; caller passes the result to `setQueryData`).
  - `shouldContinueDrain(page: RawConversationDetail): boolean` — true iff `page.messages.length > 0 && page.message_pagination?.has_more_newer === true`.
  - `isCursorValid(page: RawConversationDetail, cursor: number): boolean` — false iff `page.message_pagination.total <= cursor` (0-based; `<=` intended).
  - Guard: `canTrigger(queryKeyHash: string, now: number, windowMs?: number): boolean` and `stampTrigger(queryKeyHash: string, now: number): void`, backed by a module-level `Map<string, number>`. Default `windowMs = 5000`. Plus `__resetTriggerGuardForTests(): void`.
  - Re-export the page-param type: `export type ConversationPageParam = number | { after: number } | { resume: number }` — **moved here** so both files share one definition. `useConversations.ts` imports it from this module.

- [x] **Step 1: Write the failing test**

Create `__tests__/unit/hooks/conversationCursor.test.ts`:

```typescript
import type { InfiniteData } from '@tanstack/react-query'
import {
  deriveCursor,
  isEmptyFirstPage,
  stripEmptyFirstPage,
  shouldContinueDrain,
  isCursorValid,
  canTrigger,
  stampTrigger,
  __resetTriggerGuardForTests,
  type ConversationPageParam,
} from '@/hooks/conversationCursor'
import type { RawConversationDetail } from '@/hooks/useConversations'

function page(indexes: number[], pag?: Partial<RawConversationDetail['message_pagination']>): RawConversationDetail {
  return {
    meta: { id: 'c1' },
    messages: indexes.map((i) => ({ message_index: i, role: 'user', timestamp: '', text: `m${i}` })),
    message_pagination: {
      total: indexes.length ? Math.max(...indexes) + 1 : 0,
      before_index: 0,
      from_index: 0,
      has_more_older: false,
      next_before_index: null,
      ...pag,
    },
  } as RawConversationDetail
}

function infinite(pages: RawConversationDetail[], params: ConversationPageParam[]): InfiniteData<RawConversationDetail, ConversationPageParam> {
  return { pages, pageParams: params }
}

describe('deriveCursor', () => {
  it('returns undefined for empty/undefined pages', () => {
    expect(deriveCursor(undefined)).toBeUndefined()
    expect(deriveCursor([])).toBeUndefined()
  })
  it('returns max message_index across all pages', () => {
    // Pages are newest-chunk-first; page 0 has the highest indexes.
    expect(deriveCursor([page([80, 81, 82]), page([0, 1, 2])])).toBe(82)
  })
})

describe('isEmptyFirstPage / stripEmptyFirstPage', () => {
  it('detects an empty first page', () => {
    expect(isEmptyFirstPage(infinite([page([])], [{ resume: 82 }]))).toBe(true)
    expect(isEmptyFirstPage(infinite([page([83])], [{ resume: 82 }]))).toBe(false)
  })
  it('strips pages[0] and pageParams[0]', () => {
    const data = infinite([page([]), page([80])], [{ resume: 82 }, -1])
    const out = stripEmptyFirstPage(data)
    expect(out.pages).toHaveLength(1)
    expect(out.pageParams).toEqual([-1])
    expect(data.pages).toHaveLength(2) // original untouched (pure)
  })
})

describe('shouldContinueDrain', () => {
  it('continues on a non-empty page with has_more_newer', () => {
    expect(shouldContinueDrain(page([83, 84], { has_more_newer: true }))).toBe(true)
  })
  it('stops on has_more_newer false', () => {
    expect(shouldContinueDrain(page([83], { has_more_newer: false }))).toBe(false)
  })
  it('stops on an empty page even if has_more_newer is true', () => {
    expect(shouldContinueDrain(page([], { has_more_newer: true }))).toBe(false)
  })
})

describe('isCursorValid', () => {
  it('valid when total > cursor', () => {
    expect(isCursorValid(page([83], { total: 84 }), 82)).toBe(true)
  })
  it('invalid when total === cursor (0-based boundary)', () => {
    expect(isCursorValid(page([], { total: 82 }), 82)).toBe(false)
  })
  it('invalid when total < cursor (truncation)', () => {
    expect(isCursorValid(page([], { total: 50 }), 82)).toBe(false)
  })
})

describe('trigger guard', () => {
  beforeEach(() => __resetTriggerGuardForTests())
  it('allows the first trigger and blocks a second within the window', () => {
    expect(canTrigger('k', 1000)).toBe(true)
    stampTrigger('k', 1000)
    expect(canTrigger('k', 1000 + 4999)).toBe(false)
    expect(canTrigger('k', 1000 + 5001)).toBe(true)
  })
  it('keys are independent', () => {
    stampTrigger('a', 1000)
    expect(canTrigger('b', 1000)).toBe(true)
  })
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/unit/hooks/conversationCursor.test.ts`
Expected: FAIL — `Cannot find module '@/hooks/conversationCursor'`.

- [x] **Step 3: Write minimal implementation**

First, in `hooks/useConversations.ts`, add `export` to the `RawConversationDetail` interface (`:210`):
```typescript
export interface RawConversationDetail {
```

Then create `hooks/conversationCursor.ts`:

```typescript
import type { InfiniteData } from '@tanstack/react-query'
// MUST be `import type`: Metro/Babel transpiles file-by-file with no cross-file
// type analysis, so a bare `import { RawConversationDetail }` is preserved as a
// runtime value import — reintroducing the useConversations ⇄ conversationCursor
// cycle. `import type` is erased by Babel, keeping the only runtime edge
// one-way (useConversations → conversationCursor).
import type { RawConversationDetail } from '@/hooks/useConversations'

// -1 = tail first page; number = before_index (older); { after } = anchored
// newer cursor; { resume } = tail delta-on-open cursor.
export type ConversationPageParam = number | { after: number } | { resume: number }

type ConvData = InfiniteData<RawConversationDetail, ConversationPageParam>

// Takes the raw pages array (not the InfiniteData wrapper) so it is the single
// source of cursor derivation for BOTH callers: getPreviousPageParam passes its
// `allPages` argument, and the trigger effect passes `query.data.pages`. One
// function, no drift.
export function deriveCursor(pages: RawConversationDetail[] | undefined): number | undefined {
  if (!pages?.length) return undefined
  let max = -1
  for (const p of pages) {
    for (const m of p.messages ?? []) {
      if (typeof m.message_index === 'number' && m.message_index > max) max = m.message_index
    }
  }
  return max >= 0 ? max : undefined
}

export function isEmptyFirstPage(data: ConvData | undefined): boolean {
  return (data?.pages?.[0]?.messages?.length ?? -1) === 0
}

export function stripEmptyFirstPage(data: ConvData): ConvData {
  return {
    pages: data.pages.slice(1),
    pageParams: data.pageParams.slice(1),
  }
}

export function shouldContinueDrain(page: RawConversationDetail): boolean {
  return (page.messages?.length ?? 0) > 0 && page.message_pagination?.has_more_newer === true
}

// message_index is 0-based: index N exists iff total >= N+1. So total <= cursor
// means the server's history is at or behind our cursor — a truncation/rewrite.
export function isCursorValid(page: RawConversationDetail, cursor: number): boolean {
  const total = page.message_pagination?.total
  if (typeof total !== 'number') return true
  return total > cursor
}

const lastTriggeredAt = new Map<string, number>()
const DEFAULT_WINDOW_MS = 5000

export function canTrigger(queryKeyHash: string, now: number, windowMs: number = DEFAULT_WINDOW_MS): boolean {
  const last = lastTriggeredAt.get(queryKeyHash)
  return last === undefined || now - last >= windowMs
}

export function stampTrigger(queryKeyHash: string, now: number): void {
  lastTriggeredAt.set(queryKeyHash, now)
}

export function __resetTriggerGuardForTests(): void {
  lastTriggeredAt.clear()
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/unit/hooks/conversationCursor.test.ts`
Expected: PASS.

- [x] **Step 5: Point `useConversations.ts` at the shared page-param type**

In `hooks/useConversations.ts`:
- Delete the local `type ConversationPageParam = number | { after: number }` (`:326`) and its doc comment (`:321-325`).
- Add a **dedicated type-only import** (its own statement, so Metro/Babel erases it even though Task 4/6 will add *value* imports from the same module — keep the two statements separate; a mixed `import { type X, valueY }` is fine for tsc but the separate `import type` is the safe form against file-by-file transpile):
  ```typescript
  import type { ConversationPageParam } from '@/hooks/conversationCursor'
  ```
- The existing `initialPageParam: -1 as ConversationPageParam` and `getPreviousPageParam` return type still compile — the union just gained a `{ resume }` arm that no branch produces *yet* (added in Task 4).

- [x] **Step 6: Run the full conversations suite to confirm the type move is clean**

Run: `npx jest __tests__/unit/hooks/useConversations.test.tsx`
Expected: PASS (all existing tests unchanged).

- [x] **Step 7: Lint + commit**

```bash
npx eslint hooks/conversationCursor.ts hooks/useConversations.ts __tests__/unit/hooks/conversationCursor.test.ts
git add hooks/conversationCursor.ts hooks/useConversations.ts __tests__/unit/hooks/conversationCursor.test.ts
git commit -m "feat(conversations): add cursor/drain/guard pure helpers"
```

---

## Task 3: 7-day retention (item 1)

Persist the plain tail query 7 days; keep anchored windows at 5 min; widen the persist `maxAge` so the per-query `gcTime` isn't capped by the outer ceiling.

**Files:**
- Modify: `services/query-client.ts` (add `SEVEN_DAYS` export)
- Modify: `hooks/useConversations.ts` (branch `gcTime` on `anchorIndex`)
- Modify: `app/_layout.tsx:347` (`maxAge` → 7 days)
- Test: `__tests__/unit/hooks/useConversations.test.tsx`

**Interfaces:**
- Consumes: `QUERY_GC_TIME` (existing), new `SEVEN_DAYS` from `services/query-client.ts`.
- Produces: no new exported functions; the tail query now carries `gcTime: SEVEN_DAYS`, anchored queries `gcTime: QUERY_GC_TIME`.

- [x] **Step 1: Write the failing test**

Add to `__tests__/unit/hooks/useConversations.test.tsx` a new describe block. Use RQ's cache to read the resolved `gcTime` off the query — `renderHook` with `createWrapper` gives a fresh `QueryClient`; read via `queryClient.getQueryCache().find(...)`. Because `createWrapper` hides the client, add a variant wrapper that exposes it:

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

function wrapperWithClient() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  return { qc, wrapper }
}

describe('useConversation — retention gcTime', () => {
  it('gives the plain tail query a 7-day gcTime', async () => {
    setActiveServers(['srv_gc_tail'])
    metaHandlers.srv_gc_tail = () =>
      Promise.resolve({ status: 200, etag: '"v1"', body: rawConversationPage('c_gc', ['x']) })
    const { qc, wrapper } = wrapperWithClient()

    const { result } = await renderHook(() => useConversation('srv_gc_tail', 'c_gc'), { wrapper })
    await waitFor(() => expect(result.current.data).toBeDefined())

    const q = qc.getQueryCache().find({ queryKey: ['conversation', 'srv_gc_tail', 'c_gc'] })
    expect(q?.gcTime).toBe(1000 * 60 * 60 * 24 * 7)
  })

  it('keeps anchored windows at the 5-minute default gcTime', async () => {
    setActiveServers(['srv_gc_anchor'])
    handlers.srv_gc_anchor = () =>
      Promise.resolve(rawAnchoredPage('c_gca', 90, 120, 300, { anchor_index: 150, has_more_newer: true, next_after_index: 210 }))
    const { qc, wrapper } = wrapperWithClient()

    const { result } = await renderHook(
      () => useConversation('srv_gc_anchor', 'c_gca', { anchorIndex: 150 }),
      { wrapper },
    )
    await waitFor(() => expect(result.current.data).toBeDefined())

    const q = qc.getQueryCache().find({ queryKey: ['conversation', 'srv_gc_anchor', 'c_gca', 'anchor-150'] })
    expect(q?.gcTime).toBe(1000 * 60 * 5)
  })
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/unit/hooks/useConversations.test.tsx -t "retention gcTime"`
Expected: FAIL — the tail query's `gcTime` is `QUERY_GC_TIME` (5 min), not 7 days.

- [x] **Step 3: Add the `SEVEN_DAYS` constant**

In `services/query-client.ts`, after `QUERY_GC_TIME` (`:9`):
```typescript
export const QUERY_GC_TIME = ONE_MINUTE * 5
export const SEVEN_DAYS = 1000 * 60 * 60 * 24 * 7
```

- [x] **Step 4: Branch `gcTime` in `useConversation`**

In `hooks/useConversations.ts`:
- Add to the query-client import: `import { QUERY_GC_TIME, SEVEN_DAYS } from '@/services/query-client'`.
- Inside `useConversation`, after computing `queryKey`, add:
```typescript
const conversationGcTime = anchorIndex != null ? QUERY_GC_TIME : SEVEN_DAYS
```
- Add `gcTime: conversationGcTime,` to the `useInfiniteQuery` options object (next to `initialPageParam`).

- [x] **Step 5: Widen the persist ceiling**

In `app/_layout.tsx`, change `:347`:
```typescript
maxAge: 1000 * 60 * 60 * 24 * 7,
```

- [x] **Step 6: Run test to verify it passes**

Run: `npx jest __tests__/unit/hooks/useConversations.test.tsx -t "retention gcTime"`
Expected: PASS (2 tests).

- [x] **Step 7: Lint + commit**

```bash
npx eslint services/query-client.ts hooks/useConversations.ts app/_layout.tsx __tests__/unit/hooks/useConversations.test.tsx
git add services/query-client.ts hooks/useConversations.ts app/_layout.tsx __tests__/unit/hooks/useConversations.test.tsx
git commit -m "feat(conversations): retain tail conversation query for 7 days"
```

---

## Task 4: `{ resume }` page-param — `getPreviousPageParam` + `queryFn`

Teach the query to *produce* a `{ resume }` param on the tail view and to *fetch* the delta when it sees one. No trigger yet (Task 6) — this task only wires the param and the fetch branch, tested by driving `fetchNewerPage()` manually.

**Files:**
- Modify: `hooks/useConversations.ts`
- Test: `__tests__/unit/hooks/useConversations.test.tsx`

**Interfaces:**
- Consumes: `deriveCursor`, `isCursorValid` from `hooks/conversationCursor.ts`; `CONVERSATION_MESSAGE_LIMIT` (existing `= 80`).
- Produces: `getPreviousPageParam` now returns `{ resume: cursor }` for the tail view when a cursor exists and the existing anchored branch returned `undefined`; `queryFn` handles `typeof pageParam === 'object' && 'resume' in pageParam` by fetching `?after_index=<resume>&msg_limit=80` (plain `get`, no `If-None-Match`).

- [x] **Step 1: Write the failing test**

Add to `__tests__/unit/hooks/useConversations.test.tsx`. First a fixture helper for a delta (`after_index`) tail page. Note the existing `rawAnchoredPage` already emits `has_more_newer`/`next_after_index` — reuse it, but assert the resume path.

```typescript
describe('useConversation — { resume } delta on the tail view', () => {
  it('resumes from the derived cursor: after_index GET, plain get (no If-None-Match), merges newer messages', async () => {
    setActiveServers(['srv_resume'])
    const paths: string[] = []
    // Tail first page: messages 0..2, total 3. No has_more_newer field (plain tail).
    metaHandlers.srv_resume = () =>
      Promise.resolve({ status: 200, etag: '"v1"', body: rawConversationPage('c_r', ['a', 'b', 'c']) })
    // after_index=2 delta: two new messages 3,4 out of total 5, no more newer.
    handlers.srv_resume = (path) => {
      paths.push(path)
      return Promise.resolve(
        rawAnchoredPage('c_r', 3, 2, 5, { has_more_newer: false, next_after_index: null }),
      )
    }

    const { result } = await renderHook(() => useConversation('srv_resume', 'c_r'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.data!.messages.length).toBe(3))

    // Cursor = max index = 2 → hasNewerPage true on the tail view now.
    expect(result.current.hasNewerPage).toBe(true)

    await result.current.fetchNewerPage()
    await waitFor(() => expect(result.current.data!.messages.length).toBe(5))

    expect(paths.some((p) => p.includes('after_index=2'))).toBe(true)
    expect(paths.some((p) => p.includes('msg_limit=80'))).toBe(true)
    // Delta path must NOT send If-None-Match (it's a plain get, not getWithMeta).
    const indexes = result.current.data!.messages.map((m) => m.messageIndex)
    expect(indexes).toEqual([0, 1, 2, 3, 4])
  })

  it('does not expose a resume cursor when no messages are cached (fresh install)', async () => {
    setActiveServers(['srv_fresh'])
    metaHandlers.srv_fresh = () =>
      Promise.resolve({ status: 200, etag: '"v1"', body: rawConversationPage('c_f', []) })

    const { result } = await renderHook(() => useConversation('srv_fresh', 'c_f'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.data).toBeDefined())

    // No indexed messages → no cursor → hasNewerPage stays falsy.
    expect(result.current.hasNewerPage).toBeFalsy()
  })
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/unit/hooks/useConversations.test.tsx -t "{ resume } delta"`
Expected: FAIL — `hasNewerPage` is falsy on the tail view (no `{ resume }` branch yet).

- [x] **Step 3: Add the `queryFn` `{ resume }` branch**

In `hooks/useConversations.ts` `queryFn`, extend the object-param branch. The current code (`:359-364`) handles `typeof pageParam === 'object'` as the `{ after }` case. Replace it so it distinguishes `resume` from `after`:

```typescript
      // Newer-direction page. { after } = anchored backfill (msg_limit 120);
      // { resume } = tail delta-on-open (msg_limit 80). Both are plain fetches —
      // after_index/anchored windows always answer 200, never 304, so
      // If-None-Match would be misleading dead code.
      if (typeof pageParam === 'object') {
        const isResume = 'resume' in pageParam
        const cursor = isResume ? pageParam.resume : pageParam.after
        params.set('msg_limit', String(isResume ? CONVERSATION_MESSAGE_LIMIT : CONVERSATION_ANCHORED_LIMIT))
        params.set('after_index', String(cursor))
        return api.get<RawConversationDetail>(
          `/api/conversations/${encodeURIComponent(id)}?${params.toString()}`
        )
      }
```

- [x] **Step 4: Add the `getPreviousPageParam` fallback branch**

In `hooks/useConversations.ts`, replace `getPreviousPageParam` (`:425-429`). The existing anchored branch wins when present; the `{ resume }` fallback fires only for the plain tail view.

`getPreviousPageParam` is called by React Query as `(firstPage, allPages, firstPageParam, allPageParams)`. Its second argument, `allPages`, **is** the cached pages array — the exact input `deriveCursor` now takes. So `getPreviousPageParam` and the Task 6 trigger effect call **the same** `deriveCursor` function (the effect passes `query.data.pages`); there is no second inline copy of the max-index loop and therefore no drift. `query` is not in scope here — but it does not need to be, because `allPages` already carries the pages.

```typescript
    getPreviousPageParam: (first, allPages): ConversationPageParam | undefined => {
      const p = first.message_pagination
      // Anchored/after pages carry has_more_newer — the server already told us
      // exactly where to continue, so this branch always wins when present.
      if (p?.has_more_newer && p.next_after_index != null) {
        return { after: p.next_after_index }
      }
      // Tail-view fallback: the newest cached page is plain REST/tail data with
      // no has_more_newer field. If a cursor exists, offer a { resume } param —
      // recomputed every call (never latched), so each mount/foreground/WS
      // trigger resumes from the current cursor. Anchored windows never reach
      // here. Same deriveCursor the Task 6 effect uses — one source of truth.
      if (anchorIndex != null) return undefined
      const cursor = deriveCursor(allPages)
      return cursor != null ? { resume: cursor } : undefined
    },
```

Add the import to `hooks/useConversations.ts`: a **value** import from the new module (separate from the type-only `ConversationPageParam` import added in Task 2 Step 5):
```typescript
import { deriveCursor } from '@/hooks/conversationCursor'
```
(Task 6 extends this same value import with the trigger/drain/guard helpers. `isCursorValid` is not needed until Task 6 — do not import it here or ESLint's no-unused-vars will fail the commit.)

- [x] **Step 5: Run test to verify it passes**

Run: `npx jest __tests__/unit/hooks/useConversations.test.tsx -t "{ resume } delta"`
Expected: PASS (2 tests).

- [x] **Step 6: Run the anchored-window suite to confirm no regression**

Run: `npx jest __tests__/unit/hooks/useConversations.test.tsx -t "anchored window"`
Expected: PASS — the anchored `{ after }` branch is unchanged; `has_more_newer` still wins.

- [x] **Step 7: Lint + commit**

```bash
npx eslint hooks/useConversations.ts __tests__/unit/hooks/useConversations.test.tsx
git add hooks/useConversations.ts __tests__/unit/hooks/useConversations.test.tsx
git commit -m "feat(conversations): resume tail from derived cursor via after_index"
```

---

## Task 5: Retry hygiene — disable auto-refetch, set staleTime

Stop the durable page chain from replaying on mount/focus/reconnect, and move off `staleTime: 0`. This is a prerequisite for Task 6: without it, the consolidated trigger competes with RQ's automatic full-chain refetch.

**Files:**
- Modify: `hooks/useConversations.ts`
- Test: `__tests__/unit/hooks/useConversations.test.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: the tail/anchored `useInfiniteQuery` now sets `staleTime: 15_000`, `refetchOnMount: false`, `refetchOnWindowFocus: false`, `refetchOnReconnect: false`.

- [x] **Step 1: Write the failing test**

Add to `__tests__/unit/hooks/useConversations.test.tsx`:

```typescript
describe('useConversation — retry hygiene', () => {
  it('does not refetch the page chain on remount within staleTime', async () => {
    setActiveServers(['srv_stale'])
    let getWithMetaCalls = 0
    metaHandlers.srv_stale = () => {
      getWithMetaCalls += 1
      return Promise.resolve({ status: 200, etag: '"v1"', body: rawConversationPage('c_s', ['a']) })
    }
    const { qc, wrapper } = wrapperWithClient()

    const first = await renderHook(() => useConversation('srv_stale', 'c_s'), { wrapper })
    await waitFor(() => expect(first.result.current.data).toBeDefined())
    expect(getWithMetaCalls).toBe(1)

    // Remount against the same client + warm cache: refetchOnMount:false + fresh
    // (staleTime 15s) means no second tail fetch.
    const second = await renderHook(() => useConversation('srv_stale', 'c_s'), { wrapper })
    await waitFor(() => expect(second.result.current.data).toBeDefined())
    expect(getWithMetaCalls).toBe(1)
  })

  it('sets a 15s staleTime and disables the three auto-refetch triggers on the query', async () => {
    setActiveServers(['srv_opts'])
    metaHandlers.srv_opts = () =>
      Promise.resolve({ status: 200, etag: '"v1"', body: rawConversationPage('c_o', ['a']) })
    const { qc, wrapper } = wrapperWithClient()

    const { result } = await renderHook(() => useConversation('srv_opts', 'c_o'), { wrapper })
    await waitFor(() => expect(result.current.data).toBeDefined())

    const q = qc.getQueryCache().find({ queryKey: ['conversation', 'srv_opts', 'c_o'] })
    const opts = q?.options as {
      staleTime?: number
      refetchOnMount?: boolean
      refetchOnWindowFocus?: boolean
      refetchOnReconnect?: boolean
    }
    expect(opts.staleTime).toBe(15_000)
    expect(opts.refetchOnMount).toBe(false)
    expect(opts.refetchOnWindowFocus).toBe(false)
    expect(opts.refetchOnReconnect).toBe(false)
  })
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/unit/hooks/useConversations.test.tsx -t "retry hygiene"`
Expected: FAIL — `staleTime` is 0 (global default) and `refetchOnMount` etc. are undefined/true; the remount test sees `getWithMetaCalls === 2`.

- [x] **Step 3: Add the options**

In `hooks/useConversations.ts` `useInfiniteQuery`, add alongside `gcTime`:
```typescript
    staleTime: 15_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/unit/hooks/useConversations.test.tsx -t "retry hygiene"`
Expected: PASS (2 tests).

- [x] **Step 5: Lint + commit**

```bash
npx eslint hooks/useConversations.ts __tests__/unit/hooks/useConversations.test.tsx
git add hooks/useConversations.ts __tests__/unit/hooks/useConversations.test.tsx
git commit -m "feat(conversations): disable auto-refetch on the durable tail query"
```

---

## Task 6: Consolidated trigger effect (mount + AppState + WS observer) with drain, strip, validity

The load-bearing task. One effect inside `useConversation` fires the delta from four sources, drains multi-page backlogs, strips empty husks, validates the cursor, and shares one module-level guard across concurrent instances.

**Files:**
- Modify: `hooks/useConversations.ts`
- Test: `__tests__/unit/hooks/useConversations.test.tsx`

**Interfaces:**
- Consumes: `deriveCursor`, `isEmptyFirstPage`, `stripEmptyFirstPage`, `shouldContinueDrain`, `isCursorValid`, `canTrigger`, `stampTrigger` from `hooks/conversationCursor.ts`; `AppState` from `react-native`; `wsManager` from `@/services/ws-client` (already imported); `useQueryClient` (already imported).
- Produces: no new exports. `useConversation` gains one `useEffect` that calls `query.fetchPreviousPage({ cancelRefetch: false })` and post-processes via `queryClient.setQueryData` (strip empty husk) / `queryClient.resetQueries` (discard + refetch on cursor invalidation).

**Trigger rules (all four sources funnel through one runner):**
1. Only when `anchorIndex == null` (tail view).
2. Only when a derived cursor exists (`deriveCursor(query.data?.pages) != null`).
3. Only when `canTrigger(queryKeyHash, now)` — 5s module-level guard keyed by `queryKey` hash.
4. Stamp the guard **once at drain start**, before the first fetch — not per drain iteration.
5. Each fetch is `fetchPreviousPage({ cancelRefetch: false })`.
6. After each hop resolves: read the fresh cached data via `queryClient.getQueryData(tailKey)`; if the just-prepended page is empty, strip it (`setQueryData`); if the delta is non-empty, run `isCursorValid` — invalid → `resetQueries` (discard + refetch from `-1` in one call) and abort the drain; valid + `shouldContinueDrain` → loop again.

- [x] **Step 1: Write the failing test — mount trigger fires one delta**

Add to `__tests__/unit/hooks/useConversations.test.tsx`. Seed a warm cache by pre-populating the query client, then mount and assert exactly one `after_index` GET. Use `wrapperWithClient` + `qc.setQueryData` to plant a cached tail page (simulating rehydrate-from-disk):

```typescript
import { AppState } from 'react-native'
import { __resetTriggerGuardForTests } from '@/hooks/conversationCursor'

// A cached tail InfiniteData with messages 0..2 and pageParam -1.
function warmTailCache(id: string) {
  return {
    pages: [rawConversationPage(id, ['a', 'b', 'c'])],
    pageParams: [-1],
  }
}

describe('useConversation — consolidated delta trigger', () => {
  beforeEach(() => __resetTriggerGuardForTests())

  it('fires one after_index delta on mount when a cursor exists in the warm cache', async () => {
    setActiveServers(['srv_mt'])
    const paths: string[] = []
    handlers.srv_mt = (path) => {
      paths.push(path)
      return Promise.resolve(rawAnchoredPage('c_mt', 3, 1, 4, { has_more_newer: false, next_after_index: null }))
    }
    metaHandlers.srv_mt = () => Promise.reject(new Error('tail fetch must not fire — cache is warm'))
    const { qc, wrapper } = wrapperWithClient()
    qc.setQueryData(['conversation', 'srv_mt', 'c_mt'], warmTailCache('c_mt'))

    const { result } = await renderHook(() => useConversation('srv_mt', 'c_mt'), { wrapper })

    await waitFor(() => expect(paths.filter((p) => p.includes('after_index=2'))).toHaveLength(1))
    await waitFor(() => expect(result.current.data!.messages.length).toBe(4))
    // Only the delta fired, never a tail (-1) fetch.
    expect(paths.every((p) => p.includes('after_index'))).toBe(true)
  })
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/unit/hooks/useConversations.test.tsx -t "consolidated delta trigger"`
Expected: FAIL — no trigger effect exists; no `after_index` GET fires on mount.

- [x] **Step 3: Add the trigger effect**

In `hooks/useConversations.ts`, add the `AppState` import and **extend the existing** value import from `@/hooks/conversationCursor` (Task 4 already added `import { deriveCursor } from '@/hooks/conversationCursor'` — grow that same statement, do NOT add a second import of `deriveCursor`; a duplicate binding fails the build). The type-only `import type { ConversationPageParam } from '@/hooks/conversationCursor'` from Task 2 stays a separate statement.

```typescript
import { AppState } from 'react-native'
// Extends the Task 4 import — deriveCursor is already imported; add the rest.
import {
  deriveCursor,
  isEmptyFirstPage,
  stripEmptyFirstPage,
  shouldContinueDrain,
  isCursorValid,
  canTrigger,
  stampTrigger,
} from '@/hooks/conversationCursor'
```

Inside `useConversation`, after the `useInfiniteQuery` call and before `const data = useMemo(...)`, add the effect.

**Dependency-array discipline (load-bearing).** The effect must run **once per mount**, not per render. `queryKey` is a fresh array literal on every render — putting it in the deps array tears the effect down and re-runs it on every render, which (a) resubscribes the WS/AppState listeners constantly, (b) resets the effect-local `prevStatus` to `null` every time so `prev === 'running'` is almost never true and the **session-end trigger silently never fires**, and (c) fires `runDelta()` per render (guard-gated, but any render after the 5s window triggers a spurious delta). So:
- **Do not** put `queryKey` in the deps. Depend only on stable values: `serverId`, `id`, `anchorIndex`, `queryKeyHash` (a stable string), and `queryClient` (stable from `useQueryClient`).
- **Rebuild the key inside the effect** from `serverId`/`id`. The effect only runs for the tail view (anchored is excluded by the early return), so the key is always the plain tail key.
- Use a `queryRef` for the live `query` handle so the listeners read current data without the effect depending on `query` (which changes every render).

```typescript
  const queryKeyHash = JSON.stringify(queryKey)
  const queryRef = useRef(query)
  queryRef.current = query

  useEffect(() => {
    // Delta-on-open lives only on the tail view; anchored windows are
    // navigation artifacts with their own bidirectional pagination.
    if (anchorIndex != null || !serverId || !id) return

    // Rebuild the tail key locally so queryKey (a fresh array each render) never
    // enters the deps array. Only the tail view reaches here, so this is always
    // the plain key.
    const tailKey = ['conversation', serverId, id] as const

    let cancelled = false

    const runDelta = async () => {
      // Re-read the ref (not a captured const) so every call — and every drain
      // iteration below — uses the latest query handle.
      const cursorAtStart = deriveCursor(queryRef.current.data?.pages)
      if (cursorAtStart == null) return // no cached history → nothing to resume from
      const now = Date.now()
      if (!canTrigger(queryKeyHash, now)) return
      stampTrigger(queryKeyHash, now) // stamp once per drain, at the start

      // Drain: sequential after_index hops until has_more_newer is false or an
      // empty page returns. First hop uses the { resume } param from
      // getPreviousPageParam (msg_limit 80); every subsequent hop hits the
      // { after } branch via the page's own has_more_newer/next_after_index and
      // therefore uses msg_limit 120 (CONVERSATION_ANCHORED_LIMIT) — intentional
      // and correct: larger continuation pages mean fewer round-trips; do not
      // "fix" it to 80.
      let cursor = cursorAtStart
      // eslint-disable-next-line no-constant-condition
      while (true) {
        if (cancelled) return
        await queryRef.current.fetchPreviousPage({ cancelRefetch: false })
        if (cancelled) return

        const data = queryClient.getQueryData<InfiniteData<RawConversationDetail, ConversationPageParam>>(tailKey)
        if (!data) return
        const firstPage = data.pages[0]

        // Empty-200: RQ prepended an empty husk — strip it, stop draining.
        if (isEmptyFirstPage(data)) {
          queryClient.setQueryData(tailKey, stripEmptyFirstPage(data))
          return
        }

        // Cursor validity: a truncation/rewrite means our cursor no longer
        // points onto this history. resetQueries discards the cached data AND
        // refetches the active query from initialPageParam (-1) in one call —
        // the purpose-built primitive for discard-and-refetch. (removeQueries
        // alone would leave the refetch to the mounted observer; resetQueries
        // is explicit and self-contained.)
        if (!isCursorValid(firstPage, cursor)) {
          void queryClient.resetQueries({ queryKey: tailKey })
          return
        }

        if (!shouldContinueDrain(firstPage)) return
        // Advance our local cursor to the new max for the next validity check.
        cursor = deriveCursor(data.pages) ?? cursor
      }
    }

    // Mount.
    void runDelta()

    // AppState foreground.
    const appStateSub = AppState.addEventListener('change', (status) => {
      if (status === 'active') void runDelta()
    })

    // WS connected transition (observer, never owner). onAnyStatusChange also
    // covers clients created after mount; filter to this server + connected.
    const unsubStatus = wsManager.onAnyStatusChange((sid, status) => {
      if (sid === serverId && status === 'connected') void runDelta()
    })

    // WS running → not-running transition, per this conversation's session.
    // prevStatus is effect-local and survives because the effect runs once per
    // mount (stable deps) — if queryKey were in the deps this would reset every
    // render and never see a running→not-running edge.
    let prevStatus: string | null = null
    const unsubSession = wsManager.getClient(serverId)?.on('session_update', (msg) => {
      if (msg.type !== 'session_update' || msg.session.id !== id) return
      const prev = prevStatus
      prevStatus = msg.session.status
      if (prev === 'running' && msg.session.status !== 'running') void runDelta()
    })

    return () => {
      cancelled = true
      appStateSub.remove()
      unsubStatus()
      unsubSession?.()
    }
  }, [serverId, id, anchorIndex, queryKeyHash, queryClient])
```

Note: `useRef` and `useEffect` are already imported at `useConversations.ts:1`. `InfiniteData` is imported at `:2`. `wsManager` at `:5`.

- [x] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/unit/hooks/useConversations.test.tsx -t "consolidated delta trigger"`
Expected: PASS. If the mount fetch races the warm-cache read, ensure `qc.setQueryData` runs before `renderHook` (it does in the test).

- [x] **Step 5: Write the drain test**

Add to the same describe block:

```typescript
  it('drains a >80-message backlog across sequential after_index pages, guard stamped once', async () => {
    setActiveServers(['srv_drain'])
    const paths: string[] = []
    // Warm cache ends at index 2 (cursor 2). Backlog: 3 pages.
    handlers.srv_drain = (path) => {
      paths.push(path)
      if (path.includes('after_index=2')) {
        // 80 new (3..82), more newer.
        return Promise.resolve(rawAnchoredPage('c_dr', 3, 80, 243, { has_more_newer: true, next_after_index: 83 }))
      }
      if (path.includes('after_index=83')) {
        return Promise.resolve(rawAnchoredPage('c_dr', 83, 80, 243, { has_more_newer: true, next_after_index: 163 }))
      }
      // after_index=163 → last 80 (163..242), no more.
      return Promise.resolve(rawAnchoredPage('c_dr', 163, 80, 243, { has_more_newer: false, next_after_index: null }))
    }
    metaHandlers.srv_drain = () => Promise.reject(new Error('no tail fetch expected'))
    const { qc, wrapper } = wrapperWithClient()
    qc.setQueryData(['conversation', 'srv_drain', 'c_dr'], warmTailCache('c_dr'))

    const { result } = await renderHook(() => useConversation('srv_drain', 'c_dr'), { wrapper })

    await waitFor(() => expect(result.current.data!.messages.length).toBe(243))
    // Exactly three sequential after_index GETs.
    const afterPaths = paths.filter((p) => p.includes('after_index'))
    expect(afterPaths).toHaveLength(3)
    expect(afterPaths[0]).toContain('after_index=2')
    expect(afterPaths[1]).toContain('after_index=83')
    expect(afterPaths[2]).toContain('after_index=163')
    // Full range 0..242, no gap.
    const indexes = result.current.data!.messages.map((m) => m.messageIndex)
    expect(indexes).toEqual(Array.from({ length: 243 }, (_, i) => i))
  })
```

- [x] **Step 6: Run the drain test**

Run: `npx jest __tests__/unit/hooks/useConversations.test.tsx -t "drains a >80-message backlog"`
Expected: PASS. The guard stamp-once-at-start lets the 2nd and 3rd hops through (they don't re-check `canTrigger`; they're inside the same `runDelta` loop).

- [x] **Step 7: Write the empty-200 strip test**

```typescript
  it('strips the empty husk on an empty-200 delta and stays resumable', async () => {
    setActiveServers(['srv_empty'])
    let deltaCalls = 0
    handlers.srv_empty = () => {
      deltaCalls += 1
      return Promise.resolve(rawAnchoredPage('c_e', 3, 0, 3, { has_more_newer: false, next_after_index: null }))
    }
    metaHandlers.srv_empty = () => Promise.reject(new Error('no tail fetch'))
    const { qc, wrapper } = wrapperWithClient()
    qc.setQueryData(['conversation', 'srv_empty', 'c_e'], warmTailCache('c_e'))

    const { result } = await renderHook(() => useConversation('srv_empty', 'c_e'), { wrapper })

    await waitFor(() => expect(deltaCalls).toBe(1))
    // Empty page stripped → back to the original single cached page.
    await waitFor(() => {
      const data = qc.getQueryData(['conversation', 'srv_empty', 'c_e']) as { pages: unknown[] }
      expect(data.pages).toHaveLength(1)
    })
    expect(result.current.data!.messages.length).toBe(3)
    // Still resumable afterward: hasNewerPage stays true (cursor still exists).
    expect(result.current.hasNewerPage).toBe(true)
  })
```

- [x] **Step 8: Run the empty-200 test**

Run: `npx jest __tests__/unit/hooks/useConversations.test.tsx -t "strips the empty husk"`
Expected: PASS.

- [x] **Step 9: Write the cursor-invalidation test**

```typescript
  it('discards + refetches tail when total <= cursor (truncation), no merge', async () => {
    setActiveServers(['srv_trunc'])
    let tailRefetches = 0
    // Delta reports total=2 while our cursor is 2 → total === cursor → invalid.
    handlers.srv_trunc = () =>
      Promise.resolve(rawAnchoredPage('c_t', 3, 1, 2, { has_more_newer: false, next_after_index: null }))
    metaHandlers.srv_trunc = () => {
      tailRefetches += 1
      return Promise.resolve({ status: 200, etag: '"v2"', body: rawConversationPage('c_t', ['x', 'y']) })
    }
    const { qc, wrapper } = wrapperWithClient()
    qc.setQueryData(['conversation', 'srv_trunc', 'c_t'], warmTailCache('c_t'))

    const { result } = await renderHook(() => useConversation('srv_trunc', 'c_t'), { wrapper })

    // The invalid delta triggers resetQueries → discard + refetch from -1 (getWithMeta).
    await waitFor(() => expect(tailRefetches).toBeGreaterThanOrEqual(1))
    await waitFor(() => expect(result.current.data!.messages.map((m) => m.messageIndex)).toEqual([0, 1]))
  })
```

- [x] **Step 10: Run the invalidation test**

Run: `npx jest __tests__/unit/hooks/useConversations.test.tsx -t "discards \\+ refetches tail"`
Expected: PASS.

- [x] **Step 11: Write the WS-flap guard test**

Drive 5 `connected` transitions inside the 5s window (fake timers) and assert one delta fetch. Uses the existing `wsManager` mock — but the current test file's `wsManager` mock only stubs `onAll`. Extend the mock at the top of the file to also expose `onAnyStatusChange` and `getClient`:

```typescript
// Replace the existing jest.mock('@/services/ws-client', ...) block with one
// that also drives status + session_update, so the trigger effect can subscribe.
let statusListener: ((sid: string, s: string) => void) | null = null
jest.mock('@/services/ws-client', () => ({
  wsManager: {
    onAll: (type: string, handler: (msg: any) => void) => {
      if (type === 'scan_progress') scanProgressHandler = handler
      return () => { if (type === 'scan_progress') scanProgressHandler = null }
    },
    onAnyStatusChange: (l: (sid: string, s: string) => void) => {
      statusListener = l
      return () => { statusListener = null }
    },
    getClient: () => ({ on: () => () => {} }),
  },
}))
```

Then the test:

```typescript
  it('WS flap ×5 within 5s fires at most one delta, zero tail refetches', async () => {
    jest.useFakeTimers()
    setActiveServers(['srv_flap'])
    let deltaCalls = 0
    handlers.srv_flap = () => {
      deltaCalls += 1
      return Promise.resolve(rawAnchoredPage('c_fl', 3, 1, 4, { has_more_newer: false, next_after_index: null }))
    }
    let tailCalls = 0
    metaHandlers.srv_flap = () => { tailCalls += 1; return Promise.reject(new Error('no tail')) }
    const { qc, wrapper } = wrapperWithClient()
    qc.setQueryData(['conversation', 'srv_flap', 'c_fl'], warmTailCache('c_fl'))

    await renderHook(() => useConversation('srv_flap', 'c_fl'), { wrapper })
    // Mount already fired one. Clear it so we measure the flaps in isolation.
    await waitFor(() => expect(deltaCalls).toBe(1))

    for (let i = 0; i < 5; i++) {
      statusListener?.('srv_flap', 'connected')
      jest.advanceTimersByTime(500) // 5 × 500ms = 2.5s, inside the 5s guard
    }
    await waitFor(() => expect(deltaCalls).toBe(1)) // guard held — still just the mount delta
    expect(tailCalls).toBe(0)
    jest.useRealTimers()
  })
```

Note: with fake timers, `Date.now()` advances via `jest.advanceTimersByTime`, so the guard's `now - last` stays under 5000ms across the loop.

- [x] **Step 12: Run the WS-flap test**

Run: `npx jest __tests__/unit/hooks/useConversations.test.tsx -t "WS flap"`
Expected: PASS.

- [x] **Step 12b: Write the AppState foreground + repeat-resume test (spec acceptance criterion 2)**

This is the latch-free proof: background→foreground fires one delta; after an empty-200 clears it, a *second* foreground later must fire a *fresh* delta (proving `getPreviousPageParam` isn't latched shut and the guard is time-based, not one-shot). Capture the `AppState` `change` listener via `jest.spyOn` — RN's `AppState.addEventListener` exists but emits nothing in tests, so we invoke the captured handler directly. Add the import at the top of the test file: `import { AppState } from 'react-native'`.

```typescript
  it('foreground fires one delta; a later foreground after an empty-200 fires a fresh delta (not latched)', async () => {
    jest.useFakeTimers()
    setActiveServers(['srv_fg'])
    // Both foreground deltas return empty-200 (nothing new) — the point is that
    // the SECOND foreground still issues a request, proving no latch.
    let deltaCalls = 0
    handlers.srv_fg = () => {
      deltaCalls += 1
      return Promise.resolve(rawAnchoredPage('c_fg', 3, 0, 3, { has_more_newer: false, next_after_index: null }))
    }
    metaHandlers.srv_fg = () => Promise.reject(new Error('no tail fetch expected'))

    // Capture the AppState 'change' handler the effect registers.
    let appStateHandler: ((s: string) => void) | null = null
    const spy = jest.spyOn(AppState, 'addEventListener').mockImplementation((event, handler) => {
      if (event === 'change') appStateHandler = handler as (s: string) => void
      return { remove: jest.fn() } as never
    })

    const { qc, wrapper } = wrapperWithClient()
    qc.setQueryData(['conversation', 'srv_fg', 'c_fg'], warmTailCache('c_fg'))

    await renderHook(() => useConversation('srv_fg', 'c_fg'), { wrapper })
    // Mount already fired one delta; strip pass leaves the single cached page.
    await waitFor(() => expect(deltaCalls).toBe(1))
    await waitFor(() => {
      const d = qc.getQueryData(['conversation', 'srv_fg', 'c_fg']) as { pages: unknown[] }
      expect(d.pages).toHaveLength(1)
    })

    // First foreground within the 5s guard → blocked (still 1).
    appStateHandler?.('active')
    await waitFor(() => expect(deltaCalls).toBe(1))

    // Advance past the 5s guard, then foreground again → a FRESH delta fires.
    jest.advanceTimersByTime(6000)
    appStateHandler?.('active')
    await waitFor(() => expect(deltaCalls).toBe(2))
    // Still empty-200 → still one cached page, no churn.
    await waitFor(() => {
      const d = qc.getQueryData(['conversation', 'srv_fg', 'c_fg']) as { pages: unknown[] }
      expect(d.pages).toHaveLength(1)
    })

    spy.mockRestore()
    jest.useRealTimers()
  })
```

Note: `jest.advanceTimersByTime(6000)` moves `Date.now()` past the guard's 5s window so `canTrigger` returns true for the second foreground — proving the guard is time-based (re-armable), not a one-shot latch.

- [x] **Step 12c: Run the foreground repeat-resume test**

Run: `npx jest __tests__/unit/hooks/useConversations.test.tsx -t "fires a fresh delta"`
Expected: PASS.

- [x] **Step 13: Write the same-key dedup test**

```typescript
  it('two concurrent consumers of the same key share one in-flight delta', async () => {
    setActiveServers(['srv_dup'])
    let deltaCalls = 0
    handlers.srv_dup = () => {
      deltaCalls += 1
      return Promise.resolve(rawAnchoredPage('c_du', 3, 1, 4, { has_more_newer: false, next_after_index: null }))
    }
    metaHandlers.srv_dup = () => Promise.reject(new Error('no tail'))
    const { qc, wrapper } = wrapperWithClient()
    qc.setQueryData(['conversation', 'srv_dup', 'c_du'], warmTailCache('c_du'))

    // Two hook instances, same key, same client.
    await renderHook(
      () => {
        useConversation('srv_dup', 'c_du')
        useConversation('srv_dup', 'c_du')
      },
      { wrapper },
    )

    await waitFor(() => expect(deltaCalls).toBe(1))
  })
```

- [x] **Step 14: Run the dedup test**

Run: `npx jest __tests__/unit/hooks/useConversations.test.tsx -t "share one in-flight delta"`
Expected: PASS — the module-level guard blocks the second instance's mount trigger; even if it didn't, RQ shares one in-flight `fetchPreviousPage` for the same key.

- [x] **Step 15: Run the whole conversations suite**

Run: `npx jest __tests__/unit/hooks/useConversations.test.tsx`
Expected: PASS (all old + new tests).

- [x] **Step 16: Lint + commit**

```bash
npx eslint hooks/useConversations.ts __tests__/unit/hooks/useConversations.test.tsx
git add hooks/useConversations.ts __tests__/unit/hooks/useConversations.test.tsx
git commit -m "feat(conversations): consolidate delta triggering into useConversation"
```

---

## Task 7: Strip triggering from `useConversationStream`

Remove all three `invalidateQueries` sites; the hook becomes pure live-overlay. The delta trigger now lives in `useConversation` (Task 6), so this is safe.

**Files:**
- Modify: `hooks/useConversationStream.ts`
- Test (shrink): `__tests__/unit/hooks/useConversationStream.reconnect.test.tsx`, `__tests__/unit/hooks/useConversationStream.statusRefetch.test.tsx`

**Interfaces:**
- Consumes: `wsManager` (unchanged usage for `conversation_event`).
- Produces: `useConversationStream(serverId, sessionId, conversationId)` still returns `{ liveMessages }`. It no longer imports `useQueryClient` and no longer calls `invalidateQueries` or subscribes to status/session for cache purposes.

- [x] **Step 1: Rewrite the shrunk reconnect test first (asserts the NEW behavior)**

Replace `__tests__/unit/hooks/useConversationStream.reconnect.test.tsx` body's assertions: the hook must make **zero** query-cache calls. Since it no longer takes `useQueryClient`, spy on the wrapper client's `invalidateQueries` and assert never-called across mount + status change:

```typescript
import React, { type ReactNode } from 'react'
import { renderHook, act } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useConversationStream } from '@/hooks/useConversationStream'

type StatusListener = (serverId: string, s: string) => void

jest.mock('@/services/ws-client', () => {
  const statusListeners = new Set<StatusListener>()
  return {
    wsManager: {
      getClient: () => ({ on: () => () => {} }),
      onAnyStatusChange: (l: StatusListener) => {
        statusListeners.add(l)
        return () => statusListeners.delete(l)
      },
    },
    __wsTest: {
      emitStatus: (sid: string, s: string) => statusListeners.forEach((l) => l(sid, s)),
    },
  }
})

const { __wsTest } = jest.requireMock('@/services/ws-client') as {
  __wsTest: { emitStatus: (sid: string, s: string) => void }
}

describe('useConversationStream — no longer touches the conversation query cache', () => {
  it('never calls invalidateQueries on mount or on WS reconnect', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidateSpy = jest.spyOn(qc, 'invalidateQueries')
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    )
    await renderHook(() => useConversationStream('srv-1', 'sess-1', 'conv-1'), { wrapper })
    expect(invalidateSpy).not.toHaveBeenCalled()

    await act(() => __wsTest.emitStatus('srv-1', 'connected'))
    expect(invalidateSpy).not.toHaveBeenCalled()
  })
})
```

- [x] **Step 2: Run it to verify it fails**

Run: `npx jest __tests__/unit/hooks/useConversationStream.reconnect.test.tsx`
Expected: FAIL — the current hook calls `invalidateQueries` on mount.

- [x] **Step 3: Rewrite `useConversationStream.ts`**

Remove the query-client dependency and all three invalidation sites. Keep the `conversation_event` subscription and `liveMessages` state:

```typescript
// hooks/useConversationStream.ts
import { useEffect, useRef, useState } from 'react'
import { wsManager } from '@/services/ws-client'
import type { Message, MessageContent } from '@/types/api'

function parseLineToMessage(line: string): Message | null {
  // ...unchanged parseLineToMessage body...
}

export function useConversationStream(
  serverId: string,
  sessionId: string | null,
  conversationId: string,
) {
  const [liveMessages, setLiveMessages] = useState<Message[]>([])
  const seenIds = useRef(new Set<string>())

  useEffect(() => {
    if (!serverId || !sessionId) return

    seenIds.current.clear()

    const unsub = wsManager.getClient(serverId)?.on('conversation_event', (msg) => {
      const evt = msg as { type: 'conversation_event'; sessionId: string; line: string }
      if (evt.sessionId !== sessionId) return
      const message = parseLineToMessage(evt.line)
      if (!message) return
      if (seenIds.current.has(message.id)) return
      seenIds.current.add(message.id)
      setLiveMessages((prev) => [...prev, message])
    })

    const seenIdsRef = seenIds.current
    return () => {
      unsub?.()
      setLiveMessages([])
      seenIdsRef.clear()
    }
  }, [serverId, sessionId, conversationId])

  return { liveMessages }
}
```

Notes: `conversationId` stays in the dependency array (a conversation switch resets the overlay). `prevSessionStatus` ref and the `useQueryClient`/`qc` imports are removed — they were only for the deleted invalidation sites. Keep the full `parseLineToMessage` body exactly as it was (lines 7-54 of the original).

- [x] **Step 4: Run the rewritten reconnect test**

Run: `npx jest __tests__/unit/hooks/useConversationStream.reconnect.test.tsx`
Expected: PASS.

- [x] **Step 5: Rewrite the statusRefetch test to assert no-cache-touch**

Replace `__tests__/unit/hooks/useConversationStream.statusRefetch.test.tsx` — the `session_update` running→not-running path no longer invalidates. Assert `invalidateSpy` is never called even across a running→waiting_input transition, and that live messages still flow:

```typescript
import React, { type ReactNode } from 'react'
import { renderHook, act } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useConversationStream } from '@/hooks/useConversationStream'
import type { Session } from '@/types/api'

type Handler = (msg: any) => void

jest.mock('@/services/ws-client', () => {
  const listeners = new Map<string, Set<Handler>>()
  return {
    wsManager: {
      getClient: () => ({
        on: (type: string, handler: Handler) => {
          if (!listeners.has(type)) listeners.set(type, new Set())
          listeners.get(type)!.add(handler)
          return () => listeners.get(type)!.delete(handler)
        },
      }),
      onAnyStatusChange: () => () => {},
    },
    __wsTest: {
      emit: (type: string, msg: any) => listeners.get(type)?.forEach((l) => l(msg)),
    },
  }
})

const { __wsTest } = jest.requireMock('@/services/ws-client') as {
  __wsTest: { emit: (type: string, msg: any) => void }
}

function sessionUpdate(id: string, status: Session['status']) {
  return { type: 'session_update', session: { id, status } as Session }
}

describe('useConversationStream — session transitions do not touch the cache', () => {
  it('never invalidates on running → waiting_input', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidateSpy = jest.spyOn(qc, 'invalidateQueries')
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    )
    await renderHook(() => useConversationStream('srv-1', 'sess-1', 'conv-1'), { wrapper })

    await act(() => __wsTest.emit('session_update', sessionUpdate('sess-1', 'running')))
    await act(() => __wsTest.emit('session_update', sessionUpdate('sess-1', 'waiting_input')))
    expect(invalidateSpy).not.toHaveBeenCalled()
  })

  it('still appends live conversation_event messages', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    )
    const { result } = await renderHook(
      () => useConversationStream('srv-1', 'sess-1', 'conv-1'),
      { wrapper },
    )

    await act(() =>
      __wsTest.emit('conversation_event', {
        type: 'conversation_event',
        sessionId: 'sess-1',
        line: JSON.stringify({ type: 'assistant', uuid: 'u1', message: { role: 'assistant', content: [{ type: 'text', text: 'hi' }] } }),
      }),
    )
    expect(result.current.liveMessages).toHaveLength(1)
    expect(result.current.liveMessages[0].uuid).toBe('u1')
  })
})
```

- [x] **Step 6: Run the rewritten statusRefetch test**

Run: `npx jest __tests__/unit/hooks/useConversationStream.statusRefetch.test.tsx`
Expected: PASS (2 tests).

- [x] **Step 7: Lint + commit**

```bash
npx eslint hooks/useConversationStream.ts __tests__/unit/hooks/useConversationStream.reconnect.test.tsx __tests__/unit/hooks/useConversationStream.statusRefetch.test.tsx
git add hooks/useConversationStream.ts __tests__/unit/hooks/useConversationStream.reconnect.test.tsx __tests__/unit/hooks/useConversationStream.statusRefetch.test.tsx
git commit -m "refactor(conversations): make useConversationStream a pure live overlay"
```

---

## Task 8: Gate the scroll handler to anchored views

`hasNewerPage` is now permanently `true` on the tail view, so the scroll-driven `fetchNewerPage()` at `[id].tsx:512-519` becomes an uncoordinated second caller. Restrict it to anchored windows, its actual purpose.

**Files:**
- Modify: `app/conversation/[id].tsx:512-519`

**Interfaces:**
- Consumes: `anchorIndex` (already in scope at `[id].tsx:118`).
- Produces: no interface change; behavioral guard only.

- [x] **Step 1: Add the `anchorIndex != null` condition**

In `app/conversation/[id].tsx`, the newer-direction backfill branch (`:512-519`). Add `anchorIndex != null &&` to the condition, and add `anchorIndex` to the `useCallback` dependency array (`:521`):

```typescript
    // Newer-direction backfill: only for anchored windows. On the tail view
    // hasNewerPage is now always true (delta-on-open), so gate on the anchor to
    // avoid firing redundant/racing after_index fetches outside the trigger.
    if (
      userHasScrolled.current &&
      anchorIndex != null &&
      nearBottom &&
      !nearTop &&
      hasNewerPage &&
      !isFetchingNewerPage
    ) {
      void fetchNewerPage()
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, hasNewerPage, isFetchingNewerPage, fetchNewerPage, anchorIndex])
```

- [x] **Step 2: Typecheck the touched file**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep "conversation/\[id\]" || echo "no [id].tsx type errors"`
Expected: `no [id].tsx type errors` (the scroll callback's deps now include `anchorIndex`, which is a stable `number | undefined`).

- [x] **Step 3: Lint + commit**

```bash
npx eslint "app/conversation/[id].tsx"
git add "app/conversation/[id].tsx"
git commit -m "fix(conversation): gate scroll-driven newer backfill to anchored views"
```

---

## Task 9: Id-unification merge-key contract in `LiveConversationView`

Move the overlay merge from uuid-only to a `(message_index, uuid)`-aware merge. uuid stays primary today (live WS messages carry no `message_index` yet). The load-bearing new invariant: index-less live messages never enter durable storage and never advance the cursor — they already stay in the render-time overlay, so this task's job is to make that boundary explicit and add the tiered-ordering scaffold the follow-up PR fills in.

**Files:**
- Modify: `components/conversation/LiveConversationView.tsx:87-116`
- Test: `__tests__/integration/components/LiveConversationView.test.tsx`

**Interfaces:**
- Consumes: `historicalMessages` (from `useConversation`, each carries `messageIndex`), `liveMessages` (from `useConversationStream`, no `messageIndex`).
- Produces: `allMessages` ordering — historical (index-ordered) → optimistic → live (arrival order after history). No message with a client-guessed index is ever written back to the query cache (this component never writes to the cache, so the invariant holds by construction; the change documents and guards it).

- [x] **Step 1: Write the failing test — index-ordered history, uuid dedup preserved**

Add to `__tests__/integration/components/LiveConversationView.test.tsx` a case proving the merge orders historical by `messageIndex` and still dedups live-by-uuid. The existing test at `:141-164` already covers uuid dedup; add an ordering assertion. Because the existing suite mocks `useConversation`/`useConversationStream`, check how they're mocked first and extend those mocks with `messageIndex` values.

```typescript
  it('renders historical messages in message_index order, then live messages by arrival', async () => {
    // historical out of natural order to prove index sorting (not array order).
    mockHistorical = [
      { id: 'c1-1', uuid: 'h1', messageIndex: 1, role: 'assistant', content: [{ type: 'text', text: 'second' }], timestamp: '', is_sidechain: false, parent_uuid: null },
      { id: 'c1-0', uuid: 'h0', messageIndex: 0, role: 'user', content: [{ type: 'text', text: 'first' }], timestamp: '', is_sidechain: false, parent_uuid: null },
    ]
    mockLive = [
      { id: 'L1', uuid: 'L1', role: 'assistant', content: [{ type: 'text', text: 'live-third' }], timestamp: '', is_sidechain: false, parent_uuid: null },
    ]
    await renderView()

    const texts = screen.getAllByTestId('message-text').map((n) => n.props.children)
    expect(texts).toEqual(['first', 'second', 'live-third'])
  })
```

Adjust `getAllByTestId('message-text')` to whatever stable testID `MessageItem` renders (inspect `MessageItem`; if none exists, assert via `screen.getByText` order using `within`/document order, or read the FlashList `data` prop through a test hook). If `MessageItem` has no per-text testID, assert ordering by mocking `MessageItem` in this test to render `<Text testID="message-text">{first text block}</Text>`.

- [x] **Step 2: Run it to verify it fails (or reveals the ordering gap)**

Run: `npx jest __tests__/integration/components/LiveConversationView.test.tsx -t "message_index order"`
Expected: FAIL — today's merge preserves `historicalMessages` array order, not `messageIndex` order (the two happen to coincide from REST, but the test forces them apart).

- [x] **Step 3: Implement the tiered merge**

In `components/conversation/LiveConversationView.tsx`, replace the merge block (`:87-116`). Keep uuid-primary dedup; add index-tiered ordering for historical, arrival order for live:

```typescript
  // Historical carries a server message_index; live WS messages do not (yet —
  // real indexes arrive with the WS-resume follow-up). Order historical by
  // index; live messages keep arrival order after history. Never assign a
  // synthetic index to a live message and never write one back to the query
  // cache — the derived cursor must stay "max index over server-indexed
  // messages" so it can't be advanced by a client-guessed value.
  const orderedHistorical = [...historicalMessages].sort((a, b) => {
    const ai = a.messageIndex ?? Number.MAX_SAFE_INTEGER
    const bi = b.messageIndex ?? Number.MAX_SAFE_INTEGER
    return ai - bi
  })

  // Deduplicate live messages against historical by uuid (id never matches
  // across REST/WS: REST uses index-based ids, WS uses uuid/timestamp).
  const seenUuids = new Set(orderedHistorical.map((m) => m.uuid).filter(Boolean))
  const newLive = liveMessages.filter((m) => !m.uuid || !seenUuids.has(m.uuid))

  // Drop optimistic turns whose echo has landed — matched one-for-one by text.
  const allStreamed = [...orderedHistorical, ...newLive]
  const echoedUserTexts = allStreamed.filter((m) => m.role === 'user').map((m) => userMessageText(m))
  const stillPending = (() => {
    const remaining = [...pendingSends]
    for (const echoText of echoedUserTexts) {
      const idx = remaining.findIndex((m) => userMessageText(m) === echoText)
      if (idx !== -1) remaining.splice(idx, 1)
    }
    return remaining
  })()

  // Order: historical → optimistic user bubble → live WS messages. Dedup by id
  // last (uuid-less messages fall back to timestamp-type-role ids that can
  // collide across REST/WS; duplicate FlashList keys trigger a render loop).
  const allMessages = (() => {
    const seen = new Set<string>()
    return [...orderedHistorical, ...stillPending, ...newLive].filter((m) => {
      if (seen.has(m.id)) return false
      seen.add(m.id)
      return true
    })
  })()
```

- [x] **Step 4: Run the ordering test**

Run: `npx jest __tests__/integration/components/LiveConversationView.test.tsx -t "message_index order"`
Expected: PASS.

- [x] **Step 5: Run the full LiveConversationView suite (regression)**

Run: `npx jest __tests__/integration/components/LiveConversationView.test.tsx`
Expected: PASS — the uuid-dedup and optimistic-echo tests (`:128-164`) still pass; sort is stable for already-ordered REST data.

- [x] **Step 6: Lint + commit**

```bash
npx eslint components/conversation/LiveConversationView.tsx __tests__/integration/components/LiveConversationView.test.tsx
git add components/conversation/LiveConversationView.tsx __tests__/integration/components/LiveConversationView.test.tsx
git commit -m "feat(conversation): index-aware merge with persistence boundary for live messages"
```

---

## Task 10: Full-suite green + typecheck + PR

Final verification gate. Everything above ran per-file; now run the whole thing the way CI does.

**Files:** none (verification + PR only).

- [x] **Step 1: Typecheck the whole project**

Run: `npx tsc --noEmit`
Expected: no errors. If the `ConversationPageParam` union move or the `RawConversationDetail` export surfaced a type error anywhere else, fix it now (grep for other importers of these symbols first: `grep -rn "ConversationPageParam\|firstPageEtags" hooks/ components/ app/`).

- [x] **Step 2: Run the full unit + integration suite in-band**

Run: `npm test -- --runInBand`
Expected: all suites PASS. Pay special attention to any pre-existing test that mounted `useConversation` on the tail view and did NOT seed a warm cache — the new trigger effect is inert without a cursor (no cached history → `deriveCursor` returns `undefined` → early return), so those should be unaffected. If any tail-view test now sees an unexpected `after_index` GET, it had a warm cache; adjust the test's expectation or confirm the delta is correct.

- [x] **Step 3: Lint the full changed set**

Run:
```bash
git diff main --name-only --diff-filter=ACMR | grep -E '\.(ts|tsx)$' | xargs npx eslint
```
Expected: no errors (warnings OK).

- [x] **Step 4: Push branch + open PR**

```bash
git push -u origin feat/persistent-cache-delta-sync
gh pr create --title "feat(conversations): persistent cache + cursor delta sync" --body "$(cat <<'EOF'
Implements items 1, 2, 4, 5 of the mobile phase-2 sync design (docs/superpowers/specs/2026-07-12-persistent-cache-delta-sync-design.md).

On any conversation open the app renders instantly from its 7-day on-device store, sends its last message cursor, and receives only the delta.
It never re-downloads history the device already has.

## What changed
- Durable retention: tail conversation query gets a 7-day gcTime; persist maxAge widened to 7 days; anchored windows stay at 5 min.
- First-page ETag map moved to a durable AsyncStorage-backed store (services/etag-store.ts).
- Delta-on-open: a { resume } page-param resumes from a cursor derived from cached pages (max message_index), draining >80-message backlogs across sequential after_index pages.
- Empty-200 husks are stripped; a total <= cursor truncation discards and refetches the tail.
- Retry hygiene: staleTime 15s, auto-refetch (mount/focus/reconnect) disabled on the durable query.
- All delta triggering consolidated into useConversation (mount + AppState foreground + WS connected + running→not-running), sharing one module-level per-queryKey 5s guard.
- useConversationStream is now a pure live overlay — it no longer touches the conversation query cache.
- Scroll-driven newer backfill gated to anchored views.
- LiveConversationView merge is (message_index, uuid)-aware; index-less live messages never enter durable storage.

## Out of scope
Item 3 (WS resume-by-seq) is a separate follow-up gated on streamer PR 2.

## Testing
Full Jest suite green (--runInBand); tsc --noEmit clean.
New coverage: etag-store round-trip, cursor/drain/guard helpers, delta trigger + drain + strip + cursor-invalidation + WS-flap guard + same-key dedup, gcTime retention, retry hygiene, useConversationStream no-cache-touch, index-ordered merge.
EOF
)"
```

If `gh pr create` fails with a PAT scope error, invoke the `gh-pr-create` skill.

- [x] **Step 5: Report the PR URL** back to the user and stop. Do not merge.

---

## Self-Review

**1. Spec coverage:**
- §3.1 Durable retention → Task 3 (gcTime branch, maxAge) + Task 1 (durable ETag store) + Task 4/6 (derived cursor, not separately persisted). ✓
- §3.2 Delta-on-open → Task 4 ({ resume } param + queryFn + getPreviousPageParam fallback) + Task 6 (trigger, drain loop, strip-after-resolve, cursor validity). ✓ Explicitly-not-initialPageParam handled (Task 4 uses fetchPreviousPage, not initialPageParam). ✓
- §3.3 Retry hygiene + consolidation → Task 5 (staleTime + refetchOn* false) + Task 6 (consolidated effect, module-level per-queryKey guard, stamp-once-at-drain-start, cancelRefetch:false) + Task 7 (useConversationStream sheds invalidateQueries). ✓ Scroll-handler gate → Task 8. ✓
- §3.4 Id unification → Task 9 (tiered merge, persistence boundary). ✓
- §4 Error handling → cursor invalidation (Task 6 step 9), empty-200 strip (Task 6 step 7), network failure falls through to RQ (no code — cached data stays visible, verified by "renders instantly" being the warm-cache path), ETag corruption graceful (Task 1 test "corrupt stored JSON"). ✓
- §5 Testing strategy → all six acceptance criteria mapped: (1) Task 6 step 1, (2) Task 6 step 7 empty-200 strip **+ Task 6 step 12b AppState foreground/repeat-resume** (the latch-free proof: second foreground past the guard fires a fresh delta), (3) Task 4 + Task 6 step 5 drain, (4) Task 6 step 9, (5) Task 6 step 11, (6) Task 6 step 13. ETag round-trip → Task 1. gcTime anchored-vs-tail → Task 3. useConversationStream shrink → Task 7. ✓
- §6 Constraints → Global Constraints section + Task 10 (full suite --runInBand, lint, conventional commits, no new deps). ✓

**2. Placeholder scan:** No "TBD"/"add error handling"/"similar to Task N" — every code step shows full code. The one soft spot is Task 9 step 1's `getAllByTestId('message-text')`, which explicitly instructs inspecting `MessageItem` and gives a concrete fallback (mock `MessageItem` to render a testID'd Text). Acceptable — it's a named, bounded decision, not a placeholder.

**3. Type consistency:**
- `ConversationPageParam = number | { after: number } | { resume: number }` defined once in `conversationCursor.ts` (Task 2), imported **type-only** by `useConversations.ts` (Task 2 step 5) — must be `import type`, not a bare import, or Metro/Babel preserves it as a runtime value edge and reintroduces the `useConversations ⇄ conversationCursor` cycle. ✓
- **Import cycle killed at the value level:** `conversationCursor.ts` imports `RawConversationDetail` **type-only** from `useConversations.ts` (erased by Babel); `useConversations.ts` imports the *values* `deriveCursor` (Task 4) + trigger/drain/guard helpers (Task 6) and the *type* `ConversationPageParam` from `conversationCursor.ts`. The only runtime import edge is one-way (`useConversations` → `conversationCursor`). No cycle. ✓
- `deriveCursor`, `isEmptyFirstPage`, `stripEmptyFirstPage`, `shouldContinueDrain`, `isCursorValid`, `canTrigger`, `stampTrigger` — signatures identical between Task 2 definition, Task 6 usage, and tests. ✓
- ETag store: `getEtag`/`setEtag`/`deleteEtag` names consistent Task 1 ↔ Task 1 step 5 rewire. ✓
- `SEVEN_DAYS` exported Task 3 step 3, consumed Task 3 step 4. ✓
- `fetchNewerPage`/`hasNewerPage` (aliases for `fetchPreviousPage`/`hasPreviousPage`) used consistently; the trigger effect calls `query.fetchPreviousPage` directly (Task 6) while the scroll handler and tests use the `fetchNewerPage` alias — both resolve to the same RQ handle. ✓
- **Single cursor-derivation function, no drift:** `deriveCursor(pages: RawConversationDetail[])` is called by both `getPreviousPageParam` (Task 4, via its `allPages` argument) and the Task 6 trigger effect (via `queryRef.current.data?.pages` / `data.pages`). There is no second inline copy of the max-index loop anywhere in the plan — verified by grep against the plan text, not from memory. ✓

**4. Effect-correctness invariants (Task 6 body, verified against the actual code block):**
- **Deps array is stable → effect runs once per mount.** The deps are `[serverId, id, anchorIndex, queryKeyHash, queryClient]` — no `queryKey` (a fresh array literal every render). The tail key is rebuilt inside the effect as `['conversation', serverId, id]`. Consequence: WS/AppState listeners subscribe once, and `prevStatus` (effect-local) survives across `session_update` events, so the `running → not-running` edge actually fires. Had `queryKey` stayed in the deps, `prevStatus` would reset to `null` every render and the session-end trigger would silently never fire. ✓
- **`deriveCursor` receives `.pages` at both effect sites** (`queryRef.current.data?.pages` at drain start, `data.pages` in the loop) — matches the `pages[]` signature. No `InfiniteData` wrapper is ever passed to it. ✓
- **Cursor invalidation uses `resetQueries`, not `removeQueries` + `refetchQueries`.** `resetQueries({ queryKey: tailKey })` discards cached data AND refetches the active query from `initialPageParam` (`-1`) in one call — the purpose-built primitive. The dead `refetchQueries`-after-`removeQueries` pattern (second call matches nothing) is not in the body. ✓
- **Drain re-reads `queryRef.current` each iteration** rather than capturing `const q` once, so a query-handle change between hops is picked up. ✓
- **Continuation hops use `msg_limit=120` by design** (they route through the `{ after }` branch's `CONVERSATION_ANCHORED_LIMIT`, not the first hop's `{ resume }` `msg_limit=80`). Documented in the drain-loop comment so it isn't "fixed" as a bug — larger continuation pages = fewer round-trips. ✓
- **Spec acceptance criterion 2 has a foreground test** (Step 12b): drives an `AppState` `change → active` handler captured via `jest.spyOn`, proves one delta within the guard window, then a fresh delta after advancing past 5s — the latch-free proof the spec demands. ✓
