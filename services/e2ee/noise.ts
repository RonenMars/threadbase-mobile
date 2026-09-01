/**
 * `Noise_IKpsk1_25519_ChaChaPoly_SHA256`, initiator side.
 *
 * Written from the Noise Protocol Framework (rev 34) rather than from the
 * streamer's responder, so the committed interop vectors compare two
 * independent readings of the spec instead of one reading against itself.
 *
 * Pattern, with the `psk1` modifier putting `psk` at the end of message 1:
 *
 *     IKpsk1:
 *       <- s
 *       ...
 *       -> e, es, s, ss, psk
 *       <- e, ee, se
 *
 * This module is deliberately payload-agnostic and app-agnostic: it takes and
 * returns bytes. The prologue, the PSK derivation and the JSON payloads are
 * `services/e2ee/pair-handshake.ts`.
 */
import { ChaCha20Poly1305 } from '@stablelib/chacha20poly1305'
import { hmac } from '@stablelib/hmac'
import { DIGEST_LENGTH, SHA256, hash as sha256 } from '@stablelib/sha256'
import { PUBLIC_KEY_LENGTH, generateKeyPairFromSeed, sharedKey } from '@stablelib/x25519'
import { assertBytes } from '@/services/e2ee/record'
import { randomBytes } from 'tweetnacl'

export const NOISE_PROTOCOL_NAME = 'Noise_IKpsk1_25519_ChaChaPoly_SHA256'

/**
 * `POST /api/e2ee/open` runs a **psk-less** `IK` — a different pattern, a
 * different protocol name, and its own prologue
 * (`threadbase-e2ee/1 open`, in `pair-handshake.ts`).
 *
 * The protocol name is the exact bytes that seed `h`, so the name itself is the
 * domain separation between this handshake and pairing. NONCE-DESIGN §11.
 */
export const NOISE_OPEN_PROTOCOL_NAME = 'Noise_IK_25519_ChaChaPoly_SHA256'

/** The PSK is a 32-byte value or it is absent. There is no third case. */
export const PSK_BYTES = 32

/**
 * Which pattern an initiator runs. **Required, with no default and never
 * inferred from whether a `psk` happens to be present.**
 *
 * Selecting the pattern by `psk` presence is the specific bug W1a's fourth
 * adversary round found: an empty `Uint8Array` is truthy, so a truthiness check
 * ran a full `IKpsk1` binding a constant. A capability that was never asked for
 * must not be inferred — the same rule `readOnly` follows at pairing.
 */
export type NoisePattern = 'IKpsk1' | 'IK'

const TAG_LENGTH = 16
const NONCE_LENGTH = 12

export function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

/**
 * Noise's HKDF (§4.3).
 *
 * Computationally this *is* RFC 5869, with `salt = ck`, `IKM = ikm` and an
 * empty `info`. Saying the chaining key is "the HMAC key rather than the salt"
 * would be a distinction without a difference — HKDF-Extract keys the HMAC with
 * the salt, so those are the same thing.
 *
 * What makes a stock HKDF the wrong substitute is the shape, not the maths: two
 * or three fixed 32-byte outputs read off the chained expansion, with an empty
 * `info`, rather than one buffer of requested length. Reach for a generic
 * helper and the `info` argument is the one you will get wrong.
 *
 * The third output is always computed; only `MixKeyAndHash` reads it.
 */
function hkdf(ck: Uint8Array, ikm: Uint8Array): [Uint8Array, Uint8Array, Uint8Array] {
  const temp = hmac(SHA256, ck, ikm)
  const out1 = hmac(SHA256, temp, Uint8Array.of(1))
  const out2 = hmac(SHA256, temp, concatBytes(out1, Uint8Array.of(2)))
  const out3 = hmac(SHA256, temp, concatBytes(out2, Uint8Array.of(3)))
  return [out1, out2, out3]
}

function dh(secretKey: Uint8Array, publicKey: Uint8Array): Uint8Array {
  return sharedKey(secretKey, publicKey, true)
}

/**
 * The **handshake** nonce for a counter: 4 zero bytes, then the counter as
 * 64-bit little-endian, per Noise §12.3.
 *
 * **Not the record layer's nonce, and not reusable as one.** design.md §3.3
 * builds that from `direction(4) || counter(8)` **big-endian** — a different
 * layout and the opposite byte order. A Phase 3 record layer that reached for
 * this helper would disagree with the streamer on every record, and would do it
 * while passing a suite that only ever exercises the handshake.
 *
 * The counter is a JS `number`, so it cannot represent the spec's full 2^64
 * range and would start repeating nonces above 2^53 — silently, which is the
 * worst way for a nonce to fail. §5.1 requires signalling an error rather than
 * wrapping, so this refuses above the safe-integer bound instead. Unreachable
 * here, where a handshake spends three nonces at most.
 *
 * **The bound is deliberately far below the spec's 2^64-1, and raising it to
 * match would be a regression, not a fix.** Refusing earlier than required can
 * never wrap and never repeat, so a stricter limit still satisfies §5.1; a
 * `number` counter allowed up to 2^64-1 would lose integer precision first and
 * start emitting duplicate nonces with no error at all. The record layer *does*
 * need the full range — design.md §3.3 has it refuse at 2^64-1 and force a
 * rekey, and the streamer's counter is already a `bigint` — which is one more
 * reason it needs its own counter rather than this one.
 */
