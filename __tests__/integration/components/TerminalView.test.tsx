import React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
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
  useReanimatedKeyboardAnimation: () => ({ height: { value: 0 }, progress: { value: 0 } }),
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
  // The composer tracks screen focus so it never restores focus under another
  // screen; the real hook runs the effect on mount and cleans up on blur.
  useFocusEffect: (cb: () => (() => void) | void) => {
    const React = jest.requireActual<typeof import('react')>('react')
    React.useEffect(() => cb(), [cb])
  },
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

// PTY rows and the prompts the streamer submitted. Tests that open a turn set
// both: the join anchors on the latest prompt's `❯` row.
let mockLines: string[] = ['line one', 'line two']
// Rows drawn since the last full clear; null means "same as mockLines".
let mockFrameLines: string[] | null = null
let mockPrompts: { text: string; ts: number }[] = []
jest.mock('@/hooks/useTerminalStream', () => ({
  useTerminalStream: () => ({
    lines: mockLines,
    frameLines: mockFrameLines ?? mockLines,
    isStreaming: false,
    userMessageTexts: new Set(mockPrompts.map((p) => p.text)),
    prompts: mockPrompts,
  }),
}))

// Session status drives whether a turn is open (running) or folded.
let mockSession: Partial<import('@/types/api').Session> | undefined
jest.mock('@/hooks/useSession', () => ({
  ...jest.requireActual('@/hooks/useSession'),
  useSessionDetail: () => ({ data: mockSession, isLoading: false }),
}))
jest.mock('@/hooks/useConversationStream', () => ({
  useConversationStream: () => ({ liveMessages: [] }),
}))

// Controllable transcript fixture: the terminal's scrollback whenever
// TerminalView gets a conversationId.
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

const mockAnswerPermissionMutate = jest.fn()
const mockAnswerPermissionState: { isError: boolean; error: Error | null } = { isError: false, error: null }
// Settled state of the send mutation, read during render for the inline
// composer error — mutable so a test can stand in for "the last send failed".
let mockSendInputState: { isError: boolean; error: Error | null } = { isError: false, error: null }

jest.mock('@/hooks/useSessionActions', () => ({
  useSessionActions: () => ({
    sendInput: {
      mutate: mockSendInputMutate,
      mutateAsync: mockSendInputMutate,
      ...mockSendInputState,
    },
    sendKeys: { mutate: mockSendKeysMutate },
    sendRawKey: { mutate: jest.fn(), isPending: false, error: null },
    respondToQuestion: {
      mutate: mockRespondToQuestionMutate,
      mutateAsync: mockRespondToQuestionMutate,
      isError: mockRespondToQuestionState.isError,
      error: mockRespondToQuestionState.error,
    },
    answerPermission: {
      mutate: mockAnswerPermissionMutate,
      mutateAsync: mockAnswerPermissionMutate,
      isError: mockAnswerPermissionState.isError,
      error: mockAnswerPermissionState.error,
    },
    answerPrompt: { mutate: jest.fn(), mutateAsync: jest.fn(), isError: false, error: null },
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
    setQueueVisible: jest.fn(),
    voice: { listening: false, start: jest.fn(), stop: jest.fn() },
    micGranted: true,
    handleToggleMic: jest.fn(),
  }),
}))

// Captured per event type so a test can drive useActiveQuestion's real
// reducer (question open → answered → ghost) instead of mocking its output.
const wsHandlers: Record<string, ((msg: unknown) => void)[]> = {}
function dispatchWs(event: string, msg: unknown) {
  ;(wsHandlers[event] ?? []).forEach((handler) => handler(msg))
}
jest.mock('@/services/ws-client', () => ({
  // on() is needed now that TerminalView subscribes via useActiveQuestion, and
  // onAnyStatusChange() now that it tears the card down on a disconnect.
  wsManager: {
    getClient: () => ({
      status: () => 'connected',
      send: jest.fn(),
      on: (event: string, handler: (msg: unknown) => void) => {
        wsHandlers[event] = [...(wsHandlers[event] ?? []), handler]
        return () => {
          wsHandlers[event] = (wsHandlers[event] ?? []).filter((h) => h !== handler)
        }
      },
    }),
    onAnyStatusChange: jest.fn(() => jest.fn()),
  },
}))

jest.mock('@/components/shared/SlashCommandBoard', () => ({
  SlashCommandBoard: () => null,
}))
jest.mock('@/components/shared/SlashCommandArgModal', () => ({
  SlashCommandArgModal: () => null,
}))


