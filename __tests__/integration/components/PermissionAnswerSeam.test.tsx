/**
 * The seam between the card and the answer route, driven through the real view.
 *
 * Each half is covered on its own — the components report a position, the
 * mutation classifies its replies — and neither test would notice if the view
 * wired them together wrongly. This drives the whole path: a gate arrives on the
 * socket, the user taps, the server replies, and the card does what the reply
 * says.
 *
 * Weighted toward the exits, because that is where every defect in this work has
 * lived. In particular, a gate the server says is closed has to clear the card
 * with a calm notice: leaving it up and tappable is a regression AND wrong, since
 * the server has just said a second tap cannot succeed either. And for two of the
 * three closed reasons no `permission_cancelled` is broadcast at all, so this
 * path is the only thing that takes the card down.
 */
import React from 'react'
import { Alert } from 'react-native'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { createWrapper } from '@/test-utils'
import { NetworkError } from '@/services/api-client'
import type { PermissionWsMessage } from '@/types/api'

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
jest.mock('@/hooks/useSessionActions', () => ({
  useSessionActions: () => ({
    sendInput: { mutate: jest.fn(), mutateAsync: mockSendInput, isError: false, error: null },
    sendKeys: { mutate: jest.fn() },
    respondToQuestion: { mutate: jest.fn(), mutateAsync: mockRespondToQuestion, isError: false, error: null },
    answerPermission: { mutate: jest.fn(), mutateAsync: mockAnswerPermission, isError: false, error: null },
  }),
}))

jest.mock('@/components/terminal/SessionHistoryFeed', () => ({ SessionHistoryFeed: () => null }))
jest.mock('@/components/shared/SlashCommandBoard', () => ({ SlashCommandBoard: () => null }))
jest.mock('@/components/shared/SlashCommandArgModal', () => ({ SlashCommandArgModal: () => null }))
jest.mock('@/components/queue/PromptQueueSheet', () => ({ PromptQueueSheet: () => null }))
jest.mock('@/components/queue/PlanPreviewSheet', () => ({ PlanPreviewSheet: () => null }))

// eslint-disable-next-line import/first
import { TerminalView } from '@/components/terminal/TerminalView'

const gate: PermissionWsMessage = {
  type: 'permission',
  sessionId: 'sess-1',
  prompt: 'Do you want to proceed?',
  detail: 'Bash command',
  options: [{ index: 1, label: 'Yes' }, { index: 2, label: 'No' }],
  contentKey: 'Do you want to proceed?::Bash command::1.Yes,2.No',
}

async function openGate() {
  const Wrapper = createWrapper()
  await render(
    <Wrapper>
      <TerminalView serverId="srv-1" sessionId="sess-1" />
    </Wrapper>,
  )
  await act(async () => { __wsTest.emit('permission', gate) })
  return screen.getByLabelText('Yes')
}

beforeEach(() => {
  mockAnswerPermission.mockReset()
  mockAnswerPermission.mockResolvedValue({ ok: true })
  mockRespondToQuestion.mockReset()
  mockSendInput.mockReset()
  mockSendInput.mockResolvedValue({})
})

