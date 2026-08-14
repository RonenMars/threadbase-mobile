// The single place an authenticated request to a streamer is constructed.
//
// Everything that talked to a streamer used to build its own request: the
// base-URL join, the Authorization header, and the 401 check were copied across
// eight call sites in five files, and `lib/clientLog.ts` carried a bespoke
// variant because it reaches the credential through a differently-shaped
// object. These tests pin the three things that are now decided exactly once.

import { authedFetch, AuthError, serverUrl } from '@/services/authed-fetch'
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
    await expect(authedFetch(target(), '/api/info')).rejects.toBeInstanceOf(AuthError)
  })

  // Every other status is the caller's business: a 304 is a cache hit, a 404
  // means the server predates a feature, a 409 carries a conflict payload.
  it('returns every other status untouched', async () => {
    mockFetch({ status: 409, ok: false })
    const res = await authedFetch(target(), '/api/cache/alert/resolve', { method: 'POST' })
    expect(res.status).toBe(409)
  })
})
