/**
 * Transport contexts on the client: what a completed `POST /api/e2ee/open`
 * handshake leaves behind, and the rules about its lifetime.
 *
 * NONCE-DESIGN §8, §9, §11, §12, at streamer tag `v1.72.0`.
 *
 * **A context is bound to one channel instance, not to the device.** A socket
 * context lives exactly as long as its socket and a reconnect opens a new one;
 * there is no grace window and no reuse. A device-wide context shared with REST
 * would sequence-violate itself into a close loop, because frames in flight when
 * a socket drops are lost and §5 R2 turns the next frame into a gap.
 *
 * **Nothing here is ever persisted.** No key, no `ctxId`, no counter, no ticket
 * reaches SecureStore or AsyncStorage. After an app kill the client opens a
 * fresh context; a resumed counter is a nonce repeat.
 */
import naclUtil from 'tweetnacl-util'
import { E2EE_CLIENT_VERSION } from '@/types/api'
import { createOpenInitiator, openMessage1Payload, type OpenContextKind } from '@/services/e2ee/pair-handshake'
import {
  CHANNEL_REST_REQUEST,
  CHANNEL_REST_RESPONSE,
  CHANNEL_WEBSOCKET,
  CTX_ID_BYTES,
  DIRECTION_CLIENT_TO_SERVER,
  DIRECTION_SERVER_TO_CLIENT,
  RecordState,
  createRecordState,
} from '@/services/e2ee/record'

/**
 * The `/open` request gets its own timeout, separate from the socket's connect
 * timeout (review M5). A handshake that never answers must not hold the
 * generation-guarded sequence open indefinitely — the reconnect backoff is what
 * should be driving retries.
 */
export const OPEN_TIMEOUT_MS = 10_000

/**
 * §12: the ticket is base64url, unpadded, 22 characters. A single-use credential
 * with a 30 s TTL, bound to its `ctxId`.
 */
export const TICKET_CHARS = 22

/** The header the ticket travels in. **Never a URL parameter** (§10, review M12). */
export const TICKET_HEADER = 'X-TB-Ticket'

/**
 * §9's four codes, plus the outer refusals `/open` itself can answer.
 *
 * The four are frozen at W1a's tag and consumed by both repositories; nothing
 * renames them without a coordinated change in both.
 */
export type OpenErrorCode =
  /** Recoverable: one transparent re-handshake, then retry. */
  | 'E2EE_CTX_UNKNOWN'
  /** Hard failure. Surface it. **Never** retry. */
  | 'E2EE_DEVICE_REVOKED'
  | 'E2EE_SEQUENCE_VIOLATION'
  | 'E2EE_SEAL_FAILED'
  /** This server does not offer E2EE at all. */
  | 'E2EE_DISABLED'
  | 'E2EE_HANDSHAKE_FAILED'
  | 'E2EE_MALFORMED'
  | 'E2EE_VERSION_UNSUPPORTED'
  /** Transient: retry with backoff. Never the re-auth path, never a pin change. */
  | 'E2EE_TRANSIENT'
  /** This device holds no static key for this server. */
  | 'E2EE_NOT_PAIRED'

export class OpenError extends Error {
  readonly code: OpenErrorCode
  /** `true` for exactly the codes a client may retry. */
  readonly retryable: boolean

  constructor(code: OpenErrorCode, message: string) {
    super(message)
    this.name = 'OpenError'
    this.code = code
    this.retryable = code === 'E2EE_CTX_UNKNOWN' || code === 'E2EE_TRANSIENT'
  }
}

/**
 * A live transport context.
 *
 * The two record states are the only way to reach the traffic keys, and neither
 * exposes them. `send` and `recv` own their counters; nothing outside can set one.
 */
export interface TransportContext {
  /** base64url, unpadded, 22 characters — the same spelling everywhere (§12). */
  readonly ctxId: string
  readonly kind: OpenContextKind
  /** Milliseconds since the epoch. While `provisional`, this is the use-by deadline. */
  readonly expiresAt: number
  /**
   * §8: a context is provisional until its first authenticated use, and a
   * provisional one dies at the 30 s ticket TTL. While `true`, `expiresAt` is
   * NOT a session lifetime.
   */
  readonly provisional: boolean
  /** Present only for `kind: 'ws'`. Absent for REST — not null (§11). */
  readonly ticket?: string
  readonly send: RecordState
  readonly recv: RecordState
  destroy(): void
}

