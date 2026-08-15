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
import { randomBytes } from 'tweetnacl'

export const NOISE_PROTOCOL_NAME = 'Noise_IKpsk1_25519_ChaChaPoly_SHA256'

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
  /** The responder's static public key, known in advance — `IK`'s `<- s` pre-message. */
  serverStaticPublic: Uint8Array
  clientStaticPrivate: Uint8Array
  psk: Uint8Array
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
  const sym = new SymmetricState(NOISE_PROTOCOL_NAME)
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

      // -> e, es, s, ss, psk
      sym.mixHash(e.publicKey)
      // A PSK handshake additionally mixes each ephemeral into the chaining key,
      // because message 1's payload can otherwise be keyed by the PSK alone.
      sym.mixKey(e.publicKey)
      sym.mixKey(dh(e.secretKey, config.serverStaticPublic))
      const encryptedStatic = sym.encryptAndHash(s.publicKey)
      sym.mixKey(dh(s.secretKey, config.serverStaticPublic))
      sym.mixKeyAndHash(config.psk)
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
      sym.mixKey(re)
      sym.mixKey(dh(e.secretKey, re))
      sym.mixKey(dh(s.secretKey, re))
      const payload = sym.decryptAndHash(message.subarray(PUBLIC_KEY_LENGTH))

      const [clientToServerKey, serverToClientKey] = sym.split()
      return { payload, handshakeHash: sym.h, clientToServerKey, serverToClientKey }
    },
  }
}
