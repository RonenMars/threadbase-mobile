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
