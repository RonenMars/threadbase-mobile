/**
 * Slow streamer requests must be attributable from a release build.
 *
 * On 2026-09-12 a session kill sat on "Sending…" for about ten seconds. The
 * streamer's log proves it answered `POST /stop` in 26 ms and that the next
 * request arrived 10.7 s later, so the time went somewhere on the client or the
 * wire — and build 232 kept no record of either, because `clog()` and
 * `installClientLogCapture()` both start with `if (!__DEV__) return`.
 *
 * These tests pin what makes the new record trustworthy: a fast call stays
 * silent, a slow one is recorded once with the fields that attribute it, the
 * handshake is separated from the rest of the time, the upload of a report is
 * itself never reported, each report reaches the server its request addressed,
 * and a sink that refuses a batch drops it instead of pushing the failure back
 * into the app.
 */
import { authedFetch, HEADER_E2EE, HEADER_SEQ } from '@/services/authed-fetch'
import {
  _pendingReportsForTests,
  _resetSlowRequestLogForTests,
  _setSlowRequestLogEnabledForTests,
} from '@/services/slow-request-log'
import { useServersStore } from '@/stores/servers'
import type { ServerConfig } from '@/types/api'
import type { TransportContext } from '@/services/e2ee/context'
import {
  CHANNEL_REST_REQUEST,
  CHANNEL_REST_RESPONSE,
  DIRECTION_CLIENT_TO_SERVER,
  DIRECTION_SERVER_TO_CLIENT,
  createRecordState,
  restTargetHash,
} from '@/services/e2ee/record'
import { _resetRestSessionsForTests, _setRestOpenForTests } from '@/services/e2ee/rest-session'
import vectors from '../fixtures/e2ee-record-vectors.json'

const b64 = (s: string): Uint8Array => Uint8Array.from(Buffer.from(s, 'base64'))
const utf8 = (s: string) => new TextEncoder().encode(s)
const ctxIdRaw = b64(vectors.ctxId)

/**
 * A clock only the mocked `fetch` advances. Wall time is what a report
 * measures, so a test that wants a slow call has to make the call itself take
 * the time — a jest timer would not move `Date.now()` through the await.
 */
let clock = 1_000_000
const takes = (ms: number) => () => {
  clock += ms
}

function server(over: Partial<ServerConfig> = {}): ServerConfig {
  return {
    id: 'srv-1',
    url: 'https://box.example.com',
    apiKey: 'tb_shared',
    isConnected: true,
    serverInfo: null,
    connectionError: null,
    ...over,
  }
}

function pinned(over: Partial<ServerConfig> = {}): ServerConfig {
  return server({
    serverPublicKey: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    requireEncryption: true,
    ...over,
  })
}

function makeRestContext(): TransportContext {
  const send = createRecordState({
    key: b64(vectors.clientToServerKey),
    ctxId: ctxIdRaw,
    direction: DIRECTION_CLIENT_TO_SERVER,
    channel: CHANNEL_REST_REQUEST,
  })
  const recv = createRecordState({
    key: b64(vectors.serverToClientKey),
    ctxId: ctxIdRaw,
    direction: DIRECTION_SERVER_TO_CLIENT,
    channel: CHANNEL_REST_RESPONSE,
  })
  return {
    ctxId: vectors.ctxIdBase64Url,
    kind: 'rest',
    // Past any clock this file uses, so nothing rolls over mid-test.
    expiresAt: Number.MAX_SAFE_INTEGER,
    provisional: false,
    send,
    recv,
    destroy() {
      send.destroy()
      recv.destroy()
    },
  }
}

function sealedReplyTo(headers: Record<string, string>, path: string, method: string) {
  const state = createRecordState({
    key: b64(vectors.serverToClientKey),
    ctxId: ctxIdRaw,
    direction: DIRECTION_SERVER_TO_CLIENT,
    channel: CHANNEL_REST_RESPONSE,
    initialCounter: BigInt(headers[HEADER_SEQ]),
  })
  const frame = state.seal(utf8('{"ok":true}'), restTargetHash(method, path, ''))
  return new Response(frame as unknown as BodyInit, {
    status: 200,
    headers: { [HEADER_E2EE]: '1' },
  })
}

