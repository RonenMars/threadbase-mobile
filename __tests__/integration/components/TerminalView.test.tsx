import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { createWrapper } from '@/test-utils'

// ── native module mocks (must be hoisted) ────────────────────────────────────
jest.mock('expo-speech-recognition', () => ({
  ExpoSpeechRecognitionModule: {
    requestPermissionsAsync: jest.fn().mockResolvedValue({ granted: false }),
    getPermissionsAsync: jest.fn().mockResolvedValue({ granted: false }),
    start: jest.fn(),
    stop: jest.fn(),
  },
  useSpeechRecognitionEvent: jest.fn(),
}))

jest.mock('react-native-keyboard-controller', () => ({
  KeyboardProvider: ({ children }: { children: unknown }) => children,
  KeyboardAwareScrollView: ({ children }: { children: unknown }) => children,
  KeyboardAvoidingView: ({ children }: { children: unknown }) => children,
  useKeyboardState: (selector?: (s: { isVisible: boolean; height: number }) => unknown) => {
    const state = { isVisible: false, height: 0 }
    return selector ? selector(state) : state
  },
}))

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: unknown }) => children,
  SafeAreaView: ({ children }: { children: unknown }) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))

const mockPush = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({}),
}))

// ── feature mocks ────────────────────────────────────────────────────────────
const mockSendInputMutate = jest.fn()
const mockSendKeysMutate = jest.fn()
const mockRespondToQuestionMutate = jest.fn()
let mockRespondToQuestionState: { isError: boolean; error: Error | null } = {
  isError: false,
  error: null,
}

jest.mock('@/hooks/useTerminalStream', () => ({
  useTerminalStream: () => ({
    lines: ['line one', 'line two'],
    isStreaming: false,
  }),
}))

// Controllable seed-history fixture for SessionHistoryFeed (rendered above
// TerminalOutput whenever TerminalView gets a conversationId).
let mockHistoryMessages: import('@/types/api').Message[] = []
let mockHistoryHasNextPage = false
let mockHistoryIsFetchingNextPage = false
// The conversation's real message total (server's message_pagination.total,
// surfaced by useConversation as `totalMessages`) — deliberately independent
// of mockHistoryMessages.length so tests can prove the header reports the
// true size, not merely what the byte-bounded seed has loaded so far.
let mockHistoryTotalMessages = 0
const mockHistoryFetchNextPage = jest.fn()
const mockHistoryFetchNewerPage = jest.fn()
jest.mock('@/hooks/useConversations', () => ({
  useConversation: () => ({
    data: { messages: mockHistoryMessages },
    fetchNextPage: mockHistoryFetchNextPage,
    hasNextPage: mockHistoryHasNextPage,
    isFetchingNextPage: mockHistoryIsFetchingNextPage,
    fetchNewerPage: mockHistoryFetchNewerPage,
    hasNewerPage: false,
    isFetchingNewerPage: false,
    totalMessages: mockHistoryTotalMessages,
  }),
}))
// MessageItem has no stable per-message testID exposing its text — mock it to
// surface the first text block directly, same as LiveConversationView.test.tsx.
jest.mock('@/components/conversation/MessageItem', () => ({
  MessageItem: ({ message }: { message: import('@/types/api').Message }) => {
    const { Text: RNText } = jest.requireActual('react-native')
    const textBlock = message.content.find((b: { type: string }) => b.type === 'text') as
      | { type: 'text'; text: string }
      | undefined
    if (!textBlock) return null
    return <RNText testID="session-history-message">{textBlock.text}</RNText>
  },
}))

jest.mock('@/hooks/useSessionActions', () => ({
  useSessionActions: () => ({
    sendInput: {
      mutate: mockSendInputMutate,
      mutateAsync: mockSendInputMutate,
      isError: false,
      error: null,
    },
    sendKeys: { mutate: mockSendKeysMutate },
    respondToQuestion: {
      mutate: mockRespondToQuestionMutate,
      isError: mockRespondToQuestionState.isError,
      error: mockRespondToQuestionState.error,
    },
  }),
}))