describe('permission answer seam — the view between the card and the route', () => {
  it('sends the gate content key and the tapped position', async () => {
    const yes = await openGate()
    await act(async () => { fireEvent.press(yes) })

    await waitFor(() => expect(mockAnswerPermission).toHaveBeenCalledWith({
      contentKey: gate.contentKey,
      optionIndex: 0,
      keys: '1\r',
    }))
  })

  it('keeps the card up while the answer is in flight', async () => {
    let settle: (v: unknown) => void = () => {}
    mockAnswerPermission.mockImplementation(() => new Promise((res) => { settle = res }))
    const yes = await openGate()

    await act(async () => { fireEvent.press(yes) })
    expect(screen.getByLabelText('Yes')).toBeTruthy()

    await act(async () => { settle({ ok: true }) })
  })

  it('turns the card into a ghost once the server takes the answer', async () => {
    const yes = await openGate()
    await act(async () => { fireEvent.press(yes) })

    await waitFor(() => expect(screen.getByTestId('question-card-ghost')).toBeTruthy())
  })

  it.each(['gate_closed', 'gate_mismatch', 'unknown_option'])(
    'clears the card calmly on %s, with no error styling',
    async (reason) => {
      mockAnswerPermission.mockRejectedValue(new NetworkError('Server returned 409', reason))
      const yes = await openGate()

      await act(async () => { fireEvent.press(yes) })

      await waitFor(() => expect(screen.queryByLabelText('Yes')).toBeNull())
      expect(screen.queryByTestId('question-card-ghost')).toBeNull()
    },
  )

  // The other direction, and the one that would be a lockout if it were wrong:
  // a blip must not take the card away, because send stays disabled while it is
  // active and the user needs it back to get out of that state.
  it('keeps the card up and tappable when the failure is retryable', async () => {
    mockAnswerPermission.mockRejectedValue(new NetworkError('Server returned 500'))
    const yes = await openGate()

    await act(async () => { fireEvent.press(yes) })

    await waitFor(() => expect(mockAnswerPermission).toHaveBeenCalled())
    expect(screen.getByLabelText('Yes')).toBeTruthy()
    expect(screen.queryByTestId('question-card-ghost')).toBeNull()
  })

  it('lets the user answer again after a retryable failure', async () => {
    mockAnswerPermission.mockRejectedValueOnce(new NetworkError('Server returned 500'))
    mockAnswerPermission.mockResolvedValue({ ok: true })
    const yes = await openGate()

    await act(async () => { fireEvent.press(yes) })
    await waitFor(() => expect(mockAnswerPermission).toHaveBeenCalledTimes(1))

    await act(async () => { fireEvent.press(screen.getByLabelText('Yes')) })
    await waitFor(() => expect(mockAnswerPermission).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.getByTestId('question-card-ghost')).toBeTruthy())
  })

  // A 404 is the mutation's own business — it falls back to /input and resolves.
  // From the view's side that is indistinguishable from a 200, and must be.
  it('ghosts the card when the answer landed through the fallback', async () => {
    mockAnswerPermission.mockResolvedValue(undefined)
    const yes = await openGate()

    await act(async () => { fireEvent.press(yes) })
    await waitFor(() => expect(screen.getByTestId('question-card-ghost')).toBeTruthy())
  })

  // Exits with nothing on screen to tap: the server closes the gate some other
  // way — answered at the host keyboard, on a second device, /clear — and the
  // card has to go from either phase.
  it('clears an active card when the gate closes elsewhere', async () => {
    await openGate()

    await act(async () => { __wsTest.emit('permission_cancelled', { type: 'permission_cancelled', sessionId: 'sess-1' }) })

    expect(screen.queryByLabelText('Yes')).toBeNull()
  })

  it('clears a ghost when the gate closes elsewhere', async () => {
    const yes = await openGate()
    await act(async () => { fireEvent.press(yes) })
    await waitFor(() => expect(screen.getByTestId('question-card-ghost')).toBeTruthy())

    await act(async () => { __wsTest.emit('permission_cancelled', { type: 'permission_cancelled', sessionId: 'sess-1' }) })

    expect(screen.queryByTestId('question-card-ghost')).toBeNull()
    expect(screen.queryByLabelText('Yes')).toBeNull()
  })
})

describe('permission answer seam — gate identity', () => {
  // The gateId on the WS frame is the one the answer carries, next to the
  // contentKey — through the real reducer, the real card, and the real
  // handler, not a hand-built block.
  it('echoes the gateId the frame arrived with, next to the content key', async () => {
    const Wrapper = createWrapper()
    await render(
      <Wrapper>
        <TerminalView serverId="srv-1" sessionId="sess-1" />
      </Wrapper>,
    )
    await act(async () => { __wsTest.emit('permission', { ...gate, gateId: 'gate-instance-7' }) })
    await act(async () => { fireEvent.press(screen.getByLabelText('Yes')) })

    await waitFor(() => expect(mockAnswerPermission).toHaveBeenCalledWith({
      contentKey: gate.contentKey,
      gateId: 'gate-instance-7',
      optionIndex: 0,
      keys: '1\r',
    }))
  })
})

// POST /input answered 409 prompt_pending: a card is open on the host and the
// text was refused before any byte was written. Reached here in the window
// before the card's own WS frame lands (once it has, send is disabled locally).
// The composer keeps the draft and no alert takes the focus from the card,
// which sits right above the composer in this view (the composer itself drops
// the keyboard on every send).
describe('composer text refused while a prompt is open (TerminalView)', () => {
  const PROMPT_PENDING_MESSAGE = 'A prompt is waiting for an answer; answer or dismiss it before sending text'
  let alertSpy: jest.SpyInstance

  beforeEach(() => {
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
  })
  afterEach(() => {
    alertSpy.mockRestore()
  })

  async function typeAndSend(text: string) {
    const Wrapper = createWrapper()
    await render(
      <Wrapper>
        <TerminalView serverId="srv-1" sessionId="sess-1" />
      </Wrapper>,
    )
    const input = screen.getByTestId('chat-message-input')
    await fireEvent.changeText(input, text)
    await act(async () => { fireEvent.press(screen.getByTestId('chat-send-button')) })
    return input
  }

  it('keeps the draft and raises no alert on prompt_pending', async () => {
    mockSendInput.mockRejectedValueOnce(new NetworkError(PROMPT_PENDING_MESSAGE, 'prompt_pending'))

    const input = await typeAndSend('keep me')

    expect(mockSendInput).toHaveBeenCalledWith('keep me')
    expect(input.props.value).toBe('keep me')
    expect(alertSpy).not.toHaveBeenCalled()
  })

  // Positive control: any other failure still alerts, so the case above passes
  // because of the code, not because this view never alerts.
  it('still alerts on an ordinary send failure', async () => {
    mockSendInput.mockRejectedValueOnce(new NetworkError('Failed to reach server'))

    const input = await typeAndSend('keep me')

    expect(input.props.value).toBe('keep me')
    expect(alertSpy).toHaveBeenCalledWith(expect.any(String), 'Failed to reach server')
  })
})