/** The reports uploaded by every `POST /api/__client-log` the mock received. */
function uploadedReports(fn: jest.Mock): Record<string, unknown>[] {
  return fn.mock.calls
    .filter((call) => String(call[0]).endsWith('/api/__client-log'))
    .flatMap((call) => {
      const body = JSON.parse((call[1] as RequestInit).body as string) as {
        entries: { fields: Record<string, unknown> }[]
      }
      return body.entries.map((entry) => entry.fields)
    })
}

function uploadsTo(fn: jest.Mock): string[] {
  return fn.mock.calls.map((call) => String(call[0])).filter((url) => url.endsWith('/api/__client-log'))
}

describe('slow streamer requests', () => {
  beforeEach(() => {
    clock = 1_000_000
    jest.spyOn(Date, 'now').mockImplementation(() => clock)
    jest.useFakeTimers({ doNotFake: ['Date'] })
    _setSlowRequestLogEnabledForTests(true)
    useServersStore.setState({ servers: { 'srv-1': server() } })
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
    _resetSlowRequestLogForTests()
    _resetRestSessionsForTests()
    useServersStore.setState({ servers: {} })
  })

  async function settleFlush() {
    await jest.advanceTimersByTimeAsync(2_000)
  }

  // Durations are literal on purpose. Deriving them from `SLOW_REQUEST_MS`
  // would move the test whenever the threshold moved, which is exactly the
  // change this pair exists to catch.
  it('says nothing about a request that finishes under the threshold', async () => {
    const fn = jest.fn(async () => {
      takes(1_900)()
      return new Response('{}', { status: 200 })
    })
    globalThis.fetch = fn as unknown as typeof fetch

    await authedFetch(server(), '/api/info')
    await settleFlush()

    expect(uploadsTo(fn)).toHaveLength(0)
  })

  it('reports a request that crosses the threshold', async () => {
    const fn = jest.fn(async (url: string) => {
      if (String(url).endsWith('/api/__client-log')) return new Response('{}', { status: 200 })
      takes(2_100)()
      return new Response('{}', { status: 200 })
    })
    globalThis.fetch = fn as unknown as typeof fetch

    await authedFetch(server(), '/api/info')
    await settleFlush()

    expect(uploadedReports(fn)).toHaveLength(1)
  })

  it('reports a slow request once, with the shape that attributes it', async () => {
    const fn = jest.fn(async () => {
      takes(10_700)()
      return new Response('{}', { status: 200 })
    })
    globalThis.fetch = fn as unknown as typeof fetch

    await authedFetch(server(), '/api/sessions/A/stop?token=hunter2', {
      method: 'POST',
      body: '{"sessionId":"A"}',
    })
    await settleFlush()

    expect(uploadedReports(fn)).toEqual([
      {
        method: 'POST',
        path: '/api/sessions/A/stop',
        ms: 10_700,
        outcome: '200',
        sealed: false,
        ctxMs: 0,
      },
    ])
  })

  // A report travels to a server; a query value or a body would travel with it.
  it('carries no query value and no request body', async () => {
    const fn = jest.fn(async () => {
      takes(3_000)()
      return new Response('{}', { status: 200 })
    })
    globalThis.fetch = fn as unknown as typeof fetch

    await authedFetch(server(), '/api/conversations?q=hunter2', {
      method: 'POST',
      body: '{"secret":"swordfish"}',
    })
    await settleFlush()

    const uploaded = JSON.stringify(uploadedReports(fn))
    expect(uploaded).toContain('/api/conversations')
    expect(uploaded).not.toContain('hunter2')
    expect(uploaded).not.toContain('swordfish')
  })

  it('records the error kind when a slow request fails, and still throws', async () => {
    const fn = jest.fn(async () => {
      takes(4_000)()
      throw new TypeError('Network request failed')
    })
    globalThis.fetch = fn as unknown as typeof fetch

    await expect(authedFetch(server(), '/api/info')).rejects.toThrow(TypeError)
    await settleFlush()

    expect(uploadedReports(fn)[0]).toMatchObject({ outcome: 'TypeError' })
  })

  // A refused credential is not a slow network, and a reader has to be able to
  // tell them apart without a status code to go on.
  it('records a refused credential as its error kind, not as a status', async () => {
    const fn = jest.fn(async (url: string) => {
      if (String(url).endsWith('/api/__client-log')) return new Response('{}', { status: 200 })
      takes(4_000)()
      return new Response('{}', { status: 401 })
    })
    globalThis.fetch = fn as unknown as typeof fetch

    await expect(authedFetch(server(), '/api/info')).rejects.toThrow('Unauthorized')
    await settleFlush()

    expect(uploadedReports(fn)[0]).toMatchObject({ outcome: 'AuthError' })
  })

  // Without this the sink's own upload is timed, reported, uploaded, timed…
  it('never reports the client-log upload itself', async () => {
    const fn = jest.fn(async () => {
      takes(30_000)()
      return new Response('{}', { status: 200 })
    })
    globalThis.fetch = fn as unknown as typeof fetch

    await authedFetch(server(), '/api/__client-log', {
      method: 'POST',
      body: '{"entries":[]}',
    })
    await settleFlush()

    expect(uploadsTo(fn)).toHaveLength(1) // the caller's own request, and no report of it
  })

  // A pre-pairing probe builds an ad-hoc `{ url, apiKey }` target that is in no
  // store, so there is no server to route its report to. Two mechanisms produce
  // this outcome — `reportRequestTiming` refuses the report and the flush
  // refuses the unknown server — so the assertion below survives removing
  // either one; what it pins is that such a request is never uploaded anywhere.
  it('drops a report it cannot attribute to a stored server', async () => {
    const fn = jest.fn(async () => {
      takes(9_000)()
      return new Response('{}', { status: 200 })
    })
    globalThis.fetch = fn as unknown as typeof fetch

    await authedFetch({ url: 'https://new.example.com', apiKey: 'tb_typed' }, '/api/profiles')
    await settleFlush()

    expect(uploadsTo(fn)).toHaveLength(0)
  })

  // The report names a route, and a route carries session and conversation ids.
  // `lib/clientLog.ts` uploads to `Object.values(servers)[0]`, which would put
  // machine B's ids in machine A's log the moment a second server is paired.
  it('uploads each report to the server its request addressed', async () => {
    useServersStore.setState({
      servers: {
        'srv-1': server(),
        'srv-2': server({ id: 'srv-2', url: 'https://other.example.com', apiKey: 'tb_other' }),
      },
    })
    const fn = jest.fn(async (url: string) => {
      if (String(url).endsWith('/api/__client-log')) return new Response('{}', { status: 200 })
      takes(8_000)()
      return new Response('{}', { status: 200 })
    })
    globalThis.fetch = fn as unknown as typeof fetch

    await authedFetch(useServersStore.getState().servers['srv-2'], '/api/sessions/B/stop', {
      method: 'POST',
    })
    await settleFlush()

    expect(uploadsTo(fn)).toEqual(['https://other.example.com/api/__client-log'])
    expect(uploadedReports(fn)[0]).toMatchObject({ path: '/api/sessions/B/stop' })
  })

  // The Noise handshake is one of the two suspects for the 2026-09-12 stall.
  // The log has to separate "this request was sealed" from "this request waited
  // on a handshake", or it can neither accuse the handshake nor clear it.
  //
  // Read off the queue rather than the sink: a report about a pinned server is
  // uploaded sealed, and unsealing it here would test the envelope, which
  // `e2ee-rest-envelope.test.ts` already owns.
  it('separates the handshake wait from the rest of a sealed request', async () => {
    const ctx = makeRestContext()
    _setRestOpenForTests(async () => {
      takes(6_000)()
      return ctx
    })
    const fn = jest.fn(async (_url: string, init: RequestInit) => {
      takes(500)()
      return sealedReplyTo(init.headers as Record<string, string>, '/api/info', 'GET')
    })
    globalThis.fetch = fn as unknown as typeof fetch

    await authedFetch(pinned(), '/api/info')
    // Second call: the context is live, so no handshake is paid for. If this one
    // is still slow, the log now says the handshake is not why.
    await authedFetch(pinned(), '/api/info')

    expect(_pendingReportsForTests('srv-1')).toEqual([
      { method: 'GET', path: '/api/info', ms: 6_500, outcome: '200', sealed: true, ctxMs: 6_000 },
    ])
  })
})

