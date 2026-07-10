/**
 * Search-origin anchored navigation on the conversation detail screen:
 * resolving a search query to a target message, requesting the anchored
 * window in one request (no sequential tail-then-backfill), and falling back
 * cleanly to the normal tail view when no target resolves.
 */
import React from 'react'
import { act, render, waitFor } from '@testing-library/react-native'
import { useLocalSearchParams } from 'expo-router'
import ConversationDetailScreen from '@/app/conversation/[id]'
import { useServersStore } from '@/stores/servers'
import { createWrapper } from '@/test-utils'
import { NotFoundError } from '@/services/api-client'

function makeDetail(fromIndex: number, count: number, total: number, extra: Record<string, unknown> = {}) {
  const messages = Array.from({ length: count }, (_, i) => ({
    message_index: fromIndex + i,
    uuid: `uuid-${fromIndex + i}`,
    role: i % 2 === 0 ? 'user' : 'assistant',
    timestamp: `2026-06-10T10:00:${String((fromIndex + i) % 60).padStart(2, '0')}Z`,
    text: `message ${fromIndex + i}`,
  }))
  return {
    meta: {
      id: 'conv-anchor',
      project_name: 'Anchor Test',
      project_path: '/tmp/p',
      last_updated_at: '2026-06-10T11:00:00Z',
      message_count: total,
    },
    messages,
    message_pagination: {
      total,
      before_index: fromIndex + count,
      from_index: fromIndex,
      has_more_older: fromIndex > 0,
      next_before_index: fromIndex > 0 ? fromIndex : null,
      ...extra,
    },
  }
}

// path-keyed responders — search-target (via QUERY), the tail page, and the
// anchored page are distinguishable by request shape.
let mockSearchTargetResponder: (() => unknown) | null = null
let mockTailResponder: (() => unknown) | null = null
let mockAnchoredResponder: (() => unknown) | null = null
const mockRequestedPaths: string[] = []
const mockQueryCalls: { path: string; body: unknown }[] = []

jest.mock('@/services/api-client', () => {
  const { NotFoundError } = jest.requireActual('@/services/api-client')
  return {
    NotFoundError,
    createApiForServer: () => ({
      get: (path: string) => {
        mockRequestedPaths.push(path)
        if (path.includes('anchor_index=') || path.includes('after_index=')) {
          if (!mockAnchoredResponder) return Promise.reject(new Error('no anchored responder'))
          const v = mockAnchoredResponder()
          return v instanceof Error ? Promise.reject(v) : Promise.resolve(v)
        }
        if (!mockTailResponder) return Promise.reject(new Error('no tail responder'))
        const v = mockTailResponder()
        return v instanceof Error ? Promise.reject(v) : Promise.resolve(v)
      },
      getWithMeta: (path: string) => {
        mockRequestedPaths.push(path)
        if (!mockTailResponder) return Promise.reject(new Error('no tail responder'))
        const v = mockTailResponder()
        return v instanceof Error
          ? Promise.reject(v)
          : Promise.resolve({ status: 200, etag: null, body: v })
      },
      // HTTP QUERY (RFC 10008) — the search-target resolver's only caller.
      query: (path: string, body: unknown) => {
        mockRequestedPaths.push(path)
        mockQueryCalls.push({ path, body })
        if (!mockSearchTargetResponder) return Promise.reject(new Error('no search-target responder'))
        const v = mockSearchTargetResponder()
        return v instanceof Error ? Promise.reject(v) : Promise.resolve(v)
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

async function flushQueries() {
  for (let i = 0; i < 30; i++) {
    await act(async () => {
      jest.advanceTimersByTime(20)
    })
  }
}

beforeEach(() => {
  jest.useFakeTimers()
  seedServer()
  mockSearchTargetResponder = null
  mockTailResponder = null
  mockAnchoredResponder = null
  mockRequestedPaths.length = 0
  mockQueryCalls.length = 0
})

afterEach(() => {
  jest.clearAllTimers()
  jest.useRealTimers()
})

describe('conversation detail — search-anchored navigation', () => {
  it('resolves the target and requests only the anchored window (no tail request)', async () => {
    ;(useLocalSearchParams as jest.Mock).mockReturnValue({
      id: 'conv-anchor',
      server: 'srv1',
      search: 'needle',
    })
    mockSearchTargetResponder = () => ({
      query: 'needle',
      message_index: 150,
      uuid: 'uuid-150',
      snippet: 'a needle appears',
      match_indexes: [150],
      total_matches: 1,
    })
    mockAnchoredResponder = () =>
      makeDetail(90, 120, 300, { anchor_index: 150, has_more_newer: true, next_after_index: 210 })

    await render(<ConversationDetailScreen />, { wrapper: createWrapper() })
    await flushQueries()

    await waitFor(() => {
      // Resolver call: QUERY with the search term in the JSON body, not the URL.
      expect(mockQueryCalls.some((c) => c.path.includes('/search-target') && (c.body as { q?: string })?.q === 'needle')).toBe(true)
      expect(mockRequestedPaths.some((p) => p.includes('anchor_index=150'))).toBe(true)
    })
    expect(mockRequestedPaths.some((p) => p.includes('msg_limit=80') && !p.includes('anchor'))).toBe(false)
  })

  it('falls back to the tail view with no highlight when the resolver 404s', async () => {
    ;(useLocalSearchParams as jest.Mock).mockReturnValue({
      id: 'conv-anchor',
      server: 'srv1',
      search: 'project-path-only-term',
    })
    mockSearchTargetResponder = () => new NotFoundError('/search-target')
    mockTailResponder = () => makeDetail(0, 10, 10)

    await render(<ConversationDetailScreen />, { wrapper: createWrapper() })
    await flushQueries()

    await waitFor(() => {
      expect(mockRequestedPaths.some((p) => p.includes('/search-target'))).toBe(true)
      expect(mockRequestedPaths.some((p) => p.includes('msg_limit=80'))).toBe(true)
    })
    expect(mockRequestedPaths.some((p) => p.includes('anchor_index'))).toBe(false)
  })

  it('does not call the resolver when no search param is present (regression)', async () => {
    ;(useLocalSearchParams as jest.Mock).mockReturnValue({ id: 'conv-anchor', server: 'srv1' })
    mockTailResponder = () => makeDetail(0, 10, 10)

    await render(<ConversationDetailScreen />, { wrapper: createWrapper() })
    await flushQueries()

    await waitFor(() => {
      expect(mockRequestedPaths.some((p) => p.includes('msg_limit=80'))).toBe(true)
    })
    expect(mockRequestedPaths.some((p) => p.includes('/search-target'))).toBe(false)
  })

  it('skips the resolver and anchors directly when anchor_index is already in the params', async () => {
    ;(useLocalSearchParams as jest.Mock).mockReturnValue({
      id: 'conv-anchor',
      server: 'srv1',
      search: 'needle',
      anchor_index: '150',
    })
    mockAnchoredResponder = () => makeDetail(90, 120, 300, { anchor_index: 150 })

    await render(<ConversationDetailScreen />, { wrapper: createWrapper() })
    await flushQueries()

    await waitFor(() => {
      expect(mockRequestedPaths.some((p) => p.includes('anchor_index=150'))).toBe(true)
    })
    expect(mockRequestedPaths.some((p) => p.includes('/search-target'))).toBe(false)
  })
})
