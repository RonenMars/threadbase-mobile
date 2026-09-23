// The single place an authenticated request to a streamer is constructed.
//
// Everything that talked to a streamer used to build its own request: the
// base-URL join, the Authorization header, and the 401 check were copied across
// eight call sites in five files, and `lib/clientLog.ts` carried a bespoke
// variant because it reaches the credential through a differently-shaped
// object. These tests pin the three things that are now decided exactly once.

import { authedFetch, AuthError, serverUrl } from '@/services/authed-fetch'
import { FIRST_ADDRESS_TIMEOUT_MS } from '@/services/server-addresses'
import { AuthError as ApiClientAuthError } from '@/services/api-client'
import type { ServerConfig, ServerInfo } from '@/types/api'

const info = (over: Partial<ServerInfo> = {}): ServerInfo => ({
  version: '1.52.3',
  machineName: 'box',
  platform: 'darwin',
  activeSessions: 0,
  ...over,
})

const target = (over: Partial<ServerConfig> = {}) => ({
  url: 'https://box.example.com',
  apiKey: 'tb_shared',
  serverInfo: null,
  ...over,
})

function mockFetch(response: Partial<Response> = {}) {
  const fn = jest.fn().mockResolvedValue({ status: 200, ok: true, ...response } as Response)
  globalThis.fetch = fn as unknown as typeof fetch
  return fn
}

function headersOf(fn: jest.Mock): Record<string, string> {
  return fn.mock.calls[0][1].headers
}

describe('serverUrl', () => {
  it('joins the path onto the server URL', () => {
    expect(serverUrl({ url: 'https://box.example.com' }, '/api/info')).toBe(
      'https://box.example.com/api/info',
    )
  })

  it('does not double the slash when the stored URL has a trailing one', () => {
    expect(serverUrl({ url: 'https://box.example.com/' }, '/api/info')).toBe(
      'https://box.example.com/api/info',
    )
  })

  // Every caller today passes a leading slash, so nothing was broken — but the
  // one that forgets would silently address `…example.comapi/info`, which fails
  // as a DNS error rather than as an obviously malformed URL.
  it('inserts the separator when the path has no leading slash', () => {
    expect(serverUrl({ url: 'https://box.example.com' }, 'api/info')).toBe(
      'https://box.example.com/api/info',
    )
  })
})

