/**
 * Claude's terminal rows through the real view: the server's `questionOther`
 * decides whether they show, and "Chat about this" leaves the question in the
 * composer's placeholder, focused, until the user sends.
 */
import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { TextInput } from 'react-native'
import { createWrapper } from '@/test-utils'
import type { QuestionWsMessage } from '@/types/api'

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
  useKeyboardHandler: () => {},
}))
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: unknown }) => children,
  SafeAreaView: ({ children }: { children: unknown }) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  // The composer tracks screen focus so it never restores focus under another
  // screen; the real hook runs the effect on mount and cleans up on blur.
  useFocusEffect: (cb: () => (() => void) | void) => {
    const React = jest.requireActual<typeof import('react')>('react')
    React.useEffect(() => cb(), [cb])
  },
  useLocalSearchParams: () => ({}),
}))

type ClientHandler = (msg: unknown) => void
jest.mock('@/services/ws-client', () => {
  const clientListeners = new Map<string, Set<ClientHandler>>()
  return {
    wsManager: {
      getClient: () => ({
        status: () => 'connected',
        send: jest.fn(),
        on: (type: string, handler: ClientHandler) => {
          if (!clientListeners.has(type)) clientListeners.set(type, new Set())
          clientListeners.get(type)!.add(handler)
          return () => clientListeners.get(type)!.delete(handler)
        },
      }),
      onAnyStatusChange: jest.fn(() => jest.fn()),
    },
    __wsTest: {
      emit: (type: string, msg: unknown) => clientListeners.get(type)?.forEach((l) => l(msg)),
    },
  }
})
const { __wsTest } = jest.requireMock('@/services/ws-client') as {
  __wsTest: (msg: unknown) => void
} & { __wsTest: { emit: (type: string, msg: unknown) => void } }

jest.mock('@/hooks/useTerminalStream', () => ({
  useTerminalStream: () => ({
    lines: [],
    frameLines: [],
    isStreaming: false,
    userMessageTexts: new Set<string>(),
    prompts: [],
    parseConfidence: 'high',
    isLoadingHistory: false,
    clear: jest.fn(),
  }),
}))

// The real mutation is covered in useSessionActions.answerPermission.test.tsx.
// Here it is a stand-in for the server's reply, so the view's handling of each
// reply is what is under test.
const mockAnswerPermission = jest.fn()
const mockRespondToQuestion = jest.fn()
const mockSendInput = jest.fn()
const mockAnswerPrompt = jest.fn()
const mockSendKeys = jest.fn()
const mockRawKey = jest.fn()
// sendRawKey is a real mutation around the stand-in, because the cancel path
// reads its settled error during render to pick between notice and error.
// The transcript hooks behind TerminalView's scrollback. Mocked the way the
// other data hooks here are: this seam is about the card and the answer route,
// and the real hooks would otherwise open queries against no server.
jest.mock('@/hooks/useConversations', () => ({
  useConversation: () => ({
    data: undefined,
    fetchNextPage: jest.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNewerPage: jest.fn(),
    hasNewerPage: false,
    isFetchingNewerPage: false,
    totalMessages: 0,
  }),
}))
jest.mock('@/hooks/useConversationStream', () => ({
  useConversationStream: () => ({ liveMessages: [] }),
}))
jest.mock('@/hooks/useSession', () => ({
  ...jest.requireActual('@/hooks/useSession'),
  useSessionDetail: () => ({ data: undefined, isLoading: false }),
}))

jest.mock('@/hooks/useSessionActions', () => {
  const { useMutation } = jest.requireActual<typeof import('@tanstack/react-query')>('@tanstack/react-query')
  return {
    useSessionActions: () => ({
      sendInput: { mutate: jest.fn(), mutateAsync: mockSendInput, isError: false, error: null },
      sendKeys: { mutate: mockSendKeys },
      sendRawKey: useMutation({ mutationFn: (vars: { action: 'escape'; promptId?: string }) => mockRawKey(vars) }),
      respondToQuestion: { mutate: jest.fn(), mutateAsync: mockRespondToQuestion, isError: false, error: null },
      answerPermission: { mutate: jest.fn(), mutateAsync: mockAnswerPermission, isError: false, error: null },
      answerPrompt: { mutate: jest.fn(), mutateAsync: mockAnswerPrompt, isError: false, error: null },
    }),
  }
})

