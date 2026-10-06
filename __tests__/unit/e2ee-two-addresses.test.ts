/**
 * #734: a server has two addresses — the one the user gave, then the `publicUrl`
 * it advertised. `/open` tries them in order, moves on only when an address
 * never answered, and a permanent refusal is remembered per address, so a proxy
 * in front of `publicUrl` cannot brand the user's own address as revoked.
 *
 * Reserved documentation addresses only (RFC 5737, RFC 2606).
 */
import { createOpenInitiator } from '@/services/e2ee/pair-handshake'
import {
  OpenError,
  clearOpenRefusal,
  openContext,
  openOnFirstReachable,
  _openRefusalCount,
  _resetOpenRefusalsForTests,
  type OpenContextArgs,
  type TransportContext,
} from '@/services/e2ee/context'
import { FIRST_ADDRESS_TIMEOUT_MS, serverAddresses } from '@/services/server-addresses'
import vectors from '../fixtures/e2ee-record-vectors.json'

jest.mock('@/services/e2ee/pair-handshake', () => {
  const actual = jest.requireActual(
    '@/services/e2ee/pair-handshake',
  ) as typeof import('@/services/e2ee/pair-handshake')
  return { ...actual, createOpenInitiator: jest.fn() }
})

const mockedOpen = createOpenInitiator as jest.MockedFunction<typeof createOpenInitiator>
const b64 = (s: string): Uint8Array => Uint8Array.from(Buffer.from(s, 'base64'))

const LAN = 'https://192.0.2.10:8766'
const PUBLIC = 'https://tb.example.com'
const PIN = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
const RELAY = 'https://relay.example.com/r/abcdefghijklmnopqrstuvwxyz012345'

beforeEach(() => {
  _resetOpenRefusalsForTests()
  mockedOpen.mockResolvedValue({
    ok: true,
    handshake: {
      writeMessage1: async () => new Uint8Array(48),
      readMessage2: async () => ({
        payload: new TextEncoder().encode(
          JSON.stringify({ v: 1, ctxId: vectors.ctxIdBase64Url, expiresAt: Date.now() + 86_400_000 }),
        ),
        clientToServerKey: b64(vectors.clientToServerKey),
        serverToClientKey: b64(vectors.serverToClientKey),
        handshakeHash: new Uint8Array(32),
      }),
    },
  } as Awaited<ReturnType<typeof createOpenInitiator>>)
})

/** A streamer whose answer depends on the address dialled; every call is recorded. */
function byAddress(answers: Record<string, () => Promise<Response>>) {
  const calls: string[] = []
  const fetchImpl = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>(async (input) => {
    const url = String(input)
    calls.push(url)
    const origin = Object.keys(answers).find((a) => url.startsWith(a))
    if (!origin) throw new TypeError('Network request failed')
    return answers[origin]()
  })
  return { fetchImpl, calls }
}

const healthy = async () =>
  new Response(JSON.stringify({ e2ee: { v: 1, noise: 'YQ==' } }), { status: 200 })
const accessGate = async () => new Response('<html>Sign in</html>', { status: 403 })

const open = (baseUrl: string, fetchImpl: typeof fetch) =>
  openContext({ serverId: 'studio', baseUrl, serverPublicKey: PIN, kind: 'rest', fetchImpl })

async function errorOf(p: Promise<TransportContext>): Promise<OpenError> {
  try {
    await p
  } catch (error) {
    if (error instanceof OpenError) return error
    throw error
  }
  throw new Error('expected an OpenError')
}

