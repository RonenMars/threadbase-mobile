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

type MockHandler = (msg: WSMessage) => void
type MockStatus = 'connecting' | 'connected' | 'disconnected'
type MockStatusListener = (serverId: string, status: MockStatus) => void

// State lives outside the factory. A jest.mock factory is hoisted above the
// imports and may not reference anything out of its own scope — not even a
// type alias, whose parameter names the hoist guard reads as variable access.
// `mock`-prefixed names are the sanctioned exception.
const mockListeners = new Map<string, Set<MockHandler>>()
const mockStatusListeners = new Set<MockStatusListener>()
let mockClient: { on: (type: string, handler: MockHandler) => () => void } | undefined

const mockMakeClient = () => ({
  on: (type: string, handler: MockHandler) => {
    if (!mockListeners.has(type)) mockListeners.set(type, new Set())
    mockListeners.get(type)!.add(handler)
    // Tolerant: dropClient() can clear the map before a stale unsub runs.
    return () => mockListeners.get(type)?.delete(handler)
  },
})

jest.mock('@/services/ws-client', () => ({
  wsManager: {
    getClient: () => mockClient,
    onAnyStatusChange: (l: MockStatusListener) => {
      mockStatusListeners.add(l)
      return () => mockStatusListeners.delete(l)
    },
  },
}))

const ws = {
  // The socket dials: a client appears, then subscribers are told.
  connect: (serverId: string) => {
    mockClient = mockMakeClient()
    mockStatusListeners.forEach((l) => l(serverId, 'connected'))
  },
  // disconnect()/retain() drop the instance; a later dial builds a new one.
  dropClient: () => {
    mockClient = undefined
    mockListeners.clear()
  },
  emit: (type: string, msg: WSMessage) => mockListeners.get(type)?.forEach((h) => h(msg)),
  handlerCount: (type: string) => mockListeners.get(type)?.size ?? 0,
  reset: () => {
    mockListeners.clear()
    mockStatusListeners.clear()
    mockClient = undefined
  },
}

// eslint-disable-next-line import/first
import { useActiveQuestion } from '@/hooks/useActiveQuestion'

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
