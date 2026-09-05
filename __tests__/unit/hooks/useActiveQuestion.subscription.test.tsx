/**
 * The subscription effect of useActiveQuestion, which nothing else covered.
 *
 * Every other useActiveQuestion test drives useActiveQuestionReducer directly
 * and hands it messages by hand, so none of them could notice that the public
 * hook never bound a listener at all. That is exactly the defect here: the
 * client was resolved once, at effect time, and on a cold start it does not
 * exist yet — React runs this child effect before _layout.tsx's
 * wsManager.connect().
 *
 * What makes it costly rather than cosmetic is the other end. `subscribe_session`
 * makes the streamer unicast back any gate that opened before the client
 * subscribed (server-wiring's ws.replay_permission), so the card was being sent
 * correctly and discarded on arrival.
 */
import { renderHook, act } from '@testing-library/react-native'
import type { PermissionWsMessage } from '@/types/api'
import type { WSMessage } from '@/services/ws-client'

// These aliases are not decoration. A jest.mock factory is hoisted above the
// imports and checked by babel-plugin-jest-hoist before TypeScript annotations
// are stripped, so the plugin reads type nodes as if they were code. An inline
// function type inside a `new` type argument — `new Set<(id: string) => void>()`
// — makes it treat the parameter name as out-of-scope variable access and throw.
// Behind an alias the same type is invisible to it, which is what lets all the
// state below stay inside the factory instead of leaking to module scope.
type Handler = (msg: WSMessage) => void
type Status = 'connecting' | 'connected' | 'disconnected'
type StatusListener = (serverId: string, status: Status) => void

type WsTestApi = {
  connect: (serverId: string) => void
  dropClient: () => void
  emit: (type: string, msg: WSMessage) => void
  handlerCount: (type: string) => number
  reset: () => void
}

jest.mock('@/services/ws-client', () => {
  const listeners = new Map<string, Set<Handler>>()
  const statusListeners = new Set<StatusListener>()
  let client: { on: (type: string, handler: Handler) => () => void } | undefined

  const makeClient = () => ({
    on: (type: string, handler: Handler) => {
      if (!listeners.has(type)) listeners.set(type, new Set())
      listeners.get(type)!.add(handler)
      // Tolerant: dropClient() can clear the map before a stale unsub runs.
      return () => listeners.get(type)?.delete(handler)
    },
  })

  return {
    wsManager: {
      getClient: () => client,
      onAnyStatusChange: (l: StatusListener) => {
        statusListeners.add(l)
        return () => statusListeners.delete(l)
      },
    },
    __wsTest: {
      // The socket dials: a client appears, then subscribers are told.
      connect: (serverId: string) => {
        client = makeClient()
        statusListeners.forEach((l) => l(serverId, 'connected'))
      },
      // disconnect()/retain() drop the instance; a later dial builds a new one.
      dropClient: () => {
        client = undefined
        listeners.clear()
      },
      emit: (type: string, msg: WSMessage) => listeners.get(type)?.forEach((h) => h(msg)),
      handlerCount: (type: string) => listeners.get(type)?.size ?? 0,
      reset: () => {
        listeners.clear()
        statusListeners.clear()
        client = undefined
      },
    },
  }
})

// eslint-disable-next-line import/first
import { useActiveQuestion } from '@/hooks/useActiveQuestion'

const { __wsTest: ws } = jest.requireMock('@/services/ws-client') as { __wsTest: WsTestApi }

const gate: PermissionWsMessage = {
  type: 'permission',
  sessionId: 's1',
  prompt: 'Do you trust the contents of this directory?',
  options: [
    { index: 1, label: 'Yes, continue' },
    { index: 2, label: 'No, quit' },
  ],
  cursor: 1,
}

beforeEach(() => ws.reset())

describe('useActiveQuestion subscription', () => {
  // The regression gate. Fails before the rebind: the mount binds nothing,
  // and the gate the server replays on subscribe is lost.
  it('receives a gate when the client is created after the hook mounts', async () => {
    const { result } = await renderHook(() => useActiveQuestion('srv', 's1'))
    expect(result.current.question).toBeNull()

    await act(() => ws.connect('srv'))
    await act(() => ws.emit('permission', gate))

    expect(result.current.question?.source).toBe('permission')
  })

  it('receives a gate when the client already exists at mount', async () => {
    ws.connect('srv')
    const { result } = await renderHook(() => useActiveQuestion('srv', 's1'))

    await act(() => ws.emit('permission', gate))

    expect(result.current.question?.source).toBe('permission')
  })

  // A rebind must replace its listeners, not stack a second set beside them:
  // two live handlers means every gate is delivered twice.
  it('does not accumulate listeners across repeated connects', async () => {
    await renderHook(() => useActiveQuestion('srv', 's1'))

    await act(() => ws.connect('srv'))
    expect(ws.handlerCount('permission')).toBe(1)

    await act(() => ws.connect('srv'))
    expect(ws.handlerCount('permission')).toBe(1)
  })

  // connect() reuses the client, so this is the narrow case where the instance
  // really is replaced: disconnect()/retain() dropped it and a later dial built
  // a new one. Listeners bound to the dead instance never fire again.
  it('rebinds onto a replaced client instance', async () => {
    ws.connect('srv')
    const { result } = await renderHook(() => useActiveQuestion('srv', 's1'))

    await act(() => ws.dropClient())
    await act(() => ws.connect('srv'))
    await act(() => ws.emit('permission', gate))

    expect(result.current.question?.source).toBe('permission')
  })

  it('ignores a gate addressed to another session', async () => {
    const { result } = await renderHook(() => useActiveQuestion('srv', 'OTHER'))

    await act(() => ws.connect('srv'))
    await act(() => ws.emit('permission', gate))

    expect(result.current.question).toBeNull()
  })

  it('unbinds every listener on unmount', async () => {
    const { unmount } = await renderHook(() => useActiveQuestion('srv', 's1'))
    await act(() => ws.connect('srv'))
    expect(ws.handlerCount('permission')).toBe(1)

    // Wrapped: an unmount outside act() does not flush the effect cleanup.
    await act(() => {
      unmount()
    })

    expect(ws.handlerCount('permission')).toBe(0)
  })
})