describe('serverAddresses', () => {
  const pinned = { serverPublicKey: PIN, requireEncryption: true }

  it('puts the user address first and publicUrl second', () => {
    expect(serverAddresses({ url: `${LAN}/`, publicUrl: `${PUBLIC}/`, ...pinned })).toEqual([LAN, PUBLIC])
  })

  it('drops a publicUrl that is absent, the same address, or refused by the cleartext policy', () => {
    expect(serverAddresses({ url: LAN, ...pinned })).toEqual([LAN])
    expect(serverAddresses({ url: LAN, publicUrl: `${LAN}/`, ...pinned })).toEqual([LAN])
    expect(serverAddresses({ url: LAN, publicUrl: 'http://tb.example.com', ...pinned })).toEqual([LAN])
  })

  it('drops a publicUrl whose scheme is not http(s)', () => {
    expect(serverAddresses({ url: LAN, publicUrl: 'wss://tb.example.com', ...pinned })).toEqual([LAN])
    expect(serverAddresses({ url: LAN, publicUrl: 'ftp://tb.example.com', ...pinned })).toEqual([LAN])
  })

  // TB-M-03: an unpinned server's publicUrl came from an unauthenticated reply.
  it('drops publicUrl unless the server is pinned', () => {
    expect(serverAddresses({ url: LAN, publicUrl: PUBLIC })).toEqual([LAN])
    expect(serverAddresses({ url: LAN, publicUrl: PUBLIC, serverPublicKey: PIN })).toEqual([LAN])
    expect(serverAddresses({ url: LAN, publicUrl: PUBLIC, requireEncryption: true })).toEqual([LAN])
  })

  it('puts the relay route last, with or without a publicUrl', () => {
    expect(serverAddresses({ url: LAN, publicUrl: PUBLIC, relayUrl: `${RELAY}/`, ...pinned })).toEqual([LAN, PUBLIC, RELAY])
    expect(serverAddresses({ url: LAN, relayUrl: RELAY, ...pinned })).toEqual([LAN, RELAY])
  })

  it('drops the relay route when the user turned it off, or the server is not pinned', () => {
    expect(serverAddresses({ url: LAN, publicUrl: PUBLIC, relayUrl: RELAY, relayDisabled: true, ...pinned })).toEqual([LAN, PUBLIC])
    expect(serverAddresses({ url: LAN, relayUrl: RELAY })).toEqual([LAN])
    expect(serverAddresses({ url: LAN, relayUrl: 'http://relay.example.com/r/x', ...pinned })).toEqual([LAN])
  })
})

describe('openOnFirstReachable', () => {
  const base = { serverId: 'studio', serverPublicKey: PIN, kind: 'rest' as const }
  const context = (baseUrl: string) => ({ baseUrl }) as TransportContext

  it('tries the user address first with the short timeout, then publicUrl, one after the other', async () => {
    const events: string[] = []
    const fake = jest.fn(async (args: OpenContextArgs) => {
      events.push(`start ${args.baseUrl} ${args.timeoutMs ?? 'default'}`)
      await Promise.resolve()
      events.push(`end ${args.baseUrl}`)
      if (args.baseUrl === LAN) throw new OpenError('E2EE_TRANSIENT', 'unreachable', true)
      return context(args.baseUrl)
    })

    const result = await openOnFirstReachable(base, [LAN, PUBLIC], fake)

    expect(result.baseUrl).toBe(PUBLIC)
    expect(events).toEqual([
      `start ${LAN} ${FIRST_ADDRESS_TIMEOUT_MS}`,
      `end ${LAN}`,
      `start ${PUBLIC} default`,
      `end ${PUBLIC}`,
    ])
  })

  it.each([
    ['a 429', new OpenError('E2EE_TRANSIENT', 'busy')],
    ['a permanent refusal', new OpenError('E2EE_DEVICE_REVOKED', 'revoked')],
  ])('stays on the user address after %s — the server answered', async (_label, refusal) => {
    const fake = jest.fn(async () => {
      throw refusal
    })

    await expect(openOnFirstReachable(base, [LAN, PUBLIC], fake)).rejects.toBe(refusal)
    expect(fake).toHaveBeenCalledTimes(1)
  })

  it('gives a lone address the default timeout', async () => {
    const fake = jest.fn(async (args: OpenContextArgs) => context(args.baseUrl))
    await openOnFirstReachable(base, [LAN], fake)
    expect(fake.mock.calls[0][0].timeoutMs).toBeUndefined()
  })
})

