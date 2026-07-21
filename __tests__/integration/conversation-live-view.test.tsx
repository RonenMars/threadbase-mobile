/**
 * Read-only live conversation view (app/conversation/[id].tsx).
 *
 * P2.2 — external-session frames (keyed by the conversation UUID in sessionId)
 * append to the transcript; frames for another conversation are ignored; a line
 * that arrives over WS and again via the REST drain is not duplicated; the
 * additive conversation_updated push triggers a delta drain.
 * P2.1 — the freshness poll runs only while the screen is focused AND the app is
 * foregrounded.
 * The view is strictly read-only: no composer.
 *
 * useConversation is mocked (its own drain is covered by useConversations
 * tests) so triggerDelta is an observable spy; useConversationStream is REAL,
 * driven through the mocked ws-client.
 */
import React from 'react'
import { AppState } from 'react-native'
import { render, act, type RenderResult } from '@testing-library/react-native'
import { useLocalSearchParams } from 'expo-router'
import ConversationDetailScreen from '@/app/conversation/[id]'
import { useServersStore } from '@/stores/servers'
import { createWrapper } from '@/test-utils'
import type { Message } from '@/types/api'

// ── observable delta trigger + controllable REST history ─────────────────────
const mockTriggerDelta = jest.fn()
const mockConversationRef: { current: unknown } = { current: null }

jest.mock('@/hooks/useConversations', () => ({
  useConversation: () => ({
    data: mockConversationRef.current,
    isLoading: false,
    error: null,
    refetch: jest.fn(),
    fetchNextPage: jest.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNewerPage: jest.fn(),
    isFetchingNewerPage: false,
    totalMessages: 0,
    loadedMessages: 0,
    triggerDelta: mockTriggerDelta,
  }),
}))

// ── ws-client: shared handler registry so getClient()'s per-call objects all
// register into one place; `emit` fans a frame out to subscribers. ────────────
const mockWsHandlers = new Map<string, Set<(msg: unknown) => void>>()
jest.mock('@/services/ws-client', () => ({
  wsManager: {
    getClient: () => ({
      on: (type: string, handler: (msg: unknown) => void) => {
        if (!mockWsHandlers.has(type)) mockWsHandlers.set(type, new Set())
        mockWsHandlers.get(type)!.add(handler)
        return () => mockWsHandlers.get(type)?.delete(handler)
      },
      status: () => 'connected',
      send: jest.fn(),
    }),
    onAnyStatusChange: () => () => {},
  },
}))

function emit(type: string, msg: unknown) {
  mockWsHandlers.get(type)?.forEach((h) => h(msg))
}

jest.mock('@/hooks/useSessionActions', () => ({
  useSessionActions: () => ({ resume: { mutate: jest.fn(), isPending: false, isError: false } }),
}))

// Surface each message's first text block so the transcript is assertable.
jest.mock('@/components/conversation/MessageItem', () => ({
  MessageItem: ({ message }: { message: Message }) => {
    const { Text: RNText } = jest.requireActual('react-native')
    const textBlock = message.content.find((b: { type: string }) => b.type === 'text') as
      | { type: 'text'; text: string }
      | undefined
    if (!textBlock) return null
    return <RNText testID="message-text">{textBlock.text}</RNText>
  },
}))

function histMsg(index: number, uuid: string, text: string): Message {
  return {
    id: `conv-1-${index}`,
    uuid,
    messageIndex: index,
    role: index % 2 === 0 ? 'user' : 'assistant',
    content: [{ type: 'text', text }],
    timestamp: `2026-07-19T10:00:0${index}Z`,
    is_sidechain: false,
    parent_uuid: null,
  }
}

function makeConversation(messages: Message[]) {
  return {
    id: 'conv-1',
    title: 'Live Convo',
    projectPath: '/tmp/p',
    messageCount: messages.length,
    lastActivity: '2026-07-19T12:00:00Z',
    resumable: true,
    provider: 'claude-code' as const,
    messages,
  }
}

// A raw Claude JSONL user line (content as a bare string, matching Claude Code).
function claudeUserLine(uuid: string, text: string): string {
  return JSON.stringify({
    type: 'user',
    uuid,
    timestamp: '2026-07-19T12:00:00Z',
    message: { role: 'user', content: text },
  })
}

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

// Flush passive effects (and FlashList's cell-render timer) inside act.
async function settle(ms = 600) {
  await act(async () => {
    jest.advanceTimersByTime(ms)
  })
}