function decodeBase64Url(value: string, label: string): Uint8Array {
  const standard = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = standard + '='.repeat((4 - (standard.length % 4)) % 4)
  try {
    return naclUtil.decodeBase64(padded)
  } catch {
    throw new OpenError('E2EE_MALFORMED', `E2EE: ${label} is not valid base64url`)
  }
}

/**
 * Reads the msg2 payload.
 *
 * `provisional` is read with `Object.hasOwn` and an absent value is treated as
 * `false`. NONCE-DESIGN §11 and §12 both say the field is always present, and
 * the streamer does send it — but the committed `/open` interop vector at
 * v1.72.0 omits it, so requiring it would reject the tagged fixture. Reported
 * upstream as a fixture/spec contradiction; tolerating absence costs nothing
 * and is the fail-safe direction (an unknown provisional state is treated as
 * the *shorter* deadline only insofar as callers never extend it themselves).
 *
 * Every field is read off the parsed object with `Object.hasOwn`, never with
 * `??`: this payload came off the wire, and a `??` read walks the prototype
 * chain, so a polluted `Object.prototype.ticket` would supply a ticket the
 * server never issued.
 */
export function parseOpenMessage2(
  payloadUtf8: string,
  kind: OpenContextKind,
): { ctxId: string; ctxIdRaw: Uint8Array; expiresAt: number; provisional: boolean; ticket?: string } {
  let parsed: unknown
  try {
    parsed = JSON.parse(payloadUtf8)
  } catch {
    throw new OpenError('E2EE_MALFORMED', 'E2EE: the open response payload is not JSON')
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new OpenError('E2EE_MALFORMED', 'E2EE: the open response payload must be an object')
  }
  const own = <T>(key: string): T | undefined =>
    Object.hasOwn(parsed as object, key) ? ((parsed as Record<string, unknown>)[key] as T) : undefined

  const v = own<number>('v')
  if (v !== E2EE_CLIENT_VERSION) {
    throw new OpenError('E2EE_VERSION_UNSUPPORTED', `E2EE: the server answered protocol version ${String(v)}`)
  }

  const ctxId = own<string>('ctxId')
  if (typeof ctxId !== 'string' || ctxId.length === 0) {
    throw new OpenError('E2EE_MALFORMED', 'E2EE: the open response carried no ctxId')
  }
  // §12: server-assigned, 16 random bytes, NEVER derived by the client. A client
  // that derived it would hold a second source of truth to disagree with.
  const ctxIdRaw = decodeBase64Url(ctxId, 'ctxId')
  if (ctxIdRaw.length !== CTX_ID_BYTES) {
    throw new OpenError('E2EE_MALFORMED', `E2EE: ctxId must decode to ${CTX_ID_BYTES} bytes`)
  }

  const expiresAtRaw = own<number>('expiresAt')
  if (typeof expiresAtRaw !== 'number' || !Number.isFinite(expiresAtRaw)) {
    throw new OpenError('E2EE_MALFORMED', 'E2EE: the open response carried no usable expiresAt')
  }

  const provisionalRaw = own<unknown>('provisional')
  const provisional = provisionalRaw === undefined ? false : provisionalRaw === true

  const ticket = own<unknown>('ticket')
  if (kind === 'ws') {
    if (typeof ticket !== 'string' || ticket.length !== TICKET_CHARS) {
      // Fail closed: a socket open without a usable ticket is a failed open,
      // never a socket we go on to connect in the clear.
      throw new OpenError('E2EE_MALFORMED', 'E2EE: the open response carried no usable ticket')
    }
    return { ctxId, ctxIdRaw, expiresAt: expiresAtRaw, provisional, ticket }
  }
  // §11: `ticket` is ABSENT for a REST context, not null. A ticket nobody can
  // spend would be a credential minted for no reason.
  if (ticket !== undefined) {
    throw new OpenError('E2EE_MALFORMED', 'E2EE: a REST context must not be issued a ticket')
  }
  return { ctxId, ctxIdRaw, expiresAt: expiresAtRaw, provisional }
}

