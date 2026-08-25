/**
 * LiveConversationView — bubble chat view behavior.
 *
 * Guards two regressions from PR #148:
 *  - Bug 2: a message the user sends must appear in the bubble list
 *    immediately (optimistic echo), not only after the JSONL round-trips
 *    back over the WebSocket.
 */
import React from 'react'
import { Alert } from 'react-native'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { NetworkError } from '@/services/api-client'
import { LiveConversationView } from '@/components/conversation/LiveConversationView'
import { createWrapper } from '@/test-utils'
import type { Message } from '@/types/api'

const mockMutate = jest.fn()
const mockMutateAsync = jest.fn(async (payload: string) => {
  mockMutate(payload, {})
})
// Settled state of the send mutation, read during render for the inline
// composer error. Mutable so a test can stand in for "the last send failed".
let mockSendInputState: { isError: boolean; error: Error | null } = { isError: false, error: null }

// MessageItem has no stable per-message testID exposing its text (only row-level
// testIDs for the last/search-anchor rows), so render order can't be asserted
// against the real component. Mock it to surface the first text block directly.
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

let mockHistorical: Message[] = []
let mockLive: Message[] = []
let mockPtyLines: string[] = []

jest.mock('@/hooks/useConversations', () => ({
  useConversation: () => ({ data: { messages: mockHistorical } }),
}))

jest.mock('@/hooks/useConversationStream', () => ({
  useConversationStream: () => ({ liveMessages: mockLive }),
}))

// respondToQuestion's error state is read during render (to tell a closed
// question from a real send failure), not just inside a callback, so the mock
// has to carry the whole mutation rather than only what the send path touches.
jest.mock('@/hooks/useSessionActions', () => ({
  useSessionActions: () => ({
    sendInput: {
      mutate: mockMutate,
      mutateAsync: mockMutateAsync,
      ...mockSendInputState,
    },
    sendKeys: { mutate: jest.fn() },
    respondToQuestion: { mutate: jest.fn(), mutateAsync: jest.fn(), isError: false, error: null },
    answerPermission: { mutate: jest.fn(), mutateAsync: jest.fn(), isError: false, error: null },
  }),
}))

// The composer guards sends on a connected WS client. Report connected so the
// send path runs under test. send() is called by useTerminalStream.
const mockOnStatusChange = jest.fn((_serverId: string, _listener: (s: string) => void) => jest.fn())
jest.mock('@/services/ws-client', () => ({
  wsManager: {
    getClient: () => ({ status: () => 'connected', send: jest.fn(), on: jest.fn(() => jest.fn()) }),
    onAnyStatusChange: jest.fn(() => jest.fn()),
    onStatusChange: (serverId: string, listener: (s: string) => void) => mockOnStatusChange(serverId, listener),
    forceReconnect: jest.fn(),
  },
}))

jest.mock('@/hooks/useSession', () => ({
  useSessionDetail: () => ({ data: { status: 'waiting_input' } }),
}))

jest.mock('@/hooks/useTerminalStream', () => ({
  useTerminalStream: () => ({ lines: mockPtyLines, isStreaming: false }),
}))

// useComposerState imports expo-speech-recognition at module load time; mock it
// here (not just in jest.setup.js) so Jest hoisting intercepts before require.
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

// useComposerState deps not already covered by jest.setup.js
jest.mock('@/stores/drafts', () => {
  const store = (sel: (s: { setDraft: jest.Mock; clearDraft: jest.Mock; hydrate: jest.Mock; getDraft: jest.Mock }) => unknown) =>
    sel({ setDraft: jest.fn(), clearDraft: jest.fn(), hydrate: jest.fn().mockResolvedValue(undefined), getDraft: jest.fn().mockReturnValue(null) })
  store.getState = () => ({ getDraft: jest.fn().mockReturnValue(null) })
  return { useDraftsStore: store }
})
jest.mock('@/stores/settings', () => ({
  useSettingsStore: () => ({ autoNameFromMessage: false }),
}))
jest.mock('@/stores/sessionNames', () => ({
  useSessionNamesStore: (sel: (s: { getName: () => undefined }) => unknown) =>
    sel({ getName: () => undefined }),
}))
jest.mock('@/hooks/useSessionName', () => ({
  useRenameSession: () => ({ mutate: jest.fn() }),
}))
jest.mock('@/hooks/useVoiceInput', () => ({
  useVoiceInput: () => ({ listening: false, start: jest.fn(), stop: jest.fn() }),
}))