// eslint-disable-next-line import/first
import { TerminalView } from '@/components/terminal/TerminalView'
// eslint-disable-next-line import/first
import { NetworkError } from '@/services/api-client'

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
    mockSendInputState = { isError: false, error: null }
    mockHistoryMessages = []
    mockHistoryHasNextPage = false
    mockHistoryIsFetchingNextPage = false
    mockHistoryTotalMessages = 0
    mockHistoryFetchNextPage.mockClear()
    mockHistoryFetchNewerPage.mockClear()
    mockLines = ['line one', 'line two']
    mockFrameLines = null
    mockPrompts = []
    mockSession = undefined
    for (const key of Object.keys(wsHandlers)) delete wsHandlers[key]
  })

  describe('transcript scrollback (seeded from the conversation)', () => {
    const user = (text: string, index: number): import('@/types/api').Message => ({
      id: `m${index}`, uuid: `u${index}`, messageIndex: index, role: 'user',
      content: [{ type: 'text', text }], timestamp: '', is_sidechain: false, parent_uuid: null,
    })
    const assistant = (text: string, index: number): import('@/types/api').Message => ({
      id: `m${index}`, uuid: `u${index}`, messageIndex: index, role: 'assistant',
      content: [{ type: 'text', text }], timestamp: '', is_sidechain: false, parent_uuid: null,
    })

    it('renders only PTY rows when no conversationId is given', async () => {
      mockHistoryMessages = [user('older message', 0)]
      mockHistoryTotalMessages = 1
      await renderView()
      expect(screen.queryByTestId('session-history-header')).toBeNull()
      expect(screen.queryByTestId('terminal-transcript-row')).toBeNull()
      expect(screen.getAllByTestId('terminal-line-row').length).toBe(2)
    })

    it('renders the transcript above the PTY rows in one list when a conversationId is given', async () => {
      mockHistoryMessages = [user('older message one', 0), assistant('older message two', 1)]
      mockHistoryTotalMessages = 2
      mockPrompts = [{ text: 'now run the tests', ts: 1 }]
      mockSession = { id: 'sess1', status: 'running' }
      mockLines = ['❯ now run the tests', 'line two']
      await renderView({ conversationId: 'conv-1' })
      const rows = screen.getAllByTestId('terminal-transcript-row')
      expect(rows.length).toBe(2)
      expect(screen.getByText('❯ older message one')).toBeTruthy()
      expect(screen.getByText('⏺ older message two')).toBeTruthy()
      expect(screen.getByTestId('terminal-live-divider')).toBeTruthy()
      expect(screen.getAllByTestId('terminal-line-row').length).toBe(2)
    })

    it('hides the current prompt from the transcript while its row is on screen', async () => {
      mockHistoryMessages = [user('first', 0), assistant('reply', 1), user('now run the tests', 2)]
      mockHistoryTotalMessages = 3
      mockPrompts = [{ text: 'now run the tests', ts: 1 }]
      mockSession = { id: 'sess1', status: 'running' }
      mockLines = ['❯ now run the tests', '⏺ Running the suite.']
      await renderView({ conversationId: 'conv-1' })
      expect(screen.getAllByTestId('terminal-transcript-row').length).toBe(2)
      // The prompt appears once: as the live PTY row, not as a transcript row too.
      expect(screen.getAllByText('❯ now run the tests').length).toBe(1)
      expect(screen.getAllByTestId('terminal-line-row').length).toBe(2)
    })

    it('shows the whole transcript and no live rows once the reply has landed', async () => {
      mockHistoryMessages = [user('now run the tests', 0), assistant('All 6 pass.', 1)]
      mockHistoryTotalMessages = 2
      mockPrompts = [{ text: 'now run the tests', ts: 1 }]
      mockSession = { id: 'sess1', status: 'waiting_input', statusSource: 'turn-signal' }
      mockLines = ['❯ now run the tests', '⏺ All 6 pass.', '❯ ']
      await renderView({ conversationId: 'conv-1' })
      expect(screen.getAllByTestId('terminal-transcript-row').length).toBe(2)
      expect(screen.queryByTestId('terminal-live-divider')).toBeNull()
      expect(screen.queryByTestId('terminal-line-row')).toBeNull()
    })

    it('keeps the live rows after a settle the streamer only guessed', async () => {
      mockHistoryMessages = [user('now run the tests', 0)]
      mockHistoryTotalMessages = 1
      mockPrompts = [{ text: 'now run the tests', ts: 1 }]
      mockSession = { id: 'sess1', status: 'waiting_input', statusSource: 'prompt-marker' }
      mockLines = ['❯ now run the tests', '⏺ Still going.']
      await renderView({ conversationId: 'conv-1' })
      expect(screen.getAllByTestId('terminal-line-row').length).toBe(2)
    })

    // History a clear erased: kept by the stream in `lines`, absent from
    // `frameLines`. It is the only history a transcript-less session has, and
    // it must not reach the join, which would show it next to the transcript.
    it('renders history kept across a clear when there is no transcript', async () => {
      mockLines = ['before the clear', 'frame row']
      mockFrameLines = ['frame row']
      await renderView()
      expect(screen.getByText('before the clear')).toBeTruthy()
      expect(screen.getByText('frame row')).toBeTruthy()
    })

    it('joins the transcript against the frame only, so kept history does not repeat it', async () => {
      mockHistoryMessages = [user('before the clear', 0), assistant('reply', 1)]
      mockHistoryTotalMessages = 2
      mockPrompts = [{ text: 'before the clear', ts: 1 }]
      mockSession = { id: 'sess1', status: 'running' }
      mockLines = ['❯ before the clear', 'reply', 'frame row']
      mockFrameLines = ['frame row']
      await renderView({ conversationId: 'conv-1' })
      expect(screen.getAllByTestId('terminal-line-row')).toHaveLength(1)
      expect(screen.getByText('frame row')).toBeTruthy()
      expect(screen.queryByText('❯ before the clear', { exact: true })).toBeTruthy()
      expect(screen.getAllByTestId('terminal-transcript-row')).toHaveLength(2)
    })

    it('shows no header when the conversation has no messages yet', async () => {
      mockHistoryMessages = []
      await renderView({ conversationId: 'conv-empty' })
      expect(screen.queryByTestId('session-history-header')).toBeNull()
    })

    it('shows the conversation\'s real total in the header, not just what the byte-bounded seed has loaded', async () => {
      mockHistoryMessages = [user('a', 0), assistant('b', 1)]
      mockHistoryTotalMessages = 350
      await renderView({ conversationId: 'conv-1' })
      expect(screen.getByText('History · 350 messages')).toBeTruthy()
      expect(screen.queryByText('History · 2 messages')).toBeNull()
    })

    it('loads older pages from the top of the list', async () => {
      mockHistoryMessages = [user('older message', 0)]
      mockHistoryTotalMessages = 1
      mockHistoryHasNextPage = true
      await renderView({ conversationId: 'conv-1' })
      const list = screen.getByTestId('terminal-output-list')
      expect(list.props.drawDistance).toBe(2000)
      expect(mockHistoryFetchNextPage).not.toHaveBeenCalled()
      await fireEvent(list, 'startReached')
      expect(mockHistoryFetchNextPage).toHaveBeenCalledTimes(1)
      expect(mockHistoryFetchNextPage).toHaveBeenCalledWith({ cancelRefetch: false })
    })

    it('asks for one older page while the reader bounces at the top during a slow fetch', async () => {
      mockHistoryMessages = [user('older message', 0)]
      mockHistoryTotalMessages = 1
      mockHistoryHasNextPage = true
      // Never resolves: the page is still on the wire for the whole test.
      mockHistoryFetchNextPage.mockImplementationOnce(() => new Promise(() => {}))
      await renderView({ conversationId: 'conv-1' })
      const list = screen.getByTestId('terminal-output-list')
      await fireEvent(list, 'startReached')
      await fireEvent(list, 'startReached')
      await fireEvent(list, 'startReached')
      expect(mockHistoryFetchNextPage).toHaveBeenCalledTimes(1)
    })

    it('shows the load-boundary spinner while an older page is in flight', async () => {
      mockHistoryMessages = [user('older message', 0)]
      mockHistoryTotalMessages = 1
      mockHistoryHasNextPage = true
      mockHistoryIsFetchingNextPage = true
      await renderView({ conversationId: 'conv-1' })
      expect(screen.getByTestId('history-load-boundary-spinner')).toBeTruthy()
    })

    it('opens the conversation search from the header', async () => {
      mockHistoryMessages = [user('needle in history', 0)]
      mockHistoryTotalMessages = 1
      await renderView({ conversationId: 'conv-1' })
      await fireEvent.press(screen.getByTestId('session-history-search-btn'))
      expect(mockPush).toHaveBeenCalledTimes(1)
      const href = String(mockPush.mock.calls[0][0])
      expect(href).toContain('/conversation/conv-1')
      expect(href).toContain('fromSession=sess1')
      expect(href).toContain('openSearch=1')
    })
  })

  describe('send refused while the ghost is pending', () => {
    const PROMPT_PENDING_MESSAGE = 'A prompt is waiting for an answer; answer or dismiss it before sending text'
    const GHOST_LOCAL_MESSAGE = 'Waiting for the prompt to close; try again in a moment.'

    const QUESTION_MESSAGE = {
      type: 'question' as const,
      sessionId: 'sess1',
      toolUseId: 'q1',
      questions: [
        {
          question: 'Which approach?',
          header: 'Choose one',
          multiSelect: false,
          options: [
            { label: 'Option A', description: '' },
            { label: 'Option B', description: '' },
          ],
        },
      ],
    }

    it('keeps the server message while the gate is still active', async () => {
      const { rerender } = await renderView()
      await act(async () => dispatchWs('question', QUESTION_MESSAGE))
      expect(screen.getByTestId('question-card')).toBeTruthy()

      mockSendInputState = { isError: true, error: new NetworkError(PROMPT_PENDING_MESSAGE, 'prompt_pending') }
      await act(async () => rerender(<TerminalView serverId="srv1" sessionId="sess1" />))

      expect(screen.getByText(PROMPT_PENDING_MESSAGE)).toBeTruthy()
      expect(screen.queryByText(GHOST_LOCAL_MESSAGE)).toBeNull()
    })

    it('shows the local ghost message once the answer has been sent and is pending confirmation', async () => {
      const { rerender } = await renderView()
      await act(async () => dispatchWs('question', QUESTION_MESSAGE))
      expect(screen.getByTestId('question-card')).toBeTruthy()

      await act(async () => fireEvent.press(screen.getByLabelText('Option A')))
      expect(screen.getByTestId('question-card-ghost')).toBeTruthy()

      mockSendInputState = { isError: true, error: new NetworkError(PROMPT_PENDING_MESSAGE, 'prompt_pending') }
      await act(async () => rerender(<TerminalView serverId="srv1" sessionId="sess1" />))

      expect(screen.getByText(GHOST_LOCAL_MESSAGE)).toBeTruthy()
      expect(screen.queryByText(PROMPT_PENDING_MESSAGE)).toBeNull()
    })
  })

  // The prompt_pending guard is a server 409 on `{ input }` and applies to the
  // Terminal view's composer too. `{ keys }` is not arbitrated server-side, so
  // Escape is the one thing that can still reach the PTY — but with no card on
  // screen there was nowhere to send it from (#947).
  describe('send refused with no card to answer', () => {
    const PROMPT_PENDING_MESSAGE = 'A prompt is waiting for an answer; answer or dismiss it before sending text'
    const SEND_ESCAPE = 'Send Escape to dismiss it'

    it('offers Escape through the raw-key route, and never re-sends the text as keys', async () => {
      const { rerender } = await renderView()
      expect(screen.queryByTestId('question-card')).toBeNull()

      mockSendInputState = { isError: true, error: new NetworkError(PROMPT_PENDING_MESSAGE, 'prompt_pending') }
      await act(async () => rerender(<TerminalView serverId="srv1" sessionId="sess1" />))

      // Positive control: the text refusal itself is unchanged.
      expect(screen.getByText(PROMPT_PENDING_MESSAGE)).toBeTruthy()

      await act(async () => fireEvent.press(screen.getByText(SEND_ESCAPE)))
      expect(mockSendKeysMutate).toHaveBeenCalledTimes(1)
      expect(mockSendKeysMutate).toHaveBeenCalledWith('\x1b')
      expect(mockSendInputMutate).not.toHaveBeenCalled()
    })

    it('does not offer Escape when nothing was refused', async () => {
      await renderView()
      expect(screen.queryByText(SEND_ESCAPE)).toBeNull()
      expect(screen.queryByTestId('send-error-action')).toBeNull()
    })

    it('does not offer Escape for a refusal that is not prompt_pending', async () => {
      const { rerender } = await renderView()
      mockSendInputState = { isError: true, error: new NetworkError('boom', 'something_else') }
      await act(async () => rerender(<TerminalView serverId="srv1" sessionId="sess1" />))
      expect(screen.getByText('boom')).toBeTruthy()
      expect(screen.queryByText(SEND_ESCAPE)).toBeNull()
    })
  })
})
