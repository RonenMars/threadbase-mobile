/**
 * XC2 REST envelope: sealing lives in authedFetch. Unpinned servers stay on
 * the Authorization path; a pinned server sends no bearer and unseals before
 * any application status is interpreted.
 */
import {
  authedFetch,
  AuthError,
  EnvelopeError,
  HEADER_CTX,
  HEADER_E2EE,
  HEADER_ENV,
  HEADER_SEQ,
} from '@/services/authed-fetch'
import {
  CHANNEL_REST_REQUEST,
  CHANNEL_REST_RESPONSE,
  DIRECTION_CLIENT_TO_SERVER,
  DIRECTION_SERVER_TO_CLIENT,
  HEADER_BYTES,
  createRecordState,
  recordCounter,
  restTargetHash,
} from '@/services/e2ee/record'
import type { TransportContext } from '@/services/e2ee/context'
import {
  _resetRestSessionsForTests,
  _restLiveCount,
  _setRestOpenForTests,
} from '@/services/e2ee/rest-session'
import * as SecureStore from '@/services/secure-store'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { hash as sha256 } from '@stablelib/sha256'
import vectors from '../fixtures/e2ee-record-vectors.json'

const b64 = (s: string): Uint8Array => Uint8Array.from(Buffer.from(s, 'base64'))
const utf8 = (s: string) => new TextEncoder().encode(s)
const ctxIdRaw = b64(vectors.ctxId)

function makeRestContext(expiresAt = Date.now() + 86_400_000): TransportContext {
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
    expiresAt,
    provisional: false,
    send,
    recv,
    destroy() {
      send.destroy()
      recv.destroy()
    },
  }
}

function pinnedTarget() {
  return {
    id: 'srv-1',
    url: 'https://box.example.com',
    apiKey: 'tb_shared',
    serverPublicKey: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    requireEncryption: true as const,
  }
}

function hasHeader(headers: Record<string, string>, name: string): boolean {
  const want = name.toLowerCase()
  return Object.keys(headers).some((key) => key.toLowerCase() === want)
}

function asBody(frame: Uint8Array): BodyInit {
  return frame as unknown as BodyInit
}

function decodeEnv(value: string): Uint8Array {
  const standard = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = standard + '='.repeat((4 - (standard.length % 4)) % 4)
  return Uint8Array.from(Buffer.from(padded, 'base64'))
}

