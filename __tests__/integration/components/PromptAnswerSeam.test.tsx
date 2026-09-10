/**
 * The provider-neutral seam, driven through the real view: a prompt_snapshot
 * arrives on the socket, the card renders, the user taps, the answer route is
 * called with the ids the server minted, and a terminal prompt_event takes the
 * card down. The legacy permission seam next door is the old-streamer control.
 */
import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { createWrapper } from '@/test-utils'
import { NetworkError } from '@/services/api-client'
import type { Prompt } from '@/types/api'

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
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
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
    isStreaming: false,
    userMessageTexts: new Set<string>(),
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

jest.mock('@/components/terminal/SessionHistoryFeed', () => ({ SessionHistoryFeed: () => null }))
jest.mock('@/components/shared/SlashCommandBoard', () => ({ SlashCommandBoard: () => null }))
jest.mock('@/components/shared/SlashCommandArgModal', () => ({ SlashCommandArgModal: () => null }))
jest.mock('@/components/queue/PromptQueueSheet', () => ({ PromptQueueSheet: () => null }))

// eslint-disable-next-line import/first
import { TerminalView } from '@/components/terminal/TerminalView'
// eslint-disable-next-line import/first
import { useServersStore } from '@/stores/servers'

function setRawKeys(supported: boolean) {
  useServersStore.setState({
    servers: {
      'srv-1': {
        id: 'srv-1',
        url: 'http://srv-1',
        apiKey: 'key',
        isConnected: true,
        connectionError: null,
        serverInfo: { version: '1', machineName: 'mac', platform: 'macOS', activeSessions: 0, ...(supported ? { rawKeys: true as const } : {}) },
      },
    },
  })
}


const PROMPT: Prompt = {
  schemaVersion: 1,
  sessionId: 'sess-1',
  promptId: 'prompt-1',
  revision: 1,
  state: 'open',
  intent: 'approval',
  title: 'Approval',
  message: 'Do you want to proceed?',
  detail: 'Bash command\ngit push',
  questions: [
    {
      questionId: 'q-1',
      text: 'Do you want to proceed?',
      header: 'Approval',
      inputMode: 'single',
      options: [
        { optionId: 'opt-yes', label: 'Yes' },
        { optionId: 'opt-no', label: 'No' },
      ],
      allowOther: false,
      secret: 'unknown',
    },
  ],
  answerRequirement: 'unknown',
  expiresAt: null,
  provenance: { source: 'screen', confidence: 'inferred' },
}

const snapshot = (prompts: Prompt[]) => ({ type: 'prompt_snapshot', schemaVersion: 1, sessionId: 'sess-1', sequence: 1, prompts })
const event = (prompt: Prompt, sequence: number) => ({ type: 'prompt_event', sessionId: 'sess-1', sequence, prompt })

async function openPrompt(prompt: Prompt = PROMPT) {
  const Wrapper = createWrapper()
  await render(
    <Wrapper>
      <TerminalView serverId="srv-1" sessionId="sess-1" />
    </Wrapper>,
  )
  await act(async () => { __wsTest.emit('prompt_snapshot', snapshot([prompt])) })
}

beforeEach(() => {
  mockAnswerPrompt.mockReset()
  mockAnswerPrompt.mockResolvedValue({ ok: true })
  mockAnswerPermission.mockReset()
  mockSendInput.mockReset()
  mockSendKeys.mockReset()
  mockRawKey.mockReset()
  mockRawKey.mockResolvedValue({ ok: true })
  setRawKeys(true)
})

describe('prompt answer seam — the view between the card and the contract route', () => {
  it('opens the card from the subscribe snapshot and answers by ids', async () => {
    await openPrompt()
    await act(async () => { fireEvent.press(screen.getByLabelText('No')) })

    await waitFor(() => expect(mockAnswerPrompt).toHaveBeenCalledTimes(1))
    expect(mockAnswerPrompt.mock.calls[0][0]).toMatchObject({
      promptId: 'prompt-1', revision: 1, questionId: 'q-1', optionId: 'opt-no',
    })
    expect(mockAnswerPermission).not.toHaveBeenCalled()
    expect(mockSendInput).not.toHaveBeenCalled()
  })

  it('ghosts the card once the server takes the answer, then clears it on the resolved event', async () => {
    await openPrompt()
    await act(async () => { fireEvent.press(screen.getByLabelText('Yes')) })
    await waitFor(() => expect(screen.getByTestId('question-card-ghost')).toBeTruthy())

    await act(async () => {
      __wsTest.emit('prompt_event', event({ ...PROMPT, revision: 2, state: 'resolved', terminalReason: 'answered' }, 2))
    })
    expect(screen.queryByTestId('question-card-ghost')).toBeNull()
    expect(screen.queryByTestId('question-card')).toBeNull()
  })

  it('keeps the card up and tappable on a stale reply', async () => {
    mockAnswerPrompt.mockRejectedValueOnce(new NetworkError('409', 'prompt_revision_mismatch'))
    await openPrompt()
    await act(async () => { fireEvent.press(screen.getByLabelText('Yes')) })

    await waitFor(() => expect(mockAnswerPrompt).toHaveBeenCalledTimes(1))
    expect(screen.getByTestId('question-card')).toBeTruthy()
    expect(screen.getByLabelText('Yes')).toBeTruthy()
  })

  it('clears the card on a closed reply', async () => {
    mockAnswerPrompt.mockRejectedValueOnce(new NetworkError('409', 'prompt_expired'))
    await openPrompt()
    await act(async () => { fireEvent.press(screen.getByLabelText('Yes')) })

    await waitFor(() => expect(screen.queryByTestId('question-card')).toBeNull())
  })

  // Fail closed, at the surface the user sees: no rows, guidance instead, and
  // the dismiss control still there. Send stays disabled exactly as for any
  // active card — the prompt is open on the host and the streamer refuses
  // composer text while it is (409 prompt_pending); Escape is the safe exit.
  it('renders an unsupported shape with no options, guidance, and a dismiss control', async () => {
    await openPrompt({ ...PROMPT, questions: [{ ...PROMPT.questions[0], inputMode: 'multi' }] })

    expect(screen.getByTestId('question-card-unsupported')).toBeTruthy()
    expect(screen.queryByLabelText('Yes')).toBeNull()
    expect(screen.queryByLabelText('No')).toBeNull()
    expect(mockAnswerPrompt).not.toHaveBeenCalled()
    expect(screen.getAllByLabelText('Cancel').length).toBeGreaterThan(0)
    expect(screen.getByTestId('chat-send-button').props.accessibilityState?.disabled).toBe(true)
  })
})

