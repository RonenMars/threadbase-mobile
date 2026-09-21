/**
 * LiveConversationView — bubble chat view behavior.
 *
 * Guards two regressions from PR #148:
 *  - Bug 2: a message the user sends must appear in the bubble list
 *    immediately (optimistic echo), not only after the JSONL round-trips
 *    back over the WebSocket.
 */
import React from 'react'
import { Alert, Keyboard } from 'react-native'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { NetworkError } from '@/services/api-client'
import { LiveConversationView } from '@/components/conversation/LiveConversationView'
import { createWrapper } from '@/test-utils'
import { useServersStore } from '@/stores/servers'
import type { Message, Prompt } from '@/types/api'

const mockMutate = jest.fn()
const mockMutateAsync = jest.fn(async (payload: string) => {
  mockMutate(payload, {})
})
// Settled state of the send mutation, read during render for the inline
// composer error. Mutable so a test can stand in for "the last send failed".
let mockSendInputState: { isError: boolean; error: Error | null } = { isError: false, error: null }
const mockRawKeyMutate = jest.fn()

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
let mockHistoryLoading = false

jest.mock('@/hooks/useConversations', () => ({
  useConversation: () => ({ data: { messages: mockHistorical }, isLoading: mockHistoryLoading }),
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
    sendRawKey: { mutate: mockRawKeyMutate, isPending: false, error: null },
    respondToQuestion: { mutate: jest.fn(), mutateAsync: jest.fn(), isError: false, error: null },
    answerPermission: { mutate: jest.fn(), mutateAsync: jest.fn(), isError: false, error: null },
    answerPrompt: { mutate: jest.fn(), mutateAsync: jest.fn(), isError: false, error: null },
  }),
}))

