/**
 * A permanent `/open` refusal stays permanent, and a later `429` cannot undo it.
 *
 * D2 row 8 reproduced the storm on demand: revoke a paired device while the app
 * is open and it retries forever — 10 x 403 then 60 x 429 in under two minutes,
 * still climbing. The mechanism is laundering, not a mis-classification:
 * `403 E2EE_DEVICE_REVOKED` is correctly non-retryable, but the retries charge
 * the streamer's per-source failure budget, the server switches to `429`, and
 * `mapOpenFailure` correctly calls a `429` transient. A permanent condition has
 * become a retryable one, and the on-screen diagnosis degrades with it — the
 * true "This device is not paired for encryption" is replaced by the false
 * "The server is busy; retrying shortly".
 *
 * `mapOpenFailure` is right in itself and is not changed here. What was wrong is
 * that a transient answer was allowed to overwrite a verdict already reached.
 *
 * `openContext` is the one place both channels funnel through — websockets via
 * `openContextOnce` (`ws-client.ts:200`), REST via `rest-session`'s opener — so
 * guarding it closes every candidate retry layer at once, whichever one turns
 * out to be issuing the requests. That is why this fix does not depend on
 * naming that layer.
 *
 * Evidence: `tracks/D/evidence/d2-row8-revocation-and-the-429-laundering.md`.
 */
import { createOpenInitiator } from '@/services/e2ee/pair-handshake'
import {
  OpenError,
  clearOpenRefusal,
  openContext,
  _openRefusalCount,
  _resetOpenRefusalsForTests,
} from '@/services/e2ee/context'
import vectors from '../fixtures/e2ee-record-vectors.json'

jest.mock('@/services/e2ee/pair-handshake', () => {
  const actual = jest.requireActual(
    '@/services/e2ee/pair-handshake',
  ) as typeof import('@/services/e2ee/pair-handshake')
  return { ...actual, createOpenInitiator: jest.fn() }
})

const mockedOpen = createOpenInitiator as jest.MockedFunction<typeof createOpenInitiator>
const b64 = (s: string): Uint8Array => Uint8Array.from(Buffer.from(s, 'base64'))

/** The two messages row 8 watched swap places on screen. */
const REVOKED_TEXT = 'This device is not paired for encryption'
const BUSY_TEXT = 'The server is busy; retrying shortly'

const PIN = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
const OTHER_PIN = 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB'

/**
 * The keystore/Noise boundary, mocked following the precedent at
 * `e2ee-rest-context-channels.test.ts:16`. This is NOT the transition under
 * test: every refusal below is produced by the real `mapOpenFailure`, carried by
 * the real `OpenError`, through the real `openContext` control flow. On a
 * refusal the handshake is never read at all — `openContext` throws on
 * `!response.ok` long before `readMessage2`.
 */
function pairedDevice() {
  mockedOpen.mockResolvedValue({
    ok: true,
    handshake: {
      writeMessage1: () => new Uint8Array(48),
      readMessage2: () => ({
        payload: new TextEncoder().encode(
          JSON.stringify({
            v: 1,
            ctxId: vectors.ctxIdBase64Url,
            expiresAt: Date.now() + 86_400_000,
          }),
        ),
        clientToServerKey: b64(vectors.clientToServerKey),
        serverToClientKey: b64(vectors.serverToClientKey),
        handshakeHash: new Uint8Array(32),
      }),
    },
  } as Awaited<ReturnType<typeof createOpenInitiator>>)
}

type Refusal = { status: number; code: string }

/** A refusing streamer. Every call is counted, so "did it reach the server" is observable. */
function refusingServer(answer: (call: number) => Refusal) {
  let calls = 0
  const fetchImpl = jest.fn(async () => {
    const { status, code } = answer(++calls)
    return { ok: false, status, json: async () => ({ code }) }
  })
  return { fetchImpl: fetchImpl as unknown as typeof fetch, calls: () => calls }
}