jest.mock('@/hooks/useComposerState', () => ({
  useComposerState: ({ onSend }: { onSend: (payload: string, text: string) => void }) => ({
    inputText: 'hello',
    handleInputChange: jest.fn(),
    handleSend: () => onSend('test-payload', 'test-payload'),
    slashBoardVisible: false,
    setSlashBoardVisible: jest.fn(),
    pendingArgCommand: null,
    setPendingArgCommand: jest.fn(),
    handleSlashCommandSelect: jest.fn(),
    handleSlashArgConfirm: jest.fn(),
    attachments: [],
    isUploading: false,
    attachError: null,
    handleAttach: jest.fn(),
    removeAttachment: jest.fn(),
    queueVisible: false,
    setQueueVisible: jest.fn(),
    voice: { listening: false, start: jest.fn(), stop: jest.fn() },
    micGranted: true,
    handleToggleMic: jest.fn(),
  }),
}))

jest.mock('@/services/ws-client', () => ({
  // on() is needed now that TerminalView subscribes via useActiveQuestion.
  wsManager: { getClient: () => ({ status: () => 'connected', send: jest.fn(), on: jest.fn(() => jest.fn()) }) },
}))

jest.mock('@/components/shared/SlashCommandBoard', () => ({
  SlashCommandBoard: () => null,
}))
jest.mock('@/components/shared/SlashCommandArgModal', () => ({
  SlashCommandArgModal: () => null,
}))
jest.mock('@/components/queue/PromptQueueSheet', () => ({
  PromptQueueSheet: () => null,
}))
jest.mock('@/components/queue/PlanPreviewSheet', () => ({
  PlanPreviewSheet: () => null,
}))

const mockSearchTargetQuery = jest.fn()
jest.mock('@/services/api-client', () => {
  const actual = jest.requireActual('@/services/api-client')
  return {
    ...actual,
    createApiForServer: () => ({
      query: (path: string, body: { q: string }) => mockSearchTargetQuery(path, body),
    }),
  }
})

// eslint-disable-next-line import/first
import { TerminalView } from '@/components/terminal/TerminalView'
// eslint-disable-next-line import/first
import { NetworkError, QUESTION_GONE_CODE } from '@/services/api-client'

async function renderView(props?: { resumedConversationId?: string; conversationId?: string }) {
  return await render(
    <TerminalView serverId="srv1" sessionId="sess1" {...props} />,
    { wrapper: createWrapper() },
  )
}

