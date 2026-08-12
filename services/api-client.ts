import { useServersStore } from '@/stores/servers'
import { useServerFetchStatusStore } from '@/stores/serverFetchStatus'
import { getDeviceClientId } from './device-id'
import { clientLog } from '@/lib/clientLog'
import { getServerWarmupState } from './server-warmup'
import { mark as traceMark, isTracing } from '@/lib/openTrace'
import { CLAUDE_CODE_PROVIDER, CODEX_CLI_PROVIDER, type ProviderName } from '@/constants/providers'
import type {
  CacheAlert,
  CacheAlertResolveAction,
  ClaudeFlagsConfig,
  ClaudeFlagValues,
  FeatureFlagsConfig,
  ServerWarmupState,
} from '@/types/api'
import { authToken } from '@/types/api'

export class NetworkError extends Error {
  code?: string
  warmupState?: ServerWarmupState
  constructor(message: string, code?: string, warmupState?: ServerWarmupState) {
    super(message)
    this.name = 'NetworkError'
    this.code = code
    this.warmupState = warmupState
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

export class SessionNotFoundError extends Error {
  constructor(public sessionId: string) {
    super(`Session not found: ${sessionId}`)
    this.name = 'SessionNotFoundError'
  }
}

/**
 * Which signals the server used to decide a conversation is busy. `file_handle`
 * is the Codex exact-rollout probe: another process holds the session's JSONL
 * open right now.
 */
export type ConversationBusyDetectedBy =
  | 'jsonl_mtime'
  | 'process_argv'
  | 'process_cwd'
  | 'file_handle'

/** Provider-specific cause of the collision, when the server names one. */
export type ConversationBusyReasonCode = 'CODEX_SESSION_ACTIVE'

/**
 * Soft 409 from `POST /api/sessions/resume`: the conversation looks like it may
 * still be open elsewhere (e.g. an external CLI writing its JSONL). Carries the
 * structured payload so callers can name what was detected and offer only the
 * recovery actions the server actually allows.
 *
 * `canForce` / `canTakeOver` / `canFork` are authoritative when the server sends
 * them. Older streamers omit them, so the defaults reproduce the Claude Code
 * flow that shipped before they existed: force allowed, take-over only when a
 * real process was matched, no fork. A malformed (non-boolean) field falls back
 * to the same default rather than being read as permission.
 */
export class ConversationBusyError extends Error {
  detectedBy: ConversationBusyDetectedBy[]
  lastActivityMs: number | null
  likelyOwner: 'external' | 'unknown'
  reasonCode: ConversationBusyReasonCode | null
  provider: ProviderName | null
  canForce: boolean
  canTakeOver: boolean
  canFork: boolean
  constructor(
    message: string,
    payload: {
      detectedBy?: unknown
      lastActivityMs?: unknown
      likelyOwner?: unknown
      reasonCode?: unknown
      provider?: unknown
      canForce?: unknown
      canTakeOver?: unknown
      canFork?: unknown
    } = {},
  ) {
    super(message)
    this.name = 'ConversationBusyError'
    this.detectedBy = Array.isArray(payload.detectedBy)
      ? (payload.detectedBy.filter((d) => typeof d === 'string') as ConversationBusyDetectedBy[])
      : []
    this.lastActivityMs = typeof payload.lastActivityMs === 'number' ? payload.lastActivityMs : null
    this.likelyOwner = payload.likelyOwner === 'external' ? 'external' : 'unknown'
    this.reasonCode = payload.reasonCode === 'CODEX_SESSION_ACTIVE' ? 'CODEX_SESSION_ACTIVE' : null
    this.provider =
      payload.provider === CODEX_CLI_PROVIDER || payload.provider === CLAUDE_CODE_PROVIDER
        ? payload.provider
        : null
    this.canForce = typeof payload.canForce === 'boolean' ? payload.canForce : true
    this.canTakeOver =
      typeof payload.canTakeOver === 'boolean'
        ? payload.canTakeOver
        : this.likelyOwner === 'external'
    this.canFork = typeof payload.canFork === 'boolean' ? payload.canFork : false
  }
}

const REQUEST_TIMEOUT_MS = 15000
// First attempt fails over to the silent retry sooner — a stalled connection
// shouldn't burn the full 15 s before the retry even starts.
const FIRST_ATTEMPT_TIMEOUT_MS = 8000

// Splits "response headers back" from "body read + parsed" for the conversation
// detail fetch — the two are one await in every caller, and only the trace
// needs them apart.
function isConversationDetail(path: string): boolean {
  return isTracing() && /^\/api\/conversations\/[^/?]+(\?|$)/.test(path)
}

function isWarmupFetchEndpoint(method: string, path: string): boolean {
  if (method !== 'GET') return false
  const pathname = path.split('?')[0]
  return pathname === '/api/sessions' ||
    pathname === '/api/sessions/count' ||
    pathname === '/api/sessions/recents' ||
    /^\/api\/sessions\/[^/]+$/.test(pathname) ||
    pathname === '/api/conversations' ||
    pathname === '/api/conversations/count' ||
    /^\/api\/conversations\/[^/]+$/.test(pathname)
}

function recordWarmupError(serverId: string, errorBody: unknown): ServerWarmupState | undefined {
  const warmupState = getServerWarmupState(errorBody) ?? undefined
  if (warmupState) {
    useServerFetchStatusStore.getState().recordWarmingUp(serverId, warmupState)
  }
  return warmupState
}

async function request<T>(
  method: string,
  path: string,
  body: unknown | undefined,
  serverId: string,
  options: RequestOptions = {},
  retried = false,
): Promise<T> {
  const server = useServersStore.getState().getServer(serverId)
  if (!server) throw new NetworkError(`Unknown server: ${serverId}`)

  const url = `${server.url.replace(/\/$/, '')}${path}`
  const isStartSession =
    path === '/api/sessions/start' ||
    path.startsWith('/api/sessions/start?') ||
    path === '/api/sessions/resume'

  // Combine the caller's signal (from React Query) with a per-request timeout
  // so a single hung page can't strand the eager-pagination loop. A caller can
  // override the timeout for slow endpoints (e.g. multi-server session fetch).
  const timeoutController = new AbortController()
  const timeoutMs = options.timeoutMs ?? (retried ? REQUEST_TIMEOUT_MS : FIRST_ATTEMPT_TIMEOUT_MS)
  const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs)
  const onCallerAbort = () => timeoutController.abort()
  if (options.signal) {
    if (options.signal.aborted) timeoutController.abort()
    else options.signal.addEventListener('abort', onCallerAbort)
  }

  const clientId = await getDeviceClientId()
  if (isStartSession) {
    clientLog.info('startSession', 'start request → server', {
      method,
      path,
      serverId,
      url,
      body,
      timeoutMs,
      retry: options.retry,
      retried,
      clientId,
    })
  }
  let response: Response
  const t0 = Date.now()
  const traced = isConversationDetail(path)
  if (traced) traceMark('request', `${path.split('?')[1] ?? 'no query params'}`)
  try {
    response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${authToken(server)}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Client-Id': clientId,
        ...options.headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: timeoutController.signal,
    })
  } catch (err) {
    if (isStartSession) {
      clientLog.info('startSession', 'start request failed (network)', {
        method,
        path,
        serverId,
        url,
        elapsedMs: Date.now() - t0,
        message: err instanceof Error ? err.message : String(err),
        aborted: timeoutController.signal.aborted,
        callerAborted: !!options.signal?.aborted,
        retried,
      })
    }
    // Don't retry if the caller aborted — that's an intentional cancellation.
    if (options.signal?.aborted) {
      throw new NetworkError('Request cancelled')
    }
    // Session start/resume are non-idempotent — retrying a timed-out request
    // spawns a second PTY. Callers of those endpoints pass retry: false.
    if (!retried && options.retry !== false) {
      return request(method, path, body, serverId, options, true)
    }
    // timeoutController (not a caller abort) fired — this was OUR timeout, not
    // a generic fetch failure. Tag it so callers can show a specific message
    // instead of a raw "fetch failed" string.
    const code = timeoutController.signal.aborted ? 'TIMEOUT' : undefined
    throw new NetworkError(`Failed to reach ${url}: ${String(err)}`, code)
  } finally {
    clearTimeout(timeoutId)
    options.signal?.removeEventListener('abort', onCallerAbort)
  }

  if (isStartSession) {
    clientLog.info('startSession', 'start response ← server', {
      method,
      path,
      serverId,
      status: response.status,
      ok: response.ok,
      elapsedMs: Date.now() - t0,
    })
  }

  if (response.status === 401) throw new AuthError()
  if (response.status === 404) throw new NotFoundError(path)
  if (!response.ok) {
    let detail = ''
    let code: string | undefined
    let warmupState: ServerWarmupState | undefined
    // Hoisted out of the try so the 409 handler below can read the structured
    // collision payload, not just the flattened detail/code strings.
    let errBody: Record<string, unknown> | undefined
    try {
      errBody = await response.json()
      if (errBody?.error) detail = errBody.error as string
      if (errBody?.code) code = errBody.code as string
      if (isWarmupFetchEndpoint(method, path)) warmupState = recordWarmupError(serverId, errBody)
      if (isStartSession) {
        clientLog.info('startSession', 'start response error body', {
          status: response.status,
          detail,
          code,
          errBody,
        })
      }
    } catch {}
    // Soft resume-collision: surface the structured payload as a typed error so
    // the caller can name what was detected and offer a force-override retry.
    if (response.status === 409 && code === 'CONVERSATION_BUSY') {
      throw new ConversationBusyError(detail || 'Conversation is busy', errBody ?? {})
    }
    throw new NetworkError(detail || `Server returned ${response.status}`, code, warmupState)
  }

  if (traced) traceMark('response', `HTTP ${response.status}`)
  const json = (await response.json()) as T
  if (traced) traceMark('parsed')
  if (isWarmupFetchEndpoint(method, path)) {
    useServerFetchStatusStore.getState().recordReady(serverId)
  }
  if (isStartSession) {
    const keys = json && typeof json === 'object' ? Object.keys(json as object) : []
    clientLog.info('startSession', 'start response body', {
      method,
      path,
      serverId,
      status: response.status,
      elapsedMs: Date.now() - t0,
      keys,
      body: json,
    })
  }
  return json
}

