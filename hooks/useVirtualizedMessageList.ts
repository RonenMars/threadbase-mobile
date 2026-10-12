import { useCallback, useRef } from 'react'
import type { FlashListProps } from '@shopify/flash-list'
import type { Message } from '@/types/api'
import { messageItemType } from '@/utils/messageItemType'

// The virtualization contract shared by every message list: the live chat
// (LiveConversationView), the read-only history (ConversationHistoryList) and
// the anchored search view that wraps it. One module owns the FlashList tuning
// and the page-loading guard so the three lists cannot drift apart.
//
// The shape follows autokitteh's useVirtualizedList (react-virtualized List +
// InfiniteLoader + CellMeasurerCache): FlashList v2 already does the windowing
// and the per-type height estimation that CellMeasurerCache did there, and
// react-query's infinite pages are the paged cache. What this module adds is
// the InfiniteLoader half — a loader that cannot be re-entered while a page is
// in flight — plus the list props that used to be copied between the lists.

/** FlashList v2's chat preset: anchor the tail and open at the bottom. */
// This object is a module constant and the live list is NEVER switched to
// `{ disabled: true }`: with the threshold gone, flash-list's checkBounds stops
// clearing its sticky `pendingAutoscrollToBottom` flag (useBoundDetection.ts),
// which stays latched `true` from when the user was last at the tail — and the
// next `data` change fires a scrollToEnd, snapping the user back to the bottom
// mid-drag. The threshold alone already is the follow rule: near the tail →
// follow, scrolled up → don't. The anchored search view is the one list that
// disables it, because it drives scrollToIndex itself.
export const CHAT_ANCHOR = { autoscrollToBottomThreshold: 0.2, startRenderingFromBottom: true } as const
export const CHAT_ANCHOR_DISABLED = { disabled: true } as const

function messageKey(message: Message): string {
  return message.id
}

/**
 * FlashList props every virtualized transcript shares, whatever its row type:
 * the chat lists (rows are `Message`) and the terminal (rows mix transcript
 * messages with PTY lines). Spread onto the list.
 *
 * drawDistance is PIXELS of pre-rendered runway, not rows, and the iOS default
 * is 250 — split 70/30 toward the scroll direction, so scrolling up pre-renders
 * only ~350px above the viewport and evicts rows ~150px below it. A single
 * table answer measures ~3,100px (≈5 viewports), so the default buffer is
 * outrun by any real flick and just-passed rows unmount into visible blanks.
 * 2000px keeps the engaged window ahead of momentum scrolling and clears the
 * known-bad "item taller than 2×drawDistance" mVCP-correction regime
 * (Shopify/flash-list#2136) for rows up to 4,000px.
 *
 * The reach thresholds are fractions of the visible length: a page is requested
 * once the reader is within 30% of a viewport of the end that has more.
 */
export const VIRTUALIZED_LIST_PROPS = {
  drawDistance: 2000,
  onStartReachedThreshold: 0.3,
  onEndReachedThreshold: 0.3,
} as const

/** The chat lists' props: the shared runway plus `Message`-keyed rows. */
export const MESSAGE_LIST_PROPS = {
  ...VIRTUALIZED_LIST_PROPS,
  scrollEventThrottle: 16,
  keyExtractor: messageKey,
  getItemType: messageItemType,
} satisfies Partial<FlashListProps<Message>>

/**
 * One direction of a paginated message query, in react-query's terms. `fetch`
 * is `fetchNextPage` / `fetchPreviousPage`; the guard always calls it with
 * `cancelRefetch: false`, so a repeat trigger can never cancel an in-flight page.
 * `TResult` is whatever the fetch resolves to — the guard only waits for it.
 */
export interface PageLoader<TResult = void> {
  hasMore: boolean
  isFetching: boolean
  fetch: (options: { cancelRefetch: false }) => Promise<TResult> | TResult
}

export interface VirtualizedMessageListOptions<TOlder = void, TNewer = void> {
  /** Older history, loaded when the reader nears the top. */
  older?: PageLoader<TOlder>
  /** Newer messages, loaded when the reader nears the bottom (anchored views only). */
  newer?: PageLoader<TNewer>
}

// FlashList latches onStartReached per entry into the threshold zone and
// releases it when the reader scrolls out, so a reader bouncing at the top
// while a page is slow fires it again. react-query's fetchNextPage defaults to
// cancelRefetch: true — the second call would cancel the page already on the
// wire and start it over, and a reader who keeps bouncing never gets a page at
// all. The in-flight ref closes the gap between the call and the render that
// reports isFetching, and the explicit cancelRefetch: false makes a call that
// does slip through a no-op instead of a restart.
function useGuardedPageLoader<TResult>(loader: PageLoader<TResult> | undefined): (() => void) | undefined {
  const inFlightRef = useRef(false)
  const fetch = loader?.fetch
  const hasMore = loader?.hasMore ?? false
  const isFetching = loader?.isFetching ?? false

  const load = useCallback(() => {
    if (!fetch || isFetching || inFlightRef.current) return
    inFlightRef.current = true
    const clear = () => {
      inFlightRef.current = false
    }
    let result: Promise<TResult> | TResult
    try {
      result = fetch({ cancelRefetch: false })
    } catch (err) {
      clear()
      throw err
    }
    Promise.resolve(result).then(clear, clear)
  }, [fetch, isFetching])

  // No handler at all once the direction is exhausted: FlashList skips the
  // bound check entirely for a missing handler, and the HistoryLoadBoundary /
  // footer spinner already tell the reader there is nothing more to load.
  return hasMore && fetch ? load : undefined
}

/**
 * Guarded `onStartReached` / `onEndReached` handlers for a message list. Pass
 * them straight to FlashList (or to ConversationHistoryList) together with
 * `MESSAGE_LIST_PROPS`.
 */
export function useVirtualizedMessageList<TOlder = void, TNewer = void>({
  older,
  newer,
}: VirtualizedMessageListOptions<TOlder, TNewer>) {
  const onStartReached = useGuardedPageLoader(older)
  const onEndReached = useGuardedPageLoader(newer)
  return { onStartReached, onEndReached }
}
