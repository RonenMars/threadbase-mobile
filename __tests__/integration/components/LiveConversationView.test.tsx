/**
 * LiveConversationView — bubble chat view behavior.
 *
 * Guards two regressions from PR #148:
 *  - Bug 2: a message the user sends must appear in the bubble list
 *    immediately (optimistic echo), not only after the JSONL round-trips
 *    back over the WebSocket.
 */
import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react-native'
import { LiveConversationView } from '@/components/conversation/LiveConversationView'
import { createWrapper } from '@/test-utils'
import type { Message } from '@/types/api'

const mockMutate = jest.fn()

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

jest.mock('@/hooks/useSessionActions', () => ({
  useSessionActions: () => ({ sendInput: { mutate: mockMutate } }),
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

  it('shows the sent message in the bubbles immediately, before any WS echo', async () => {
    await renderView()

    const input = screen.getByTestId('chat-message-input')
    await fireEvent.changeText(input, 'hello there')
    await fireEvent.press(screen.getByTestId('chat-send-button'))

    // It still fires the send mutation with the typed text as the payload…
    expect(mockMutate).toHaveBeenCalledWith('hello there', expect.anything())
    // …and the user's text shows up right away as a bubble, with no live echo.
    expect(screen.getByText('hello there')).toBeTruthy()
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
