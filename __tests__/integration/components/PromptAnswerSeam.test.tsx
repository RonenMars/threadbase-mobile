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
jest.mock('@/hooks/useSessionActions', () => ({
  useSessionActions: () => ({
    sendInput: { mutate: jest.fn(), mutateAsync: mockSendInput, isError: false, error: null },
    sendKeys: { mutate: jest.fn() },
    respondToQuestion: { mutate: jest.fn(), mutateAsync: mockRespondToQuestion, isError: false, error: null },
    answerPermission: { mutate: jest.fn(), mutateAsync: mockAnswerPermission, isError: false, error: null },
    answerPrompt: { mutate: jest.fn(), mutateAsync: mockAnswerPrompt, isError: false, error: null },
  }),
}))

jest.mock('@/components/terminal/SessionHistoryFeed', () => ({ SessionHistoryFeed: () => null }))
jest.mock('@/components/shared/SlashCommandBoard', () => ({ SlashCommandBoard: () => null }))
jest.mock('@/components/shared/SlashCommandArgModal', () => ({ SlashCommandArgModal: () => null }))
jest.mock('@/components/queue/PromptQueueSheet', () => ({ PromptQueueSheet: () => null }))
jest.mock('@/components/queue/PlanPreviewSheet', () => ({ PlanPreviewSheet: () => null }))

// eslint-disable-next-line import/first
import { TerminalView } from '@/components/terminal/TerminalView'


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