/** The streamer answering a healthy handshake. */
function healthyServer() {
  let calls = 0
  const fetchImpl = jest.fn(async () => {
    calls++
    return { ok: true, json: async () => ({ e2ee: { v: 1, noise: 'YQ==' } }) }
  })
  return { fetchImpl: fetchImpl as unknown as typeof fetch, calls: () => calls }
}

/**
 * Row 8's server: revoked for the first `revokedCount` calls, then the failure
 * budget is spent and everything after is a `429`.
 */
const row8Server = (revokedCount: number) =>
  refusingServer((call) =>
    call <= revokedCount
      ? { status: 403, code: 'E2EE_DEVICE_REVOKED' }
      : { status: 429, code: 'E2EE_TRANSIENT' },
  )

/** Stands in for whichever layer above the transport re-issues the request. */
async function attempt(serverId: string, fetchImpl: typeof fetch, serverPublicKey = PIN) {
  return openContext({ serverId, baseUrl: 'https://box.example.com', serverPublicKey, kind: 'rest', fetchImpl })
}

async function attemptError(serverId: string, fetchImpl: typeof fetch, serverPublicKey = PIN) {
  try {
    await attempt(serverId, fetchImpl, serverPublicKey)
    throw new Error('expected the open to be refused')
  } catch (error) {
    return error as OpenError
  }
}

const ATTEMPTS = 12

beforeEach(() => {
  jest.clearAllMocks()
  _resetOpenRefusalsForTests()
  pairedDevice()
})

afterEach(() => {
  _resetOpenRefusalsForTests()
})

describe('the storm, as row 8 observed it', () => {
  /**
   * The negative control, and the one that makes every assertion below mean
   * something. Same fake streamer and same caller loop as the guarded test — the
   * single variable is that each attempt carries a fresh `serverId`, so no
   * verdict can ever apply to the next one. This is what the client did before
   * the fix, and it is how the harness proves it can see a call it does not
   * suppress: if it could not, the guarded test's `1` would be meaningless.
   */
  it('unguarded, every attempt reaches the server and a permanent refusal becomes a busy message', async () => {
    const server = row8Server(10)
    const seen: string[] = []

    for (let i = 0; i < ATTEMPTS; i++) {
      const error = await attemptError(`unguarded-server-${i}`, server.fetchImpl)
      seen.push(error.message)
    }

    // The storm: nothing stopped, and every single attempt cost the streamer a request.
    expect(server.calls()).toBe(ATTEMPTS)

    // The laundering: the first ten refusals are permanent and say so; from the
    // eleventh the rate limiter's own answer is read as a temporary condition.
    expect(seen.slice(0, 10)).toEqual(Array(10).fill(REVOKED_TEXT))
    expect(seen.slice(10)).toEqual(Array(ATTEMPTS - 10).fill(BUSY_TEXT))
  })

  it('unguarded, the classification itself flips from permanent to retryable', async () => {
    const server = row8Server(1)

    const permanent = await attemptError('flip-a', server.fetchImpl)
    const laundered = await attemptError('flip-b', server.fetchImpl)

    expect(permanent.code).toBe('E2EE_DEVICE_REVOKED')
    expect(permanent.retryable).toBe(false)
    // This is the step that makes the loop infinite: the client now believes a
    // permanent condition is temporary.
    expect(laundered.code).toBe('E2EE_TRANSIENT')
    expect(laundered.retryable).toBe(true)
  })
})