// The composer guards sends on a connected WS client. Report connected so the
// send path runs under test. send() is called by useTerminalStream.
const mockOnStatusChange = jest.fn((_serverId: string, _listener: (s: string) => void) => jest.fn())
// Captured per event type so a test can drive useActiveQuestion's real
// reducer (question open → answered → ghost) instead of mocking its output.
const wsHandlers: Record<string, ((msg: unknown) => void)[]> = {}
function dispatchWs(event: string, msg: unknown) {
  ;(wsHandlers[event] ?? []).forEach((handler) => handler(msg))
}
jest.mock('@/services/ws-client', () => ({
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

type KeyboardHandler = { onStart?: () => void; onEnd?: (e: { height: number }) => void }
// The component registers keyboard worklets; hold the last one so a test can
// play the animation's start and end.
let mockKeyboardHandler: KeyboardHandler | null = null
jest.mock('react-native-keyboard-controller', () => ({
  useKeyboardHandler: (handler: KeyboardHandler) => { mockKeyboardHandler = handler },
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

afterEach(() => {
  for (const key of Object.keys(wsHandlers)) {
    delete wsHandlers[key]
  }
  mockSendInputState = { isError: false, error: null }
})

async function renderView(onPreferRawTerminal?: () => void) {
  return await render(
    <LiveConversationView
      serverId="srv1"
      sessionId="sess1"
      conversationId="conv1"
      onPreferRawTerminal={onPreferRawTerminal}
    />,
    { wrapper: createWrapper() },
  )
}

// The list's scrollToEnd and the keyboard handler both come from jest.setup's
// mocks: one records what scrolled, the other lets a test play the keyboard
// animation's start and end.
const { __scrollToEndMock: scrollToEndMock } = jest.requireMock('@shopify/flash-list') as {
  __scrollToEndMock: jest.Mock
}
// FlashList is mocked, so drive the FAB the way the real list does: a scroll
// event whose distance-from-bottom is past the threshold.
const SCROLLED_UP = {
  nativeEvent: { contentOffset: { y: 0 }, contentSize: { height: 5000 }, layoutMeasurement: { height: 800 } },
}
const AT_BOTTOM = {
  nativeEvent: { contentOffset: { y: 4200 }, contentSize: { height: 5000 }, layoutMeasurement: { height: 800 } },
}

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

describe('LiveConversationView — optimistic sent message', () => {
  beforeEach(() => {
    mockMutate.mockClear()
    mockMutateAsync.mockClear()
    mockOnStatusChange.mockClear()
    mockHistorical = []
    mockLive = []
    mockPtyLines = []
    mockHistoryLoading = false
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

  it('offers a jump-to-latest once the user has scrolled away from the tail', async () => {
    mockHistorical = [
      { id: 'history-1', uuid: 'history-1', role: 'assistant', content: [{ type: 'text', text: 'Earlier message' }], timestamp: '', is_sidechain: false, parent_uuid: null },
    ]

    await renderView()
    const messageList = screen.getByTestId('live-conversation-list')

    expect(messageList).toBeTruthy()
    expect(messageList!.props.onScroll).toEqual(expect.any(Function))
    await act(async () => messageList!.props.onScroll(SCROLLED_UP))

    expect(screen.getByTestId('chat-jump-to-latest')).toBeTruthy()

    await act(async () => messageList!.props.onScroll(AT_BOTTOM))
    expect(screen.queryByTestId('chat-jump-to-latest')).toBeNull()
  })

  // Regression: the view used to swap maintainVisibleContentPosition to
  // `{ disabled: true }` on scroll-begin-drag. flash-list's checkBounds only
  // clears its sticky pendingAutoscrollToBottom flag while the threshold is
  // set, so disabling it latched that flag `true` and the next `data` change
  // fired scrollToEnd — the user could not scroll up past the last message.
  it('keeps bottom-anchoring enabled while the user is scrolled up', async () => {
    await renderView()
    const list = screen.getByTestId('live-conversation-list')
    await act(async () => list!.props.onScroll(SCROLLED_UP))

    expect(list!.props.maintainVisibleContentPosition).toMatchObject({
      autoscrollToBottomThreshold: 0.2,
      startRenderingFromBottom: true,
    })
    expect(list!.props.maintainVisibleContentPosition.disabled).toBeFalsy()
  })

  // RN's default ('never') spends the first tap on dismissing the keyboard, so a
  // question card in the footer needed two taps while the user was typing.
  it('lets transcript controls take the first tap while the keyboard is up', async () => {
    await renderView()
    expect(screen.getByTestId('live-conversation-list')!.props.keyboardShouldPersistTaps).toBe('handled')
  })

  // The keyboard changes layout; the list decides position. Before this, every
  // keyboardDidShow / keyboardDidChangeFrame fired an unconditional scrollToEnd,
  // so opening the keyboard — or, on iOS, closing it — yanked a reader who had
  // scrolled up back to the newest message.
  describe('keyboard movement and scroll position', () => {
    async function moveKeyboard(height: number) {
      const handler = mockKeyboardHandler
      await act(async () => {
        handler?.onStart?.()
        handler?.onEnd?.({ height })
      })
    }

    it('carries a reader who was at the end when the keyboard opens', async () => {
      await renderView()
      const list = screen.getByTestId('live-conversation-list')
      await act(async () => list!.props.onScroll(AT_BOTTOM))
      scrollToEndMock.mockClear()

      await moveKeyboard(300)
      expect(scrollToEndMock).toHaveBeenCalled()
    })

    it('leaves a reader who scrolled up where they are', async () => {
      await renderView()
      const list = screen.getByTestId('live-conversation-list')
      await act(async () => list!.props.onScroll(SCROLLED_UP))
      scrollToEndMock.mockClear()

      await moveKeyboard(300)
      expect(scrollToEndMock).not.toHaveBeenCalled()
    })

    it('does not scroll when the keyboard hides', async () => {
      await renderView()
      const list = screen.getByTestId('live-conversation-list')
      await act(async () => list!.props.onScroll(AT_BOTTOM))
      scrollToEndMock.mockClear()

      await moveKeyboard(0)
      expect(scrollToEndMock).not.toHaveBeenCalled()
    })

    // The lift shrinks the viewport while the keyboard animates, so a follower
    // reads as scrolled-away by the time it settles. The verdict has to come
    // from onStart.
    it('decides before the viewport shrinks, not after', async () => {
      await renderView()
      const list = screen.getByTestId('live-conversation-list')
      await act(async () => list!.props.onScroll(AT_BOTTOM))
      scrollToEndMock.mockClear()
      const handler = mockKeyboardHandler

      await act(async () => handler?.onStart?.())
      await act(async () => list!.props.onScroll(SCROLLED_UP))
      await act(async () => handler?.onEnd?.({ height: 300 }))

      expect(scrollToEndMock).toHaveBeenCalled()
    })

    it('subscribes to no RN keyboard events', async () => {
      const addListener = jest.spyOn(Keyboard, 'addListener')
      await renderView()
      expect(addListener).not.toHaveBeenCalledWith('keyboardDidShow', expect.any(Function))
      expect(addListener).not.toHaveBeenCalledWith('keyboardDidChangeFrame', expect.any(Function))
      addListener.mockRestore()
    })
  })

  it('pins to the true bottom on first load until the user drags', async () => {
    mockHistorical = [
      { id: 'history-1', uuid: 'history-1', role: 'assistant', content: [{ type: 'text', text: 'Earlier message' }], timestamp: '', is_sidechain: false, parent_uuid: null },
    ]
    await renderView()
    const list = screen.getByTestId('live-conversation-list')
    expect(list!.props.onContentSizeChange).toEqual(expect.any(Function))
    expect(list!.props.onScrollBeginDrag).toEqual(expect.any(Function))
  })

  // Regression: flash-list runs its autoscroll-to-bottom check on every `data`
  // identity change. The FAB flips ~100pt from the tail, inside the 0.2-viewport
  // autoscroll zone, so a fresh array on that re-render snapped the reader back.
  it('keeps the list data identity when a scroll re-renders the view', async () => {
    mockHistorical = [
      { id: 'history-1', uuid: 'history-1', role: 'assistant', content: [{ type: 'text', text: 'Earlier message' }], timestamp: '', is_sidechain: false, parent_uuid: null },
    ]
    await renderView()
    const before = screen.getByTestId('live-conversation-list').props.data

    await act(async () => screen.getByTestId('live-conversation-list').props.onScroll(SCROLLED_UP))

    expect(screen.getByTestId('chat-jump-to-latest')).toBeTruthy()
    expect(screen.getByTestId('live-conversation-list').props.data).toBe(before)
  })

  // Regression: every row shared one height average, so ~60pt tool/reasoning
  // rows above a long answer were placed at ~1,200pt. Measuring them as the
  // reader scrolled up shrank the content below their offset and iOS bounced
  // them back to the tail. Measured on device, 2026-09-12.
  it('estimates row heights per message shape with a 2000pt draw runway', async () => {
    await renderView()
    const list = screen.getByTestId('live-conversation-list')
    expect(list.props.getItemType({ id: 't', role: 'assistant', content: [{ type: 'tool_use', id: 'x', name: 'Read', input: {} }] })).toBe('tool')
    expect(list.props.getItemType({ id: 'a', role: 'assistant', content: [{ type: 'text', text: 'hi' }] })).toBe('assistant')
    expect(list.props.drawDistance).toBe(2000)
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

// A question card renders as the list's footer, which flash-list's autoscroll
// never measures (getChildContainerDimensions excludes header/footer), so
// nothing scrolls when one lands and its lower options can sit behind the
// composer. The list is re-pinned only for a reader who was still at the tail
// when the card arrived.
describe('LiveConversationView — question card arriving below the fold', () => {
  beforeEach(() => {
    mockHistorical = []
    mockLive = []
    mockPtyLines = []
    mockSendInputState = { isError: false, error: null }
    for (const key of Object.keys(wsHandlers)) delete wsHandlers[key]
    scrollToEndMock.mockClear()
  })

  it('re-pins to the bottom when a card arrives while the reader is at the tail', async () => {
    await renderView()
    const list = screen.getByTestId('live-conversation-list')
    await act(async () => list!.props.onScrollBeginDrag())
    await act(async () => list!.props.onScroll(AT_BOTTOM))
    scrollToEndMock.mockClear()

    await act(async () => dispatchWs('question', QUESTION_MESSAGE))
    expect(screen.getByTestId('question-card')).toBeTruthy()
    // The card lays out over the frames after it mounts; the pin is what makes
    // the list follow it down to its true bottom.
    await act(async () => list!.props.onContentSizeChange(400, 5600))

    expect(scrollToEndMock).toHaveBeenCalled()
  })

  it('leaves a reader who had scrolled away from the tail where they are', async () => {
    await renderView()
    const list = screen.getByTestId('live-conversation-list')
    await act(async () => list!.props.onScrollBeginDrag())
    await act(async () => list!.props.onScroll(SCROLLED_UP))
    scrollToEndMock.mockClear()

    await act(async () => dispatchWs('question', QUESTION_MESSAGE))
    expect(screen.getByTestId('question-card')).toBeTruthy()
    await act(async () => list!.props.onContentSizeChange(400, 5600))

    expect(scrollToEndMock).not.toHaveBeenCalled()
  })
})

// Regression: a resumed session's PTY replay lands before REST conversation
// history resolves, so "0 messages" briefly means "still loading", not
// "genuinely empty chat". Firing the raw-terminal fallback on that transient
// read is a one-way trip (app/session/[id].tsx's forceRawTerminal never
// resets), so it must wait for history to settle before deciding.
describe('LiveConversationView — raw-terminal fallback vs. history-loading race', () => {
  const LONG_PTY_BACKLOG = Array.from({ length: 30 }, (_, i) => `replayed line ${i}`)

  beforeEach(() => {
    mockHistorical = []
    mockLive = []
    mockPtyLines = []
    mockHistoryLoading = false
  })

  it('does not fall back to terminal while history is still loading, even with a large PTY backlog', async () => {
    mockHistoryLoading = true
    mockPtyLines = LONG_PTY_BACKLOG
    const onPreferRawTerminal = jest.fn()

    await renderView(onPreferRawTerminal)

    expect(onPreferRawTerminal).not.toHaveBeenCalled()
  })

  it('stays in chat once history loads with real messages, despite the same backlog', async () => {
    mockHistoryLoading = true
    mockPtyLines = LONG_PTY_BACKLOG
    const onPreferRawTerminal = jest.fn()
    const { rerender } = await renderView(onPreferRawTerminal)

    mockHistoryLoading = false
    mockHistorical = [
      { id: 'h1', uuid: 'h1', role: 'assistant', content: [{ type: 'text', text: 'resumed reply' }], timestamp: '', is_sidechain: false, parent_uuid: null },
    ]
    await act(async () => rerender(
      <LiveConversationView serverId="srv1" sessionId="sess1" conversationId="conv1" onPreferRawTerminal={onPreferRawTerminal} />,
    ))

    expect(onPreferRawTerminal).not.toHaveBeenCalled()
  })

  it('still falls back to terminal once history has genuinely loaded empty with an active backlog', async () => {
    // Not a false positive on the fix: once loading has actually finished and
    // the chat is still empty while the PTY is clearly active, the original
    // chat_empty_pty_active signal must still fire.
    mockHistoryLoading = false
    mockHistorical = []
    mockPtyLines = LONG_PTY_BACKLOG
    const onPreferRawTerminal = jest.fn()

    await renderView(onPreferRawTerminal)

    expect(onPreferRawTerminal).toHaveBeenCalled()
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

  // Scroll away from the tail first: that is the state in which "jump back to
  // the card" is observable (the jump button is only rendered while the tail is
  // off-screen).
  async function dragThenSend(text: string) {
    await renderView()
    const list = screen.getByTestId('live-conversation-list')
    await act(async () => list!.props.onScroll(SCROLLED_UP))
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

// The 409 above can also land in the narrower window right after the user
// answers a card: the server took the answer but hasn't confirmed the gate is
// closed yet (the ghost, `answerPhase === 'pending'`). The server's message
// there describes a wrong-answer/still-open refusal that isn't true — the
// user just answered — so a local line replaces it. Every other phase,
// including the gate still being open (`'active'`), keeps the server's
// wording, because that text is accurate there.
describe('LiveConversationView — send refused while the ghost is pending', () => {
  const PROMPT_PENDING_MESSAGE = 'A prompt is waiting for an answer; answer or dismiss it before sending text'
  const GHOST_LOCAL_MESSAGE = 'Waiting for the prompt to close; try again in a moment.'

  beforeEach(() => {
    mockMutate.mockClear()
    mockMutateAsync.mockClear()
    mockSendInputState = { isError: false, error: null }
    mockHistorical = []
    mockLive = []
    mockPtyLines = []
    for (const key of Object.keys(wsHandlers)) delete wsHandlers[key]
  })

  it('keeps the server message while the gate is still active', async () => {
    const { rerender } = await renderView()
    await act(async () => dispatchWs('question', QUESTION_MESSAGE))
    expect(screen.getByTestId('question-card')).toBeTruthy()

    mockSendInputState = { isError: true, error: new NetworkError(PROMPT_PENDING_MESSAGE, 'prompt_pending') }
    await act(async () => rerender(<LiveConversationView serverId="srv1" sessionId="sess1" conversationId="conv1" />))

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
    await act(async () => rerender(<LiveConversationView serverId="srv1" sessionId="sess1" conversationId="conv1" />))

    expect(screen.getByText(GHOST_LOCAL_MESSAGE)).toBeTruthy()
    expect(screen.queryByText(PROMPT_PENDING_MESSAGE)).toBeNull()
  })
})

// The bubble view hosts the same card, so its Cancel has to take the same
// bound route; the full reply handling is covered in PromptAnswerSeam.
describe('LiveConversationView — cancel on a prompt card', () => {
  it('sends the Escape bound to the card promptId over raw-key', async () => {
    useServersStore.setState({
      servers: {
        srv1: {
          id: 'srv1',
          url: 'http://srv1',
          apiKey: 'key',
          isConnected: true,
          connectionError: null,
          serverInfo: { version: '1', machineName: 'mac', platform: 'macOS', activeSessions: 0, rawKeys: true },
        },
      },
    })
    const prompt: Prompt = {
      schemaVersion: 1,
      sessionId: 'sess1',
      promptId: 'prompt-1',
      revision: 1,
      state: 'open',
      intent: 'approval',
      title: 'Approval',
      message: 'Do you want to proceed?',
      questions: [{
        questionId: 'q-1',
        text: 'Do you want to proceed?',
        inputMode: 'single',
        options: [{ optionId: 'opt-yes', label: 'Yes' }, { optionId: 'opt-no', label: 'No' }],
        allowOther: false,
        secret: 'unknown',
      }],
      answerRequirement: 'unknown',
      expiresAt: null,
      provenance: { source: 'screen', confidence: 'inferred' },
    }
    await renderView()
    await act(async () => dispatchWs('prompt_snapshot', { type: 'prompt_snapshot', schemaVersion: 1, sessionId: 'sess1', sequence: 1, prompts: [prompt] }))

    await act(async () => { fireEvent.press(screen.getAllByLabelText('Cancel')[0]) })

    expect(mockRawKeyMutate).toHaveBeenCalledWith({ action: 'escape', promptId: 'prompt-1' }, expect.any(Object))
    expect(screen.getByTestId('question-card')).toBeTruthy()
  })
})
