import { createApiForServer, NetworkError, AuthError, NotFoundError } from '@/services/api-client'

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
