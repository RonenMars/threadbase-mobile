/**
 * The E2EE record layer — the client half of
 * `specs/end-to-end-encryption/NONCE-DESIGN.md` at streamer tag `v1.72.0`
 * (`d7a27ab5d7ec963ae9350b60a99b8d48b0c1b99b`).
 *
 * Written from the specification rather than from the streamer's implementation,
 * so the committed interop vectors compare two independent readings instead of
 * one reading against itself.
 *
 *     nonce[12] = direction(4) || counter(8)                                  big-endian
 *     AAD[30]   = version(1) || ctxId(16) || direction(4) || counter(8) || channel(1)
 *     AAD[62]   = the same 30 bytes || sha256(method || "\n" || path || "\n" || query)
 *     frame     = the 30-byte plaintext header || ciphertext‖tag
 *
 * **The nonce is never random** (§2). A counter makes nonce reuse an invariant a
 * test asserts on rather than a birthday bound argued about in review.
 *
 * **`chachaNonce`/`noiseNonce` from `./noise.ts` must never be reused here**
 * (§14). That one is 4 zero bytes then a **little-endian** counter, per Noise
 * §12.3 — a different layout and the opposite byte order. Two layers, two
 * encodings, both correct for their own specification. Do not unify them.
 */
import { ChaCha20Poly1305 } from '@stablelib/chacha20poly1305'
import { hash as sha256 } from '@stablelib/sha256'

/** `E2EE_PROTOCOL_VERSION`. Minting a third copy of this constant is forbidden (§4). */
export const E2EE_PROTOCOL_VERSION = 1

export const DIRECTION_CLIENT_TO_SERVER = 1
export const DIRECTION_SERVER_TO_CLIENT = 2

export const CHANNEL_WEBSOCKET = 1
export const CHANNEL_REST_REQUEST = 2
export const CHANNEL_REST_RESPONSE = 3

export const CTX_ID_BYTES = 16
export const KEY_BYTES = 32
export const TARGET_HASH_BYTES = 32
export const TAG_BYTES = 16
export const NONCE_BYTES = 12
/** `version(1) || ctxId(16) || direction(4) || counter(8) || channel(1)`. */
export const HEADER_BYTES = 30

/**
 * §7. A sender that would exceed this **refuses to send**; it does not wrap.
 * Unreachable in practice — at D-3's measured ~1.6 MB/s it is on the order of
 * 10^11 years — and asserted precisely so it can never become a silent wrap.
 */
export const MAX_COUNTER = 2n ** 64n - 1n

export type RecordDirection = typeof DIRECTION_CLIENT_TO_SERVER | typeof DIRECTION_SERVER_TO_CLIENT
export type RecordChannel =
  | typeof CHANNEL_WEBSOCKET
  | typeof CHANNEL_REST_REQUEST
  | typeof CHANNEL_REST_RESPONSE

/**
 * §9's four codes, frozen at W1a's tag. X-server and X-client consume them;
 * nothing renames them without a coordinated change in both repositories.
 *
 * `E2EE_SEAL_FAILED` is deliberately distinct from `E2EE_SEQUENCE_VIOLATION`: a
 * seal failure is a fault, a sequence violation is a claim about the peer.
 * Collapsing them was a P1 in the prior program.
 */
export type RecordErrorCode =
  | 'E2EE_SEAL_FAILED'
  | 'E2EE_SEQUENCE_VIOLATION'
  | 'E2EE_COUNTER_EXHAUSTED'

export class RecordError extends Error {
  readonly code: RecordErrorCode

  constructor(code: RecordErrorCode, message: string) {
    super(message)
    this.name = 'RecordError'
    this.code = code
  }
}

/**
 * The one byte-field guard, used for every key, ctxId, ephemeral and target hash.
 *
 * **Never truthiness and never `.length`.** A `Float64Array(32)` has
 * `.length === 32` and passed a `.length` check on the server during W1a's
 * adversary rounds, running a full handshake that bound 256 zero bytes. The
 * `BYTES_PER_ELEMENT` and `byteLength` checks are what actually close that.
 */
export function assertBytes(value: unknown, length: number, label: string): Uint8Array {
  if (!(value instanceof Uint8Array)) {
    throw new RecordError('E2EE_SEAL_FAILED', `E2EE: ${label} must be a Uint8Array`)
  }
  if (value.BYTES_PER_ELEMENT !== 1) {
    throw new RecordError('E2EE_SEAL_FAILED', `E2EE: ${label} must be a byte array`)
  }
  if (value.byteLength !== length) {
    throw new RecordError(
      'E2EE_SEAL_FAILED',
      `E2EE: ${label} must be exactly ${length} bytes, got ${value.byteLength}`,
    )
  }
  return value
}

