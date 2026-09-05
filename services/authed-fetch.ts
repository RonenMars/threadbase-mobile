import type { ServerConfig, ServerInfo } from '@/types/api'
import { CleartextBlockedError, isCleartextAllowed } from '@/services/cleartext-policy'
import naclUtil from 'tweetnacl-util'
import { OpenError } from '@/services/e2ee/context'
import { RecordError, recordCounter, restTargetHash } from '@/services/e2ee/record'
import {
  acquireRestContext,
  invalidateRestContext,
  noteRestBytes,
} from '@/services/e2ee/rest-session'

/** Which credential a request presented. See `selectCredential`. */
export type CredentialKind = 'device' | 'shared'

/**
 * The server refused the credential this request presented.
 *
 * `credential` is on the error because the remedy differs by kind and nothing
 * downstream can work it out: by the time this reaches a screen, the choice
 * `selectCredential` made is gone. A refused device token means this device was
 * revoked or the registry lost it, and the fix is to pair again — editing the
 * API key field changes nothing, because a `devicesDurable` server will keep
 * being sent the device token whatever is typed there. A refused shared key
 * means the key changed, and editing it is exactly the fix.
 *
 * The message is an English diagnostic for logs. User-facing wording is the
 * render site's job, keyed off the class and this field — `services/` imports
 * no i18n, and translating one of its ten error classes would leave a reader
 * unable to tell which service messages are safe to show.
 *
 * `path` names the route that was refused, which is what makes a 401 in a log
 * actionable. It is the route only: the query string is dropped because it
 * carries search terms and ids that `services/sanitize.ts` keeps out of every
 * outbound payload, and the credential never appears here at all — it travels
 * in the `Authorization` header, which this class never sees.
 */
export class AuthError extends Error {
  readonly credential: CredentialKind
  readonly path: string

  constructor(credential: CredentialKind, path: string) {
    const route = path.replace(/\?.*$/, '')
    super(
      credential === 'device'
        ? `Unauthorized — the server rejected this device for ${route}. Pair the device again.`
        : `Unauthorized — the server rejected the API key for ${route}.`,
    )
    this.name = 'AuthError'
    this.credential = credential
    this.path = route
  }
}

/**
 * Everything `authedFetch` needs to address a streamer and present a credential.
 * Deliberately looser than `ServerConfig` so callers that hold only a URL and a
 * key — a pre-pairing credential check, the dev-server client-log target — go
 * through the same path as a stored server rather than a bespoke variant.
 *
 * Structural, so it has no identity: two `{ url, apiKey }` literals for the same
 * server are different objects. Per-connection crypto state must therefore be
 * keyed off a stable server id, never off the target — keying a sequence counter
 * off this would silently produce two counters where one is required, and nonce
 * reuse is the one invariant that has to be assertable rather than improbable.
 */
export interface AuthedTarget {
  url: string
  apiKey: string
  deviceToken?: string
  serverInfo?: ServerInfo | null
  /** Stable store id. Required to seal: crypto state keys off this, never the URL. */
  id?: string
  serverPublicKey?: string
  requireEncryption?: boolean
}

export interface AuthedFetchInit extends Omit<RequestInit, 'headers'> {
  headers?: Record<string, string>
}

// eslint-disable-next-line i18next/no-literal-string -- protocol header name, never rendered
export const HEADER_E2EE = 'X-TB-E2EE'
export const HEADER_CTX = 'X-TB-Ctx'
export const HEADER_SEQ = 'X-TB-Seq'
export const HEADER_ENV = 'X-TB-Env'
// eslint-disable-next-line i18next/no-literal-string -- HTTP header name, never rendered
const HEADER_AUTHORIZATION = 'Authorization'
// eslint-disable-next-line i18next/no-literal-string -- HTTP header name, never rendered
const HEADER_CONTENT_TYPE = 'Content-Type'

/** Encoded-length ceiling on `X-TB-Env`, matching the streamer's bound. */
const MAX_ENVELOPE_HEADER_CHARS = 1024

/**
 * A sealed-transport failure. Distinct from `AuthError`: H2 forbids treating an
 * unsealed 401 on a request we sealed as a credential rejection.
 */
export class EnvelopeError extends Error {
  readonly code: string
  readonly retryable: boolean
  readonly path: string

  constructor(code: string, message: string, path: string, retryable: boolean) {
    super(message)
    this.name = 'EnvelopeError'
    this.code = code
    this.path = path.replace(/\?.*$/, '')
    this.retryable = retryable
  }
}

