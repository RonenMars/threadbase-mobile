/**
 * Search-origin anchored navigation on the conversation detail screen:
 * resolving a search query to a target message, requesting the anchored
 * window in one request (no sequential tail-then-backfill), and falling back
 * cleanly to the normal tail view when no target resolves.
 */
import React from 'react'
import { act, fireEvent, render, waitFor, within } from '@testing-library/react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
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
  ;(useRouter as jest.Mock).mockReturnValue({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    navigate: jest.fn(),
    setParams: jest.fn(),
    canGoBack: jest.fn(() => true),
  })
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

  it('does not re-fetch when stepping to a match already in the loaded window', async () => {
    ;(useLocalSearchParams as jest.Mock).mockReturnValue({
      id: 'conv-anchor',
      server: 'srv1',
      search: 'needle',
    })
    // Two matches, both inside the 120-message window fetched around index 150.
    mockSearchTargetResponder = () => ({
      query: 'needle',
      message_index: 150,
      uuid: 'uuid-150',
      snippet: 'a needle appears',
      match_indexes: [148, 150],
      total_matches: 2,
    })
    mockAnchoredResponder = () =>
      makeDetail(90, 120, 300, { anchor_index: 150, has_more_newer: true, next_after_index: 210 })

    const { getByTestId } = await render(<ConversationDetailScreen />, { wrapper: createWrapper() })
    await flushQueries()
    await waitFor(() => {
      expect(getByTestId('search-match-nav')).toBeTruthy()
    })
    const anchoredFetchesBefore = mockRequestedPaths.filter((p) => p.includes('anchor_index=')).length

    // Step prev to match 148 — it's already in the loaded window (90..209), so
    // no new anchored fetch should fire (regression: endless skeleton when a
    // pointless re-fetch produces an unchanged window that never re-lays-out).
    await act(async () => {
      fireEvent.press(getByTestId('search-match-prev'))
    })
    await flushQueries()

    const anchoredFetchesAfter = mockRequestedPaths.filter((p) => p.includes('anchor_index=')).length
    expect(anchoredFetchesAfter).toBe(anchoredFetchesBefore)
  })

  it('re-fetches a fresh window when stepping to a match outside the loaded window', async () => {
    ;(useLocalSearchParams as jest.Mock).mockReturnValue({
      id: 'conv-anchor',
      server: 'srv1',
      search: 'needle',
    })
    // Two matches far apart: 150 is in the initial window, 5 is not.
    mockSearchTargetResponder = () => ({
      query: 'needle',
      message_index: 150,
      uuid: 'uuid-150',
      snippet: 'a needle appears',
      match_indexes: [5, 150],
      total_matches: 2,
    })
    mockAnchoredResponder = () =>
      makeDetail(90, 120, 300, { anchor_index: 150, has_more_newer: true, next_after_index: 210 })

    const { getByTestId } = await render(<ConversationDetailScreen />, { wrapper: createWrapper() })
    await flushQueries()
    await waitFor(() => {
      expect(getByTestId('search-match-nav')).toBeTruthy()
    })

    // Step prev to match 5 — outside the loaded window (90..209) — so a new
    // anchored window centered on 5 must be requested.
    await act(async () => {
      fireEvent.press(getByTestId('search-match-prev'))
    })
    await flushQueries()

    await waitFor(() => {
      expect(mockRequestedPaths.some((p) => p.includes('anchor_index=5'))).toBe(true)
    })
  })

  // Invariant: exactly one row is the
  // active search anchor at any time — a double-writer (or a recycled cell
  // leaking its highlight) would break stepping and the keyword-aimed scroll.
  it('marks exactly one row as the search anchor, before and after stepping', async () => {
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
      match_indexes: [148, 150],
      total_matches: 2,
    })
    // Small window so the anchor rows are inside the FlatList mock's initial
    // render batch — a 120-row window leaves them unmounted under jest.
    mockAnchoredResponder = () => makeDetail(145, 10, 300, { anchor_index: 150 })

    const { getByTestId, queryAllByTestId } = await render(<ConversationDetailScreen />, {
      wrapper: createWrapper(),
    })
    await flushQueries()

    await waitFor(() => {
      const anchors = queryAllByTestId('search-anchor-message')
      expect(anchors).toHaveLength(1)
      expect(within(anchors[0]).getByText('message 150')).toBeTruthy()
    })

    await act(async () => {
      fireEvent.press(getByTestId('search-match-prev'))
    })
    await flushQueries()

    await waitFor(() => {
      const anchors = queryAllByTestId('search-anchor-message')
      expect(anchors).toHaveLength(1)
      expect(within(anchors[0]).getByText('message 148')).toBeTruthy()
    })
  })

  // Documents that counting is per-message: a message
  // containing the needle twice is still one match, and the counter's
  // numerator and denominator both walk match_indexes.
  it('counts matches per message, not per occurrence', async () => {
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
      match_indexes: [148, 150],
      total_matches: 2,
    })
    const detail = makeDetail(145, 10, 300, { anchor_index: 150 })
    detail.messages[5].text = 'a needle here and another needle there'
    mockAnchoredResponder = () => detail

    const { getByTestId } = await render(<ConversationDetailScreen />, { wrapper: createWrapper() })
    await flushQueries()

    await waitFor(() => {
      expect(getByTestId('search-match-count')).toHaveTextContent('2 of 2')
    })
  })

  // The streamer caps match_indexes (last 1000) but reports the uncapped
  // total_matches. The denominator must count the navigable list, not the
  // uncapped total — with a "+" signalling the truncation.
  it('caps the counter denominator at the navigable list when total_matches exceeds it', async () => {
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
      match_indexes: [148, 150],
      total_matches: 5,
    })
    mockAnchoredResponder = () => makeDetail(145, 10, 300, { anchor_index: 150 })

    const { getByTestId } = await render(<ConversationDetailScreen />, { wrapper: createWrapper() })
    await flushQueries()

    await waitFor(() => {
      expect(getByTestId('search-match-count')).toHaveTextContent('2 of 2+')
    })
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

  it('submits in-chat search from the header bar and scopes to this conversation', async () => {
    const setParams = jest.fn()
    ;(useRouter as jest.Mock).mockReturnValue({
      push: jest.fn(),
      replace: jest.fn(),
      back: jest.fn(),
      navigate: jest.fn(),
      setParams,
      canGoBack: jest.fn(() => true),
    })
    ;(useLocalSearchParams as jest.Mock).mockReturnValue({ id: 'conv-anchor', server: 'srv1' })
    mockTailResponder = () => makeDetail(0, 10, 10)

    const { getByTestId, queryByTestId } = await render(<ConversationDetailScreen />, {
      wrapper: createWrapper(),
    })
    await flushQueries()

    await waitFor(() => {
      expect(getByTestId('conversation-search-btn')).toBeTruthy()
    })
    expect(queryByTestId('conversation-search-input')).toBeNull()

    await act(async () => {
      fireEvent.press(getByTestId('conversation-search-btn'))
    })
    const input = getByTestId('conversation-search-input')
    await act(async () => {
      fireEvent.changeText(input, '  needle  ')
    })
    await act(async () => {
      fireEvent(input, 'submitEditing')
    })

    expect(setParams).toHaveBeenCalledWith({ search: 'needle', anchor_index: '' })
    // Hub-wide /api/search must not be used for in-chat search.
    expect(mockRequestedPaths.some((p) => p.includes('/api/search'))).toBe(false)
  })

  it('auto-opens the in-chat search bar when navigation already carries ?search=', async () => {
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

    const { getByTestId } = await render(<ConversationDetailScreen />, { wrapper: createWrapper() })
    await flushQueries()

    await waitFor(() => {
      expect(getByTestId('search-match-nav')).toBeTruthy()
    })
    expect(getByTestId('conversation-search-input')).toBeTruthy()
    expect(getByTestId('conversation-search-input').props.value).toBe('needle')
  })
})
