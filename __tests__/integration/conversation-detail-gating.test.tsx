// @ts-nocheck - TODO: migrate from removed UNSAFE_getAllByType to testID queries
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
import { useLocalSearchParams, useRouter } from 'expo-router'
import ConversationDetailScreen from '@/app/conversation/[id]'
import { useServersStore } from '@/stores/servers'
import { createWrapper } from '@/test-utils'
import { NotFoundError } from '@/services/api-client'

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

const mockDetailRef: { current: unknown } = { current: null }
// null = never fetched; Error instance = throw; object = resolve
const mockSessionRef: { current: unknown } = { current: null }

jest.mock('@/services/api-client', () => {
  const { NotFoundError } = jest.requireActual('@/services/api-client')
  return {
    NotFoundError,
    createApiForServer: () => ({
      get: (path: string) => {
        if (path.includes('/api/sessions/')) {
          const v = mockSessionRef.current
          if (v instanceof Error) return Promise.reject(v)
          return Promise.resolve(v)
        }
        const v = mockDetailRef.current
        if (v instanceof Error) return Promise.reject(v)
        return Promise.resolve(v)
      },
      // useConversation's first page uses getWithMeta (conditional fetch). This
      // gating suite only cares about render timing, so return a plain 200 with
      // no ETag — the same detail payload, wrapped in the meta envelope.
      getWithMeta: (path: string) => {
        if (path.includes('/api/sessions/')) {
          const v = mockSessionRef.current
          if (v instanceof Error) return Promise.reject(v)
          return Promise.resolve({ status: 200, etag: null, body: v })
        }
        const v = mockDetailRef.current
        if (v instanceof Error) return Promise.reject(v)
        return Promise.resolve({ status: 200, etag: null, body: v })
      },
      post: () => Promise.resolve({}),
    }),
  }
})

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

describe.skip('conversation detail — skeleton gating', () => {
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
    const root = await render(<ConversationDetailScreen />, { wrapper: createWrapper() })
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
    const root = await render(<ConversationDetailScreen />, { wrapper: createWrapper() })
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

function allText(root: RenderResult): string {
  const walk = (node: unknown): string => {
    if (node == null) return ''
    if (typeof node === 'string') return node
    if (Array.isArray(node)) return node.map(walk).join(' ')
    const n = node as { children?: unknown }
    return walk(n.children)
  }
  return walk(root.toJSON())
}

async function flushQueriesAndLiftSkeleton() {
  for (let i = 0; i < 20; i++) {
    await act(async () => {
      jest.advanceTimersByTime(10)
    })
  }
  await act(async () => {
    jest.advanceTimersByTime(600)
  })
}

describe('conversation detail — resumability gating', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    seedServer()
    ;(useLocalSearchParams as jest.Mock).mockReturnValue({ id: 'conv-gating', server: 'srv1' })
  })
  afterEach(() => {
    jest.clearAllTimers()
    jest.useRealTimers()
  })

  it('shows the worktree banner and disables Resume when resumable is false', async () => {
    mockDetailRef.current = {
      ...makeDetail(4),
      meta: { ...makeDetail(4).meta, resumable: false, unavailable_reason: 'worktree_removed' },
    }
    const root = await render(<ConversationDetailScreen />, { wrapper: createWrapper() })
    await flushQueriesAndLiftSkeleton()

    const text = allText(root)
    expect(text).toContain('git worktree that no longer exists')
    expect(text).toContain("Can't resume")
    expect(text).not.toContain('Resume Session')
  })

  it('shows the path-missing banner for a missing project dir', async () => {
    mockDetailRef.current = {
      ...makeDetail(4),
      meta: { ...makeDetail(4).meta, resumable: false, unavailable_reason: 'path_missing' },
    }
    const root = await render(<ConversationDetailScreen />, { wrapper: createWrapper() })
    await flushQueriesAndLiftSkeleton()

    const text = allText(root)
    expect(text).toContain('project folder for this conversation was moved or deleted')
    expect(text).toContain("Can't resume")
  })

  it('keeps Resume enabled and shows no banner when resumable', async () => {
    mockDetailRef.current = {
      ...makeDetail(4),
      meta: { ...makeDetail(4).meta, resumable: true },
    }
    const root = await render(<ConversationDetailScreen />, { wrapper: createWrapper() })
    await flushQueriesAndLiftSkeleton()

    const text = allText(root)
    expect(text).toContain('Resume Session')
    expect(text).not.toContain("Can't resume")
    expect(text).not.toContain('no longer exists')
  })
})

describe('conversation detail — 404 live-session fallback', () => {
  let mockReplace: jest.Mock

  beforeEach(() => {
    jest.useFakeTimers()
    seedServer()
    mockReplace = jest.fn()
    ;(useRouter as jest.Mock).mockReturnValue({
      push: jest.fn(),
      replace: mockReplace,
      back: jest.fn(),
      navigate: jest.fn(),
      canGoBack: jest.fn(() => true),
    })
    ;(useLocalSearchParams as jest.Mock).mockReturnValue({ id: 'conv-gating', server: 'srv1' })
  })

  afterEach(() => {
    jest.clearAllTimers()
    jest.useRealTimers()
    mockDetailRef.current = null
    mockSessionRef.current = null
  })

  async function flushAllQueries() {
    for (let i = 0; i < 20; i++) {
      await act(async () => {
        jest.advanceTimersByTime(10)
      })
    }
  }

  it('redirects to /session/:id when conversation 404s and session is live (ptyAttached)', async () => {
    mockDetailRef.current = new NotFoundError('/api/conversations/conv-gating')
    mockSessionRef.current = { id: 'conv-gating', status: 'running', ptyAttached: true }

    await render(<ConversationDetailScreen />, { wrapper: createWrapper() })
    await flushAllQueries()

    expect(mockReplace).toHaveBeenCalledWith('/session/conv-gating?server=srv1')
  })

  it('does NOT redirect when the session is detached/idle — session/[id] would bounce back, looping', async () => {
    mockDetailRef.current = new NotFoundError('/api/conversations/conv-gating')
    mockSessionRef.current = { id: 'conv-gating', status: 'idle', ptyAttached: false }

    await render(<ConversationDetailScreen />, { wrapper: createWrapper() })
    await flushAllQueries()

    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('shows "no longer available" when both conversation and session are absent', async () => {
    mockDetailRef.current = new NotFoundError('/api/conversations/conv-gating')
    mockSessionRef.current = new NotFoundError('/api/sessions/conv-gating')

    const root = await render(<ConversationDetailScreen />, { wrapper: createWrapper() })
    await flushAllQueries()

    const text = allText(root)
    expect(text).toContain('no longer available')
    expect(mockReplace).not.toHaveBeenCalled()
  })
})
