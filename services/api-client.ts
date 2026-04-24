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

async function request<T>(
  method: string,
  path: string,
  body: unknown | undefined,
  serverId: string,
  retried = false,
): Promise<T> {
  const server = useServersStore.getState().getServer(serverId)
  if (!server) throw new NetworkError(`Unknown server: ${serverId}`)

  const url = `${server.url.replace(/\/$/, '')}${path}`

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
    })
  } catch (err) {
    if (!retried) {
      return request(method, path, body, serverId, true)
    }
    throw new NetworkError(`Failed to reach ${url}: ${String(err)}`)
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

export interface ServerApi {
  get: <T>(path: string) => Promise<T>
  post: <T>(path: string, body?: unknown) => Promise<T>
  patch: <T>(path: string, body?: unknown) => Promise<T>
  delete: <T>(path: string) => Promise<T>
}

export function createApiForServer(serverId: string): ServerApi {
  return {
    get: <T>(path: string) => request<T>('GET', path, undefined, serverId),
    post: <T>(path: string, body?: unknown) => request<T>('POST', path, body, serverId),
    patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body, serverId),
    delete: <T>(path: string) => request<T>('DELETE', path, undefined, serverId),
  }
}

/** @deprecated Use createApiForServer(serverId) instead. */
export const api: ServerApi = {
  get: <T>(path: string) => {
    const first = useServersStore.getState().activeServerIds[0]
    return first ? request<T>('GET', path, undefined, first) : Promise.reject(new NetworkError('No servers configured'))
  },
  post: <T>(path: string, body?: unknown) => {
    const first = useServersStore.getState().activeServerIds[0]
    return first ? request<T>('POST', path, body, first) : Promise.reject(new NetworkError('No servers configured'))
  },
  patch: <T>(path: string, body?: unknown) => {
    const first = useServersStore.getState().activeServerIds[0]
    return first ? request<T>('PATCH', path, body, first) : Promise.reject(new NetworkError('No servers configured'))
  },
  delete: <T>(path: string) => {
    const first = useServersStore.getState().activeServerIds[0]
    return first ? request<T>('DELETE', path, undefined, first) : Promise.reject(new NetworkError('No servers configured'))
  },
}