describe('a permanent refusal is remembered per server', () => {
  it('stops the storm at one request, however many times the layer above asks', async () => {
    const server = row8Server(10)
    const seen: string[] = []

    for (let i = 0; i < ATTEMPTS; i++) {
      const error = await attemptError('revoked-server', server.fetchImpl)
      seen.push(error.message)
    }

    expect(server.calls()).toBe(1)
    expect(seen).toEqual(Array(ATTEMPTS).fill(REVOKED_TEXT))
  })

  it('keeps answering with the true diagnosis, never the busy message', async () => {
    const server = row8Server(10)

    await attemptError('revoked-server', server.fetchImpl)
    const later = await attemptError('revoked-server', server.fetchImpl)

    expect(later.code).toBe('E2EE_DEVICE_REVOKED')
    expect(later.retryable).toBe(false)
    expect(later.message).toBe(REVOKED_TEXT)
    expect(later.message).not.toBe(BUSY_TEXT)
  })

  it('covers both channels — a websocket refusal blocks the REST open too', async () => {
    const server = row8Server(10)

    await expect(
      openContext({
        serverId: 'revoked-server',
        baseUrl: 'https://box.example.com',
        serverPublicKey: PIN,
        kind: 'ws',
        fetchImpl: server.fetchImpl,
      }),
    ).rejects.toThrow(REVOKED_TEXT)

    const viaRest = await attemptError('revoked-server', server.fetchImpl)

    expect(server.calls()).toBe(1)
    expect(viaRest.message).toBe(REVOKED_TEXT)
  })

  it('remembers each server separately', async () => {
    const server = row8Server(10)

    await attemptError('revoked-a', server.fetchImpl)
    await attemptError('revoked-a', server.fetchImpl)
    await attemptError('revoked-b', server.fetchImpl)

    expect(server.calls()).toBe(2)
    expect(_openRefusalCount()).toBe(2)
  })

  it('every non-retryable code is remembered, not just revocation', async () => {
    // The field storm was a handshake failure, not a revocation: a device pinned
    // to a server identity that is no longer the one answering.
    const handshakeFailed = refusingServer(() => ({ status: 400, code: 'E2EE_HANDSHAKE_FAILED' }))

    for (let i = 0; i < ATTEMPTS; i++) await attemptError('mispinned-server', handshakeFailed.fetchImpl)

    expect(handshakeFailed.calls()).toBe(1)
  })
})

describe('a 429 is the limiter reacting to our own retries, not new information', () => {
  /**
   * The race the device actually runs: the websocket and the REST session open
   * independently. Here the REST open is already in flight when the websocket
   * open is refused, so its `429` lands *after* the verdict exists. It must not
   * clear it — that is exactly the laundering, in miniature.
   */
  it('a 429 arriving after the verdict cannot reset it', async () => {
    let releaseRest: () => void = () => {}
    const restReachedServer = new Promise<void>((resolve) => {
      releaseRest = resolve
    })

    let calls = 0
    const fetchImpl = jest.fn(async () => {
      calls++
      if (calls === 1) {
        await restReachedServer
        return { ok: false, status: 429, json: async () => ({ code: 'E2EE_TRANSIENT' }) }
      }
      return { ok: false, status: 403, json: async () => ({ code: 'E2EE_DEVICE_REVOKED' }) }
    }) as unknown as typeof fetch
    const requestsMade = () => calls

    // REST goes first and hangs at the server.
    const rest = attemptError('raced-server', fetchImpl)
    // The websocket open is refused meanwhile and records the verdict.
    const ws = await attemptError('raced-server', fetchImpl)
    expect(ws.code).toBe('E2EE_DEVICE_REVOKED')

    // Now the in-flight REST request comes back 429.
    releaseRest()
    const laundered = await rest
    expect(laundered.code).toBe('E2EE_TRANSIENT')
    expect(requestsMade()).toBe(2)

    // The verdict survives it. Asserted on requests reaching the server, not on
    // the code that comes back: a server still answering 403 would return the
    // same code either way, so only the request count can tell a surviving
    // verdict apart from one that was cleared and immediately re-earned — and
    // the request is the thing that fed the storm.
    const after = await attemptError('raced-server', fetchImpl)
    expect(requestsMade()).toBe(2)
    expect(after.code).toBe('E2EE_DEVICE_REVOKED')
    expect(after.message).toBe(REVOKED_TEXT)
    expect(_openRefusalCount()).toBe(1)
  })
})