// Cancel is "dismiss this card", not "interrupt the agent". A blind Escape
// written after the gate already closed lands on Claude's prompt and kills the
// turn the user is waiting on, so a card with a registry promptId cancels over
// /raw-key bound to it, and comes down on the server's verdict, not the tap.
describe('prompt cancel seam — Escape bound to the card it was tapped on', () => {
  const tapCancel = async () => {
    await act(async () => { fireEvent.press(screen.getAllByLabelText('Cancel')[0]) })
  }

  it('sends a bound raw-key escape and never a blind /input keys write', async () => {
    await openPrompt()
    await tapCancel()

    await waitFor(() => expect(mockRawKey).toHaveBeenCalledWith({ action: 'escape', promptId: 'prompt-1' }))
    expect(mockSendKeys).not.toHaveBeenCalled()
  })

  it('keeps the card up until the server replies, then takes it down on a 200', async () => {
    let settle: (v: { ok: true }) => void = () => {}
    mockRawKey.mockImplementation(() => new Promise((res) => { settle = res }))
    await openPrompt()
    await tapCancel()

    expect(screen.getByTestId('question-card')).toBeTruthy()
    await act(async () => { settle({ ok: true }) })
    await waitFor(() => expect(screen.queryByTestId('question-card')).toBeNull())
  })

  it('treats raw_key_stale as the gate already gone: card down, calm notice, zero bytes', async () => {
    mockRawKey.mockRejectedValue(new NetworkError('Server returned 409', 'raw_key_stale'))
    await openPrompt()
    await tapCancel()

    await waitFor(() => expect(screen.queryByTestId('question-card')).toBeNull())
    expect(screen.getByText("That question isn't open anymore.")).toBeTruthy()
    expect(screen.queryByText('Server returned 409')).toBeNull()
    expect(mockSendKeys).not.toHaveBeenCalled()
  })

  it('keeps the card up and surfaces the error on any other failure', async () => {
    mockRawKey.mockRejectedValue(new NetworkError('Server returned 409', 'raw_key_unavailable'))
    await openPrompt()
    await tapCancel()

    await waitFor(() => expect(screen.getByText(
      'The focused prompt changed or is no longer available. Check the session and try again.',
    )).toBeTruthy())
    expect(screen.queryByText('Server returned 409')).toBeNull()
    expect(screen.getByTestId('question-card')).toBeTruthy()
    expect(mockSendKeys).not.toHaveBeenCalled()
  })

  it('does not take down a different card that arrived while the cancel was in flight', async () => {
    let fail: (e: Error) => void = () => {}
    mockRawKey.mockImplementation(() => new Promise((_res, rej) => { fail = rej }))
    await openPrompt()
    await tapCancel()

    const next: Prompt = {
      ...PROMPT,
      promptId: 'prompt-2',
      questions: [{ ...PROMPT.questions[0], text: 'Run the tests?' }],
    }
    await act(async () => { __wsTest.emit('prompt_event', event(next, 2)) })
    await act(async () => { fail(new NetworkError('Server returned 409', 'raw_key_stale')) })

    expect(screen.getByText('Run the tests?')).toBeTruthy()
  })

  // Negative control: the capability flag, not the card, selects the bound path.
  it('falls back to the blind Escape and an immediate dismiss when the server lacks rawKeys', async () => {
    setRawKeys(false)
    await openPrompt()
    await tapCancel()

    expect(mockSendKeys).toHaveBeenCalledWith('\x1b')
    expect(mockRawKey).not.toHaveBeenCalled()
    expect(screen.queryByTestId('question-card')).toBeNull()
  })
})
