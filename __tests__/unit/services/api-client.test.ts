import { createApiForServer, NetworkError, AuthError, NotFoundError } from '@/services/api-client'
import { useServerFetchStatusStore } from '@/stores/serverFetchStatus'

jest.mock('@/stores/servers', () => ({
  useServersStore: {
    getState: jest.fn(() => ({
      getServer: (id: string) => id === 'srv_test' ? {
        id: 'srv_test',
        url: 'http://test.local',
        apiKey: 'test-api-key',
        isConnected: true,
        serverInfo: null,
      } : undefined,
      servers: {
        srv_test: {
          id: 'srv_test',
          url: 'http://test.local',
          apiKey: 'test-api-key',
          isConnected: true,
          serverInfo: null,
        },
      },
      activeServerIds: ['srv_test'],
    })),
  },
}))

const mockFetch = jest.fn()
global.fetch = mockFetch

const api = createApiForServer('srv_test')

function mockOkResponse(body: unknown) {
  return { ok: true, status: 200, json: jest.fn().mockResolvedValue(body) }
}

function mockErrorResponse(status: number) {
  return { ok: false, status, json: jest.fn().mockResolvedValue({}) }
}

beforeEach(() => {
  mockFetch.mockReset()
  useServerFetchStatusStore.getState().reset()
})

describe('Error classes', () => {
  it('NetworkError has correct name and message', () => {
    const err = new NetworkError('connection refused')
    expect(err.name).toBe('NetworkError')
    expect(err.message).toBe('connection refused')
    expect(err instanceof Error).toBe(true)
  })

  it('AuthError has correct name and message', () => {
    const err = new AuthError()
    expect(err.name).toBe('AuthError')
    expect(err.message).toMatch(/Unauthorized/i)
  })

  it('NotFoundError includes path in message', () => {
    const err = new NotFoundError('/api/missing')
    expect(err.name).toBe('NotFoundError')
    expect(err.message).toContain('/api/missing')
  })
})