describe('conversation live view — transcript merge (P2.2)', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    seedServer()
    mockWsHandlers.clear()
    mockTriggerDelta.mockClear()
    mockConversationRef.current = makeConversation([histMsg(0, 'h0', 'hello historical')])
    ;(useLocalSearchParams as jest.Mock).mockReturnValue({ id: 'conv-1', server: 'srv1' })
  })
  afterEach(() => {
    jest.clearAllTimers()
    jest.useRealTimers()
  })

  it('appends streamed conversation_events for the viewed conversation', async () => {
    const root: RenderResult = await render(<ConversationDetailScreen />, { wrapper: createWrapper() })
    await settle()
    expect(root.getByText('hello historical')).toBeTruthy()

    await act(async () => {
      emit('conversation_events', {
        type: 'conversation_events',
        sessionId: 'conv-1',
        lines: [claudeUserLine('L0', 'live streamed line')],
      })
    })
    await settle()

    expect(root.getByText('live streamed line')).toBeTruthy()
  })

  it('ignores frames for a different conversation id', async () => {
    const root: RenderResult = await render(<ConversationDetailScreen />, { wrapper: createWrapper() })
    await settle()

    await act(async () => {
      emit('conversation_events', {
        type: 'conversation_events',
        sessionId: 'other-conv',
        lines: [claudeUserLine('X', 'from another convo')],
      })
    })
    await settle()

    expect(root.queryByText('from another convo')).toBeNull()
    expect(root.getByText('hello historical')).toBeTruthy()
  })

  it('does not duplicate a line delivered over WS and again via REST history', async () => {
    mockConversationRef.current = makeConversation([
      histMsg(0, 'h0', 'hello'),
      histMsg(1, 'dup-uuid', 'echoed turn'),
    ])
    const root: RenderResult = await render(<ConversationDetailScreen />, { wrapper: createWrapper() })
    await settle()
    expect(root.getAllByText('echoed turn')).toHaveLength(1)

    await act(async () => {
      emit('conversation_event', {
        type: 'conversation_event',
        sessionId: 'conv-1',
        line: claudeUserLine('dup-uuid', 'echoed turn'),
      })
    })
    await settle()

    expect(root.getAllByText('echoed turn')).toHaveLength(1)
  })

  it('is strictly read-only — renders no composer', async () => {
    const root: RenderResult = await render(<ConversationDetailScreen />, { wrapper: createWrapper() })
    await settle()

    expect(root.queryByTestId('chat-message-input')).toBeNull()
    expect(root.queryByTestId('chat-send-button')).toBeNull()
  })
})

describe('conversation live view — freshness triggers (P2.1)', () => {
  let appStateListeners: ((s: string) => void)[] = []
  const fireAppState = (s: string) => appStateListeners.forEach((l) => l(s))

  beforeEach(() => {
    jest.useFakeTimers()
    seedServer()
    mockWsHandlers.clear()
    mockTriggerDelta.mockClear()
    mockConversationRef.current = makeConversation([histMsg(0, 'h0', 'hello historical')])
    ;(useLocalSearchParams as jest.Mock).mockReturnValue({ id: 'conv-1', server: 'srv1' })
    appStateListeners = []
    Object.defineProperty(AppState, 'currentState', { value: 'active', configurable: true, writable: true })
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, cb) => {
      appStateListeners.push(cb as (s: string) => void)
      return { remove: jest.fn() } as ReturnType<typeof AppState.addEventListener>
    })
  })
  afterEach(() => {
    jest.restoreAllMocks()
    jest.clearAllTimers()
    jest.useRealTimers()
  })

  it('polls the delta drain only while focused and foregrounded', async () => {
    await render(<ConversationDetailScreen />, { wrapper: createWrapper() })
    // Flush passive effects so the focus-poll interval starts (currentState=active).
    await act(async () => {})

    await act(async () => {
      jest.advanceTimersByTime(3000)
    })
    expect(mockTriggerDelta).toHaveBeenCalledTimes(1)
    await act(async () => {
      jest.advanceTimersByTime(3000)
    })
    expect(mockTriggerDelta).toHaveBeenCalledTimes(2)

    // Background: the interval stops.
    fireAppState('background')
    mockTriggerDelta.mockClear()
    await act(async () => {
      jest.advanceTimersByTime(9000)
    })
    expect(mockTriggerDelta).not.toHaveBeenCalled()

    // Foreground again: it resumes.
    fireAppState('active')
    await act(async () => {
      jest.advanceTimersByTime(3000)
    })
    expect(mockTriggerDelta).toHaveBeenCalledTimes(1)
  })

  it('drains on a conversation_updated push for this conversation, and ignores others', async () => {
    await render(<ConversationDetailScreen />, { wrapper: createWrapper() })
    await act(async () => {}) // flush effects → conversation_updated subscription registered
    mockTriggerDelta.mockClear() // discard any mount-time interval tick

    await act(async () => {
      emit('conversation_updated', {
        type: 'conversation_updated',
        conversationId: 'conv-1',
        messageCount: 5,
        lastActivity: '2026-07-19T12:01:00Z',
        ownership: 'external',
      })
    })
    expect(mockTriggerDelta).toHaveBeenCalledTimes(1)

    mockTriggerDelta.mockClear()
    await act(async () => {
      emit('conversation_updated', {
        type: 'conversation_updated',
        conversationId: 'other-conv',
        messageCount: 9,
        lastActivity: '2026-07-19T12:02:00Z',
        ownership: 'external',
      })
    })
    expect(mockTriggerDelta).not.toHaveBeenCalled()
  })
})