describe('openContext across two addresses', () => {
  it('marks a failure to reach the address as unreachable, and an answer as not', async () => {
    const down = byAddress({})
    expect((await errorOf(open(LAN, down.fetchImpl))).unreachable).toBe(true)

    const busy = byAddress({ [LAN]: async () => new Response('{"code":"E2EE_TRANSIENT"}', { status: 429 }) })
    const answered = await errorOf(open(LAN, busy.fetchImpl))
    expect(answered.code).toBe('E2EE_TRANSIENT')
    expect(answered.unreachable).toBe(false)
  })

  it('does not let an access-gate refusal on publicUrl stop the user address', async () => {
    const away = byAddress({ [PUBLIC]: accessGate })
    expect((await errorOf(open(PUBLIC, away.fetchImpl))).code).toBe('E2EE_DEVICE_REVOKED')

    const home = byAddress({ [LAN]: healthy })
    const context = await open(LAN, home.fetchImpl)

    expect(context.baseUrl).toBe(LAN)
    expect(home.calls).toEqual([`${LAN}/api/e2ee/open`])
  })

  it('still remembers the refusal for the address that gave it', async () => {
    const away = byAddress({ [PUBLIC]: accessGate })
    await errorOf(open(PUBLIC, away.fetchImpl))
    await errorOf(open(PUBLIC, away.fetchImpl))

    expect(away.calls).toHaveLength(1)
    expect(_openRefusalCount()).toBe(1)
  })

  it('costs a genuine revocation one refused /open per address, then no more', async () => {
    const revoked = byAddress({ [LAN]: accessGate, [PUBLIC]: accessGate })
    for (let i = 0; i < 3; i++) {
      await errorOf(open(LAN, revoked.fetchImpl))
      await errorOf(open(PUBLIC, revoked.fetchImpl))
    }

    expect(revoked.calls).toEqual([`${LAN}/api/e2ee/open`, `${PUBLIC}/api/e2ee/open`])
    expect(_openRefusalCount()).toBe(2)
    clearOpenRefusal('studio')
    expect(_openRefusalCount()).toBe(0)
  })
})

// The relay answers for itself when the streamer's tunnel is down. That is not
// the streamer's verdict on this device, so it must read as "did not answer".
describe('openContext through the relay', () => {
  const relayRefusal = async () =>
    new Response('{"code":"RELAY_STREAMER_OFFLINE"}', { status: 503, headers: { 'X-TB-Relay-Error': '1' } })

  it('treats a relay-written error as unreachable and never remembers it', async () => {
    const offline = byAddress({ [RELAY]: relayRefusal })
    const error = await errorOf(open(RELAY, offline.fetchImpl))

    expect(error.code).toBe('E2EE_TRANSIENT')
    expect(error.unreachable).toBe(true)
    expect(_openRefusalCount()).toBe(0)
  })

  // The positive control: the same status without the relay's header is the
  // streamer speaking, and a 400 from it is still a permanent refusal.
  it('still remembers a refusal the streamer sent through the relay', async () => {
    const refused = byAddress({ [RELAY]: async () => new Response('{}', { status: 400 }) })
    const error = await errorOf(open(RELAY, refused.fetchImpl))

    expect(error.code).toBe('E2EE_HANDSHAKE_FAILED')
    expect(error.unreachable).toBe(false)
    expect(_openRefusalCount()).toBe(1)
  })

  it('a relay 400 on /open is not a permanent refusal either', async () => {
    const unsupported = byAddress({
      [RELAY]: async () =>
        new Response('{"code":"RELAY_UNSUPPORTED_REQUEST"}', { status: 400, headers: { 'X-TB-Relay-Error': '1' } }),
    })
    expect((await errorOf(open(RELAY, unsupported.fetchImpl))).retryable).toBe(true)
    expect(_openRefusalCount()).toBe(0)
  })
})