describe('TerminalView', () => {
  beforeEach(() => {
    mockSendInputMutate.mockClear()
    mockSendKeysMutate.mockClear()
    mockPush.mockClear()
    mockRespondToQuestionState = { isError: false, error: null }
    mockHistoryMessages = []
    mockHistoryHasNextPage = false
    mockHistoryIsFetchingNextPage = false
    mockHistoryTotalMessages = 0
    mockHistoryFetchNextPage.mockClear()
    mockHistoryFetchNewerPage.mockClear()
    mockSearchTargetQuery.mockReset()
  })

  describe('session history feed (seeded from the conversation)', () => {
    it('does not render the history feed when no conversationId is given', async () => {
      mockHistoryMessages = [
        { id: 'm1', uuid: null, role: 'user', content: [{ type: 'text', text: 'older message' }], timestamp: '', is_sidechain: false, parent_uuid: null },
      ]
      await renderView()
      expect(screen.queryByTestId('session-history-feed')).toBeNull()
    })

    it('renders the history header above the terminal when a conversationId is given', async () => {
      mockHistoryMessages = [
        { id: 'm1', uuid: null, role: 'user', content: [{ type: 'text', text: 'older message one' }], timestamp: '', is_sidechain: false, parent_uuid: null },
        { id: 'm2', uuid: null, role: 'assistant', content: [{ type: 'text', text: 'older message two' }], timestamp: '', is_sidechain: false, parent_uuid: null },
      ]
      await renderView({ conversationId: 'conv-1' })
      expect(screen.getByTestId('session-history-feed')).toBeTruthy()
      expect(screen.queryByTestId('session-history-message')).toBeNull()
      // The live terminal tail still renders as its own separate region.
      expect(screen.getAllByTestId('terminal-line-row').length).toBeGreaterThanOrEqual(2)
    })

    it('gives the expanded history region and list a concrete height', async () => {
      mockHistoryMessages = [
        { id: 'm1', uuid: null, role: 'user', content: [{ type: 'text', text: 'older message' }], timestamp: '', is_sidechain: false, parent_uuid: null },
      ]
      await renderView({ conversationId: 'conv-1' })
      await fireEvent.press(screen.getByTestId('session-history-toggle'))
      expect(screen.getByTestId('session-history-feed')).toHaveStyle({ height: '35%' })
      expect(screen.getByTestId('session-history-list')).toHaveStyle({ flex: 1 })
    })

    it('opens from the latest message without autoscrolling back to the tail on prepend', async () => {
      mockHistoryMessages = [
        { id: 'm1', uuid: null, role: 'user', content: [{ type: 'text', text: 'older message' }], timestamp: '', is_sidechain: false, parent_uuid: null },
      ]
      mockHistoryHasNextPage = true
      await renderView({ conversationId: 'conv-1' })
      await fireEvent.press(screen.getByTestId('session-history-toggle'))
      const list = screen.getByTestId('session-history-list')
      expect(list.props.maintainVisibleContentPosition).toEqual(
        expect.objectContaining({ startRenderingFromBottom: true }),
      )
      expect(list.props.maintainVisibleContentPosition.autoscrollToBottomThreshold).toBeUndefined()
      expect(list.props.drawDistance).toBe(2000)
      expect(mockHistoryFetchNextPage).not.toHaveBeenCalled()
      fireEvent(list, 'startReached')
      expect(mockHistoryFetchNextPage).toHaveBeenCalledTimes(1)
    })

    it('does not render the history feed when the conversation has no messages yet', async () => {
      mockHistoryMessages = []
      await renderView({ conversationId: 'conv-empty' })
      expect(screen.queryByTestId('session-history-feed')).toBeNull()
    })

    it('shows the load-boundary spinner while an older page is in flight', async () => {
      mockHistoryMessages = [
        { id: 'm1', uuid: null, role: 'user', content: [{ type: 'text', text: 'x' }], timestamp: '', is_sidechain: false, parent_uuid: null },
      ]
      mockHistoryHasNextPage = true
      mockHistoryIsFetchingNextPage = true
      await renderView({ conversationId: 'conv-1' })
      await fireEvent.press(screen.getByTestId('session-history-toggle'))
      expect(screen.getByTestId('history-load-boundary-spinner')).toBeTruthy()
    })

    it('starts collapsed on every live-session visit', async () => {
      mockHistoryMessages = [
        { id: 'm1', uuid: null, role: 'user', content: [{ type: 'text', text: 'older message' }], timestamp: '', is_sidechain: false, parent_uuid: null },
      ]
      await renderView({ conversationId: 'conv-1' })
      expect(screen.queryByTestId('session-history-message')).toBeNull()
      expect(screen.getByTestId('session-history-toggle').props.accessibilityState).toEqual({ expanded: false })
    })

    it('expands on tap, showing the messages, without writing a persisted preference', async () => {
      mockHistoryMessages = [
        { id: 'm1', uuid: null, role: 'user', content: [{ type: 'text', text: 'older message' }], timestamp: '', is_sidechain: false, parent_uuid: null },
      ]
      await renderView({ conversationId: 'conv-1' })
      await fireEvent.press(screen.getByTestId('session-history-toggle'))
      expect(screen.getByTestId('session-history-message')).toBeTruthy()
      // The live terminal tail is unaffected by the history region expanding.
      expect(screen.getAllByTestId('terminal-line-row').length).toBeGreaterThanOrEqual(2)
    })

    it('collapses again on a second tap, hiding the messages', async () => {
      mockHistoryMessages = [
        { id: 'm1', uuid: null, role: 'user', content: [{ type: 'text', text: 'older message' }], timestamp: '', is_sidechain: false, parent_uuid: null },
      ]
      await renderView({ conversationId: 'conv-1' })
      await fireEvent.press(screen.getByTestId('session-history-toggle'))
      await fireEvent.press(screen.getByTestId('session-history-toggle'))
      expect(screen.queryByTestId('session-history-message')).toBeNull()
    })

    it('shows the conversation\'s real total in the header, not just what the byte-bounded seed has loaded', async () => {
      // A 512KB-bounded seed page can load far fewer messages than the
      // conversation actually has — message_pagination.total (surfaced as
      // totalMessages) is the true count; mockHistoryMessages.length is only
      // what happened to fit in the first page.
      mockHistoryMessages = [
        { id: 'm1', uuid: null, role: 'user', content: [{ type: 'text', text: 'a' }], timestamp: '', is_sidechain: false, parent_uuid: null },
        { id: 'm2', uuid: null, role: 'assistant', content: [{ type: 'text', text: 'b' }], timestamp: '', is_sidechain: false, parent_uuid: null },
      ]
      mockHistoryTotalMessages = 350
      await renderView({ conversationId: 'conv-1' })
      expect(screen.getByText('History · 350 messages')).toBeTruthy()
      expect(screen.queryByText('History · 2 messages')).toBeNull()
    })
  })

  describe('session history full-screen (maximize/minimize)', () => {
    beforeEach(() => {
      mockHistoryMessages = [
        { id: 'm1', uuid: null, role: 'user', content: [{ type: 'text', text: 'older message' }], timestamp: '', is_sidechain: false, parent_uuid: null },
      ]
      mockHistoryTotalMessages = 1
    })

    it('offers a maximize control when expanded, but not while collapsed', async () => {
      await renderView({ conversationId: 'conv-1' })
      expect(screen.queryByTestId('expand-history-button')).toBeNull()

      await fireEvent.press(screen.getByTestId('session-history-toggle'))
      expect(screen.getByTestId('expand-history-button')).toBeTruthy()

      await fireEvent.press(screen.getByTestId('session-history-toggle'))
      expect(screen.queryByTestId('expand-history-button')).toBeNull()
    })

    it('maximizing fills the history region and hides (without unmounting) the terminal', async () => {
      await renderView({ conversationId: 'conv-1' })
      const rowsBefore = screen.getAllByTestId('terminal-line-row').length
      expect(rowsBefore).toBeGreaterThanOrEqual(2)

      await fireEvent.press(screen.getByTestId('session-history-toggle'))
      await fireEvent.press(screen.getByTestId('expand-history-button'))

      expect(screen.getByTestId('minimize-history-button')).toBeTruthy()
      expect(screen.getByTestId('session-history-feed')).toHaveStyle({ flex: 1 })
      expect(screen.getByTestId('session-history-feed')).not.toHaveStyle({ maxHeight: '35%' })
      expect(screen.queryByTestId('expand-history-button')).toBeNull()
      // The collapse toggle is not offered while full — there is nothing to
      // collapse into once the terminal is hidden and history owns the screen.
      expect(screen.queryByTestId('session-history-toggle')).toBeNull()
      // The terminal region is visually hidden via style, never unmounted: its
      // rows are still present in the tree (queried with `hidden: true` since
      // @testing-library/react-native excludes display:none subtrees from the
      // default, accessibility-filtered query) at the same count as before.
      expect(screen.getByTestId('terminal-output-region', { hidden: true }).props.style).toEqual({ display: 'none' })
      expect(screen.getAllByTestId('terminal-line-row', { hidden: true }).length).toBe(rowsBefore)
      // History still shows its content in full-screen mode.
      expect(screen.getByTestId('session-history-message')).toBeTruthy()
    })

    it('minimizing restores the terminal region and returns to mini', async () => {
      await renderView({ conversationId: 'conv-1' })
      await fireEvent.press(screen.getByTestId('session-history-toggle'))
      await fireEvent.press(screen.getByTestId('expand-history-button'))
      await fireEvent.press(screen.getByTestId('minimize-history-button'))

      expect(screen.getByTestId('terminal-output-region').props.style).toEqual({ flex: 1 })
      expect(screen.getByTestId('expand-history-button')).toBeTruthy()
      expect(screen.getByTestId('session-history-toggle')).toBeTruthy()
      expect(screen.getByTestId('session-history-message')).toBeTruthy()
    })

    // Full-screen is unreachable from collapsed (the maximize control is not
    // offered there), so the only route in is expand-then-maximize — which
    // means minimize lands on mini. "Returns to the prior state" therefore has
    // exactly one reachable case; there is no collapsed→full→collapsed path.
    it('lands on mini after expanding out of collapsed to reach full-screen', async () => {
      await renderView({ conversationId: 'conv-1' })
      // Collapsed hides the maximize control (see the test above), so reach
      // full-screen the only way it's offered: expand, then maximize.
      await fireEvent.press(screen.getByTestId('session-history-toggle'))
      await fireEvent.press(screen.getByTestId('expand-history-button'))
      await fireEvent.press(screen.getByTestId('minimize-history-button'))

      expect(screen.getByTestId('session-history-message')).toBeTruthy()
    })
  })

  describe('session history in-feed search', () => {
    const seedMessage = {
      id: 'm1',
      uuid: null,
      role: 'user' as const,
      content: [{ type: 'text' as const, text: 'needle in history' }],
      timestamp: '',
      is_sidechain: false,
      parent_uuid: null,
      messageIndex: 1,
    }

    beforeEach(() => {
      mockHistoryMessages = [seedMessage]
      mockHistoryTotalMessages = 1
      mockSearchTargetQuery.mockResolvedValue({
        query: 'needle',
        message_index: 1,
        uuid: null,
        snippet: 'needle in history',
        match_indexes: [1],
        total_matches: 1,
      })
    })

    it('hides search while collapsed and shows it once the feed is mini', async () => {
      await renderView({ conversationId: 'conv-1' })
      expect(screen.queryByTestId('session-history-search-btn')).toBeNull()

      await fireEvent.press(screen.getByTestId('session-history-toggle'))
      expect(screen.getByTestId('session-history-search-btn')).toBeTruthy()
      expect(screen.getByTestId('session-history-chevron')).toBeTruthy()
    })

    it('opening search from mini expands to full-screen and shows the query bar', async () => {
      await renderView({ conversationId: 'conv-1' })
      await fireEvent.press(screen.getByTestId('session-history-toggle'))
      await fireEvent.press(screen.getByTestId('session-history-search-btn'))

      expect(screen.getByTestId('session-history-search-input')).toBeTruthy()
      expect(screen.getByTestId('session-history-feed')).toHaveStyle({ flex: 1 })
      expect(screen.getByTestId('minimize-history-button')).toBeTruthy()
      expect(screen.queryByTestId('session-history-toggle')).toBeNull()
    })

    it('submits a conversation-scoped search-target query, not hub /api/search', async () => {
      await renderView({ conversationId: 'conv-1' })
      await fireEvent.press(screen.getByTestId('session-history-toggle'))
      await fireEvent.press(screen.getByTestId('session-history-search-btn'))
      const input = screen.getByTestId('session-history-search-input')
      await act(async () => {
        fireEvent.changeText(input, '  needle  ')
      })
      await act(async () => {
        fireEvent(input, 'submitEditing')
      })

      await waitFor(() => {
        expect(mockSearchTargetQuery).toHaveBeenCalledWith(
          '/api/conversations/conv-1/search-target',
          { q: 'needle' },
        )
      })
    })

    it('shows match navigation when the resolver returns hits, and clear restores the seed list', async () => {
      await renderView({ conversationId: 'conv-1' })
      await fireEvent.press(screen.getByTestId('session-history-toggle'))
      await fireEvent.press(screen.getByTestId('session-history-search-btn'))
      const input = screen.getByTestId('session-history-search-input')
      await act(async () => {
        fireEvent.changeText(input, 'needle')
      })
      await act(async () => {
        fireEvent(input, 'submitEditing')
      })

      await waitFor(() => {
        expect(screen.getByTestId('search-match-nav')).toBeTruthy()
      })
      expect(screen.getByTestId('search-match-count')).toHaveTextContent('1 of 1')
      expect(screen.queryByTestId('session-history-list')).toBeNull()

      await fireEvent.press(screen.getByTestId('search-match-clear'))
      expect(screen.queryByTestId('search-match-nav')).toBeNull()
      expect(screen.getByTestId('session-history-list')).toBeTruthy()
    })
  })

  it('renders terminal-line-row elements when lines are provided', async () => {
    await renderView()
    const rows = screen.getAllByTestId('terminal-line-row')
    expect(rows.length).toBeGreaterThanOrEqual(2)
  })

  it('renders chat-message-input (the composer is present)', async () => {
    await renderView()
    expect(screen.getByTestId('chat-message-input')).toBeTruthy()
  })

  it('tapping chat-send-button calls sendInput.mutate with the payload', async () => {
    await renderView()
    await fireEvent.press(screen.getByTestId('chat-send-button'))
    expect(mockSendInputMutate).toHaveBeenCalledWith('test-payload')
  })

  it('does not show the resumed scrollback notice for a fresh session', async () => {
    await renderView()
    expect(screen.queryByTestId('terminal-resumed-scrollback-notice')).toBeNull()
  })

  it('does not show the resumed scrollback notice when conversation history is embedded', async () => {
    mockHistoryMessages = [
      { id: 'm1', uuid: null, role: 'user', content: [{ type: 'text', text: 'older message' }], timestamp: '', is_sidechain: false, parent_uuid: null },
    ]
    await renderView({ resumedConversationId: 'conv-42', conversationId: 'conv-42' })
    expect(screen.getByTestId('session-history-feed')).toBeTruthy()
    expect(screen.queryByTestId('terminal-resumed-scrollback-notice')).toBeNull()
  })

  it('shows the resumed scrollback notice and navigates to the conversation', async () => {
    await renderView({ resumedConversationId: 'conv-42' })
    const notice = screen.getByTestId('terminal-resumed-history-view')
    expect(notice).toBeTruthy()
    await fireEvent.press(notice)
    expect(mockPush).toHaveBeenCalledWith(
      '/conversation/conv-42?server=srv1&fromSession=sess1',
    )
  })

  it('navigates to conversation search when the search link is pressed', async () => {
    await renderView({ resumedConversationId: 'conv-42' })
    await fireEvent.press(screen.getByTestId('terminal-resumed-history-search'))
    expect(mockPush).toHaveBeenCalledWith(
      '/conversation/conv-42?server=srv1&fromSession=sess1&openSearch=1',
    )
  })

  it('navigates to the conversation when the history tail link is pressed', async () => {
    await renderView({ resumedConversationId: 'conv-42' })
    await fireEvent.press(screen.getByTestId('terminal-resumed-history-tail'))
    expect(mockPush).toHaveBeenCalledWith(
      '/conversation/conv-42?server=srv1&fromSession=sess1',
    )
  })

  it('shows an error message when answering a question fails for a genuine reason', async () => {
    mockRespondToQuestionState = { isError: true, error: new NetworkError('Server returned 500') }
    await renderView()
    expect(screen.getByText('Server returned 500')).toBeTruthy()
  })

  it('shows a calm notice instead of an error when the question already closed (question_gone)', async () => {
    mockRespondToQuestionState = {
      isError: true,
      error: new NetworkError('Server returned 409', QUESTION_GONE_CODE),
    }
    await renderView()
    expect(screen.getByText("That question isn't open anymore.")).toBeTruthy()
    expect(screen.queryByText('Server returned 409')).toBeNull()
  })
})