/** Maps an `/open` HTTP refusal onto the client's contract. */
export function mapOpenFailure(status: number, code: unknown): OpenError {
  const named = typeof code === 'string' ? code : ''
  if (named === 'E2EE_DEVICE_REVOKED' || status === 403) {
    return new OpenError('E2EE_DEVICE_REVOKED', 'This device is not paired for encryption')
  }
  if (named === 'E2EE_DISABLED' || status === 404) {
    return new OpenError('E2EE_DISABLED', 'This server does not offer encryption')
  }
  if (named === 'E2EE_VERSION_UNSUPPORTED') {
    return new OpenError('E2EE_VERSION_UNSUPPORTED', 'This server speaks a different E2EE version')
  }
  if (named === 'E2EE_HANDSHAKE_FAILED') {
    return new OpenError('E2EE_HANDSHAKE_FAILED', 'The encryption handshake failed')
  }
  if (named === 'E2EE_MALFORMED') {
    return new OpenError('E2EE_MALFORMED', 'The server refused the handshake request')
  }
  // 429 and 5xx are transient. Retry with backoff — never the re-auth path,
  // never a pin change. A sealed 503 STORE_UNAVAILABLE lands here too.
  if (status === 429 || status >= 500) {
    return new OpenError('E2EE_TRANSIENT', 'The server is busy; retrying shortly')
  }
  return new OpenError('E2EE_HANDSHAKE_FAILED', `The encryption handshake failed (${status})`)
}

export interface OpenContextArgs {
  serverId: string
  /** The server's base URL, e.g. `https://host:port`. */
  baseUrl: string
  /** The pinned server static key, base64url, from the server record. */
  serverPublicKey: string
  kind: OpenContextKind
  /** Test seam. Production uses the global `fetch`. */
  fetchImpl?: typeof fetch
  /** Test seam, forwarded to the Noise initiator. */
  ephemeralPrivate?: Uint8Array
}

function contextFor(
  kind: OpenContextKind,
  ctxId: string,
  ctxIdRaw: Uint8Array,
  expiresAt: number,
  provisional: boolean,
  ticket: string | undefined,
  clientToServerKey: Uint8Array,
  serverToClientKey: Uint8Array,
): TransportContext {
  // REST send is the request channel; REST receive is the response channel.
  // A websocket context uses 0x01 both ways. Mixing them is a seal failure
  // on the first frame, which is why this split is its own mutation row.
  const sendChannel = kind === 'rest' ? CHANNEL_REST_REQUEST : CHANNEL_WEBSOCKET
  const recvChannel = kind === 'rest' ? CHANNEL_REST_RESPONSE : CHANNEL_WEBSOCKET
  const send = createRecordState({
    key: clientToServerKey,
    ctxId: ctxIdRaw,
    direction: DIRECTION_CLIENT_TO_SERVER,
    channel: sendChannel,
  })
  const recv = createRecordState({
    key: serverToClientKey,
    ctxId: ctxIdRaw,
    direction: DIRECTION_SERVER_TO_CLIENT,
    channel: recvChannel,
  })
  // The handshake's copies are wiped now that the record states hold their own.
  clientToServerKey.fill(0)
  serverToClientKey.fill(0)

  let destroyed = false
  return {
    ctxId,
    kind,
    expiresAt,
    provisional,
    ...(ticket === undefined ? {} : { ticket }),
    send,
    recv,
    destroy() {
      if (destroyed) return
      destroyed = true
      send.destroy()
      recv.destroy()
    },
  }
}

/**
 * Runs one `/open` handshake and returns the context it leaves behind.
 *
 * **Every attempt runs `writeMessage1` afresh, with a new ephemeral.** A retry
 * after a lost response, a timeout or a `429` must NOT re-send the same bytes:
 * the server keeps a replay cache keyed on the cleartext ephemeral and refuses a
 * repeated one as `E2EE_HANDSHAKE_FAILED` for the life of the entry, so
 * re-sending is a permanent refusal rather than a retry. Because this function
 * builds its initiator internally, a caller cannot get that wrong.
 */