async function renderView() {
  return await render(
    <LiveConversationView serverId="srv1" sessionId="sess1" conversationId="conv1" />,
    { wrapper: createWrapper() },
  )
}

describe('LiveConversationView — optimistic sent message', () => {
  beforeEach(() => {
    mockMutate.mockClear()
    mockMutateAsync.mockClear()
    mockOnStatusChange.mockClear()
    mockHistorical = []
    mockLive = []
    mockPtyLines = []
  })

  it('subscribes to WS reconnect so a status flip missed while backgrounded is resynced', async () => {
    // Regression: session_update is a fire-once WS push. If the app is
    // backgrounded when the server emits it, the frame is lost and the
    // thinking bubble stays stuck forever unless something resyncs on
    // reconnect. Assert the reconnect listener is wired up.
    await renderView()

    expect(mockOnStatusChange).toHaveBeenCalledWith('srv1', expect.any(Function))
  })

  it('shows live PTY output when there are no conversation messages yet', async () => {
    // Fresh / waiting_input session: no JSONL → no historical/live messages,
    // but the PTY is streaming. The chat must not be blank.
    mockHistorical = []
    mockLive = []
    mockPtyLines = ['Scanning project...', 'Found 12 apps']

    await renderView()

    expect(screen.getByText('Scanning project...')).toBeTruthy()
    expect(screen.getByText('Found 12 apps')).toBeTruthy()
  })

  it('stops following live output as soon as the user drags the chat', async () => {
    mockHistorical = [
      { id: 'history-1', uuid: 'history-1', role: 'assistant', content: [{ type: 'text', text: 'Earlier message' }], timestamp: '', is_sidechain: false, parent_uuid: null },
    ]

    await renderView()
    const messageList = screen.getByTestId('live-conversation-list')

    expect(messageList).toBeTruthy()
    expect(messageList!.props.onScrollBeginDrag).toEqual(expect.any(Function))
    await act(async () => messageList!.props.onScrollBeginDrag())

    const jumpToLatest = screen.getByTestId('chat-jump-to-latest')
    expect(jumpToLatest).toBeTruthy()
  })

  it('shows the sent message in the bubbles immediately, before any WS echo', async () => {
    await renderView()

    const input = screen.getByTestId('chat-message-input')
    await fireEvent.changeText(input, 'hello there')
    await fireEvent.press(screen.getByTestId('chat-send-button'))

    // It still fires the send mutation with the typed text as the payload…
    expect(mockMutate).toHaveBeenCalledWith('hello there', expect.anything())
    // …and the user's text shows up right away as a bubble, with no live echo.
    expect(screen.getByText('hello there')).toBeTruthy()
    expect(input.props.value).toBe('')
  })

  it('keeps composer text and does not leave an optimistic bubble when send fails', async () => {
    mockMutateAsync.mockRejectedValueOnce(new Error('offline'))
    await renderView()

    const input = screen.getByTestId('chat-message-input')
    await fireEvent.changeText(input, 'keep this')
    await fireEvent.press(screen.getByTestId('chat-send-button'))

    expect(mockMutateAsync).toHaveBeenCalledWith('keep this')
    expect(input.props.value).toBe('keep this')
    expect(screen.queryByTestId('message-text')).toBeNull()
  })

  it('does not duplicate the message once the WS echo arrives with the same text', async () => {
    const { rerender } = await renderView()

    const input = screen.getByTestId('chat-message-input')
    await fireEvent.changeText(input, 'ping')
    await fireEvent.press(screen.getByTestId('chat-send-button'))
    expect(screen.getByText('ping')).toBeTruthy()

    // The streamer echoes the user turn back over the WS.
    mockLive = [
      {
        id: 'echo-1',
        uuid: 'echo-1',
        role: 'user',
        content: [{ type: 'text', text: 'ping' }],
        timestamp: '2026-06-18T10:00:00Z',
        is_sidechain: false,
        parent_uuid: null,
      },
    ]
    rerender(<LiveConversationView serverId="srv1" sessionId="sess1" conversationId="conv1" />)

    expect(screen.getAllByText('ping')).toHaveLength(1)
  })

  it('renders historical messages in message_index order, then live messages by arrival', async () => {
    // historical out of natural order to prove index sorting (not array order).
    mockHistorical = [
      { id: 'c1-1', uuid: 'h1', messageIndex: 1, role: 'assistant', content: [{ type: 'text', text: 'second' }], timestamp: '', is_sidechain: false, parent_uuid: null },
      { id: 'c1-0', uuid: 'h0', messageIndex: 0, role: 'user', content: [{ type: 'text', text: 'first' }], timestamp: '', is_sidechain: false, parent_uuid: null },
    ]
    mockLive = [
      { id: 'L1', uuid: 'L1', role: 'assistant', content: [{ type: 'text', text: 'live-third' }], timestamp: '', is_sidechain: false, parent_uuid: null },
    ]
    await renderView()

    const texts = screen.getAllByTestId('message-text').map((n) => n.props.children)
    expect(texts).toEqual(['first', 'second', 'live-third'])
  })
})