jest.mock('@/components/shared/SlashCommandBoard', () => ({ SlashCommandBoard: () => null }))
jest.mock('@/components/shared/SlashCommandArgModal', () => ({ SlashCommandArgModal: () => null }))

// eslint-disable-next-line import/first
import { TerminalView } from '@/components/terminal/TerminalView'
// eslint-disable-next-line import/first
import { useServersStore } from '@/stores/servers'

const QUESTION = 'Which store should hold sessions?'

function setQuestionOther(supported: boolean) {
  useServersStore.setState({
    servers: {
      'srv-1': {
        id: 'srv-1',
        url: 'http://srv-1',
        apiKey: 'key',
        isConnected: true,
        connectionError: null,
        serverInfo: { version: '1', machineName: 'mac', platform: 'macOS', activeSessions: 0, ...(supported ? { questionOther: true } : {}) },
      },
    },
  })
}

const SCREEN_QUESTION: QuestionWsMessage = {
  type: 'question',
  sessionId: 'sess-1',
  toolUseId: 'screen:1',
  questions: [{
    question: QUESTION,
    header: 'Store',
    multiSelect: false,
    options: [
      { label: 'SQLite', description: '' },
      { label: 'Files', description: '' },
      { label: 'Type something.', description: '', terminalRow: 'other' },
      { label: 'Chat about this', description: '', terminalRow: 'chat' },
    ],
  }],
}

async function openQuestion() {
  const Wrapper = createWrapper()
  await render(
    <Wrapper>
      <TerminalView serverId="srv-1" sessionId="sess-1" />
    </Wrapper>,
  )
  await act(async () => { __wsTest.emit('question', SCREEN_QUESTION) })
}

beforeEach(() => {
  mockRespondToQuestion.mockReset()
  mockRespondToQuestion.mockResolvedValue({ ok: true })
  mockSendInput.mockReset()
  mockSendInput.mockResolvedValue({ ok: true })
})

describe('terminal rows seam — the view between the card and the composer', () => {
  it('hides both rows on a server that cannot answer them', async () => {
    setQuestionOther(false)
    await openQuestion()
    expect(screen.queryByLabelText('Chat about this')).toBeNull()
    expect(screen.queryByLabelText('Type something.')).toBeNull()
    expect(screen.getByLabelText('SQLite')).toBeTruthy()
  })

  it('shows each row once on a server that answers them', async () => {
    setQuestionOther(true)
    await openQuestion()
    expect(screen.getAllByLabelText('Chat about this')).toHaveLength(1)
    expect(screen.getAllByLabelText('Type something.')).toHaveLength(1)
  })

  it('forwards the chat row, then carries the question in the composer until the user sends', async () => {
    setQuestionOther(true)
    await openQuestion()
    const defaultPlaceholder = screen.getByTestId('chat-message-input').props.placeholder
    const focusSpy = TextInput.prototype.focus as jest.Mock
    focusSpy.mockClear()

    await act(async () => { fireEvent.press(screen.getByLabelText('Chat about this')) })

    // The spy only proves the request reached the input; real keyboard focus needs a device.
    await waitFor(() => expect(focusSpy).toHaveBeenCalled())
    expect(mockRespondToQuestion).toHaveBeenCalledWith({ toolUseId: 'screen:1', answers: { [QUESTION]: 'Chat about this' } })
    await waitFor(() => expect(screen.getByTestId('chat-message-input').props.placeholder).toBe(QUESTION))

    await act(async () => { fireEvent.changeText(screen.getByTestId('chat-message-input'), 'Neither, I want Postgres') })
    await act(async () => { fireEvent.press(screen.getByTestId('chat-send-button')) })

    await waitFor(() => expect(mockSendInput).toHaveBeenCalled())
    expect(screen.getByTestId('chat-message-input').props.placeholder).toBe(defaultPlaceholder)
  })

  it('leaves the placeholder alone when the chat answer is refused', async () => {
    setQuestionOther(true)
    mockRespondToQuestion.mockRejectedValue(new Error('Server returned 500'))
    await openQuestion()
    const defaultPlaceholder = screen.getByTestId('chat-message-input').props.placeholder

    await act(async () => { fireEvent.press(screen.getByLabelText('Chat about this')) })

    await waitFor(() => expect(mockRespondToQuestion).toHaveBeenCalled())
    expect(screen.getByTestId('chat-message-input').props.placeholder).toBe(defaultPlaceholder)
  })
})
