import { wsClient } from '@/services/ws-client'

// ── Minimal WebSocket mock ───────────────────────────────────────────────────
type MockSocket = {
  url: string
  onopen: (() => void) | null
  onmessage: ((e: { data: string }) => void) | null
  onclose: (() => void) | null
  onerror: (() => void) | null
  send: jest.Mock
  close: jest.Mock
  readyState: number
}

let mockSocket: MockSocket

const MockWebSocket = jest.fn().mockImplementation((url: string) => {
  mockSocket = {
    url,
    onopen: null,
    onmessage: null,
    onclose: null,
    onerror: null,
    send: jest.fn(),
    close: jest.fn(),
    readyState: 0,
  }
  return mockSocket
}) as unknown as typeof WebSocket
;(MockWebSocket as unknown as Record<string, number>).OPEN = 1
;(MockWebSocket as unknown as Record<string, number>).CONNECTING = 0
;(MockWebSocket as unknown as Record<string, number>).CLOSED = 3

global.WebSocket = MockWebSocket

beforeEach(() => {
  wsClient.disconnect()
  jest.clearAllMocks()
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

describe('WSClient – initial state', () => {
  it('starts as disconnected', () => {
    expect(wsClient.status()).toBe('disconnected')
  })
})

describe('WSClient – connect', () => {
  it('changes status to connecting', () => {
    wsClient.connect('http://test.local', 'my-key')
    expect(wsClient.status()).toBe('connecting')
  })

  it('constructs WebSocket with ws URL and key', () => {
    wsClient.connect('http://test.local', 'my-key')
    expect(MockWebSocket).toHaveBeenCalledWith('ws://test.local/ws?key=my-key')
  })

  it('converts https to wss', () => {
    wsClient.connect('https://secure.host', 'key')
    expect(MockWebSocket).toHaveBeenCalledWith('wss://secure.host/ws?key=key')
  })

  it('strips trailing slash from URL', () => {
    wsClient.connect('http://test.local/', 'key')
    expect(MockWebSocket).toHaveBeenCalledWith('ws://test.local/ws?key=key')
  })

  it('sets status to connected on socket open', () => {
    wsClient.connect('http://test.local', 'key')
    mockSocket.readyState = 1
    mockSocket.onopen!()
    expect(wsClient.status()).toBe('connected')
  })

  it('resets reconnect attempt on open', () => {
    wsClient.connect('http://test.local', 'key')
    mockSocket.onopen!()
    // Should have notified status listeners
    expect(wsClient.status()).toBe('connected')
  })
})

describe('WSClient – message handling', () => {
  it('dispatches message to registered handler', () => {
    const handler = jest.fn()
    const unsub = wsClient.on('session_update', handler)

    wsClient.connect('http://test.local', 'key')
    mockSocket.onopen!()
    mockSocket.onmessage!({ data: JSON.stringify({ type: 'session_update', session: { id: '1' } }) })

    expect(handler).toHaveBeenCalledWith({ type: 'session_update', session: { id: '1' } })
    unsub()
  })

  it('does not dispatch to unsubscribed handler', () => {
    const handler = jest.fn()
    const unsub = wsClient.on('session_update', handler)
    unsub()

    wsClient.connect('http://test.local', 'key')
    mockSocket.onopen!()
    mockSocket.onmessage!({ data: JSON.stringify({ type: 'session_update', session: { id: '1' } }) })

    expect(handler).not.toHaveBeenCalled()
  })

  it('dispatches to wildcard (*) handlers', () => {
    const handler = jest.fn()
    const unsub = wsClient.on('*', handler)

    wsClient.connect('http://test.local', 'key')
    mockSocket.onopen!()
    mockSocket.onmessage!({ data: JSON.stringify({ type: 'terminal_output', sessionId: 's1', data: 'line' }) })

    expect(handler).toHaveBeenCalled()
    unsub()
  })

  it('dispatches cache_alert to registered handler', () => {
    const handler = jest.fn()
    const unsub = wsClient.on('cache_alert', handler)

    wsClient.connect('http://test.local', 'key')
    mockSocket.onopen!()
    const msg = {
      type: 'cache_alert',
      fingerprint: 'fp1',
      severity: 'high',
      missingCount: 3,
      totalRows: 10,
      detectedAt: '2026-07-18T00:00:00.000Z',
      sample: [{ id: 'a', title: 'Session A' }],
    }
    mockSocket.onmessage!({ data: JSON.stringify(msg) })

    expect(handler).toHaveBeenCalledWith(msg)
    unsub()
  })

  it('dispatches cache_alert_resolved to registered handler', () => {
    const handler = jest.fn()
    const unsub = wsClient.on('cache_alert_resolved', handler)

    wsClient.connect('http://test.local', 'key')
    mockSocket.onopen!()
    const msg = { type: 'cache_alert_resolved', fingerprint: 'fp1', action: 'ignore' }
    mockSocket.onmessage!({ data: JSON.stringify(msg) })

    expect(handler).toHaveBeenCalledWith(msg)
    unsub()
  })

  it('silently ignores invalid JSON', () => {
    const handler = jest.fn()
    const unsub = wsClient.on('session_update', handler)

    wsClient.connect('http://test.local', 'key')
    mockSocket.onopen!()
    expect(() => {
      mockSocket.onmessage!({ data: 'not-json{{' })
    }).not.toThrow()
    expect(handler).not.toHaveBeenCalled()
    unsub()
  })
})

describe('WSClient – status listeners', () => {
  it('notifies status listeners when status changes', () => {
    const listener = jest.fn()
    const unsub = wsClient.onStatusChange(listener)

    wsClient.connect('http://test.local', 'key')
    expect(listener).toHaveBeenCalledWith('connecting')

    mockSocket.onopen!()
    expect(listener).toHaveBeenCalledWith('connected')

    unsub()
  })

  it('unsubscribes status listener correctly', () => {
    const listener = jest.fn()
    const unsub = wsClient.onStatusChange(listener)
    unsub()

    wsClient.connect('http://test.local', 'key')
    expect(listener).not.toHaveBeenCalled()
  })
})

describe('WSClient – disconnect', () => {
  it('sets status to disconnected', () => {
    wsClient.connect('http://test.local', 'key')
    mockSocket.onopen!()
    wsClient.disconnect()
    expect(wsClient.status()).toBe('disconnected')
  })

  it('does not throw when not connected', () => {
    expect(() => wsClient.disconnect()).not.toThrow()
  })
})

describe('WSClient – send', () => {
  it('sends JSON when socket is open', () => {
    wsClient.connect('http://test.local', 'key')
    mockSocket.readyState = 1
    mockSocket.onopen!()
    wsClient.send({ type: 'ping' })
    expect(mockSocket.send).toHaveBeenCalledWith(JSON.stringify({ type: 'ping' }))
  })

  it('does not throw when socket is not open', () => {
    expect(() => wsClient.send({ type: 'ping' })).not.toThrow()
  })
})

describe('WSClient – connect-attempt timeout', () => {
  it('abandons a connect attempt that never opens and schedules a retry', () => {
    wsClient.connect('http://test.local', 'key')
    expect(MockWebSocket).toHaveBeenCalledTimes(1)
    const hungSocket = mockSocket

    // Neither onopen nor onerror/onclose ever fires (black-holed handshake).
    // The client must not sit in 'connecting' forever — after the connect
    // timeout it should abandon the socket and retry via backoff.
    jest.advanceTimersByTime(15_000)
    expect(hungSocket.close).toHaveBeenCalled()

    // Backoff retry produces a fresh connect attempt.
    jest.advanceTimersByTime(1_000)
    expect(MockWebSocket).toHaveBeenCalledTimes(2)
  })

  it('does not abandon a socket that opened in time', () => {
    wsClient.connect('http://test.local', 'key')
    mockSocket.readyState = 1
    mockSocket.onopen!()

    jest.advanceTimersByTime(60_000)
    expect(mockSocket.close).not.toHaveBeenCalled()
    expect(MockWebSocket).toHaveBeenCalledTimes(1)
    expect(wsClient.status()).toBe('connected')
  })
})

describe('WSClient – forceReconnect', () => {
  it('opens a new socket immediately, bypassing backoff', () => {
    wsClient.connect('http://test.local', 'key')
    expect(MockWebSocket).toHaveBeenCalledTimes(1)
    const firstSocket = mockSocket

    wsClient.forceReconnect()

    // A second WebSocket instance was constructed right away, not after a delay.
    expect(MockWebSocket).toHaveBeenCalledTimes(2)
    expect(mockSocket).not.toBe(firstSocket)
    // The first socket was explicitly closed during the reconnect.
    expect(firstSocket.close).toHaveBeenCalled()
  })

  it('does not throw when called with no prior connect', () => {
    // The shared `wsClient` singleton retains `this.url` across the test's
    // beforeEach `disconnect()`, so we cannot directly exercise the "no url"
    // branch here. The manager-level wrapper covers that case via the
    // missing-client check; this asserts the call itself is safe.
    expect(() => wsClient.forceReconnect()).not.toThrow()
  })

  it('does not deliver messages arriving late on the old socket after reconnect', () => {
    const handler = jest.fn()
    const unsub = wsClient.on('session_update', handler)

    wsClient.connect('http://test.local', 'key')
    mockSocket.readyState = 1
    mockSocket.onopen!()
    const staleSocket = mockSocket
    // Capture the callback the way a real WebSocket implementation would:
    // the underlying platform holds its own reference to the listener and
    // can still invoke it even after `.onmessage = null` is set — closing a
    // socket does not synchronously guarantee in-flight events are dropped.
    const staleOnMessage = staleSocket.onmessage!

    wsClient.forceReconnect()
    expect(mockSocket).not.toBe(staleSocket)

    // A message already in flight before forceReconnect() (e.g. buffered
    // while the app was suspended) can still land on the stale socket's
    // original callback. It must not reach handlers.
    staleOnMessage({
      data: JSON.stringify({ type: 'session_update', session: { id: 'stale' } }),
    })

    expect(handler).not.toHaveBeenCalled()
    unsub()
  })

  it('clears any pending reconnect timer', () => {
    wsClient.connect('http://test.local', 'key')
    // Trigger an error to schedule a backoff reconnect.
    mockSocket.onerror!()
    expect(MockWebSocket).toHaveBeenCalledTimes(1)

    wsClient.forceReconnect()
    // The forced reconnect happened immediately.
    expect(MockWebSocket).toHaveBeenCalledTimes(2)

    // The 1s backoff scheduled by the error must not produce another connect —
    // forceReconnect should have cancelled the scheduled timer. (Stay under the
    // 15s connect-attempt timeout: the mock socket never opens, so advancing
    // past it would legitimately trigger an abandon-and-retry.)
    jest.advanceTimersByTime(14_000)
    expect(MockWebSocket).toHaveBeenCalledTimes(2)
  })
})
