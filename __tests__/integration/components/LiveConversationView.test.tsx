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
const mockSendKeys = jest.fn()
const mockRespondToQuestion = jest.fn()

let mockHistorical: Message[] = []
let mockLive: Message[] = []
let mockPtyLines: string[] = []
let mockActiveQuestion: unknown = null
let mockSessionStatus = 'waiting_input'

jest.mock('@/constants/flags', () => ({ FEATURE_QUESTIONS: true }))

jest.mock('@/hooks/useConversations', () => ({
  useConversation: () => ({ data: { messages: mockHistorical } }),
}))

jest.mock('@/hooks/useConversationStream', () => ({
  useConversationStream: () => ({ liveMessages: mockLive }),
}))

jest.mock('@/hooks/useActiveQuestion', () => ({
  useActiveQuestion: () => ({ question: mockActiveQuestion }),
}))

jest.mock('@/hooks/useSessionActions', () => ({
  useSessionActions: () => ({
    sendInput: { mutate: mockMutate },
    sendKeys: { mutate: mockSendKeys },
    respondToQuestion: { mutate: mockRespondToQuestion },
  }),
}))

// The composer guards sends on a connected WS client. Report connected so the
// send path runs under test. send() is called by useTerminalStream.
jest.mock('@/services/ws-client', () => ({
  wsManager: {
    getClient: () => ({ status: () => 'connected', send: jest.fn(), on: jest.fn(() => jest.fn()) }),
    onAnyStatusChange: jest.fn(() => jest.fn()),
    forceReconnect: jest.fn(),
  },
}))

jest.mock('@/hooks/useSession', () => ({
  useSessionDetail: () => ({ data: { status: mockSessionStatus } }),
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

function renderView() {
  return render(
    <LiveConversationView serverId="srv1" sessionId="sess1" conversationId="conv1" />,
    { wrapper: createWrapper() },
  )
}

describe('LiveConversationView — optimistic sent message', () => {
  beforeEach(() => {
    mockMutate.mockClear()
    mockSendKeys.mockClear()
    mockRespondToQuestion.mockClear()
    mockHistorical = []
    mockLive = []
    mockPtyLines = []
    mockActiveQuestion = null
    mockSessionStatus = 'waiting_input'
  })

  it('shows live PTY output when there are no conversation messages yet', () => {
    // Fresh / waiting_input session: no JSONL → no historical/live messages,
    // but the PTY is streaming. The chat must not be blank.
    mockHistorical = []
    mockLive = []
    mockPtyLines = ['Scanning project...', 'Found 12 apps']

    renderView()

    expect(screen.getByText('Scanning project...')).toBeTruthy()
    expect(screen.getByText('Found 12 apps')).toBeTruthy()
  })

  it('shows the sent message in the bubbles immediately, before any WS echo', () => {
    renderView()

    const input = screen.getByTestId('chat-message-input')
    fireEvent.changeText(input, 'hello there')
    fireEvent.press(screen.getByTestId('chat-send-button'))

    // It still fires the send mutation with the typed text as the payload…
    expect(mockMutate).toHaveBeenCalledWith('hello there', expect.anything())
    // …and the user's text shows up right away as a bubble, with no live echo.
    expect(screen.getByText('hello there')).toBeTruthy()
  })

  it('does not duplicate the message once the WS echo arrives with the same text', () => {
    const { rerender } = renderView()

    const input = screen.getByTestId('chat-message-input')
    fireEvent.changeText(input, 'ping')
    fireEvent.press(screen.getByTestId('chat-send-button'))
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
})

describe('LiveConversationView — question card + answered bubbles', () => {
  beforeEach(() => {
    mockMutate.mockClear()
    mockSendKeys.mockClear()
    mockRespondToQuestion.mockClear()
    mockHistorical = []
    mockLive = []
    mockPtyLines = []
    mockActiveQuestion = null
    mockSessionStatus = 'waiting_input'
  })

  it('renders the active question card even when the agent is not running (status parked)', () => {
    // An AskUserQuestion parks the agent — status is NOT 'running', so the
    // thinking bubble is hidden. The card must still render so the user can answer.
    mockSessionStatus = 'waiting_input'
    mockActiveQuestion = {
      source: 'structured',
      toolUseId: 't1',
      questions: [{ question: 'Pick one?', header: 'H', multiSelect: false, options: [{ label: 'Alpha', description: '' }, { label: 'Beta', description: '' }] }],
    }

    renderView()

    fireEvent.press(screen.getByLabelText('Beta'))
    expect(mockRespondToQuestion).toHaveBeenCalledWith({ toolUseId: 't1', answers: { 'Pick one?': 'Beta' } })
  })

  it('answers a permission/shell prompt via the keystroke route', () => {
    mockActiveQuestion = {
      source: 'permission',
      questions: [{ question: 'Continue? [y/N]', multiSelect: false, options: [{ label: 'Yes', description: '' }, { label: 'No', description: '' }] }],
      permissionIndices: [1, 2],
      permissionAnswerKeys: ['y\r', 'n\r'],
    }

    renderView()

    fireEvent.press(screen.getByLabelText('Yes'))
    expect(mockSendKeys).toHaveBeenCalledWith('y\r')
  })

  it('renders an answered AskUserQuestion as plain question + answer bubbles', () => {
    mockHistorical = [
      {
        id: 'm1', uuid: 'm1', role: 'assistant',
        content: [{ type: 'tool_use', id: 'tt1', name: 'AskUserQuestion', input: { questions: [{ question: 'Which area?', header: 'Area', options: [{ label: 'Botik', description: '' }] }] } }],
        timestamp: '2026-06-23T10:00:00Z', is_sidechain: false, parent_uuid: null,
      },
      {
        id: 'm2', uuid: 'm2', role: 'user',
        content: [{ type: 'tool_result', toolUseId: 'tt1', toolName: '', content: '"Area"="Botik"' }],
        timestamp: '2026-06-23T10:00:01Z', is_sidechain: false, parent_uuid: null,
      },
    ]

    renderView()

    expect(screen.getByText('Area\nWhich area?')).toBeTruthy()
    expect(screen.getByText('"Area"="Botik"')).toBeTruthy()
  })
})