/** The absolute URL a request to `path` will hit. Exported for error messages. */
export function serverUrl(target: Pick<AuthedTarget, 'url'>, path: string): string {
  return `${target.url.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`
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
export function selectCredential(
  target: Pick<ServerConfig, 'apiKey' | 'deviceToken' | 'serverInfo'> | AuthedTarget,
): { token: string; kind: CredentialKind } {
  return target.serverInfo?.devicesDurable && target.deviceToken
    ? { token: target.deviceToken, kind: 'device' }
    : { token: target.apiKey, kind: 'shared' }
}

/**
 * The token alone, for the WebSocket — it puts the credential in the URL rather
 * than a header and has no 401 to attribute, so it needs no kind.
 */
export function authToken(
  target: Pick<ServerConfig, 'apiKey' | 'deviceToken' | 'serverInfo'> | AuthedTarget,
): string {
  return selectCredential(target).token
}

/**
 * The one place an authenticated request to a streamer is constructed: base-URL
 * join, credential selection, and 401 translation. Callers own timeouts,
 * retries, and every other status code.
 *
 * Callers that wrap the call in a try/catch for network failures must rethrow
 * `AuthError` — a rejected credential is not a network failure, and retrying it
 * only presents the same rejected key again. The same holds for
 * `CleartextBlockedError`: the request never left the process, and every retry
 * of the same URL is refused at the same line. The same holds for
 * `EnvelopeError`: a sealed-transport failure is not a rejected credential.
 */
export async function authedFetch(
  target: AuthedTarget,
  path: string,
  init: AuthedFetchInit = {},
): Promise<Response> {
  const url = serverUrl(target, path)
  if (!isCleartextAllowed(url)) throw new CleartextBlockedError(url)
  if (isPinned(target)) return sealedFetch(target, path, url, init, false)
  return plaintextFetch(target, path, url, init)
}

function isPinned(target: AuthedTarget): boolean {
  return target.requireEncryption === true && !!target.serverPublicKey && !!target.id
}

async function plaintextFetch(
  target: AuthedTarget,
  path: string,
  url: string,
  init: AuthedFetchInit,
): Promise<Response> {
  const credential = selectCredential(target)
  const response = await fetch(url, {
    ...init,
    headers: {
      // Caller headers first: an `Authorization` among them loses to the one
      // chosen here. A module that owns credential selection cannot let a
      // caller quietly opt out of it — the request would still succeed.
      ...init.headers,
      Authorization: `Bearer ${credential.token}`,
    },
  })
  if (response.status === 401) throw new AuthError(credential.kind, path)
  return response
}

function isForbiddenSealedHeader(name: string): boolean {
  const lower = name.toLowerCase()
  // Fetch header names are case-insensitive. A caller `AUTHORIZATION` or
  // `x-tb-env` is the same header as the canonical spelling, and deleting
  // only the two mixed-case keys leaves the credential or a second envelope
  // carrier on the object `fetch` actually sends.
  if (lower === HEADER_AUTHORIZATION.toLowerCase()) return true
  if (lower === HEADER_E2EE.toLowerCase()) return true
  if (lower === HEADER_CTX.toLowerCase()) return true
  if (lower === HEADER_SEQ.toLowerCase()) return true
  if (lower === HEADER_ENV.toLowerCase()) return true
  if (lower === HEADER_CONTENT_TYPE.toLowerCase()) return true
  return false
}

function copySealedCallerHeaders(init: AuthedFetchInit): Record<string, string> {
  const headers: Record<string, string> = {}
  for (const [key, value] of Object.entries(init.headers ?? {})) {
    if (isForbiddenSealedHeader(key)) continue
    headers[key] = value
  }
  return headers
}

function splitPathQuery(path: string): { pathname: string; query: string } {
  const q = path.indexOf('?')
  const raw = q === -1 ? path : path.slice(0, q)
  const pathname = raw.startsWith('/') ? raw : `/${raw}`
  return { pathname, query: q === -1 ? '' : path.slice(q + 1) }
}

function requestMethod(init: AuthedFetchInit): string {
  return (init.method ?? 'GET').toUpperCase()
}

function canCarryRequestBody(method: string): boolean {
  return method !== 'GET' && method !== 'HEAD'
}

function encodeBase64Url(bytes: Uint8Array): string {
  return naclUtil.encodeBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function decodeBase64Url(value: string): Uint8Array {
  const standard = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = standard + '='.repeat((4 - (standard.length % 4)) % 4)
  return naclUtil.decodeBase64(padded)
}

function bodyToBytes(body: AuthedFetchInit['body']): Uint8Array {
  if (body == null) return new Uint8Array(0)
  if (typeof body === 'string') return new TextEncoder().encode(body)
  if (body instanceof Uint8Array) return body
  if (body instanceof ArrayBuffer) return new Uint8Array(body)
  throw new EnvelopeError(
    'E2EE_SEAL_FAILED',
    'E2EE: this request body cannot be sealed',
    '',
    false,
  )
}

/** The UTF-8 text of a JSON body, or null when the body is empty or not JSON. */
function decodeJsonText(plaintext: Uint8Array): string | null {
  if (plaintext.byteLength === 0) return null
  const text = new TextDecoder().decode(plaintext)
  try {
    JSON.parse(text)
    return text
  } catch {
    return null
  }
}

function isSealedResponse(response: Response): boolean {
  return response.headers.get(HEADER_E2EE) === '1' || response.headers.has(HEADER_ENV)
}

function isPlaintextRefusal(status: number): boolean {
  return status === 400 || status === 409 || status === 413 || status === 426
}

async function readErrorCode(response: Response): Promise<string> {
  try {
    const body: { code?: string } = (await response.clone().json()) as { code?: string }
    return typeof body.code === 'string' ? body.code : ''
  } catch {
    return ''
  }
}

function responseFromPlaintext(status: number, plaintext: Uint8Array, source: Response): Response {
  const headers = new Headers()
  source.headers.forEach((value, key) => {
    const lower = key.toLowerCase()
    if (
      lower === 'content-type' ||
      lower === 'content-length' ||
      lower === 'transfer-encoding' ||
      lower === HEADER_E2EE.toLowerCase() ||
      lower === HEADER_ENV.toLowerCase()
    ) {
      return
    }
    headers.set(key, value)
  })
  const jsonText = decodeJsonText(plaintext)
  if (jsonText !== null) {
    // eslint-disable-next-line i18next/no-literal-string -- HTTP header name, never rendered
    headers.set('Content-Type', 'application/json')
  }
  // Hand a JSON body over as a string, never as bytes: React Native's whatwg-fetch
  // reads an ArrayBuffer body with String.fromCharCode per byte (latin-1), which
  // mangles every non-ASCII character. A string body is returned verbatim.
  const body = jsonText ?? (plaintext.byteLength === 0 ? null : (plaintext as BodyInit))
  return new Response(body, {
    status,
    headers,
  })
}

async function sealedFetch(
  target: AuthedTarget,
  path: string,
  url: string,
  init: AuthedFetchInit,
  retriedUnknown: boolean,
): Promise<Response> {
  const serverId = target.id
  const serverPublicKey = target.serverPublicKey
  if (!serverId || !serverPublicKey) {
    throw new EnvelopeError('E2EE_SEAL_FAILED', 'E2EE: a pinned request has no server identity', path, false)
  }

  const method = requestMethod(init)
  const { pathname, query } = splitPathQuery(path)
  const targetHash = restTargetHash(method, pathname, query)
  const plaintext = bodyToBytes(init.body)

  let context
  try {
    context = await acquireRestContext({
      serverId,
      baseUrl: target.url,
      serverPublicKey,
      kind: 'rest',
    })
  } catch (err) {
    if (err instanceof OpenError) {
      throw new EnvelopeError(err.code, err.message, path, err.retryable)
    }
    throw err
  }

  const frame = context.send.seal(plaintext, targetHash)
  const seq = recordCounter(frame)
  noteRestBytes(serverId, frame.byteLength)

  const headers: Record<string, string> = copySealedCallerHeaders(init)
  headers[HEADER_E2EE] = '1'
  headers[HEADER_CTX] = context.ctxId
  headers[HEADER_SEQ] = seq.toString(10)

  let body: BodyInit | undefined
  if (canCarryRequestBody(method)) {
    delete headers[HEADER_ENV]
    body = frame as BodyInit
    headers['Content-Type'] = 'application/octet-stream'
  } else {
    delete headers['Content-Type']
    headers[HEADER_ENV] = encodeBase64Url(frame)
    body = undefined
  }

  const response = await fetch(url, {
    ...init,
    method,
    headers,
    body,
  })

  if (!isSealedResponse(response) && isPlaintextRefusal(response.status)) {
    const code = await readErrorCode(response)
    if (response.status === 409 && code === 'E2EE_CTX_UNKNOWN' && !retriedUnknown) {
      invalidateRestContext(serverId)
      return sealedFetch(target, path, url, init, true)
    }
    throw new EnvelopeError(
      code || 'E2EE_SEAL_FAILED',
      `E2EE: sealed request refused (${response.status})`,
      path,
      false,
    )
  }

  if (!isSealedResponse(response)) {
    throw new EnvelopeError(
      'E2EE_SEAL_FAILED',
      'E2EE: the server answered a sealed request without a sealed response',
      path,
      false,
    )
  }

  let responseFrame: Uint8Array
  const env = response.headers.get(HEADER_ENV)
  if (env !== null) {
    if (env.length > MAX_ENVELOPE_HEADER_CHARS) {
      throw new EnvelopeError('E2EE_SEAL_FAILED', 'E2EE: X-TB-Env is too large', path, false)
    }
    try {
      responseFrame = decodeBase64Url(env)
    } catch {
      throw new EnvelopeError('E2EE_SEAL_FAILED', 'E2EE: X-TB-Env is not valid base64url', path, false)
    }
  } else {
    responseFrame = new Uint8Array(await response.arrayBuffer())
  }

  let opened: Uint8Array
  try {
    opened = context.recv.unsealMatching(responseFrame, seq, targetHash)
  } catch (err) {
    if (err instanceof RecordError) {
      throw new EnvelopeError(err.code, err.message, path, false)
    }
    throw err
  }
  noteRestBytes(serverId, responseFrame.byteLength)

  const unsealed = responseFromPlaintext(response.status, opened, response)
  if (unsealed.status === 503) {
    const code = await readErrorCode(unsealed)
    if (code === 'STORE_UNAVAILABLE') {
      throw new EnvelopeError('E2EE_TRANSIENT', 'The server is busy; retrying shortly', path, true)
    }
  }
  return unsealed
}
