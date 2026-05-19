# Conversation Loader — Min-Display-Time Design

**Bug:** 2026-05-16 backlog → Bug 1 (Conversation open flicker)
**Status:** Design approved 2026-05-19, ready for implementation
**Backlog plan:** `docs/superpowers/plans/2026-05-16-loading-perf-and-tree-new-session.md`

---

## Problem

Tapping a cached conversation flickers. React Query persists the `conversation` query (see `PERSISTED_QUERY_ROOTS` in `services/query-client.ts`), so on return visits `isPending` is false on mount and the existing `if (isLoading)` skeleton branch in `app/conversation/[id].tsx` is skipped. The FlatList mounts with messages already in `data`, `onContentSizeChange` fires, `handleContentSizeChange` calls `scrollToBottom(false)` — and the user sees a brief jump as the list paints, scrolls off-screen, and resettles.

`MessageSkeletonRow` covers cold loads only. We need a gate that holds the skeleton until both the data is present *and* the initial layout pass has run.

---

## Approach

Introduce a `useMinDisplayTime` hook that returns `isGated` — a single boolean combining a minimum display floor with a readiness signal. The conversation screen ANDs `isGated` with the existing `isLoading` to drive the skeleton render branch.

### Approved decisions

| # | Decision | Picked |
|---|----------|--------|
| 1 | Loader scope | Both fetch + initial scroll-to-bottom layout |
| 2 | Visual | Reuse `MessageSkeletonRow` (10 rows) |
| 3 | Helper shape | `useMinDisplayTime` hook in `hooks/` |
| 4 | Gate reset trigger | On `id` route-param change |
| 5 | Error handling | Errors bypass the floor — show error view immediately |
| 6 | Ready signal | `data !== undefined` AND first `onContentSizeChange` fired |
| 7 | Pagination scope | Lift gate after first page laid out; `ProgressBar` handles older-page backfill |
| 8 | Integration | Approach A — single combined `isGated` boolean in `[id].tsx` |
| 9 | Empty conversations | Treat `conversation.messages.length === 0` as `firstLayoutDone = true` immediately |

---

## Section 1 — Architecture (approved)

- **Helper:** custom hook, not a wrapper component, not folded into `useConversation`. Keeps the floor concern separate from data fetching and reusable for Bug 3 (Hub directory open flicker).
- **Trigger:** reset on `id` route param change, not on screen mount and not on every readiness flip. Re-navigating to the same `id` does not re-gate.
- **Errors:** bypass the gate entirely. Error view renders immediately.
- **Ready signal:** combines `conversation !== undefined` with `firstLayoutDone` (first `onContentSizeChange` fire). This is what masks the visible scroll jump.
- **Pagination:** the gate lifts after the *first* page is laid out. Older pages backfill behind the existing `ProgressBar` at the top of the list.

---

## Section 2 — Hook API (approved)

### Signature

```ts
// hooks/useMinDisplayTime.ts
export function useMinDisplayTime(
  isReady: boolean,
  minMs: number = 1200,
  resetKey?: string | number,
): boolean // returns isGated
```

### Behavior

- On mount and on every `resetKey` change: clear any pending timer, set `floorElapsed = false`, schedule `setTimeout(() => setFloorElapsed(true), minMs)`.
- Returns `isGated = !(floorElapsed && isReady)`.
- `minMs <= 0`: short-circuit to `isGated = !isReady`, no timer scheduled (testing convenience + future opt-out).
- Unmount clears the pending timer.

### Tests (`__tests__/unit/hooks/useMinDisplayTime.test.ts`)

1. Gated while `!isReady`, timer pending.
2. Gated when timer fires but `!isReady`.
3. Gated when `isReady` but timer pending.
4. Releases when both met.
5. `resetKey` change re-gates and restarts the timer.
6. `minMs=0` releases immediately on `isReady=true`, no timer.
7. Unmount clears the timer.

Use `jest.useFakeTimers()` and `act(() => jest.advanceTimersByTime(...))` per existing test conventions.

---

## Section 3 — Integration in `app/conversation/[id].tsx` (approved)

### State additions

After existing component state (~line 116):

```ts
const [firstLayoutDone, setFirstLayoutDone] = useState(false)
```

### Reset on `id` change

Extend existing `useEffect([id])` at lines 120–123:

```ts
useEffect(() => {
  hasInitialScrolled.current = false
  hasStartedAutoScroll.current = false
  setFirstLayoutDone(false)
}, [id])
```

### Mark first layout (with empty-list short-circuit)

Empty conversations may not fire `onContentSizeChange`, so flip the flag immediately when we observe an empty messages array. Use a separate effect rather than inlining the check:

```ts
useEffect(() => {
  if (conversation && conversation.messages.length === 0) {
    setFirstLayoutDone(true)
  }
}, [conversation])
```

Update `handleContentSizeChange` (line 143):

```ts
const handleContentSizeChange = useCallback((_w: number, h: number) => {
  contentHeightRef.current = h
  if (!firstLayoutDone) setFirstLayoutDone(true)
  if (hasInitialScrolled.current) return
  scrollToBottom(false)
}, [scrollToBottom, firstLayoutDone])
```

### Derive `isReady` and call the hook

After the `useConversation` destructure (~line 108):

```ts
const isReady = conversation !== undefined && firstLayoutDone
const isGated = useMinDisplayTime(isReady, 1200, id)
```

### Render branch

Today line 247 is `if (isLoading) { return skeletonView }`. Two changes:

1. Ensure the error check runs **before** the skeleton+gate branch so errors bypass the floor. Verify the current placement during implementation; reorder if needed.
2. Change the skeleton condition:

```ts
if (error) {
  return /* existing error view */
}
if (isLoading || isGated) {
  return /* existing skeleton SafeAreaView block, unchanged */
}
```

### Unchanged

- `MessageSkeletonRow` component (reused as-is).
- `ProgressBar` for older-page backfill — Decision #7.
- `scrollToBottom`, `handleScroll`, `resumeSession`, share/info handlers.
- Auto-fetch-older-pages effect.

---

## Files

**New:**

- `hooks/useMinDisplayTime.ts`
- `__tests__/unit/hooks/useMinDisplayTime.test.ts`

**Modify:**

- `app/conversation/[id].tsx` — add `firstLayoutDone` state + empty-list effect, call hook, reorder error/skeleton render branches.

**Read-only references:**

- `hooks/useConversations.ts` — `useConversation` returns `isLoading` (from `query.isPending`)
- `services/query-client.ts` — `conversation` is in `PERSISTED_QUERY_ROOTS`
- `components/conversation/MessageSkeletonRow.tsx`

---

## Out of scope

- Bug 3 (Hub directory open flicker) — same `useMinDisplayTime` helper, but the integration is a separate change handled under its own plan.
- Bug 5 (multi-attachment send → no output) — unrelated path; tracked separately.