export function noiseNonce(counter: number): Uint8Array {
  if (!Number.isSafeInteger(counter) || counter < 0) {
    throw new Error('Noise: nonce counter is outside the representable range')
  }
  const nonce = new Uint8Array(NONCE_LENGTH)
  let remaining = counter
  for (let i = 4; i < NONCE_LENGTH && remaining > 0; i++) {
    nonce[i] = remaining & 0xff
    remaining = Math.floor(remaining / 256)
  }
  return nonce
}

/**
 * Noise's `SymmetricState`. Exported because the responder half of the pattern
 * is built from the same primitive, and the tamper tests need one to reject
 * against — the app itself is only ever the initiator.
 *
 * `ck` is initialised as an alias of `h`, and `readMessage2` hands `h` back to
 * its caller. Both are safe only because every mutator below *replaces* the
 * array rather than writing into it. Anything added here must keep doing that:
 * one in-place `h.set(…)` would corrupt `ck` through the alias, and would do it
 * without an error anywhere.
 */
export class SymmetricState {
  h: Uint8Array
  private ck: Uint8Array
  private k: Uint8Array | null = null
  private n = 0

  constructor(protocolName: string) {
    const name = Uint8Array.from(protocolName, (c) => c.charCodeAt(0))
    if (name.length <= DIGEST_LENGTH) {
      this.h = new Uint8Array(DIGEST_LENGTH)
      this.h.set(name)
    } else {
      this.h = sha256(name)
    }
    this.ck = this.h
  }

  mixHash(data: Uint8Array) {
    this.h = sha256(concatBytes(this.h, data))
  }

  mixKey(ikm: Uint8Array) {
    const [ck, k] = hkdf(this.ck, ikm)
    this.ck = ck
    this.k = k
    this.n = 0
  }

  mixKeyAndHash(ikm: Uint8Array) {
    const [ck, temp, k] = hkdf(this.ck, ikm)
    this.ck = ck
    this.mixHash(temp)
    this.k = k
    this.n = 0
  }

  encryptAndHash(plaintext: Uint8Array): Uint8Array {
    const ciphertext = this.k
      ? new ChaCha20Poly1305(this.k).seal(this.nextNonce(), plaintext, this.h)
      : plaintext
    this.mixHash(ciphertext)
    return ciphertext
  }

  decryptAndHash(ciphertext: Uint8Array): Uint8Array {
    let plaintext = ciphertext
    if (this.k) {
      // §5.1: on an authentication failure `n` is NOT incremented. Reading the
      // counter without consuming it, and only advancing once the tag verified,
      // is what implements that — `noiseNonce(this.n++)` here would burn a
      // counter slot on every rejected frame.
      const opened = new ChaCha20Poly1305(this.k).open(noiseNonce(this.n), ciphertext, this.h)
      if (!opened) throw new Error('Noise: authentication failed')
      this.n++
      plaintext = opened
    }
    this.mixHash(ciphertext)
    return plaintext
  }

  /** Returns (initiator→responder, responder→initiator). */
  split(): [Uint8Array, Uint8Array] {
    const [k1, k2] = hkdf(this.ck, new Uint8Array(0))
    return [k1, k2]
  }

  /** Seals only — `decryptAndHash` advances the counter itself, after the tag verifies. */
  private nextNonce(): Uint8Array {
    // Increments before `noiseNonce` validates, which still fails closed: a
    // counter past the bound cannot advance back into an accepted value.
    return noiseNonce(this.n++)
  }
}

export interface NoiseInitiatorConfig {
  /** Required. Never defaulted, never inferred from `psk` — see `NoisePattern`. */
  pattern: NoisePattern
  /** The responder's static public key, known in advance — `IK`'s `<- s` pre-message. */
  serverStaticPublic: Uint8Array
  clientStaticPrivate: Uint8Array
  /** Exactly 32 bytes on `IKpsk1`; must be absent on `IK`. */
  psk?: Uint8Array
  prologue: Uint8Array
  /** Test-only injection. A real handshake takes a fresh key from the system CSPRNG. */
  ephemeralPrivate?: Uint8Array
}

export interface NoiseHandshakeResult {
  /** Message 2's decrypted payload. That it decrypted at all is the key confirmation. */
  payload: Uint8Array
  handshakeHash: Uint8Array
  clientToServerKey: Uint8Array
  serverToClientKey: Uint8Array
}

export interface NoiseInitiator {
  writeMessage1(payload: Uint8Array): Uint8Array
  readMessage2(message: Uint8Array): NoiseHandshakeResult
}