export async function openContext(args: OpenContextArgs): Promise<TransportContext> {
  const start = await createOpenInitiator({
    serverId: args.serverId,
    serverPublicKey: args.serverPublicKey,
    ...(args.ephemeralPrivate ? { ephemeralPrivate: args.ephemeralPrivate } : {}),
  })
  if (!start.ok) {
    throw new OpenError('E2EE_NOT_PAIRED', 'This device holds no encryption key for this server')
  }

  const message1 = start.handshake.writeMessage1(
    naclUtil.decodeUTF8(openMessage1Payload(args.kind)),
  )

  const doFetch = args.fetchImpl ?? fetch
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), OPEN_TIMEOUT_MS)
  let response: Response
  try {
    response = await doFetch(`${args.baseUrl.replace(/\/$/, '')}/api/e2ee/open`, {
      method: 'POST',
      // No `Authorization`. `/open` is public and the handshake IS the
      // authentication — a bearer here would be a credential in the clear on a
      // request whose whole purpose is to stop that.
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        e2ee: { v: E2EE_CLIENT_VERSION, noise: naclUtil.encodeBase64(message1) },
      }),
      signal: controller.signal,
    })
  } catch {
    throw new OpenError('E2EE_TRANSIENT', 'Could not reach the server to open an encrypted context')
  } finally {
    clearTimeout(timer)
  }

  if (!response.ok) {
    let code: unknown
    try {
      code = ((await response.json()) as { code?: unknown }).code
    } catch {
      code = undefined
    }
    throw mapOpenFailure(response.status, code)
  }

  let body: unknown
  try {
    body = await response.json()
  } catch {
    throw new OpenError('E2EE_MALFORMED', 'E2EE: the open response was not JSON')
  }
  const envelope =
    typeof body === 'object' && body !== null && Object.hasOwn(body, 'e2ee')
      ? (body as { e2ee?: { v?: unknown; noise?: unknown } }).e2ee
      : undefined
  if (!envelope || typeof envelope.noise !== 'string') {
    // §"Fail closed at the trust boundary": after msg1, a missing msg2 is a
    // FAILED pairing, never a plaintext success.
    throw new OpenError('E2EE_MALFORMED', 'E2EE: the server answered without an encrypted handshake')
  }

  let result: ReturnType<typeof start.handshake.readMessage2>
  try {
    result = start.handshake.readMessage2(naclUtil.decodeBase64(envelope.noise))
  } catch {
    throw new OpenError('E2EE_HANDSHAKE_FAILED', 'The server could not be authenticated')
  }

  const msg2 = parseOpenMessage2(
    naclUtil.encodeUTF8 ? naclUtil.encodeUTF8(result.payload) : String(result.payload),
    args.kind,
  )

  return contextFor(
    args.kind,
    msg2.ctxId,
    msg2.ctxIdRaw,
    msg2.expiresAt,
    msg2.provisional,
    msg2.ticket,
    result.clientToServerKey,
    result.serverToClientKey,
  )
}

/**
 * In-flight `/open` calls, keyed by server and kind.
 *
 * **Single-flight, per review M5 and §8's re-open storm rule.** `forceReconnect`
 * fires on every foreground resume and on the 45 s silence timer, and after a
 * streamer restart every pinned device re-opens at once — two concurrent
 * requests must not become two handshakes. Two handshakes means two contexts,
 * one of which is orphaned and counts against the per-device cap.
 *
 * A module-level map is deliberate and is NOT shared mutable context state: it
 * holds promises for an in-flight *request*, never a counter or a key. Two
 * `WSClient` instances that race an open share the handshake and then each get
 * their own context object from it — see the note in `openContextOnce`.
 */
const inFlight = new Map<string, Promise<TransportContext>>()

/**
 * Single-flighted `openContext`.
 *
 * **A socket context is never shared between two callers.** Sharing the
 * *promise* is safe only because each waiter needs its own context: two
 * `WSClient` instances holding one context would share one mutable counter,
 * which is the program's "two writers" stop-work trigger. So the winner keeps
 * the context and every other waiter is told to open its own — de-duplicating
 * the storm without ever handing one counter to two writers.
 */
export async function openContextOnce(args: OpenContextArgs): Promise<TransportContext> {
  const key = `${args.serverId}:${args.kind}`
  const existing = inFlight.get(key)
  if (existing) {
    // Wait for the in-flight handshake to settle, then run our own. This
    // collapses a burst into a sequence rather than into a shared counter.
    try {
      await existing
    } catch {
      // The in-flight attempt's failure is not ours to report.
    }
  }
  const attempt = openContext(args)
  inFlight.set(key, attempt)
  try {
    return await attempt
  } finally {
    if (inFlight.get(key) === attempt) inFlight.delete(key)
  }
}

/** Test helper: asserts no handshake is being held open between tests. */
export function _inFlightCount(): number {
  return inFlight.size
}