describe('api.get', () => {
  it('makes a GET request with auth header', async () => {
    mockFetch.mockResolvedValueOnce(mockOkResponse({ ok: true }))
    await api.get('/api/test')
    expect(mockFetch).toHaveBeenCalledWith(
      'http://test.local/api/test',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Authorization: 'Bearer test-api-key' }),
      })
    )
  })

  it('returns parsed JSON', async () => {
    mockFetch.mockResolvedValueOnce(mockOkResponse({ sessions: [] }))
    const result = await api.get('/api/sessions')
    expect(result).toEqual({ sessions: [] })
  })

  it('throws AuthError on 401', async () => {
    mockFetch.mockResolvedValue(mockErrorResponse(401))
    await expect(api.get('/api/protected')).rejects.toThrow(AuthError)
  })

  it('throws NotFoundError on 404', async () => {
    mockFetch.mockResolvedValue(mockErrorResponse(404))
    await expect(api.get('/api/missing')).rejects.toThrow(NotFoundError)
  })

  it('throws NetworkError on non-ok response', async () => {
    mockFetch.mockResolvedValue(mockErrorResponse(500))
    await expect(api.get('/api/broken')).rejects.toThrow(NetworkError)
  })

  it('records the explicit server warm-up response for fetch endpoints', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: jest.fn().mockResolvedValue({
        error: 'Server is warming up',
        code: 'SERVER_WARMING_UP',
        warmupState: 'cache_reset',
      }),
    })

    await expect(api.get('/api/conversations/count')).rejects.toMatchObject({
      code: 'SERVER_WARMING_UP',
      warmupState: 'cache_reset',
    })
    expect(useServerFetchStatusStore.getState().statuses.srv_test).toMatchObject({
      status: 'warming_up',
      warmupState: 'cache_reset',
    })
  })

  it('does not classify a generic 503 as warm-up', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: jest.fn().mockResolvedValue({ error: 'Temporarily unavailable' }),
    })

    await expect(api.get('/api/conversations/count')).rejects.toMatchObject({
      code: undefined,
    })
    expect(useServerFetchStatusStore.getState().statuses.srv_test).toBeUndefined()
  })

  it('clears warm-up only after a successful fetch endpoint response', async () => {
    useServerFetchStatusStore.getState().recordWarmingUp('srv_test', 'startup')
    useServerFetchStatusStore.getState().recordSuccess('srv_test')
    expect(useServerFetchStatusStore.getState().statuses.srv_test.status).toBe('warming_up')

    mockFetch.mockResolvedValueOnce(mockOkResponse({ total: 0 }))
    await api.get('/api/conversations/count')

    expect(useServerFetchStatusStore.getState().statuses.srv_test.status).toBe('ok')
  })

  it('retries once on network failure then throws NetworkError', async () => {
    mockFetch
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await expect(api.get('/api/flaky')).rejects.toThrow(NetworkError)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('succeeds on retry if second attempt works', async () => {
    mockFetch
      .mockRejectedValueOnce(new TypeError('transient'))
      .mockResolvedValueOnce(mockOkResponse({ retried: true }))
    const result = await api.get<{ retried: boolean }>('/api/flaky')
    expect(result.retried).toBe(true)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('aborts a stalled first attempt at 8 s and fails over to the retry', async () => {
    jest.useFakeTimers()
    try {
      const abortReasons: string[] = []
      mockFetch.mockImplementation((_url: string, init: { signal: AbortSignal }) => {
        return new Promise((resolve, reject) => {
          init.signal.addEventListener('abort', () => {
            abortReasons.push('aborted')
            reject(new DOMException('Aborted', 'AbortError'))
          })
          // First attempt stalls forever; the retry responds.
          if (abortReasons.length > 0) resolve(mockOkResponse({ recovered: true }))
        })
      })

      const pending = api.get<{ recovered: boolean }>('/api/stalled')
      // Just before the 8 s first-attempt timeout — still stalled.
      await jest.advanceTimersByTimeAsync(7999)
      expect(abortReasons).toHaveLength(0)
      // Crossing it aborts attempt #1 and the silent retry succeeds.
      await jest.advanceTimersByTimeAsync(2)
      const result = await pending
      expect(result.recovered).toBe(true)
      expect(abortReasons).toHaveLength(1)
      expect(mockFetch).toHaveBeenCalledTimes(2)
    } finally {
      jest.useRealTimers()
    }
  })
})

describe('api.post – retry: false (non-idempotent endpoints)', () => {
  it('does not retry on network failure and throws immediately', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await expect(
      api.post('/api/sessions/start', { path: '/tmp' }, { retry: false }),
    ).rejects.toThrow(NetworkError)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('does not retry after the first-attempt timeout aborts', async () => {
    jest.useFakeTimers()
    try {
      mockFetch.mockImplementation((_url: string, init: { signal: AbortSignal }) => {
        return new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
        })
      })

      // Attach the assertion before advancing timers — advancing past the
      // abort inline (without a pending .rejects listener) surfaces the
      // rejection as an unhandled promise error instead of a test failure.
      const assertion = expect(
        api.post('/api/sessions/start', { path: '/tmp' }, { timeoutMs: 10_000, retry: false }),
      ).rejects.toThrow(NetworkError)
      await jest.advanceTimersByTimeAsync(10_001)
      await assertion
      expect(mockFetch).toHaveBeenCalledTimes(1)
    } finally {
      jest.useRealTimers()
    }
  })

  it('tags a timeout-abort NetworkError with code TIMEOUT', async () => {
    jest.useFakeTimers()
    try {
      mockFetch.mockImplementation((_url: string, init: { signal: AbortSignal }) => {
        return new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
        })
      })

      const assertion = expect(
        api.post('/api/sessions/start', {}, { timeoutMs: 5_000, retry: false }),
      ).rejects.toMatchObject({ code: 'TIMEOUT' })
      await jest.advanceTimersByTimeAsync(5_001)
      await assertion
    } finally {
      jest.useRealTimers()
    }
  })

  it('a caller-initiated abort is NOT tagged TIMEOUT', async () => {
    const controller = new AbortController()
    mockFetch.mockImplementation((_url: string, init: { signal: AbortSignal }) => {
      return new Promise((_resolve, reject) => {
        // The signal may already be aborted by the time fetch() is called —
        // request() awaits getDeviceClientId() first, and an abort event does
        // not replay to a listener registered after it already fired.
        if (init.signal.aborted) {
          reject(new DOMException('Aborted', 'AbortError'))
          return
        }
        init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
      })
    })
    const assertion = expect(
      api.post('/api/sessions/start', {}, { signal: controller.signal, retry: false }),
    ).rejects.toThrow('Request cancelled')
    controller.abort()
    await assertion
  })

  it('still retries other endpoints by default', async () => {
    mockFetch
      .mockRejectedValueOnce(new TypeError('transient'))
      .mockResolvedValueOnce(mockOkResponse({ ok: true }))
    const result = await api.post<{ ok: boolean }>('/api/sessions/1/input', { input: 'hi' })
    expect(result.ok).toBe(true)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })
})