describe('the client-log sink', () => {
  beforeEach(() => {
    clock = 1_000_000
    jest.spyOn(Date, 'now').mockImplementation(() => clock)
    jest.useFakeTimers({ doNotFake: ['Date'] })
    _setSlowRequestLogEnabledForTests(true)
    useServersStore.setState({ servers: { 'srv-1': server() } })
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
    _resetSlowRequestLogForTests()
    useServersStore.setState({ servers: {} })
  })

  /** Produces exactly one queued report, with `fetchMock` installed. */
  async function reportOneSlowRequest(fetchMock: jest.Mock) {
    globalThis.fetch = fetchMock as unknown as typeof fetch
    await authedFetch(server(), '/api/info')
    expect(_pendingReportsForTests('srv-1')).toHaveLength(1)
  }

  // The streamer's bounds on this endpoint are its own (a separate PR there).
  // Whatever it answers, the app forgets the batch: a retry loop against a 429
  // is how instrumentation becomes the outage.
  it.each([429, 413])('drops the batch when the sink answers %i, and never retries it', async (status) => {
    await reportOneSlowRequest(
      jest.fn(async (url: string) => {
        if (String(url).endsWith('/api/__client-log')) return new Response('{}', { status })
        takes(9_000)()
        return new Response('{}', { status: 200 })
      }),
    )
    const fn = globalThis.fetch as unknown as jest.Mock

    await jest.advanceTimersByTimeAsync(2_000)
    expect(uploadsTo(fn)).toHaveLength(1)

    await jest.advanceTimersByTimeAsync(60_000)
    expect(uploadsTo(fn)).toHaveLength(1)
    expect(_pendingReportsForTests('srv-1')).toHaveLength(0)
  })

  // A sink that is unreachable must not surface as a failed action in the app,
  // and must not be retried either.
  it('swallows a sink that throws, and keeps the caller that produced the report clean', async () => {
    await reportOneSlowRequest(
      jest.fn(async (url: string) => {
        if (String(url).endsWith('/api/__client-log')) throw new TypeError('Network request failed')
        takes(9_000)()
        return new Response('{"ok":true}', { status: 200 })
      }),
    )
    const fn = globalThis.fetch as unknown as jest.Mock

    await expect(jest.advanceTimersByTimeAsync(2_000)).resolves.toBeUndefined()
    expect(uploadsTo(fn)).toHaveLength(1)

    await jest.advanceTimersByTimeAsync(60_000)
    expect(uploadsTo(fn)).toHaveLength(1)
    expect(_pendingReportsForTests('srv-1')).toHaveLength(0)
  })

  it('drops reports for a server that was removed before the flush', async () => {
    await reportOneSlowRequest(
      jest.fn(async () => {
        takes(9_000)()
        return new Response('{}', { status: 200 })
      }),
    )
    const fn = globalThis.fetch as unknown as jest.Mock

    useServersStore.setState({ servers: {} })
    await jest.advanceTimersByTimeAsync(2_000)

    expect(uploadsTo(fn)).toHaveLength(0)
  })
})
