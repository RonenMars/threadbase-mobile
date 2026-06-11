/**
 * Skeleton gating on the conversation detail screen (slow-first-load fix).
 *
 * Two regressions guarded here:
 *  - The useMinDisplayTime anti-flicker floor is 400 ms (was 800 ms) — fast
 *    loads must not sit under a skeleton for nearly a second.
 *  - Content-size churn (code/image-heavy pages re-laying out) must NOT hold
 *    the skeleton indefinitely: the settle debounce is capped, so the gate
 *    lifts at most ~500 ms after the first onContentSizeChange even while
 *    the list is still resizing.
 */
import React from 'react'
import { FlatList } from 'react-native'
import { render, act, type RenderResult } from '@testing-library/react-native'
import { useLocalSearchParams } from 'expo-router'
import ConversationDetailScreen from '@/app/conversation/[id]'
import { useServersStore } from '@/stores/servers'
import { createWrapper } from '@/test-utils'

function makeDetail(messageCount: number) {
  const messages = Array.from({ length: messageCount }, (_, i) => ({
    message_index: i,
    uuid: `uuid-${i}`,
    role: i % 2 === 0 ? 'user' : 'assistant',
    timestamp: `2026-06-10T10:00:${String(i).padStart(2, '0')}Z`,
    text: `message ${i}`,
  }))
  return {
    meta: {
      id: 'conv-gating',
      project_name: 'Gating Test',
      project_path: '/tmp/p',
      last_updated_at: '2026-06-10T11:00:00Z',
      message_count: messageCount,
    },
    messages,
    message_pagination: {
      total: messageCount,
      before_index: -1,
      from_index: 0,
      has_more_older: false,
      next_before_index: null,
    },
  }
}

jest.mock('@/services/api-client', () => ({
  createApiForServer: () => ({
    get: () => Promise.resolve(mockDetailRef.current),
    // useConversation's first page uses getWithMeta (conditional fetch). This
    // gating suite only cares about render timing, so return a plain 200 with
    // no ETag — the same detail payload, wrapped in the meta envelope.
    getWithMeta: () => Promise.resolve({ status: 200, etag: null, body: mockDetailRef.current }),
    post: () => Promise.resolve({}),
  }),
}))

const mockDetailRef: { current: unknown } = { current: null }

function seedServer() {
  useServersStore.setState({
    servers: {
      srv1: {
        id: 'srv1',
        url: 'http://stub',
        apiKey: 'k',
        label: 'SRV1',
        isConnected: true,
        serverInfo: null,
        connectionError: null,
      },
    },
    activeServerIds: ['srv1'],
    displayedServerIds: ['srv1'],
  } as never)
}

function skeletonOverlayVisible(root: RenderResult) {
  // The gated overlay renders a non-scrollable skeleton FlatList above the
  // message list; once the gate lifts only the message list remains.
  const lists = root.UNSAFE_getAllByType(FlatList)
  return lists.some((l) => l.props.scrollEnabled === false)
}

async function renderScreenAndFindList(root: RenderResult) {
  // Flush queryFn resolution under fake timers — react-query may defer a tick.
  let list
  for (let i = 0; i < 20 && !list; i++) {
    await act(async () => {
      jest.advanceTimersByTime(5)
    })
    list = root
      .UNSAFE_getAllByType(FlatList)
      .find(
        (l) =>
          typeof l.props.onContentSizeChange === 'function' &&
          l.props.scrollEnabled !== false,
      )
  }
  expect(list).toBeDefined()
  return list!.props.onContentSizeChange as (w: number, h: number) => void
}

describe('conversation detail — skeleton gating', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    seedServer()
    mockDetailRef.current = makeDetail(10)
    ;(useLocalSearchParams as jest.Mock).mockReturnValue({ id: 'conv-gating', server: 'srv1' })
  })
  afterEach(() => {
    jest.clearAllTimers()
    jest.useRealTimers()
  })

  it('lifts the skeleton at the 400 ms floor when data and layout are fast', async () => {
    const t0 = Date.now()
    const root = render(<ConversationDetailScreen />, { wrapper: createWrapper() })
    const fireContentSizeChange = await renderScreenAndFindList(root)

    // One size change, then layout goes quiet — settle fires 150 ms later.
    await act(async () => {
      fireContentSizeChange(390, 5000)
      jest.advanceTimersByTime(150)
    })
    expect(skeletonOverlayVisible(root)).toBe(true) // floor still holding

    // Just before the 400 ms floor — still gated.
    await act(async () => {
      jest.advanceTimersByTime(400 - (Date.now() - t0) - 10)
    })
    expect(skeletonOverlayVisible(root)).toBe(true)

    // Crossing the floor lifts the gate (well before the old 800 ms).
    await act(async () => {
      jest.advanceTimersByTime(20)
    })
    expect(skeletonOverlayVisible(root)).toBe(false)
  })

  it('caps the settle wait: continuous content-size churn cannot hold the skeleton', async () => {
    const root = render(<ConversationDetailScreen />, { wrapper: createWrapper() })
    const fireContentSizeChange = await renderScreenAndFindList(root)

    // Height keeps changing every 100 ms (code/image-heavy page laying out).
    // Each change resets the 150 ms settle debounce, so without a cap the
    // gate would be deferred for as long as the churn lasts.
    let lifted: number | null = null
    const churnStart = Date.now()
    for (let t = 0; t < 1200; t += 100) {
      await act(async () => {
        fireContentSizeChange(390, 5000 + t)
        jest.advanceTimersByTime(100)
      })
      if (lifted === null && !skeletonOverlayVisible(root)) {
        lifted = Date.now() - churnStart
      }
    }

    // The gate must have lifted mid-churn: at most first-change + 500 ms cap
    // (plus the 400 ms floor lower bound), far below the 1200 ms churn window.
    expect(lifted).not.toBeNull()
    expect(lifted!).toBeLessThanOrEqual(700)
  })
})