function assertDirection(direction: number): RecordDirection {
  if (direction !== DIRECTION_CLIENT_TO_SERVER && direction !== DIRECTION_SERVER_TO_CLIENT) {
    throw new RecordError('E2EE_SEAL_FAILED', `E2EE: unknown direction ${direction}`)
  }
  return direction
}

function assertChannel(channel: number): RecordChannel {
  if (channel !== CHANNEL_WEBSOCKET && channel !== CHANNEL_REST_REQUEST && channel !== CHANNEL_REST_RESPONSE) {
    throw new RecordError('E2EE_SEAL_FAILED', `E2EE: unknown channel ${channel}`)
  }
  return channel
}

function assertCounter(counter: bigint): bigint {
  if (typeof counter !== 'bigint') {
    throw new RecordError('E2EE_SEAL_FAILED', 'E2EE: the counter must be a bigint')
  }
  if (counter < 0n) {
    throw new RecordError('E2EE_SEAL_FAILED', 'E2EE: the counter must not be negative')
  }
  if (counter > MAX_COUNTER) {
    throw new RecordError('E2EE_COUNTER_EXHAUSTED', 'E2EE: the record counter is exhausted')
  }
  return counter
}

export interface RecordAadFields {
  ctxId: Uint8Array
  direction: RecordDirection
  counter: bigint
  channel: RecordChannel
  /**
   * `sha256(method || "\n" || path || "\n" || query)`, 32 bytes.
   *
   * Required on the REST channels and forbidden on the socket channel — this
   * function enforces that itself rather than trusting its caller, because a
   * REST record without the target binding is the on-path re-routing attack
   * §4 exists to close.
   */
  target?: Uint8Array
}

function requiresTarget(channel: RecordChannel): boolean {
  return channel === CHANNEL_REST_REQUEST || channel === CHANNEL_REST_RESPONSE
}

/**
 * The authenticated header. On the socket channel it is exactly the 30 bytes
 * that travel in the clear in front of the ciphertext; on the REST channels it
 * gains a 32-byte target suffix that is **not** transmitted.
 */
export function recordAad(fields: RecordAadFields): Uint8Array {
  const ctxId = assertBytes(fields.ctxId, CTX_ID_BYTES, 'ctxId')
  const direction = assertDirection(fields.direction)
  const channel = assertChannel(fields.channel)
  const counter = assertCounter(fields.counter)

  // Read the optional field with `Object.hasOwn` rather than `??`. A `??`
  // default reads through `Object.prototype`, so a polluted prototype supplies
  // a `target` this function would then bind. Tested under pollution.
  const hasTarget = Object.hasOwn(fields, 'target') && fields.target !== undefined

  if (requiresTarget(channel)) {
    if (!hasTarget) {
      throw new RecordError('E2EE_SEAL_FAILED', 'E2EE: a REST channel record must bind a target hash')
    }
  } else if (hasTarget) {
    throw new RecordError('E2EE_SEAL_FAILED', 'E2EE: a socket channel record must not bind a target hash')
  }

  // eslint-disable-next-line i18next/no-literal-string -- internal cryptographic diagnostic, never rendered to the user
  const target = hasTarget ? assertBytes(fields.target, TARGET_HASH_BYTES, 'target hash') : null
  const aad = new Uint8Array(HEADER_BYTES + (target ? TARGET_HASH_BYTES : 0))
  const view = new DataView(aad.buffer, aad.byteOffset, aad.byteLength)

  aad[0] = E2EE_PROTOCOL_VERSION
  aad.set(ctxId, 1)
  view.setUint32(1 + CTX_ID_BYTES, direction, false)
  view.setBigUint64(1 + CTX_ID_BYTES + 4, counter, false)
  aad[1 + CTX_ID_BYTES + 4 + 8] = channel
  if (target) aad.set(target, HEADER_BYTES)

  return aad
}

/** §2: `direction(4) || counter(8)`, big-endian. Never random, never little-endian. */
export function recordNonce(direction: RecordDirection, counter: bigint): Uint8Array {
  const nonce = new Uint8Array(NONCE_BYTES)
  const view = new DataView(nonce.buffer)
  view.setUint32(0, assertDirection(direction), false)
  view.setBigUint64(4, assertCounter(counter), false)
  return nonce
}

/** Offset of the counter in the 30-byte header: version + ctxId + direction. */
const COUNTER_OFFSET = 1 + CTX_ID_BYTES + 4