describe('api.post', () => {
  it('sends JSON body', async () => {
    mockFetch.mockResolvedValueOnce(mockOkResponse({}))
    await api.post('/api/sessions/1/input', { input: 'hello' })
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ input: 'hello' }),
      })
    )
  })
})

describe('api.delete', () => {
  it('makes a DELETE request', async () => {
    mockFetch.mockResolvedValueOnce(mockOkResponse({}))
    await api.delete('/api/sessions/1/queue/p1')
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ method: 'DELETE' })
    )
  })
})

describe('createApiForServer – unknown server', () => {
  it('throws NetworkError for unknown serverId', async () => {
    const unknownApi = createApiForServer('srv_unknown')
    mockFetch.mockResolvedValueOnce(mockOkResponse({}))
    await expect(unknownApi.get('/api/test')).rejects.toThrow(NetworkError)
  })
})

describe('api.getWithMeta – conditional fetch', () => {
  function metaResponse(status: number, etag: string | null, body: unknown) {
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: { get: (h: string) => (h.toLowerCase() === 'etag' ? etag : null) },
      json: jest.fn().mockResolvedValue(body),
    }
  }

  it('returns status, etag, and body on a 200', async () => {
    mockFetch.mockResolvedValueOnce(metaResponse(200, '"abc123"', { meta: { id: 'c1' } }))
    const res = await api.getWithMeta<{ meta: { id: string } }>('/api/conversations/c1')
    expect(res.status).toBe(200)
    expect(res.etag).toBe('"abc123"')
    expect(res.body?.meta.id).toBe('c1')
  })

  it('returns body=null and does not parse json on a 304', async () => {
    const resp = metaResponse(304, '"abc123"', undefined)
    mockFetch.mockResolvedValueOnce(resp)
    const res = await api.getWithMeta('/api/conversations/c1')
    expect(res.status).toBe(304)
    expect(res.body).toBeNull()
    expect(res.etag).toBe('"abc123"')
    expect(resp.json).not.toHaveBeenCalled()
  })

  it('sends If-None-Match when provided in headers', async () => {
    mockFetch.mockResolvedValueOnce(metaResponse(200, '"new"', { ok: true }))
    await api.getWithMeta('/api/conversations/c1', { headers: { 'If-None-Match': '"old"' } })
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ 'If-None-Match': '"old"' }),
      }),
    )
  })

  it('degrades gracefully against a server that emits no ETag', async () => {
    mockFetch.mockResolvedValueOnce(metaResponse(200, null, { ok: true }))
    const res = await api.getWithMeta('/api/conversations/c1')
    expect(res.status).toBe(200)
    expect(res.etag).toBeNull()
  })
})