// POST /input answered 409 prompt_pending: a card is open on the host and the
// text was refused before any byte was written. Reached in the window before
// the card's own WS frame lands (once it has, send is disabled locally). The
// draft stays, no alert takes the focus, and the list jumps back to its tail —
// the card is the list footer in this view — with the server's message shown
// inline under the composer. (The composer itself drops the keyboard on send.)
describe('LiveConversationView — text refused while a prompt is open', () => {
  const PROMPT_PENDING_MESSAGE = 'A prompt is waiting for an answer; answer or dismiss it before sending text'
  let alertSpy: jest.SpyInstance

  beforeEach(() => {
    mockMutate.mockClear()
    mockMutateAsync.mockClear()
    mockSendInputState = { isError: false, error: null }
    mockHistorical = [
      { id: 'history-1', uuid: 'history-1', role: 'assistant', content: [{ type: 'text', text: 'Earlier message' }], timestamp: '', is_sidechain: false, parent_uuid: null },
    ]
    mockLive = []
    mockPtyLines = []
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
  })
  afterEach(() => {
    alertSpy.mockRestore()
  })

  // Drag first so the view has stopped following the tail: that is the state
  // in which "jump back to the card" is observable (the jump button is only
  // rendered while not following).
  async function dragThenSend(text: string) {
    await renderView()
    const list = screen.getByTestId('live-conversation-list')
    await act(async () => list!.props.onScrollBeginDrag())
    expect(screen.getByTestId('chat-jump-to-latest')).toBeTruthy()

    const input = screen.getByTestId('chat-message-input')
    await fireEvent.changeText(input, text)
    await act(async () => { fireEvent.press(screen.getByTestId('chat-send-button')) })
    return input
  }

  it('keeps the draft, jumps to the tail, and raises no alert', async () => {
    mockMutateAsync.mockRejectedValueOnce(new NetworkError(PROMPT_PENDING_MESSAGE, 'prompt_pending'))

    const input = await dragThenSend('keep me')

    expect(mockMutateAsync).toHaveBeenCalledWith('keep me')
    expect(input.props.value).toBe('keep me')
    // No optimistic bubble is left behind for the refused text.
    expect(screen.queryByText('keep me')).toBeNull()
    expect(alertSpy).not.toHaveBeenCalled()
    expect(screen.queryByTestId('chat-jump-to-latest')).toBeNull()
  })

  // Positive control: an ordinary failure still alerts and leaves the scroll
  // position alone.
  it('still alerts and stays put on an ordinary send failure', async () => {
    mockMutateAsync.mockRejectedValueOnce(new NetworkError('Failed to reach server'))

    const input = await dragThenSend('keep me')

    expect(input.props.value).toBe('keep me')
    expect(alertSpy).toHaveBeenCalledWith(expect.any(String), 'Failed to reach server')
    expect(screen.getByTestId('chat-jump-to-latest')).toBeTruthy()
  })

  it('shows the server message inline under the composer once the send has settled', async () => {
    mockSendInputState = { isError: true, error: new NetworkError(PROMPT_PENDING_MESSAGE, 'prompt_pending') }
    await renderView()
    expect(screen.getByText(PROMPT_PENDING_MESSAGE)).toBeTruthy()
  })
})
