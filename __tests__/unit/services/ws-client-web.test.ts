// A sealed socket on web: the ticket rides as a subprotocol, and a server that
// opens the socket without selecting `threadbase-e2ee-v1` is a permanent
// failure. Separate from ws-client.test.ts because the ticketed-socket module
// is swapped for its `.web` twin for the whole file (jest resolves native).
import { wsManager } from '@/services/ws-client'
import { openContextOnce } from '@/services/e2ee/context'
import { createRecordState } from '@/services/e2ee/record'

jest.mock('@/services/e2ee/ticketed-socket', () =>
  jest.requireActual('@/services/e2ee/ticketed-socket.web'),
)

jest.mock('@/services/e2ee/context', () => ({
  ...jest.requireActual('@/services/e2ee/context'),
  openContextOnce: jest.fn(),
}))

jest.mock('@/services/device-id', () => ({
  getDeviceClientId: jest.fn().mockResolvedValue('device-client-id'),
}))

const mockedOpenContextOnce = openContextOnce as jest.MockedFunction<typeof openContextOnce>

interface FakeSocket {
  protocol: string
  readyState: number
  binaryType: string
  onopen: (() => void) | null
  onmessage: ((event: { data: ArrayBuffer | Blob }) => void) | null
  onclose: (() => void) | null
  onerror: (() => void) | null
  send: jest.Mock
  close: jest.Mock
}

const sockets: FakeSocket[] = []
const MockWebSocket = Object.assign(
  jest.fn((_url: string, _protocols?: string | string[]) => {
    const socket: FakeSocket = {
      protocol: '',
      readyState: 0,
      // A browser's default.
      binaryType: 'blob',
      onopen: null,
      onmessage: null,
      onclose: null,
      onerror: null,
      send: jest.fn(),
      close: jest.fn(),
    }
    sockets.push(socket)
    return socket
  }),
  { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 },
)

Object.defineProperty(globalThis, 'WebSocket', {
  configurable: true,
  writable: true,
  value: MockWebSocket,
})

const recordKey = new Uint8Array(32).fill(7)
const recordContextId = new Uint8Array(16).fill(8)
const TICKET = 'AAAAAAAAAAAAAAAAAAAAAA'
const pin = { serverPublicKey: 'pinned-server-key', requireEncryption: true }

const pinnedContext = () => ({
  ctxId: 'ctx',
  kind: 'ws' as const,
  baseUrl: 'https://secure.host',
  expiresAt: Date.now() + 30_000,
  provisional: false,
  ticket: TICKET,
  send: createRecordState({ key: recordKey, ctxId: recordContextId, direction: 1, channel: 1 }),
  recv: createRecordState({ key: recordKey, ctxId: recordContextId, direction: 2, channel: 1 }),
  destroy: jest.fn(),
})

const flushAsyncConnect = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

beforeEach(() => {
  wsManager.disconnectAll()
  jest.clearAllMocks()
  sockets.length = 0
  jest.useFakeTimers()
  mockedOpenContextOnce.mockResolvedValue(pinnedContext())
})

afterEach(() => {
  wsManager.disconnectAll()
  jest.useRealTimers()
})

/** Delivers a binary frame the way a browser does: its shape follows `binaryType`. */
function deliverBinary(socket: FakeSocket, bytes: Uint8Array) {
  const data = socket.binaryType === 'arraybuffer' ? Uint8Array.from(bytes).buffer : new Blob([Uint8Array.from(bytes)])
  socket.onmessage?.({ data })
}

const sealFromServer = (message: object) =>
  createRecordState({ key: recordKey, ctxId: recordContextId, direction: 2, channel: 1 }).seal(
    new TextEncoder().encode(JSON.stringify(message)),
  )

const openSealed = async () => {
  wsManager.connect('pinned-server', 'https://secure.host', 'api-key', pin)
  await flushAsyncConnect()
  const socket = sockets[0]
  socket.protocol = 'threadbase-e2ee-v1'
  socket.readyState = 1
  socket.onopen?.()
  return socket
}

describe('WSClient on web — binary frames', () => {
  it('receives a sealed binary frame as an ArrayBuffer and unseals it', async () => {
    const received: string[] = []
    const socket = await openSealed()
    const off = wsManager.getClient('pinned-server')!.on('cache_ready', (msg) => received.push(msg.type))

    deliverBinary(socket, sealFromServer({ type: 'cache_ready' }))

    expect(received).toEqual(['cache_ready'])
    expect(wsManager.status('pinned-server')).toBe('connected')
    off()
  })

  it('still refuses a Blob frame rather than accepting that shape', async () => {
    // Not widened: if a socket ever reached here with the browser default, the
    // frame is refused and the connection closed, never read some other way.
    const socket = await openSealed()
    socket.onmessage?.({ data: new Blob([Uint8Array.from(sealFromServer({ type: 'cache_ready' }))]) })

    expect(socket.close).toHaveBeenCalled()
    expect(wsManager.status('pinned-server')).toBe('disconnected')
  })
})

describe('WSClient on web — sealed sockets', () => {
  it('offers the e2ee protocol then the ticket, with no ?key= and no headers', async () => {
    wsManager.connect('pinned-server', 'https://secure.host', 'long-term-api-key', pin)
    await flushAsyncConnect()

    expect(MockWebSocket).toHaveBeenCalledTimes(1)
    const args = MockWebSocket.mock.calls[0]
    expect(args).toEqual(['wss://secure.host/ws', ['threadbase-e2ee-v1', `tb-ticket.${TICKET}`]])
    expect(args[0]).not.toContain('key=')
    expect(JSON.stringify(args)).not.toContain('long-term-api-key')
  })

  it('connects and registers when the server selected threadbase-e2ee-v1', async () => {
    // The positive control for the mismatch below.
    wsManager.connect('pinned-server', 'https://secure.host', 'api-key', pin)
    await flushAsyncConnect()
    const socket = sockets[0]
    socket.protocol = 'threadbase-e2ee-v1'
    socket.readyState = 1
    socket.onopen?.()

    expect(wsManager.status('pinned-server')).toBe('connected')
    expect(wsManager.lastError('pinned-server')).toBeNull()
    expect(socket.send).toHaveBeenCalledTimes(1)
  })

  it.each(['', 'tb-ticket.AAAAAAAAAAAAAAAAAAAAAA', 'something-else'])(
    'fails permanently when the server selected %j instead',
    async (selected) => {
      wsManager.connect('pinned-server', 'https://secure.host', 'api-key', pin)
      await flushAsyncConnect()
      const socket = sockets[0]
      socket.protocol = selected
      socket.readyState = 1
      socket.onopen?.()

      expect(wsManager.status('pinned-server')).toBe('disconnected')
      expect(wsManager.lastError('pinned-server')).toBe('e2ee_protocol_mismatch')
      // Nothing — not even `register` — goes out on a socket that skipped the ticket path.
      expect(socket.send).not.toHaveBeenCalled()
      expect(socket.close).toHaveBeenCalled()

      // Non-retryable: no ticket retry, no backoff redial, no plaintext socket.
      jest.advanceTimersByTime(120_000)
      await flushAsyncConnect()
      expect(mockedOpenContextOnce).toHaveBeenCalledTimes(1)
      expect(MockWebSocket).toHaveBeenCalledTimes(1)
    },
  )
})
