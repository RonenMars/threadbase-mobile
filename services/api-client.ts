import { useServersStore } from '@/stores/servers'

export class NetworkError extends Error {
  code?: string
  constructor(message: string, code?: string) {
    super(message)
    this.name = 'NetworkError'
    this.code = code
  }
}

export class AuthError extends Error {
  constructor() {
    super('Unauthorized — check your API key')
    this.name = 'AuthError'
  }
}

export class NotFoundError extends Error {
  constructor(path: string) {
    super(`Not found: ${path}`)
    this.name = 'NotFoundError'
  }
}

const REQUEST_TIMEOUT_MS = 15000

async function request<T>(
  method: string,
  path: string,
  body: unknown | undefined,
  serverId: string,
  options: { signal?: AbortSignal } = {},
  retried = false,
): Promise<T> {
  const server = useServersStore.getState().getServer(serverId)
  if (!server) throw new NetworkError(`Unknown server: ${serverId}`)

  const url = `${server.url.replace(/\/$/, '')}${path}`

  // Combine the caller's signal (from React Query) with a per-request timeout
  // so a single hung page can't strand the eager-pagination loop.
  const timeoutController = new AbortController()
  const timeoutId = setTimeout(() => timeoutController.abort(), REQUEST_TIMEOUT_MS)
  const onCallerAbort = () => timeoutController.abort()
  if (options.signal) {
    if (options.signal.aborted) timeoutController.abort()
    else options.signal.addEventListener('abort', onCallerAbort)
  }

  let response: Response
  try {
    response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${server.apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: timeoutController.signal,
    })
  } catch (err) {
    // Don't retry if the caller aborted — that's an intentional cancellation.
    if (options.signal?.aborted) {
      throw new NetworkError('Request cancelled')
    }
    if (!retried) {
      return request(method, path, body, serverId, options, true)
    }
    throw new NetworkError(`Failed to reach ${url}: ${String(err)}`)
  } finally {
    clearTimeout(timeoutId)
    options.signal?.removeEventListener('abort', onCallerAbort)
  }

  if (response.status === 401) throw new AuthError()
  if (response.status === 404) throw new NotFoundError(path)
  if (!response.ok) {
    let detail = ''
    let code: string | undefined
    try {
      const body = await response.json()
      if (body?.error) detail = body.error
      if (body?.code) code = body.code
    } catch {}
    throw new NetworkError(detail || `Server returned ${response.status}`, code)
  }

  return response.json() as Promise<T>
}

export interface RequestOptions {
  signal?: AbortSignal
}

export interface ServerApi {
  get: <T>(path: string, options?: RequestOptions) => Promise<T>
  post: <T>(path: string, body?: unknown, options?: RequestOptions) => Promise<T>
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) => Promise<T>
  delete: <T>(path: string, options?: RequestOptions) => Promise<T>
}

export function createApiForServer(serverId: string): ServerApi {
  return {
    get: <T>(path: string, options?: RequestOptions) => request<T>('GET', path, undefined, serverId, options),
    post: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>('POST', path, body, serverId, options),
    patch: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>('PATCH', path, body, serverId, options),
    delete: <T>(path: string, options?: RequestOptions) => request<T>('DELETE', path, undefined, serverId, options),
  }
}

/** @deprecated Use createApiForServer(serverId) instead. */
export const api: ServerApi = {
  get: <T>(path: string, options?: RequestOptions) => {
    const first = useServersStore.getState().activeServerIds[0]
    return first ? request<T>('GET', path, undefined, first, options) : Promise.reject(new NetworkError('No servers configured'))
  },
  post: <T>(path: string, body?: unknown, options?: RequestOptions) => {
    const first = useServersStore.getState().activeServerIds[0]
    return first ? request<T>('POST', path, body, first, options) : Promise.reject(new NetworkError('No servers configured'))
  },
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) => {
    const first = useServersStore.getState().activeServerIds[0]
    return first ? request<T>('PATCH', path, body, first, options) : Promise.reject(new NetworkError('No servers configured'))
  },
  delete: <T>(path: string, options?: RequestOptions) => {
    const first = useServersStore.getState().activeServerIds[0]
    return first ? request<T>('DELETE', path, undefined, first, options) : Promise.reject(new NetworkError('No servers configured'))
  },
}