export function createNoiseInitiator(config: NoiseInitiatorConfig): NoiseInitiator {
  // The pattern is read explicitly and validated before anything else. Both
  // directions are errors: `IKpsk1` without a psk, and `IK` with one.
  const pattern = config.pattern
  if (pattern !== 'IKpsk1' && pattern !== 'IK') {
    throw new Error('Noise: a handshake pattern is required (IKpsk1 or IK)')
  }
  // `Object.hasOwn`, never `??` or truthiness: `psk` reaches a trust boundary,
  // an empty `Uint8Array` is truthy, and a polluted `Object.prototype` would
  // otherwise supply one.
  const hasPsk = Object.hasOwn(config, 'psk') && config.psk !== undefined
  if (pattern === 'IKpsk1') {
    if (!hasPsk) throw new Error('Noise: IKpsk1 requires a psk')
    // Exactly 32 bytes. A `.length`/truthiness check accepted a zero-length or
    // wrong-typed array and ran a full handshake binding a constant.
    assertBytes(config.psk, PSK_BYTES, 'psk')
  } else if (hasPsk) {
    throw new Error('Noise: the psk-less IK pattern must not be given a psk')
  }
  if (!(config.prologue instanceof Uint8Array)) {
    // Required parameter, deliberately not defaulted — defaulting it would
    // silently remove the domain separation between /open and pairing.
    throw new Error('Noise: a prologue is required')
  }

  const sym = new SymmetricState(
    pattern === 'IKpsk1' ? NOISE_PROTOCOL_NAME : NOISE_OPEN_PROTOCOL_NAME,
  )
  sym.mixHash(config.prologue)
  sym.mixHash(config.serverStaticPublic)

  const e = generateKeyPairFromSeed(config.ephemeralPrivate ?? randomBytes(32))
  const s = generateKeyPairFromSeed(config.clientStaticPrivate)
  let wroteMessage1 = false
  let readMessage2 = false

  return {
    writeMessage1(payload: Uint8Array): Uint8Array {
      if (wroteMessage1) throw new Error('Noise: message 1 was already written')
      wroteMessage1 = true

      // IKpsk1: -> e, es, s, ss, psk        IK: -> e, es, s, ss
      sym.mixHash(e.publicKey)
      // `MixKey(e.pk)` runs on BOTH patterns, and on `IK` that is a deliberate
      // deviation from the Noise specification.
      //
      // Spec §9.2 calls MixKey on the ephemeral only in a PSK handshake, so a
      // spec-pure `Noise_IK_25519_ChaChaPoly_SHA256` would omit it here. The
      // streamer's `writeMessage1` calls it unconditionally
      // (`src/e2ee/noise.ts` at tag v1.72.0), so the transcript that the
      // committed `/open` vector pins is NOT a spec-pure `IK` — it is `IK` plus
      // this extra chaining-key mix.
      //
      // The fixture is the contract, so we match the wire. Writing this to the
      // specification instead produces a message 1 whose first 32 bytes match
      // and whose remainder does not, failing with nothing but
      // "authentication failed" to debug — which is exactly how it was found.
      // Reported upstream; do NOT "fix" this to match the spec unless the
      // streamer changes in the same breath, or /open stops interoperating.
      sym.mixKey(e.publicKey)
      sym.mixKey(dh(e.secretKey, config.serverStaticPublic))
      const encryptedStatic = sym.encryptAndHash(s.publicKey)
      sym.mixKey(dh(s.secretKey, config.serverStaticPublic))
      if (pattern === 'IKpsk1') sym.mixKeyAndHash(config.psk as Uint8Array)
      return concatBytes(e.publicKey, encryptedStatic, sym.encryptAndHash(payload))
    },

    readMessage2(message: Uint8Array): NoiseHandshakeResult {
      if (!wroteMessage1) throw new Error('Noise: message 2 arrived before message 1 was written')
      // The state is spent once it has been split. A second read would mix a
      // second ephemeral into a chain that already produced traffic keys, and
      // today the AEAD happens to reject the result — but that is the cipher
      // catching a caller error, not a stated precondition, and a retry in the
      // layer above is the first thing that would lean on the difference.
      if (readMessage2) throw new Error('Noise: message 2 was already read')
      readMessage2 = true
      if (message.length < PUBLIC_KEY_LENGTH + TAG_LENGTH) {
        throw new Error('Noise: message 2 is too short')
      }

      // <- e, ee, se
      const re = message.subarray(0, PUBLIC_KEY_LENGTH)
      sym.mixHash(re)
      // Unconditional for the same reason as message 1's `mixKey(e.publicKey)`:
      // the streamer's `readMessage2` mixes the responder ephemeral on both
      // patterns, and the vector pins that transcript.
      sym.mixKey(re)
      sym.mixKey(dh(e.secretKey, re))
      sym.mixKey(dh(s.secretKey, re))
      const payload = sym.decryptAndHash(message.subarray(PUBLIC_KEY_LENGTH))

      const [clientToServerKey, serverToClientKey] = sym.split()
      return { payload, handshakeHash: sym.h, clientToServerKey, serverToClientKey }
    },
  }
}