describe('authedFetch', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('sends the scoped device token when the server stores devices durably', async () => {
    const fn = mockFetch()
    await authedFetch(
      target({ deviceToken: 'dev_tok', serverInfo: info({ devicesDurable: true }) }),
      '/api/info',
    )
    expect(headersOf(fn).Authorization).toBe('Bearer dev_tok')
  })

  // The credential decision happens INSIDE authedFetch — no caller passes a
  // token, so no caller can pick the wrong one.
  it('falls back to the shared key on a server that predates durable devices', async () => {
    const fn = mockFetch()
    await authedFetch(target({ deviceToken: 'dev_tok', serverInfo: info() }), '/api/info')
    expect(headersOf(fn).Authorization).toBe('Bearer tb_shared')
  })

  it('addresses the server by joining path onto the stored URL', async () => {
    const fn = mockFetch()
    await authedFetch(target({ url: 'https://box.example.com/' }), '/api/sessions')
    expect(fn.mock.calls[0][0]).toBe('https://box.example.com/api/sessions')
  })

  it('keeps caller headers and forwards the rest of the init', async () => {
    const fn = mockFetch()
    const signal = new AbortController().signal
    await authedFetch(target(), '/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
      signal,
    })
    const init = fn.mock.calls[0][1]
    expect(init.method).toBe('POST')
    expect(init.body).toBe('{}')
    expect(init.signal).toBe(signal)
    expect(init.headers['Content-Type']).toBe('application/json')
    expect(init.headers.Authorization).toBe('Bearer tb_shared')
  })

  it('translates 401 into AuthError', async () => {
    mockFetch({ status: 401, ok: false })
    await expect(authedFetch(target(), '/api/info')).rejects.toMatchObject({
      name: 'AuthError',
      status: 401,
    })
  })

  // The remedy differs by credential and only this module knows which was sent.
  // A refused device token means re-pair; a refused shared key means edit the
  // key. Telling a revoked device to check its API key sends the user to a
  // screen that cannot fix it, because a devicesDurable server keeps being sent
  // the device token whatever is typed there.
  it('attributes a 401 to the device token when that is what it sent', async () => {
    mockFetch({ status: 401, ok: false })
    const server = target({ deviceToken: 'dev_tok', serverInfo: info({ devicesDurable: true }) })
    await expect(authedFetch(server, '/api/devices')).rejects.toMatchObject({
      credential: 'device',
    })
  })

  it('attributes a 401 to the shared key when the device token was not used', async () => {
    mockFetch({ status: 401, ok: false })
    // Same stored device token, but the server does not keep its registry
    // durably, so selectCredential falls back to the shared key — and the error
    // must follow the credential actually presented, not the one stored.
    const server = target({ deviceToken: 'dev_tok', serverInfo: info({ devicesDurable: false }) })
    await expect(authedFetch(server, '/api/devices')).rejects.toMatchObject({
      credential: 'shared',
    })
  })

  it('reports a refused device token as needing a re-pair, not an API key', async () => {
    mockFetch({ status: 401, ok: false })
    const server = target({ deviceToken: 'dev_tok', serverInfo: info({ devicesDurable: true }) })
    const err = await authedFetch(server, '/api/devices').then(
      () => {
        throw new Error('expected authedFetch to reject')
      },
      (e: AuthError) => e,
    )
    expect(err.message).toMatch(/pair/i)
    expect(err.message).not.toMatch(/API key/i)
  })

  // A 401 in a log says nothing without the route that produced it.
  it('records the route that was refused', async () => {
    mockFetch({ status: 401, ok: false })
    await expect(authedFetch(target(), '/api/sessions')).rejects.toMatchObject({
      path: '/api/sessions',
      message: expect.stringContaining('/api/sessions'),
    })
  })

  // The credential travels in the Authorization header, which AuthError never
  // sees — and the query string is dropped because it carries search terms and
  // ids that services/sanitize.ts keeps out of every outbound payload.
  it('keeps the credential and the query string out of the error', async () => {
    mockFetch({ status: 401, ok: false })
    const err = await authedFetch(target(), '/api/sessions?search=secret-project').then(
      () => {
        throw new Error('expected authedFetch to reject')
      },
      (e: AuthError) => e,
    )
    expect(err.path).toBe('/api/sessions')
    expect(err.message).not.toMatch(/tb_shared|Bearer|secret-project/)
  })

  // There must be exactly ONE AuthError class object. A second one with an
  // identical body would keep every `err.name === 'AuthError'` assertion green
  // while `instanceof` silently returns false — and the two call sites that
  // branch on it, AddServerScreen and useTBPair, are both on the pairing path,
  // where losing the "your credential was rejected" message costs the most.
  it('rejects with the same AuthError class api-client exports', async () => {
    mockFetch({ status: 401, ok: false })
    expect(ApiClientAuthError).toBe(AuthError)
    await expect(authedFetch(target(), '/api/info')).rejects.toBeInstanceOf(ApiClientAuthError)
  })

  // Phase 0 exists so one module decides which credential is presented. A
  // caller passing its own Authorization must not be able to take that back.
  it('ignores a caller-supplied Authorization header', async () => {
    const fn = mockFetch()
    await authedFetch(target(), '/api/info', {
      headers: { Authorization: 'Bearer smuggled' },
    })
    expect(headersOf(fn).Authorization).toBe('Bearer tb_shared')
  })

  // Every other status is the caller's business: a 304 is a cache hit, a 404
  // means the server predates a feature, a 409 carries a conflict payload.
  it('returns every other status untouched', async () => {
    mockFetch({ status: 409, ok: false })
    const res = await authedFetch(target(), '/api/cache/alert/resolve', { method: 'POST' })
    expect(res.status).toBe(409)
  })
})

