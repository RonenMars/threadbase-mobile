import type { ServerConfig, ServerInfo } from '@/types/api'

export class AuthError extends Error {
  constructor() {
    super('Unauthorized — check your API key')
    this.name = 'AuthError'
  }
}

/**
 * Everything `authedFetch` needs to address a streamer and present a credential.
 * Deliberately looser than `ServerConfig` so callers that hold only a URL and a
 * key — a pre-pairing credential check, the dev-server client-log target — go
 * through the same path as a stored server rather than a bespoke variant.
 */
export interface AuthedTarget {
  url: string
  apiKey: string
  deviceToken?: string
  serverInfo?: ServerInfo | null
}

export interface AuthedFetchInit extends Omit<RequestInit, 'headers'> {
  headers?: Record<string, string>
}

/** The absolute URL a request to `path` will hit. Exported for error messages. */
export function serverUrl(target: Pick<AuthedTarget, 'url'>, path: string): string {
  return `${target.url.replace(/\/$/, '')}${path}`
}

/**
 * The credential to present to a server.
 *
 * `apiKey` is the OWNER's shared key and carries `admin` on the streamer — it
 * can rotate itself and revoke other devices. `deviceToken` is the scoped,
 * individually revocable credential the pair exchange has been minting since
 * C5. The app stored it and then sent the shared key on every request anyway,
 * so a lost phone leaked `admin` rather than a revocable scope.
 *
 * The `devicesDurable` gate is what makes preferring it safe: on a streamer
 * that keeps its device registry inside the deletable conversation cache,
 * `tb-streamer cache clear` would invalidate the token and 401 the device.
 * Falling back to `apiKey` there is exactly today's behaviour, so an older
 * server is unaffected.
 *
 * Deliberately NOT a 401-retry fallback: silently re-presenting the shared key
 * after a device token is refused would let a revoked device keep working,
 * which is the one thing revocation has to prevent.
 *
 * Lives here, beside the only code that builds an HTTP request to a streamer.
 * The WebSocket is the one other credential-presenting path and imports it from
 * here; nothing else should call it directly.
 */
export function authToken(
  target: Pick<ServerConfig, 'apiKey' | 'deviceToken' | 'serverInfo'> | AuthedTarget,
): string {
  return target.serverInfo?.devicesDurable && target.deviceToken ? target.deviceToken : target.apiKey
}

/**
 * The one place an authenticated request to a streamer is constructed: base-URL
 * join, credential selection, and 401 translation. Callers own timeouts,
 * retries, and every other status code.
 *
 * Callers that wrap the call in a try/catch for network failures must rethrow
 * `AuthError` — a rejected credential is not a network failure, and retrying it
 * only presents the same rejected key again.
 */
export async function authedFetch(
  target: AuthedTarget,
  path: string,
  init: AuthedFetchInit = {},
): Promise<Response> {
  const response = await fetch(serverUrl(target, path), {
    ...init,
    headers: {
      // Caller headers first: an `Authorization` among them loses to the one
      // chosen here. A module that owns credential selection cannot let a
      // caller quietly opt out of it — the request would still succeed.
      ...init.headers,
      Authorization: `Bearer ${authToken(target)}`,
    },
  })
  if (response.status === 401) throw new AuthError()
  return response
}
