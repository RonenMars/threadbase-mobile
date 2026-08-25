import React from 'react'
import { renderHook, act } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useQuestionAnswer } from '@/hooks/useQuestionAnswer'
import { NetworkError } from '@/services/api-client'
import type { PermissionWsMessage, QuestionWsMessage } from '@/types/api'

type ClientHandler = (msg: unknown) => void

jest.mock('@/services/ws-client', () => {
  const clientListeners = new Map<string, Set<ClientHandler>>()
  return {
    wsManager: {
      getClient: () => ({
        on: (type: string, handler: ClientHandler) => {
          if (!clientListeners.has(type)) clientListeners.set(type, new Set())
          clientListeners.get(type)!.add(handler)
          return () => clientListeners.get(type)!.delete(handler)
        },
      }),
      onAnyStatusChange: () => () => {},
    },
    __wsTest: {
      emit: (type: string, msg: unknown) => clientListeners.get(type)?.forEach((l) => l(msg)),
    },
  }
})

const { __wsTest } = jest.requireMock('@/services/ws-client') as {
  __wsTest: { emit: (type: string, msg: unknown) => void }
}

const gate: PermissionWsMessage = {
  type: 'permission',
  sessionId: 's1',
  prompt: 'Do you want to proceed?',
  detail: 'Bash command',
  options: [{ index: 1, label: 'Yes' }, { index: 2, label: 'No' }],
  contentKey: 'Do you want to proceed?::Bash command::1.Yes,2.No',
}

type Mutation = {
  mutateAsync: jest.Mock
  isPending: boolean
  isError: boolean
  error: Error | null
}

const mutation = (over: Partial<Mutation> = {}): Mutation => ({
  mutateAsync: jest.fn().mockResolvedValue({ ok: true }),
  isPending: false,
  isError: false,
  error: null,
  ...over,
})

// The mutations are passed in rather than created inside the hook, and these
// stand-ins are how that is enforced: a hook that called useSessionActions()
// itself would ignore them and read a second, independent instance.
async function setup(over: { respondToQuestion?: Mutation; answerPermission?: Mutation } = {}) {
  const respondToQuestion = over.respondToQuestion ?? mutation()
  const answerPermission = over.answerPermission ?? mutation()
  // A provider the hook itself does not need. It is here so the mutant that
  // calls useSessionActions() internally can actually run and report a real
  // isPending, instead of throwing for want of a provider — a mutant that
  // crashes proves the test noticed a change, not that it noticed the wrong
  // busy state.
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  const rendered = await renderHook(() =>
    useQuestionAnswer({
      serverId: 'srv-1',
      sessionId: 's1',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test stand-ins for two react-query mutations
      respondToQuestion: respondToQuestion as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- see above
      answerPermission: answerPermission as any,
    }),
    { wrapper },
  )
  return { ...rendered, respondToQuestion, answerPermission }
}

describe('useQuestionAnswer – the mutations it was given', () => {
  // The constraint that decides the hook's shape. If it created its own
  // useSessionActions(), answerBusy would report isPending from the instance
  // the answer did NOT go through: the card's rows would unlock while the
  // request was still out, or stay locked after it landed. Neither looks wrong
  // on screen.
  it('reports busy from the permission mutation it was handed', async () => {
    const { result } = await setup({ answerPermission: mutation({ isPending: true }) })
    expect(result.current.answerBusy).toBe(true)
  })

  it('reports busy from the question mutation it was handed', async () => {
    const { result } = await setup({ respondToQuestion: mutation({ isPending: true }) })
    expect(result.current.answerBusy).toBe(true)
  })

  it('is not busy when neither is in flight', async () => {
    const { result } = await setup()
    expect(result.current.answerBusy).toBe(false)
  })

  it('answers through the mutation it was handed, not one of its own', async () => {
    const { result, answerPermission } = await setup()
    await act(() => __wsTest.emit('permission', gate))
    await act(async () => { await result.current.handleAnswerPermission(0) })

    expect(answerPermission.mutateAsync).toHaveBeenCalledWith({
      contentKey: gate.contentKey,
      optionIndex: 0,
      keys: '1\r',
    })
  })

  // The derived messages read the same instances, for the same reason.
  it('derives the calm notice from the handed mutation being closed', async () => {
    const closed = mutation({ isError: true, error: new NetworkError('409', 'gate_closed') })
    const { result } = await setup({ answerPermission: closed })
    expect(result.current.answerNoticeMessage).not.toBeNull()
    expect(result.current.answerErrorMessage).toBeNull()
  })

  it('derives an error message from the handed mutation failing retryably', async () => {
    const failed = mutation({ isError: true, error: new NetworkError('Server returned 500') })
    const { result } = await setup({ answerPermission: failed })
    expect(result.current.answerErrorMessage).toBe('Server returned 500')
    expect(result.current.answerNoticeMessage).toBeNull()
  })
})