// #734: an unpinned server with two addresses. Each plaintext request is its own
// attempt — the user's address, then publicUrl. Reserved addresses only.
describe('authedFetch – two addresses, plaintext', () => {
  const LAN = 'https://192.0.2.10:8766'
  const PUBLIC = 'https://tb.example.com'
  const twoAddresses = { url: LAN, apiKey: 'tb_shared', publicUrl: PUBLIC }

  /** A fetch whose behaviour per address is scripted: 'down' rejects, 'hang' waits for an abort. */
  function network(script: Record<string, 'down' | 'hang' | number>) {
    const calls: string[] = []
    const spy = jest.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input)
      calls.push(url)
      const behaviour = script[Object.keys(script).find((a) => url.startsWith(a)) ?? '']
      if (behaviour === 'down') return Promise.reject(new TypeError('Network request failed'))
      if (behaviour === 'hang') {
        return new Promise<Response>((_resolve, reject) =>
          init?.signal?.addEventListener('abort', () => reject(new Error('Aborted'))),
        )
      }
      return Promise.resolve(new Response('{}', { status: behaviour }))
    })
    return { calls, spy }
  }

  afterEach(() => {
    jest.restoreAllMocks()
    jest.useRealTimers()
  })

  it('tries the user address, then publicUrl when it cannot be reached', async () => {
    const { calls } = network({ [LAN]: 'down', [PUBLIC]: 200 })
    const res = await authedFetch(twoAddresses, '/api/info')
    expect(res.status).toBe(200)
    expect(calls).toEqual([`${LAN}/api/info`, `${PUBLIC}/api/info`])
  })

  it('stays on the user address when it answered, whatever the status', async () => {
    const { calls } = network({ [LAN]: 500, [PUBLIC]: 200 })
    const res = await authedFetch(twoAddresses, '/api/info')
    expect(res.status).toBe(500)
    expect(calls).toEqual([`${LAN}/api/info`])
  })

  it('gives a read on the user address FIRST_ADDRESS_TIMEOUT_MS before moving on', async () => {
    jest.useFakeTimers()
    const { calls } = network({ [LAN]: 'hang', [PUBLIC]: 200 })
    const pending = authedFetch(twoAddresses, '/api/sessions')
    await Promise.resolve()
    jest.advanceTimersByTime(FIRST_ADDRESS_TIMEOUT_MS - 1)
    expect(calls).toHaveLength(1)
    jest.advanceTimersByTime(1)
    expect((await pending).status).toBe(200)
    expect(calls).toEqual([`${LAN}/api/sessions`, `${PUBLIC}/api/sessions`])
  })

  it('never replays a write that timed out — it may already have reached the server', async () => {
    jest.useFakeTimers()
    const { calls } = network({ [LAN]: 'hang', [PUBLIC]: 200 })
    void authedFetch(twoAddresses, '/api/sessions', { method: 'POST', body: '{}' })
    await Promise.resolve()
    jest.advanceTimersByTime(FIRST_ADDRESS_TIMEOUT_MS * 3)
    expect(calls).toEqual([`${LAN}/api/sessions`])
  })

  it('moves a write to publicUrl when the user address refused the connection outright', async () => {
    const { calls } = network({ [LAN]: 'down', [PUBLIC]: 200 })
    await authedFetch(twoAddresses, '/api/sessions', { method: 'POST', body: '{}' })
    expect(calls).toEqual([`${LAN}/api/sessions`, `${PUBLIC}/api/sessions`])
  })

  it("does not move on after the caller's own abort", async () => {
    const { calls } = network({ [LAN]: 'hang', [PUBLIC]: 200 })
    const controller = new AbortController()
    const pending = authedFetch(twoAddresses, '/api/info', { signal: controller.signal })
    controller.abort()
    await expect(pending).rejects.toThrow('Aborted')
    expect(calls).toEqual([`${LAN}/api/info`])
  })
})
