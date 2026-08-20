import { renderHook, act } from '@testing-library/react-native'
import { useActiveQuestion } from '@/hooks/useActiveQuestion'
import type { PermissionWsMessage, Session, SessionStatus } from '@/types/api'

type ClientHandler = (msg: unknown) => void
type StatusListener = (serverId: string, status: string) => void

jest.mock('@/services/ws-client', () => {
  const clientListeners = new Map<string, Set<ClientHandler>>()
  const statusListeners = new Set<StatusListener>()
  return {
    wsManager: {
      getClient: () => ({
        on: (type: string, handler: ClientHandler) => {
          if (!clientListeners.has(type)) clientListeners.set(type, new Set())
          clientListeners.get(type)!.add(handler)
          return () => clientListeners.get(type)!.delete(handler)
        },
      }),
      onAnyStatusChange: (l: StatusListener) => {
        statusListeners.add(l)
        return () => statusListeners.delete(l)
      },
    },
    __wsTest: {
      emit: (type: string, msg: unknown) => {
        clientListeners.get(type)?.forEach((l) => l(msg))
      },
      emitStatus: (serverId: string, status: string) => {
        statusListeners.forEach((l) => l(serverId, status))
      },
    },
  }
})

const { __wsTest } = jest.requireMock('@/services/ws-client') as {
  __wsTest: {
    emit: (type: string, msg: unknown) => void
    emitStatus: (serverId: string, status: string) => void
  }
}

const gate: PermissionWsMessage = {
  type: 'permission',
  sessionId: 's1',
  prompt: 'Do you want to proceed?',
  detail: 'Bash command',
  options: [{ index: 1, label: 'Yes' }, { index: 2, label: 'No' }],
  cursor: 1,
}

function session(status: SessionStatus, id = 's1'): Session {
  return {
    id,
    status,
    ptyAttached: true,
    projectPath: '/p',
    projectName: 'p',
    subStatus: null,
    lastOutput: '',
    elapsedMs: 0,
    promptCount: 0,
    startedAt: '2026-08-20T00:00:00.000Z',
  }
}

const sessionUpdate = (status: SessionStatus, id = 's1') =>
  ({ type: 'session_update', session: session(status, id) })

async function setup() {
  return renderHook(() => useActiveQuestion('srv-1', 's1'))
}

describe('useActiveQuestion – teardown when the card\'s premise dies', () => {
  it('drops the card when the socket disconnects', async () => {
    const { result } = await setup()
    await act(() => __wsTest.emit('permission', gate))
    expect(result.current.question?.source).toBe('permission')

    await act(() => __wsTest.emitStatus('srv-1', 'disconnected'))
    expect(result.current.question).toBeNull()
  })

  it('leaves a card up when a different server disconnects', async () => {
    const { result } = await setup()
    await act(() => __wsTest.emit('permission', gate))

    await act(() => __wsTest.emitStatus('srv-2', 'disconnected'))
    expect(result.current.question?.source).toBe('permission')
  })

  // The teardown must not route through clear(): clear() arms dismissedKey so a
  // repaint of an answered gate stays down, and the gate replayed on
  // resubscribe is byte-identical to the one that was up. Arming it here would
  // swallow the replay and make the card never come back.
  it('shows the gate again when the reconnect replays it', async () => {
    const { result } = await setup()
    await act(() => __wsTest.emit('permission', gate))
    await act(() => __wsTest.emitStatus('srv-1', 'disconnected'))

    await act(() => __wsTest.emit('permission', gate))
    expect(result.current.question?.source).toBe('permission')
  })

  // The other half of the same rule: a disconnect must not disarm a
  // suppression the user's own answer armed.
  it('keeps an answered gate suppressed across a disconnect', async () => {
    const { result } = await setup()
    await act(() => __wsTest.emit('permission', gate))
    await act(() => result.current.clear())
    await act(() => __wsTest.emitStatus('srv-1', 'disconnected'))

    await act(() => __wsTest.emit('permission', gate))
    expect(result.current.question).toBeNull()
  })

  it('drops the card when the session leaves waiting_input', async () => {
    const { result } = await setup()
    await act(() => __wsTest.emit('permission', gate))
    await act(() => __wsTest.emit('session_update', sessionUpdate('waiting_input')))
    expect(result.current.question?.source).toBe('permission')

    await act(() => __wsTest.emit('session_update', sessionUpdate('running')))
    expect(result.current.question).toBeNull()
  })

  it('keeps the card while the session stays in waiting_input', async () => {
    const { result } = await setup()
    await act(() => __wsTest.emit('permission', gate))
    await act(() => __wsTest.emit('session_update', sessionUpdate('waiting_input')))
    await act(() => __wsTest.emit('session_update', sessionUpdate('waiting_input')))
    expect(result.current.question?.source).toBe('permission')
  })

  // The gate broadcast and the status flip are two separate messages, and
  // nothing guarantees the flip lands first. A level-triggered rule ("status
  // isn't waiting_input, so drop the card") would tear down a card a beat after
  // it appeared. Only an observed exit from waiting_input counts.
  it('keeps a card that arrives before the status flip to waiting_input', async () => {
    const { result } = await setup()
    await act(() => __wsTest.emit('permission', gate))
    await act(() => __wsTest.emit('session_update', sessionUpdate('running')))
    expect(result.current.question?.source).toBe('permission')
  })

  it('ignores a status change on another session', async () => {
    const { result } = await setup()
    await act(() => __wsTest.emit('permission', gate))
    await act(() => __wsTest.emit('session_update', sessionUpdate('waiting_input')))

    await act(() => __wsTest.emit('session_update', sessionUpdate('idle', 'OTHER')))
    expect(result.current.question?.source).toBe('permission')
  })

  // Same rule as the disconnect case: a status teardown is the premise dying,
  // not the user dismissing, so a gate that reopens must be able to show.
  it('shows a gate that reopens after a status teardown', async () => {
    const { result } = await setup()
    await act(() => __wsTest.emit('permission', gate))
    await act(() => __wsTest.emit('session_update', sessionUpdate('waiting_input')))
    await act(() => __wsTest.emit('session_update', sessionUpdate('running')))

    await act(() => __wsTest.emit('permission', gate))
    expect(result.current.question?.source).toBe('permission')
  })
})