/**
 * The REST AAD suffix (§4): `sha256(method || "\n" || path || "\n" || query)`.
 *
 * `method` is upper-cased. `path` is the percent-encoded request-target as it
 * will appear on the wire — never decoded. `query` is the raw query string
 * WITHOUT the leading `?`, empty when there is none. The fixture
 * `restTargetCanonicalization.hashInputUtf8` is the authority.
 */
export function restTargetHash(method: string, path: string, query: string): Uint8Array {
  const input = `${method.toUpperCase()}\n${path}\n${query}`
  return sha256(new TextEncoder().encode(input))
}

/** The authenticated counter sitting in a record header. */
export function recordCounter(frame: Uint8Array): bigint {
  if (!(frame instanceof Uint8Array) || frame.byteLength < HEADER_BYTES) {
    throw new RecordError('E2EE_SEAL_FAILED', 'E2EE: the record frame is too short')
  }
  return new DataView(frame.buffer, frame.byteOffset, frame.byteLength).getBigUint64(
    COUNTER_OFFSET,
    false,
  )
}

interface ParsedHeader {
  version: number
  ctxId: Uint8Array
  direction: number
  counter: bigint
  channel: number
}

function parseHeader(frame: Uint8Array): ParsedHeader {
  const view = new DataView(frame.buffer, frame.byteOffset, frame.byteLength)
  return {
    version: frame[0],
    ctxId: frame.subarray(1, 1 + CTX_ID_BYTES),
    direction: view.getUint32(1 + CTX_ID_BYTES, false),
    counter: view.getBigUint64(1 + CTX_ID_BYTES + 4, false),
    channel: frame[1 + CTX_ID_BYTES + 4 + 8],
  }
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) return false
  let diff = 0
  for (let i = 0; i < a.byteLength; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

export interface RecordStateConfig {
  key: Uint8Array
  ctxId: Uint8Array
  direction: RecordDirection
  channel: RecordChannel
  /**
   * **Internal, tests only.** §5 R4's one sanctioned exception: the §7
   * exhaustion test has to place a counter near `2^64 - 1`, which it cannot do
   * a frame at a time. This is a construction-time seed — `seal` and `unseal`
   * still take no counter and remain the sole advancers. A `seal(counter, …)`
   * signature stays forbidden.
   */
  initialCounter?: bigint
}

/**
 * One direction of one context's record traffic.
 *
 * Every piece of state is an ECMAScript `#private` field, not a TypeScript
 * `private` one. TS `private` is a runtime own property, so `(state as any).n = 0n`
 * would be a live counter reset — the exact forbidden mutation. `#private` makes
 * it a syntax error instead of a policy.
 *
 * There is deliberately **no getter that returns the key**.
 */
export class RecordState {
  readonly #key: Uint8Array
  readonly #aead: ChaCha20Poly1305
  readonly #ctxId: Uint8Array
  readonly #direction: RecordDirection
  readonly #channel: RecordChannel
  #counter: bigint
  #destroyed = false

  constructor(config: RecordStateConfig) {
    this.#key = new Uint8Array(assertBytes(config.key, KEY_BYTES, 'traffic key'))
    this.#ctxId = new Uint8Array(assertBytes(config.ctxId, CTX_ID_BYTES, 'ctxId'))
    this.#direction = assertDirection(config.direction)
    this.#channel = assertChannel(config.channel)
    // `Object.hasOwn`, never `??` — see `recordAad`.
    const seeded = Object.hasOwn(config, 'initialCounter') && config.initialCounter !== undefined
    this.#counter = seeded ? assertCounter(config.initialCounter as bigint) : 0n
    this.#aead = new ChaCha20Poly1305(this.#key)
  }

  /** The next counter this state will use. Read-only — there is no setter. */
  get counter(): bigint {
    return this.#counter
  }

  #assertLive() {
    if (this.#destroyed) {
      throw new RecordError('E2EE_SEAL_FAILED', 'E2EE: this record state has been destroyed')
    }
  }

  /**
   * §5 R4: takes no counter. The state owns it, so there is exactly one place
   * the invariant can be broken rather than one per call site.
   *
   * §5 R1: the counter advances by exactly 1, **after** a successful seal.
   */
  seal(plaintext: Uint8Array, target?: Uint8Array): Uint8Array {
    this.#assertLive()
    const counter = this.#counter
    if (counter > MAX_COUNTER) {
      // §7: the refusal leaves the state unchanged, and the caller must then
      // destroy the context. There is no recovery that keeps it.
      throw new RecordError('E2EE_COUNTER_EXHAUSTED', 'E2EE: the record counter is exhausted')
    }

    const aad = recordAad(
      target === undefined
        ? { ctxId: this.#ctxId, direction: this.#direction, counter, channel: this.#channel }
        : { ctxId: this.#ctxId, direction: this.#direction, counter, channel: this.#channel, target },
    )
    const nonce = recordNonce(this.#direction, counter)
    const sealed = this.#aead.seal(nonce, plaintext, aad)

    const frame = new Uint8Array(HEADER_BYTES + sealed.byteLength)
    frame.set(aad.subarray(0, HEADER_BYTES), 0)
    frame.set(sealed, HEADER_BYTES)

    this.#counter = counter + 1n
    return frame
  }

  /**
   * §5 R2: the WebSocket receiver requires `counter === expected` **exactly**.
   * No window, no tolerance, no reordering allowance — a socket runs over one
   * TCP connection, so a repeat, a gap or a reorder is a protocol violation and
   * not a network event.
   *
   * §5 R2 ordering: **authenticate first, then compare the counter.** Checking
   * the counter first would make `E2EE_SEQUENCE_VIOLATION` an unauthenticated
   * verdict about the peer — anyone able to inject a frame could read the
   * previous plaintext header and make the client blame a device that did
   * nothing. A genuine replay is rejected under either order; only the
   * attribution differs.
   *
   * §5 R3: a rejected frame advances the counter in neither branch.
   */
  /**
   * Authenticate first. A counter complaint is only legal after the AEAD
   * succeeds — otherwise `E2EE_SEQUENCE_VIOLATION` is an unauthenticated
   * verdict anyone who can inject bytes could force (§5 R2 ordering).
   */
  #openAuthenticated(
    frame: Uint8Array,
    target: Uint8Array | undefined,
  ): { counter: bigint; plaintext: Uint8Array } {
    this.#assertLive()
    if (!(frame instanceof Uint8Array) || frame.BYTES_PER_ELEMENT !== 1) {
      throw new RecordError('E2EE_SEAL_FAILED', 'E2EE: a record frame must be a byte array')
    }
    if (frame.byteLength < HEADER_BYTES + TAG_BYTES) {
      throw new RecordError('E2EE_SEAL_FAILED', 'E2EE: the record frame is too short')
    }

    const header = parseHeader(frame)
    if (
      header.version !== E2EE_PROTOCOL_VERSION ||
      header.direction !== this.#direction ||
      header.channel !== this.#channel ||
      !bytesEqual(header.ctxId, this.#ctxId)
    ) {
      throw new RecordError('E2EE_SEAL_FAILED', 'E2EE: the record header does not match this context')
    }

    const aad = recordAad(
      target === undefined
        ? {
            ctxId: this.#ctxId,
            direction: this.#direction,
            counter: header.counter,
            channel: this.#channel,
          }
        : {
            ctxId: this.#ctxId,
            direction: this.#direction,
            counter: header.counter,
            channel: this.#channel,
            target,
          },
    )
    const nonce = recordNonce(this.#direction, header.counter)
    const opened = this.#aead.open(nonce, frame.subarray(HEADER_BYTES), aad)
    if (!opened) {
      throw new RecordError('E2EE_SEAL_FAILED', 'E2EE: the record did not authenticate')
    }
    return { counter: header.counter, plaintext: opened }
  }

  unseal(frame: Uint8Array, target?: Uint8Array): Uint8Array {
    const opened = this.#openAuthenticated(frame, target)
    if (opened.counter !== this.#counter) {
      throw new RecordError(
        'E2EE_SEQUENCE_VIOLATION',
        `E2EE: expected record counter ${this.#counter}, got ${opened.counter}`,
      )
    }
    this.#counter = opened.counter + 1n
    return opened.plaintext
  }

  /**
   * REST responses are bound to the request counter they answer (§13(a)), not
   * to a sequential expected. Concurrent React Query calls would otherwise
   * reject a later-numbered response that arrived first.
   *
   * Does not advance `#counter`. A rejected frame still advances nothing (§5 R3).
   */
  unsealMatching(frame: Uint8Array, requestCounter: bigint, target?: Uint8Array): Uint8Array {
    const expected = assertCounter(requestCounter)
    const opened = this.#openAuthenticated(frame, target)
    if (opened.counter !== expected) {
      throw new RecordError(
        'E2EE_SEQUENCE_VIOLATION',
        `E2EE: expected record counter ${expected}, got ${opened.counter}`,
      )
    }
    return opened.plaintext
  }

  /** Wipes the key material. The state refuses to seal or unseal afterwards. */
  destroy() {
    this.#key.fill(0)
    this.#destroyed = true
  }
}

export function createRecordState(config: RecordStateConfig): RecordState {
  return new RecordState(config)
}
