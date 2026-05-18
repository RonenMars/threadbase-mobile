# Bug 1 — Conversation loader (min 1.2s) — Brainstorm TODO

**Date opened:** 2026-05-18
**Status:** Brainstorm paused mid-Section-2 (hook API presented, not yet approved)
**Backlog entry:** `docs/superpowers/plans/2026-05-16-loading-perf-and-tree-new-session.md` → Bug 1

---

## Where we left off

Last interaction: presented Section 2 (`useMinDisplayTime` hook API + 7 test cases). User pivoted to ask whether this design helps a different bug (multi-attachment send produces no output). I answered no — that's the unsupported multi-file send path (now filed as Bug 5). User has not picked between (a) finish Bug 1 brainstorm, (b) revise Section 2, or (c) pivot to diagnose Bug 5.

**To resume:** ask user to approve Section 2, then present Section 3.

---

## Root cause confirmed

Tapping a cached conversation flickers because:
1. React Query persists `conversation` query (`PERSISTED_QUERY_ROOTS` in `services/query-client.ts`).
2. On return visit, `isPending` is false on mount → existing `if (isLoading)` skeleton branch is skipped.
3. FlatList mounts with messages already in `data` → `onContentSizeChange` fires → `handleContentSizeChange` calls `scrollToBottom(false)` → visible jump.

Existing `MessageSkeletonRow` branch only covers cold loads. We need a gate that holds the skeleton long enough for the layout pass to settle off-screen.

---

## Approved decisions (✅)

| # | Decision | Picked |
|---|----------|--------|
| 1 | Loader scope | Both fetch + initial scroll-to-bottom layout |
| 2 | Visual | Reuse `MessageSkeletonRow` (10 rows) |
| 3 | Helper shape | `useMinDisplayTime` hook in `hooks/` |
| 4 | Gate reset trigger | On `id` route-param change |
| 5 | Error handling | Errors bypass the floor — show error view immediately |
| 6 | Ready signal | `data !== undefined` AND first `onContentSizeChange` fired |
| 7 | Pagination scope | Lift gate after first page laid out; `ProgressBar` handles older-page backfill |
| 8 | Integration approach | A — single combined `isGated` boolean in `[id].tsx` |
| 9 | Design Section 1 (architecture) | Approved |

---

## Pending design (⏳)

### Section 2 — Hook API (presented, not approved)

```ts
// hooks/useMinDisplayTime.ts
export function useMinDisplayTime(
  isReady: boolean,
  minMs: number = 1200,
  resetKey?: string | number,
): boolean // returns isGated
```

**Behavior:**
- On mount + on every `resetKey` change: clear prior timer, set `floorElapsed=false`, schedule `setTimeout(() => setFloorElapsed(true), minMs)`
- Returns `isGated = !(floorElapsed && isReady)`
- `minMs <= 0`: short-circuits to `isGated = !isReady`, no timer scheduled
- Unmount clears the pending timer

**Test cases (in `__tests__/unit/hooks/useMinDisplayTime.test.ts`):**
1. Gated while !isReady, timer pending
2. Gated when timer fires but !isReady
3. Gated when isReady but timer pending
4. Releases when both met
5. `resetKey` change re-gates + restarts timer
6. `minMs=0` releases immediately on isReady=true, no timer
7. Unmount clears timer

### Section 3 — Integration in `[id].tsx` (not yet presented)

To draft once Section 2 is approved. Will cover:
- New `firstLayoutDone` `useState<boolean>(false)` reset on `id` change
- `handleContentSizeChange` sets `firstLayoutDone(true)` the first time it fires per `id`
- `const isReady = !!conversation && firstLayoutDone`
- `const isGated = useMinDisplayTime(isReady, 1200, id)`
- Render branch order: `if (error) errorView; else if (isLoading || isGated) skeletonView; else listView`
- Verify existing `useEffect([id])` resets cover the new state correctly

---

## Remaining checklist

- [ ] Approve Section 2 (hook API + tests)
- [ ] Present Section 3 (integration spec)
- [ ] Write spec to `docs/superpowers/specs/2026-05-18-conversation-loader-min-display-design.md` and commit
- [ ] User reviews committed spec
- [ ] Invoke `superpowers:writing-plans` to generate implementation plan
- [ ] Execute plan (`useMinDisplayTime` + 7 tests + `[id].tsx` wiring)

---

## Files involved

**New:**
- `hooks/useMinDisplayTime.ts`
- `__tests__/unit/hooks/useMinDisplayTime.test.ts`
- `docs/superpowers/specs/2026-05-18-conversation-loader-min-display-design.md` (to write)

**Modify:**
- `app/conversation/[id].tsx` — add `firstLayoutDone` state, call hook, change render branch

**Read-only references:**
- `hooks/useConversations.ts` → `useConversation` returns `isLoading` (from `query.isPending`)
- `services/query-client.ts` → `conversation` is in `PERSISTED_QUERY_ROOTS` (this is why cache hits skip the existing skeleton branch)
- `components/conversation/MessageSkeletonRow.tsx` (reuse as-is)

---

## Sidebar — Bug 5 (multi-attachment no output)

Filed during this brainstorm. Not blocking Bug 1. See backlog plan Bug 5 entry and `memory/project_multi_attachment_no_output.md` for diagnosis plan.