describe('genuinely retryable refusals still retry', () => {
  /**
   * The positive control. A fix that stopped all retrying would be a regression,
   * not a fix, and would pass every assertion above.
   */
  it('a 429 on its own never records a verdict — every attempt reaches the server', async () => {
    const busy = refusingServer(() => ({ status: 429, code: 'E2EE_TRANSIENT' }))

    for (let i = 0; i < ATTEMPTS; i++) {
      const error = await attemptError('busy-server', busy.fetchImpl)
      expect(error.retryable).toBe(true)
    }

    expect(busy.calls()).toBe(ATTEMPTS)
    expect(_openRefusalCount()).toBe(0)
  })

  it('a 5xx keeps retrying — a server having a bad moment is not a verdict', async () => {
    const broken = refusingServer(() => ({ status: 503, code: 'STORE_UNAVAILABLE' }))

    for (let i = 0; i < ATTEMPTS; i++) {
      const error = await attemptError('unavailable-server', broken.fetchImpl)
      expect(error.code).toBe('E2EE_TRANSIENT')
    }

    expect(broken.calls()).toBe(ATTEMPTS)
    expect(_openRefusalCount()).toBe(0)
  })

  /**
   * `E2EE_CTX_UNKNOWN` is the other retryable code, and it is deliberately NOT
   * exercised against `/open`: that endpoint never answers it. It belongs to a
   * sealed request whose `ctxId` the server has forgotten, and it is recovered
   * where it is raised — `authed-fetch.ts:383` drops the live REST context and
   * retries once. `mapOpenFailure` has no branch for it, so a `409` here is a
   * handshake failure and is remembered like any other permanent refusal. This
   * pins that reading, so a later edit that quietly makes `/open` retryable on a
   * `409` has to come past a test.
   */
  it('a 409 at /open is a handshake failure, not the recoverable context code', async () => {
    const conflict = refusingServer(() => ({ status: 409, code: 'E2EE_CTX_UNKNOWN' }))

    const error = await attemptError('conflict-server', conflict.fetchImpl)

    expect(error.code).toBe('E2EE_HANDSHAKE_FAILED')
    expect(error.retryable).toBe(false)
    for (let i = 0; i < ATTEMPTS; i++) await attemptError('conflict-server', conflict.fetchImpl)
    expect(conflict.calls()).toBe(1)
  })

  it('an unreachable server keeps retrying — a network blip is not a verdict', async () => {
    const offline = jest.fn(async () => {
      throw new Error('Network request failed')
    }) as unknown as typeof fetch

    for (let i = 0; i < ATTEMPTS; i++) {
      const error = await attemptError('offline-server', offline)
      expect(error.code).toBe('E2EE_TRANSIENT')
    }

    expect(offline).toHaveBeenCalledTimes(ATTEMPTS)
    expect(_openRefusalCount()).toBe(0)
  })
})

describe('the verdict clears on what genuinely changes the condition', () => {
  it('clears on an explicit clear — the re-pair and user-retry path', async () => {
    const server = row8Server(10)

    await attemptError('revoked-server', server.fetchImpl)
    await attemptError('revoked-server', server.fetchImpl)
    expect(server.calls()).toBe(1)

    clearOpenRefusal('revoked-server')

    await attemptError('revoked-server', server.fetchImpl)
    expect(server.calls()).toBe(2)
  })

  it('clears on a pin change — a different server identity is new information', async () => {
    const server = row8Server(10)

    await attemptError('repinned-server', server.fetchImpl)
    await attemptError('repinned-server', server.fetchImpl)
    expect(server.calls()).toBe(1)

    await attemptError('repinned-server', server.fetchImpl, OTHER_PIN)
    expect(server.calls()).toBe(2)
  })

  it('a successful handshake clears a stale verdict', async () => {
    const refused = row8Server(10)
    await attemptError('recovering-server', refused.fetchImpl)
    expect(_openRefusalCount()).toBe(1)

    clearOpenRefusal('recovering-server')
    const healthy = healthyServer()
    const context = await attempt('recovering-server', healthy.fetchImpl)

    expect(_openRefusalCount()).toBe(0)
    context.destroy()
  })

  it('clearing an unknown server is harmless', () => {
    expect(() => clearOpenRefusal('never-seen')).not.toThrow()
    expect(_openRefusalCount()).toBe(0)
  })
})
