import { act, renderHook } from '@testing-library/react-native'
import {
  CHAT_ANCHOR,
  MESSAGE_LIST_PROPS,
  useVirtualizedMessageList,
  type PageLoader,
} from '@/hooks/useVirtualizedMessageList'
import type { Message } from '@/types/api'

type Deferred = { promise: Promise<void>; resolve: () => void; reject: (err: Error) => void }
function deferred(): Deferred {
  let resolve: () => void = () => {}
  let reject: (err: Error) => void = () => {}
  const promise = new Promise<void>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function setup(older: Partial<PageLoader> & { fetch: jest.Mock }, newer?: PageLoader) {
  return renderHook(
    ({ olderLoader, newerLoader }: { olderLoader: PageLoader; newerLoader?: PageLoader }) =>
      useVirtualizedMessageList({ older: olderLoader, newer: newerLoader }),
    { initialProps: { olderLoader: { hasMore: true, isFetching: false, ...older }, newerLoader: newer } },
  )
}

describe('useVirtualizedMessageList — guarded page loading', () => {
  it('requests the next page without cancelling one already in flight', async () => {
    const fetch = jest.fn(() => Promise.resolve())
    const { result } = await setup({ fetch })
    await act(async () => {
      result.current.onStartReached?.()
    })
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledWith({ cancelRefetch: false })
  })

  it('ignores a repeat trigger while the first page is still loading', async () => {
    const d = deferred()
    const fetch = jest.fn(() => d.promise)
    const { result } = await setup({ fetch })
    await act(async () => {
      result.current.onStartReached?.()
      result.current.onStartReached?.()
      result.current.onStartReached?.()
    })
    expect(fetch).toHaveBeenCalledTimes(1)

    await act(async () => {
      d.resolve()
      await d.promise
    })
    await act(async () => {
      result.current.onStartReached?.()
    })
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('re-arms after a page request fails, so one bad page does not end paging', async () => {
    const d = deferred()
    const fetch = jest.fn(() => d.promise)
    const { result } = await setup({ fetch })
    await act(async () => {
      result.current.onStartReached?.()
    })
    await act(async () => {
      d.reject(new Error('offline'))
      await d.promise.catch(() => {})
    })
    await act(async () => {
      result.current.onStartReached?.()
    })
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('does not fetch while react-query already reports the direction as fetching', async () => {
    const fetch = jest.fn(() => Promise.resolve())
    const { result } = await setup({ fetch, isFetching: true })
    await act(async () => {
      result.current.onStartReached?.()
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('exposes no handler once a direction has nothing more to load', async () => {
    const fetch = jest.fn(() => Promise.resolve())
    const { result, rerender } = await setup({ fetch, hasMore: false })
    expect(result.current.onStartReached).toBeUndefined()
    expect(result.current.onEndReached).toBeUndefined()

    await rerender({ olderLoader: { hasMore: true, isFetching: false, fetch } })
    expect(result.current.onStartReached).toEqual(expect.any(Function))
  })

  it('guards each direction independently', async () => {
    const olderWait = deferred()
    const olderFetch = jest.fn(() => olderWait.promise)
    const newerFetch = jest.fn(() => Promise.resolve())
    const { result } = await setup({ fetch: olderFetch }, { hasMore: true, isFetching: false, fetch: newerFetch })
    await act(async () => {
      result.current.onStartReached?.()
      result.current.onEndReached?.()
    })
    // The older page is still pending; the newer one resolved. A second newer
    // request goes through — the older guard does not block the other direction.
    await act(async () => {
      result.current.onEndReached?.()
      result.current.onStartReached?.()
    })
    expect(olderFetch).toHaveBeenCalledTimes(1)
    expect(newerFetch).toHaveBeenCalledTimes(2)
    olderWait.resolve()
  })
})

describe('MESSAGE_LIST_PROPS — the shared FlashList contract', () => {
  const message: Message = {
    id: 'm1',
    uuid: 'm1',
    role: 'assistant',
    content: [{ type: 'text', text: 'hi' }],
    timestamp: '',
    is_sidechain: false,
    parent_uuid: null,
  }

  it('keys rows by message id and types them by content shape', () => {
    expect(MESSAGE_LIST_PROPS.keyExtractor(message)).toBe('m1')
    expect(MESSAGE_LIST_PROPS.getItemType(message)).toBe('assistant')
  })

  it('keeps the measured runway and reach thresholds every list relies on', () => {
    expect(MESSAGE_LIST_PROPS.drawDistance).toBe(2000)
    expect(MESSAGE_LIST_PROPS.onStartReachedThreshold).toBe(0.3)
    expect(MESSAGE_LIST_PROPS.onEndReachedThreshold).toBe(0.3)
    expect(CHAT_ANCHOR).toEqual({ autoscrollToBottomThreshold: 0.2, startRenderingFromBottom: true })
  })
})