// Hard-stops a running PTY session via POST /api/sessions/:id/stop. The server
// streams ndjson progress (`stopping` then `stopped`/`timeout`) for a live kill,
// or returns plain JSON `{ status: "already_idle" }` if it was already stopped.
// Uses a direct fetch rather than request<T>() because that helper parses the
// body as JSON and throws on the ndjson stream. WS `session_update` drives the
// status to idle afterwards — callers should not set status locally.
export async function stopSession(
  serverId: string,
  sessionId: string,
): Promise<'stopped' | 'timeout' | 'already_idle'> {
  const server = useServersStore.getState().getServer(serverId)
  if (!server) throw new NetworkError(`Unknown server: ${serverId}`)

  const url = `${server.url.replace(/\/$/, '')}/api/sessions/${encodeURIComponent(sessionId)}/stop`
  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken(server)}`,
      },
    })
  } catch (err) {
    throw new NetworkError(`Failed to reach ${url}: ${String(err)}`)
  }

  if (response.status === 404) throw new SessionNotFoundError(sessionId)
  if (response.status === 401) throw new AuthError()
  if (!response.ok) throw new NetworkError(`stop failed: ${response.status}`)

  const text = await response.text()

  if (response.headers.get('content-type')?.includes('application/json')) {
    const body = JSON.parse(text) as { status?: string }
    if (body.status === 'already_idle') return 'already_idle'
  }

  const last = text.trim().split('\n').filter(Boolean).at(-1)
  if (!last) return 'stopped'
  const event = JSON.parse(last) as { event?: string }
  return event.event === 'timeout' ? 'timeout' : 'stopped'
}

// Conditional GET that surfaces the response status + ETag to the caller.
// Used for the conversation-detail freshness check: send `If-None-Match` and
// short-circuit on `304 Not Modified` (empty body) so the cached copy is kept.
// Unlike request<T>(), a 304 is NOT an error — it returns { status: 304,
// body: null }. Degrades gracefully against servers that don't emit ETag:
// `etag` is simply null and callers send no `If-None-Match` next time.
async function requestWithMeta<T>(
  path: string,
  serverId: string,
  options: RequestOptions = {},
  retried = false,
): Promise<{ status: number; etag: string | null; body: T | null }> {
  const server = useServersStore.getState().getServer(serverId)
  if (!server) throw new NetworkError(`Unknown server: ${serverId}`)

  const url = `${server.url.replace(/\/$/, '')}${path}`

  const timeoutController = new AbortController()
  const timeoutMs = retried ? REQUEST_TIMEOUT_MS : FIRST_ATTEMPT_TIMEOUT_MS
  const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs)
  const onCallerAbort = () => timeoutController.abort()
  if (options.signal) {
    if (options.signal.aborted) timeoutController.abort()
    else options.signal.addEventListener('abort', onCallerAbort)
  }

  let response: Response
  const traced = isConversationDetail(path)
  if (traced) traceMark('request', `${path.split('?')[1] ?? 'no query params'}`)
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken(server)}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers,
      },
      signal: timeoutController.signal,
    })
  } catch (err) {
    if (options.signal?.aborted) {
      throw new NetworkError('Request cancelled')
    }
    if (!retried) {
      return requestWithMeta<T>(path, serverId, options, true)
    }
    throw new NetworkError(`Failed to reach ${url}: ${String(err)}`)
  } finally {
    clearTimeout(timeoutId)
    options.signal?.removeEventListener('abort', onCallerAbort)
  }

  const etag = response.headers.get('etag')

  // 304: the cached copy is current. fetch() resolves (does not throw); the
  // body is empty, so don't call response.json().
  if (response.status === 304) {
    useServerFetchStatusStore.getState().recordReady(serverId)
    if (traced) {
      traceMark('response', 'HTTP 304')
      traceMark('parsed', 'no body — cached page reused')
    }
    return { status: 304, etag, body: null }
  }

  if (response.status === 401) throw new AuthError()
  if (response.status === 404) throw new NotFoundError(path)
  if (!response.ok) {
    let detail = ''
    let code: string | undefined
    let warmupState: ServerWarmupState | undefined
    try {
      const errBody = await response.json()
      if (errBody?.error) detail = errBody.error
      if (errBody?.code) code = errBody.code
      warmupState = recordWarmupError(serverId, errBody)
    } catch {}
    throw new NetworkError(detail || `Server returned ${response.status}`, code, warmupState)
  }

  useServerFetchStatusStore.getState().recordReady(serverId)
  if (traced) traceMark('response', `HTTP ${response.status}`)
  const parsed = (await response.json()) as T
  if (traced) traceMark('parsed')
  return { status: response.status, etag, body: parsed }
}

export interface RequestOptions {
  signal?: AbortSignal
  /** Extra request headers, e.g. `If-None-Match` for conditional GETs. */
  headers?: Record<string, string>
  /**
   * Per-request timeout override (ms) for slow endpoints. When set it replaces
   * both the first-attempt and retry timeouts. Defaults to the shared
   * FIRST_ATTEMPT_TIMEOUT_MS / REQUEST_TIMEOUT_MS otherwise.
   */
  timeoutMs?: number
  /**
   * Set false to disable the automatic retry-once-on-network-failure behavior.
   * Required for non-idempotent requests (session start/resume) — a retry
   * after a timeout would spawn a second PTY server-side.
   */
  retry?: boolean
}

export interface ResponseWithMeta<T> {
  status: number
  etag: string | null
  body: T | null
}

export type ResolveCacheAlertResult =
  | { ok: true; action: CacheAlertResolveAction; pruned?: number; backupPath?: string }
  | { ok: true; alreadyResolved: true }
  | { ok: false; conflict: true; currentFingerprint: string }

// GET /api/cache/alert. A 404 means the server predates this feature — treat
// as "no alert" rather than an error (see cache-integrity-alert contract).
export async function getCacheAlert(serverId: string): Promise<CacheAlert | null> {
  try {
    const api = createApiForServer(serverId)
    const { pending } = await api.get<{ pending: CacheAlert | null }>('/api/cache/alert')
    return pending
  } catch (e) {
    if (e instanceof NotFoundError) return null
    throw e
  }
}

// GET /api/config/claude-flags. A 404 means the server predates this feature —
// return null so the UI hides the section entirely rather than erroring (same
// contract as getCacheAlert above).
export async function getClaudeFlags(serverId: string): Promise<ClaudeFlagsConfig | null> {
  try {
    const api = createApiForServer(serverId)
    return await api.get<ClaudeFlagsConfig>('/api/config/claude-flags')
  } catch (e) {
    if (e instanceof NotFoundError) return null
    throw e
  }
}

// GET /api/config/feature-flags. Read-only — the streamer resolves these at
// boot and ships no PUT. A 404 means the server predates feature flags; null
// lets the caller decide what a silent server implies rather than guessing here.
export async function getFeatureFlags(serverId: string): Promise<FeatureFlagsConfig | null> {
  try {
    const api = createApiForServer(serverId)
    return await api.get<FeatureFlagsConfig>('/api/config/feature-flags')
  } catch (e) {
    if (e instanceof NotFoundError) return null
    throw e
  }
}

// PUT /api/config/claude-flags. Full replace, not a patch: the server has no
// per-key delete semantics, so the client always sends the complete set.
export async function updateClaudeFlags(
  serverId: string,
  values: ClaudeFlagValues,
  extraArgs?: string,
): Promise<ClaudeFlagsConfig> {
  const api = createApiForServer(serverId)
  return await api.put<ClaudeFlagsConfig>('/api/config/claude-flags', {
    values,
    ...(extraArgs ? { extraArgs } : {}),
  })
}

// POST /api/cache/alert/resolve. Uses a direct fetch rather than request<T>()
// because a 409 fingerprint_mismatch is an expected outcome (not an error) and
// request<T>() only surfaces non-ok responses by throwing NetworkError.
export async function resolveCacheAlert(
  serverId: string,
  body: { fingerprint: string; action: CacheAlertResolveAction; ids?: string[] },
): Promise<ResolveCacheAlertResult> {
  const server = useServersStore.getState().getServer(serverId)
  if (!server) throw new NetworkError(`Unknown server: ${serverId}`)

  const url = `${server.url.replace(/\/$/, '')}/api/cache/alert/resolve`
  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken(server)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
  } catch (err) {
    throw new NetworkError(`Failed to reach ${url}: ${String(err)}`)
  }

  if (response.status === 401) throw new AuthError()
  if (response.status === 409) {
    const { currentFingerprint } = await response.json() as { currentFingerprint: string }
    return { ok: false, conflict: true, currentFingerprint }
  }
  if (!response.ok) throw new NetworkError(`resolve failed: ${response.status}`)

  return await response.json() as ResolveCacheAlertResult
}

export interface ServerApi {
  get: <T>(path: string, options?: RequestOptions) => Promise<T>
  /** Conditional GET exposing status + ETag; `body` is null on 304. */
  getWithMeta: <T>(path: string, options?: RequestOptions) => Promise<ResponseWithMeta<T>>
  /** HTTP QUERY (RFC 10008) — safe/idempotent/cacheable like GET, JSON body like POST. */
  query: <T>(path: string, body: unknown, options?: RequestOptions) => Promise<T>
  post: <T>(path: string, body?: unknown, options?: RequestOptions) => Promise<T>
  /** Full replace. Used by the server-config endpoints, which have no per-key delete. */
  put: <T>(path: string, body?: unknown, options?: RequestOptions) => Promise<T>
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) => Promise<T>
  delete: <T>(path: string, options?: RequestOptions) => Promise<T>
}

export function createApiForServer(serverId: string): ServerApi {
  return {
    get: <T>(path: string, options?: RequestOptions) => request<T>('GET', path, undefined, serverId, options),
    getWithMeta: <T>(path: string, options?: RequestOptions) => requestWithMeta<T>(path, serverId, options),
    query: <T>(path: string, body: unknown, options?: RequestOptions) => request<T>('QUERY', path, body, serverId, options),
    post: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>('POST', path, body, serverId, options),
    put: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>('PUT', path, body, serverId, options),
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
  getWithMeta: <T>(path: string, options?: RequestOptions) => {
    const first = useServersStore.getState().activeServerIds[0]
    return first ? requestWithMeta<T>(path, first, options) : Promise.reject(new NetworkError('No servers configured'))
  },
  query: <T>(path: string, body: unknown, options?: RequestOptions) => {
    const first = useServersStore.getState().activeServerIds[0]
    return first ? request<T>('QUERY', path, body, first, options) : Promise.reject(new NetworkError('No servers configured'))
  },
  post: <T>(path: string, body?: unknown, options?: RequestOptions) => {
    const first = useServersStore.getState().activeServerIds[0]
    return first ? request<T>('POST', path, body, first, options) : Promise.reject(new NetworkError('No servers configured'))
  },
  put: <T>(path: string, body?: unknown, options?: RequestOptions) => {
    const first = useServersStore.getState().activeServerIds[0]
    return first ? request<T>('PUT', path, body, first, options) : Promise.reject(new NetworkError('No servers configured'))
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