describe('useQuestionAnswer – gate identity on the answer', () => {
  // The server's per-instance id travels from the WS frame, through the card,
  // into the answer next to contentKey. contentKey stays: a streamer that
  // predates gateId answers on it alone, and the fallback keys are unchanged.
  it('echoes the gateId the gate arrived with', async () => {
    const { result, answerPermission } = await setup()
    await act(() => __wsTest.emit('permission', { ...gate, gateId: 'gate-instance-7' }))
    await act(async () => { await result.current.handleAnswerPermission(1) })

    expect(answerPermission.mutateAsync).toHaveBeenCalledWith({
      contentKey: gate.contentKey,
      gateId: 'gate-instance-7',
      optionIndex: 1,
      keys: '2\r',
    })
  })

  // Old streamer: no gateId on the wire, none on the answer.
  it('sends no gateId when the gate carried none', async () => {
    const { result, answerPermission } = await setup()
    await act(() => __wsTest.emit('permission', gate))
    await act(async () => { await result.current.handleAnswerPermission(0) })

    expect(answerPermission.mutateAsync.mock.calls[0][0].gateId).toBeUndefined()
  })
})

const question: QuestionWsMessage = {
  type: 'question',
  sessionId: 's1',
  toolUseId: 'tool-1',
  questions: [
    { question: 'Which language?', header: 'Language', multiSelect: false, options: [
      { label: 'TypeScript', description: '' },
      { label: 'Go', description: '' },
    ] },
  ],
}

describe('useQuestionAnswer – an answer the server refuses to write', () => {
  // 400 unsupported_prompt_shape / incomplete_answer: the question is still
  // open on the host and can be answered in the terminal. Clearing the card
  // here would hide the one thing that tells the user that.
  it.each(['unsupported_prompt_shape', 'incomplete_answer'])(
    'keeps the card up on %s',
    async (code) => {
      const refused = mutation({
        mutateAsync: jest.fn().mockRejectedValue(new NetworkError('Answer this one in the terminal', code)),
      })
      const { result } = await setup({ respondToQuestion: refused })
      await act(() => __wsTest.emit('question', question))
      expect(result.current.activeQuestion).not.toBeNull()

      await act(async () => {
        await result.current.handleAnswerQuestion('tool-1', { 'Which language?': 'TypeScript' })
      })

      expect(refused.mutateAsync).toHaveBeenCalledTimes(1)
      expect(result.current.activeQuestion).not.toBeNull()
      expect(result.current.answerPhase).toBe('active')
    },
  )

  // Negative control: a closed question DOES clear the card through the same
  // handler — so the case above passes because of the code, not because the
  // handler never clears anything.
  it('clears the card on question_gone through the same handler', async () => {
    const closed = mutation({
      mutateAsync: jest.fn().mockRejectedValue(new NetworkError('Server returned 409', 'question_gone')),
    })
    const { result } = await setup({ respondToQuestion: closed })
    await act(() => __wsTest.emit('question', question))
    expect(result.current.activeQuestion).not.toBeNull()

    await act(async () => {
      await result.current.handleAnswerQuestion('tool-1', { 'Which language?': 'TypeScript' })
    })

    expect(result.current.activeQuestion).toBeNull()
  })

  it.each(['unsupported_prompt_shape', 'incomplete_answer'])(
    'shows the server guidance for %s as the error, not the closed notice',
    async (code) => {
      const refused = mutation({ isError: true, error: new NetworkError('Answer this one in the terminal', code) })
      const { result } = await setup({ respondToQuestion: refused })
      expect(result.current.answerErrorMessage).toBe('Answer this one in the terminal')
      expect(result.current.answerNoticeMessage).toBeNull()
    },
  )
})
