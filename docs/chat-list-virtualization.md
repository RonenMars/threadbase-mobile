# Chat list virtualization

How the three message lists — the live chat (`components/conversation/LiveConversationView.tsx`),
the read-only history (`components/conversation/ConversationHistoryList.tsx`) and the anchored
search view that wraps it (`components/conversation/ConversationSearchView.tsx`) — render a
conversation that can be thousands of rows and megabytes of markdown without mounting it all.

The contract lives in one module, `hooks/useVirtualizedMessageList.ts`. Every list spreads its
`MESSAGE_LIST_PROPS` onto `FlashList` and takes its `onStartReached` / `onEndReached` from
`useVirtualizedMessageList`, so the tuning cannot drift between the lists.

## The model

The shape is the one autokitteh's web platform uses for session log viewers
(`src/hooks/useVirtualizedList.tsx` + `deployments/sessions/tabs/outputs.tsx`): a windowed list,
measured dynamic row heights, an infinite loader that requests the next page from a scroll edge,
and a session-keyed page cache behind it. Each piece has a native counterpart here.

| autokitteh (react-virtualized, web) | Threadbase mobile |
|---|---|
| `List` renders only visible rows + `overscanRowCount` | FlashList v2 recycles cells; `drawDistance: 2000` px of runway (`MESSAGE_LIST_PROPS`) |
| `CellMeasurerCache` + `CellMeasurer` measure each row after mount | FlashList measures rows natively; `getItemType` (`utils/messageItemType.ts`) keeps a per-shape running average so unmeasured rows are placed sanely |
| `InfiniteLoader` with `rowCount = items.length + 1` while `nextPageToken` exists | `onStartReached` while `hasNextPage`; the `+1` sentinel row is `HistoryLoadBoundary` in the list header |
| `loadingRef` guard inside `loadMoreRows` | `useVirtualizedMessageList`'s in-flight ref, plus `cancelRefetch: false` |
| `useOutputsCacheStore` keyed by session id, `nextPageToken`, `force` reload | react-query infinite query keyed `['conversation', serverId, id, …]`, `getNextPageParam` from `message_pagination`, persisted for seven days |
| `memo(OutputRow)` + a `rowRenderer` built once per data change | `React.memo(MessageItem)` + a `useCallback` `renderItem` in every list |
| `scrollToRow(0)` on an app event | Top / jump-to-latest FABs; `useInitialScrollToEnd` pins a fresh open to the true bottom |

## What the guard fixes

FlashList latches `onStartReached` per entry into the threshold zone and releases it when the
reader scrolls away (`useBoundDetection.ts`). A reader who bounces at the top while a page is slow
therefore fires it again. react-query's `fetchNextPage` defaults to `cancelRefetch: true`, so that
second call cancelled the page already on the wire and started it over — a reader who kept
bouncing never received a page at all. The hook refuses a call while one is in flight (the ref
closes the gap between the call and the render that reports `isFetchingNextPage`) and passes
`cancelRefetch: false` so a call that does slip through is a no-op rather than a restart.

Once a direction is exhausted the hook returns `undefined` for that handler. FlashList then skips
the bound check entirely, and the `HistoryLoadBoundary` marker / footer spinner already tell the
reader there is nothing more.

## Why `renderItem` is memoized

FlashList's `ViewHolder` is `React.memo` with a comparator that includes `renderItem` identity
(`src/recyclerview/ViewHolder.tsx`). An inline closure therefore re-renders every mounted row on
every parent render. The live view re-renders on each PTY chunk while the agent is working
(`useTerminalStream` state), so an inline `renderItem` there meant every visible bubble
re-rendered at terminal-output rate. Both lists now build `renderItem` with `useCallback`, keyed on
the tail message id rather than the array, so only a real new message moves `isLast`.

## What was deliberately not ported

**Viewport-derived page size.** autokitteh sizes a page as
`ceil(frameHeight / rowHeight × 1.5)` because its rows are ~44 px log lines. Chat rows here span
~46 pt (collapsed reasoning header) to ~3,100 pt (a markdown table answer), so a row count derived
from the viewport predicts nothing about payload. The first page is byte-bounded instead
(`SESSION_HISTORY_MAX_BYTES`, measured against real payloads — see
`docs/superpowers/specs/2026-08-15-session-history-byte-budget-design.md`) and older pages use the
fixed `msg_limit` in `hooks/useConversations.ts`.

**Clearing the measurement cache on every data change.** autokitteh calls `cache.clearAll()` and
`recomputeRowHeights()` whenever the outputs array changes because `CellMeasurerCache` is keyed by
index and a prepend shifts every row. FlashList keys measurements by `keyExtractor` (message id),
and `maintainVisibleContentPosition` keeps the viewport anchored across a prepend, so there is no
cache to invalidate.

## Tests

- `__tests__/unit/hooks/useVirtualizedMessageList.test.tsx` — the guard's re-entrancy, failure
  re-arm, per-direction independence and the shared props.
- `__tests__/integration/components/LiveConversationView.test.tsx` ("virtualized paging") — a
  bouncing reader produces one `fetchNextPage({ cancelRefetch: false })`, and a PTY-driven
  re-render keeps `renderItem` identity.