function encodeEnv(frame: Uint8Array): string {
  return Buffer.from(frame)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function sealServerResponse(
  seq: bigint,
  path: string,
  method: string,
  plaintext: string,
  targetHash?: Uint8Array,
): Uint8Array {
  const q = path.indexOf('?')
  const pathname = q === -1 ? path : path.slice(0, q)
  const query = q === -1 ? '' : path.slice(q + 1)
  const target = targetHash ?? restTargetHash(method, pathname, query)
  const server = createRecordState({
    key: b64(vectors.serverToClientKey),
    ctxId: ctxIdRaw,
    direction: DIRECTION_SERVER_TO_CLIENT,
    channel: CHANNEL_REST_RESPONSE,
    initialCounter: seq,
  })
  return server.seal(utf8(plaintext), target)
}

describe('authedFetch REST envelope', () => {
  afterEach(() => {
    jest.restoreAllMocks()
    _resetRestSessionsForTests()
  })

  it('an unpinned server still sends Authorization and is byte-identical to today', async () => {
    const fn = jest.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    globalThis.fetch = fn as unknown as typeof fetch
    await authedFetch({ url: 'https://box.example.com', apiKey: 'tb_shared' }, '/api/info')
    expect(fn.mock.calls[0][1].headers.Authorization).toBe('Bearer tb_shared')
    expect(fn.mock.calls[0][1].headers[HEADER_E2EE]).toBeUndefined()
  })

  it('a pinned GET carries the record in X-TB-Env, never a body, and never Authorization', async () => {
    const ctx = makeRestContext()
    _setRestOpenForTests(async () => ctx)
    const fn = jest.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      const headers = init.headers as Record<string, string>
      const seq = BigInt(headers[HEADER_SEQ])
      const frame = sealServerResponse(seq, '/api/info', 'GET', '{"ok":true}')
      return new Response(asBody(frame), {
        status: 200,
        headers: { [HEADER_E2EE]: '1', 'Content-Type': 'application/octet-stream' },
      })
    })
    globalThis.fetch = fn as unknown as typeof fetch

    const response = await authedFetch(pinnedTarget(), '/api/info')
    const headers = fn.mock.calls[0][1].headers as Record<string, string>
    expect(headers.Authorization).toBeUndefined()
    expect(headers[HEADER_E2EE]).toBe('1')
    expect(headers[HEADER_CTX]).toBe(vectors.ctxIdBase64Url)
    expect(headers[HEADER_ENV]).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(fn.mock.calls[0][1].body).toBeUndefined()
    expect(Boolean(headers[HEADER_ENV]) && fn.mock.calls[0][1].body != null).toBe(false)
    expect(decodeEnv(headers[HEADER_ENV])[HEADER_BYTES - 1]).toBe(CHANNEL_REST_REQUEST)
    expect(await response.json()).toEqual({ ok: true })
  })

  it('a pinned POST puts the record in the body and never sets X-TB-Env', async () => {
    const ctx = makeRestContext()
    _setRestOpenForTests(async () => ctx)
    const fn = jest.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      const headers = init.headers as Record<string, string>
      expect(headers[HEADER_ENV]).toBeUndefined()
      expect(init.body).toBeInstanceOf(Uint8Array)
      const seq = recordCounter(init.body as Uint8Array)
      const frame = sealServerResponse(seq, '/api/sessions/A/input', 'POST', '{"ok":true}')
      return new Response(asBody(frame), {
        status: 200,
        headers: { [HEADER_E2EE]: '1', 'Content-Type': 'application/octet-stream' },
      })
    })
    globalThis.fetch = fn as unknown as typeof fetch
    const response = await authedFetch(pinnedTarget(), '/api/sessions/A/input', {
      method: 'POST',
      body: '{"text":"hi"}',
    })
    expect(await response.json()).toEqual({ ok: true })
  })

  it('two pinned callers share one REST context / one send counter', async () => {
    const ctx = makeRestContext()
    let opens = 0
    _setRestOpenForTests(async () => {
      opens += 1
      return ctx
    })
    const fn = jest.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      const headers = init.headers as Record<string, string>
      const seq = BigInt(headers[HEADER_SEQ])
      const frame = sealServerResponse(seq, '/api/info', 'GET', '{}')
      return new Response(asBody(frame), { status: 200, headers: { [HEADER_E2EE]: '1' } })
    })
    globalThis.fetch = fn as unknown as typeof fetch
    await authedFetch(pinnedTarget(), '/api/info')
    await authedFetch(pinnedTarget(), '/api/info')
    expect(opens).toBe(1)
    expect(_restLiveCount()).toBe(1)
    const seqs = fn.mock.calls.map((c) => (c[1].headers as Record<string, string>)[HEADER_SEQ])
    expect(seqs).toEqual(['0', '1'])
  })

  it('a plaintext 409 E2EE_CTX_UNKNOWN reopens once and retries with a new counter', async () => {
    const first = makeRestContext()
    const second = makeRestContext()
    const sealFirst = jest.spyOn(first.send, 'seal')
    const sealSecond = jest.spyOn(second.send, 'seal')
    const contexts = [first, second]
    _setRestOpenForTests(async () => {
      const next = contexts.shift()
      if (!next) throw new Error('unexpected extra open')
      return next
    })
    const fn = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'unknown', code: 'E2EE_CTX_UNKNOWN' }), { status: 409 }),
      )
      .mockImplementationOnce(async (_url: string, init: RequestInit) => {
        const headers = init.headers as Record<string, string>
        const seq = BigInt(headers[HEADER_SEQ])
        const frame = sealServerResponse(seq, '/api/info', 'GET', '{"recovered":true}')
        return new Response(asBody(frame), { status: 200, headers: { [HEADER_E2EE]: '1' } })
      })
    globalThis.fetch = fn as unknown as typeof fetch
    const response = await authedFetch(pinnedTarget(), '/api/info')
    expect(fn).toHaveBeenCalledTimes(2)
    expect(sealFirst).toHaveBeenCalledTimes(1)
    expect(sealSecond).toHaveBeenCalledTimes(1)
    expect(await response.json()).toEqual({ recovered: true })
  })

  it('the 2s HTTP replay fallback path — GET /output — is sealed on a pinned server', async () => {
    const ctx = makeRestContext()
    _setRestOpenForTests(async () => ctx)
    const fn = jest.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      const headers = init.headers as Record<string, string>
      const seq = BigInt(headers[HEADER_SEQ])
      const frame = sealServerResponse(seq, '/api/sessions/sess-1/output', 'GET', '{"output":"ok"}')
      return new Response(asBody(frame), { status: 200, headers: { [HEADER_E2EE]: '1' } })
    })
    globalThis.fetch = fn as unknown as typeof fetch
    const response = await authedFetch(pinnedTarget(), '/api/sessions/sess-1/output')
    const headers = fn.mock.calls[0][1].headers as Record<string, string>
    expect(headers.Authorization).toBeUndefined()
    expect(headers[HEADER_ENV]).toBeTruthy()
    expect(await response.json()).toEqual({ output: 'ok' })
  })

  it('drops a caller Authorization header on a sealed request, in any casing', async () => {
    const ctx = makeRestContext()
    _setRestOpenForTests(async () => ctx)
    const fn = jest.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      const headers = init.headers as Record<string, string>
      expect(hasHeader(headers, 'Authorization')).toBe(false)
      const seq = BigInt(headers[HEADER_SEQ])
      const frame = sealServerResponse(seq, '/api/info', 'GET', '{}')
      return new Response(asBody(frame), { status: 200, headers: { [HEADER_E2EE]: '1' } })
    })
    globalThis.fetch = fn as unknown as typeof fetch
    await authedFetch(pinnedTarget(), '/api/info', {
      headers: {
        Authorization: 'Bearer leaked',
        authorization: 'Bearer leaked2',
        AUTHORIZATION: 'Bearer leaked3',
      },
    })
  })

  it('a pinned POST never leaves X-TB-Env in any casing beside the body', async () => {
    const ctx = makeRestContext()
    _setRestOpenForTests(async () => ctx)
    const fn = jest.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      const headers = init.headers as Record<string, string>
      expect(init.body).toBeInstanceOf(Uint8Array)
      expect(hasHeader(headers, HEADER_ENV)).toBe(false)
      const seq = recordCounter(init.body as Uint8Array)
      const frame = sealServerResponse(seq, '/api/sessions/A/input', 'POST', '{"ok":true}')
      return new Response(asBody(frame), { status: 200, headers: { [HEADER_E2EE]: '1' } })
    })
    globalThis.fetch = fn as unknown as typeof fetch
    await authedFetch(pinnedTarget(), '/api/sessions/A/input', {
      method: 'POST',
      body: '{"text":"hi"}',
      headers: { 'X-TB-Env': 'should-be-deleted', 'x-tb-env': 'attacker-env' },
    })
  })

  it('an unsealed 401 on a sealed request is EnvelopeError, never AuthError', async () => {
    const ctx = makeRestContext()
    _setRestOpenForTests(async () => ctx)
    globalThis.fetch = jest.fn().mockResolvedValue(new Response('no', { status: 401 })) as unknown as typeof fetch
    await expect(authedFetch(pinnedTarget(), '/api/info')).rejects.toBeInstanceOf(EnvelopeError)
    await expect(authedFetch(pinnedTarget(), '/api/info')).rejects.not.toBeInstanceOf(AuthError)
  })

  it('a 304 carries the record in X-TB-Env and still unseals', async () => {
    const ctx = makeRestContext()
    _setRestOpenForTests(async () => ctx)
    const fn = jest.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      const headers = init.headers as Record<string, string>
      const seq = BigInt(headers[HEADER_SEQ])
      const frame = sealServerResponse(seq, '/api/info', 'GET', '')
      return new Response(null, {
        status: 304,
        headers: { [HEADER_E2EE]: '1', [HEADER_ENV]: encodeEnv(frame) },
      })
    })
    globalThis.fetch = fn as unknown as typeof fetch
    const response = await authedFetch(pinnedTarget(), '/api/info')
    expect(response.status).toBe(304)
    expect(await response.text()).toBe('')
  })

  it('a sealed 503 STORE_UNAVAILABLE is retryable and leaves the REST context intact', async () => {
    const ctx = makeRestContext()
    _setRestOpenForTests(async () => ctx)
    const fn = jest.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      const headers = init.headers as Record<string, string>
      const seq = BigInt(headers[HEADER_SEQ])
      const frame = sealServerResponse(seq, '/api/info', 'GET', '{"code":"STORE_UNAVAILABLE"}')
      return new Response(asBody(frame), { status: 503, headers: { [HEADER_E2EE]: '1' } })
    })
    globalThis.fetch = fn as unknown as typeof fetch
    await expect(authedFetch(pinnedTarget(), '/api/info')).rejects.toMatchObject({
      name: 'EnvelopeError',
      code: 'E2EE_TRANSIENT',
      retryable: true,
    })
    expect(_restLiveCount()).toBe(1)

    fn.mockImplementation(async (_url: string, init: RequestInit) => {
      const headers = init.headers as Record<string, string>
      const seq = BigInt(headers[HEADER_SEQ])
      const frame = sealServerResponse(seq, '/api/info', 'GET', '{"ok":true}')
      return new Response(asBody(frame), { status: 200, headers: { [HEADER_E2EE]: '1' } })
    })
    const response = await authedFetch(pinnedTarget(), '/api/info')
    const seqs = fn.mock.calls.map((c) => (c[1].headers as Record<string, string>)[HEADER_SEQ])
    expect(seqs).toEqual(['0', '1'])
    expect(await response.json()).toEqual({ ok: true })
  })

  it('the REST target is the raw percent-encoded path, never a decoded one', async () => {
    const ctx = makeRestContext()
    _setRestOpenForTests(async () => ctx)
    const wirePath =
      '/api/conversations/a%2Fb?since=2026-08-29&limit=50&limit=10&q=hello+world'
    const fixtureHash = sha256(utf8(vectors.restTargetCanonicalization.hashInputUtf8))
    const fn = jest.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      expect(init.body).toBeInstanceOf(Uint8Array)
      const frame = init.body as Uint8Array
      const clientView = createRecordState({
        key: b64(vectors.clientToServerKey),
        ctxId: ctxIdRaw,
        direction: DIRECTION_CLIENT_TO_SERVER,
        channel: CHANNEL_REST_REQUEST,
      })
      expect(Buffer.from(clientView.unsealMatching(frame, 0n, fixtureHash)).toString()).toBe('{"x":1}')
      const seq = recordCounter(frame)
      const responseFrame = sealServerResponse(seq, wirePath, 'POST', '{"ok":true}', fixtureHash)
      return new Response(asBody(responseFrame), { status: 200, headers: { [HEADER_E2EE]: '1' } })
    })
    globalThis.fetch = fn as unknown as typeof fetch
    const response = await authedFetch(pinnedTarget(), wirePath, {
      method: 'POST',
      body: '{"x":1}',
    })
    expect(await response.json()).toEqual({ ok: true })
  })

  it('a response bound to a different counter is a sequence violation', async () => {
    const ctx = makeRestContext()
    _setRestOpenForTests(async () => ctx)
    globalThis.fetch = jest.fn().mockImplementation(async () => {
      const frame = sealServerResponse(99n, '/api/info', 'GET', '{}')
      return new Response(asBody(frame), { status: 200, headers: { [HEADER_E2EE]: '1' } })
    }) as unknown as typeof fetch
    await expect(authedFetch(pinnedTarget(), '/api/info')).rejects.toMatchObject({
      name: 'EnvelopeError',
      code: 'E2EE_SEQUENCE_VIOLATION',
    })
  })

  it('persists no REST ctxId, key, or counter', async () => {
    const setSecure = SecureStore.setItemAsync as jest.Mock
    const setAsync = AsyncStorage.setItem as jest.Mock
    setSecure.mockClear()
    setAsync.mockClear()
    const ctx = makeRestContext()
    _setRestOpenForTests(async () => ctx)
    const fn = jest.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      const headers = init.headers as Record<string, string>
      const seq = BigInt(headers[HEADER_SEQ])
      const frame = sealServerResponse(seq, '/api/info', 'GET', '{}')
      return new Response(asBody(frame), { status: 200, headers: { [HEADER_E2EE]: '1' } })
    })
    globalThis.fetch = fn as unknown as typeof fetch
    await authedFetch(pinnedTarget(), '/api/info')
    expect(setSecure).not.toHaveBeenCalled()
    expect(setAsync).not.toHaveBeenCalled()
  })

  // Regression: the unsealed body used to be handed to Response as raw bytes.
  // React Native's whatwg-fetch reads an ArrayBuffer body one String.fromCharCode
  // per byte (latin-1), so every multi-byte character was mangled -- an em dash
  // (U+2014 = E2 80 94) surfaced in the app as "\u00e2" plus two invisible C1 controls.
  // jest's environment supplies Node's native Response, which decodes UTF-8
  // correctly, so this test pins the polyfill the app actually ships.
  it('keeps non-ASCII text intact when the unsealed body is read by RN\'s fetch polyfill', async () => {
    const { Response: RNResponse } = jest.requireActual('whatwg-fetch') as {
      Response: typeof Response
    }
    const NativeResponse = globalThis.Response
    const title = '# Prompt \u2014 reconcile prompt-expiry (not authoritative \u2014 reading state)'
    const ctx = makeRestContext()
    _setRestOpenForTests(async () => ctx)
    const fn = jest.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      const headers = init.headers as Record<string, string>
      const seq = BigInt(headers[HEADER_SEQ])
      const frame = sealServerResponse(seq, '/api/info', 'GET', JSON.stringify({ title }))
      return new RNResponse(asBody(frame), {
        status: 200,
        headers: { [HEADER_E2EE]: '1', 'Content-Type': 'application/octet-stream' },
      })
    })
    globalThis.fetch = fn as unknown as typeof fetch
    globalThis.Response = RNResponse

    try {
      const response = await authedFetch(pinnedTarget(), '/api/info')
      const body = (await response.json()) as { title: string }
      expect(body.title).toBe(title)
      expect(body.title).not.toContain('\u00e2')
    } finally {
      globalThis.Response = NativeResponse
    }
  })
})
