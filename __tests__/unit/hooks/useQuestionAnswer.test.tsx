import React from 'react'
import { renderHook, act } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useQuestionAnswer } from '@/hooks/useQuestionAnswer'
import { NetworkError } from '@/services/api-client'
import type { PermissionWsMessage } from '@/types/api'

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
