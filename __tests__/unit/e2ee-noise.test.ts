// `Noise_IKpsk1_25519_ChaChaPoly_SHA256`, initiator side (#698).
//
// The vectors in `__tests__/fixtures/noise-ikpsk1-vectors.json` are the
// contract. They were produced by the streamer's responder, written by a
// different author from a separate reading of the Noise specification, so
// reproducing them byte-for-byte is the only assertion here that says anything
// about interoperability. Everything else tests properties of this half alone,
// and `test-utils/noise-responder.ts` — same author as the code under test —
// exists only so the tamper cases have something to be rejected by.

import naclUtil from 'tweetnacl-util'
import { NOISE_PROTOCOL_NAME, SymmetricState, createNoiseInitiator, noiseNonce } from '@/services/e2ee/noise'
import { PAIR_PROLOGUE, derivePairPsk } from '@/services/e2ee/pair-handshake'
import { createNoiseResponder } from '@/test-utils/noise-responder'
import vectors from '@/__tests__/fixtures/noise-ikpsk1-vectors.json'

const b64 = naclUtil.decodeBase64
const utf8 = naclUtil.decodeUTF8

const prologue = utf8(vectors.prologueUtf8)
const psk = b64(vectors.psk)
const serverStaticPublic = b64(vectors.keys.serverStaticPublic)
const serverStaticPrivate = b64(vectors.keys.serverStaticPrivate)
const clientStaticPrivate = b64(vectors.keys.clientStaticPrivate)
const clientEphemeralPrivate = b64(vectors.keys.clientEphemeralPrivate)
const serverEphemeralPrivate = b64(vectors.keys.serverEphemeralPrivate)
const payload1 = utf8(vectors.payload1Utf8)
const payload2 = utf8(vectors.payload2Utf8)

function initiator(overrides: { psk?: Uint8Array; serverStaticPublic?: Uint8Array } = {}) {
  return createNoiseInitiator({
    serverStaticPublic: overrides.serverStaticPublic ?? serverStaticPublic,
    clientStaticPrivate,
    psk: overrides.psk ?? psk,
    prologue,
    ephemeralPrivate: clientEphemeralPrivate,
  })
}

function responder(overrides: { psk?: Uint8Array } = {}) {
  return createNoiseResponder({
    serverStaticPrivate,
    psk: overrides.psk ?? psk,
    prologue,
    ephemeralPrivate: serverEphemeralPrivate,
  })
}

/** One full round trip against the same-author responder. */
function roundTrip(overrides: { initiatorPsk?: Uint8Array; responderPsk?: Uint8Array } = {}) {
  const client = initiator({ psk: overrides.initiatorPsk })
  const server = responder({ psk: overrides.responderPsk })
  const message1 = client.writeMessage1(payload1)
  server.readMessage1(message1)
  const message2 = server.writeMessage2(payload2)
  return { message1, message2, result: client.readMessage2(message2) }
}

describe('Noise IKpsk1 initiator — interop vectors', () => {
  it('reproduces the committed message 1 byte for byte', () => {
    const message1 = initiator().writeMessage1(payload1)
    expect(naclUtil.encodeBase64(message1)).toBe(vectors.message1)
  })

  it('reads the committed message 2 and reproduces its transcript hash and split keys', () => {
    const client = initiator()
    client.writeMessage1(payload1)
    const result = client.readMessage2(b64(vectors.message2))

    // That the payload decrypts at all IS the key confirmation — there is no
    // separate `rootKeyConfirm` field, deliberately.
    expect(naclUtil.encodeUTF8(result.payload)).toBe(vectors.payload2Utf8)
    expect(naclUtil.encodeBase64(result.handshakeHash)).toBe(vectors.handshakeHash)
    expect(naclUtil.encodeBase64(result.clientToServerKey)).toBe(vectors.clientToServerKey)
    expect(naclUtil.encodeBase64(result.serverToClientKey)).toBe(vectors.serverToClientKey)
  })

  it('derives the committed PSK from the committed pair token', () => {
    expect(naclUtil.encodeBase64(derivePairPsk(vectors.pairToken))).toBe(vectors.psk)
  })

  it('uses the namespace prologue the streamer uses', () => {
    expect(PAIR_PROLOGUE).toBe(vectors.prologueUtf8)
  })
})

describe('Noise IKpsk1 initiator — a wrong static key fails', () => {
  it('completes against the right server static key', () => {
    // The positive control for the two assertions below: without it they would
    // both pass against a handshake that never completes for any key at all.
    expect(() => {
      const client = initiator()
      client.writeMessage1(payload1)
      client.readMessage2(b64(vectors.message2))
    }).not.toThrow()
  })

  it('rejects message 2 when the server static key is wrong by one byte', () => {
    const wrong = Uint8Array.from(serverStaticPublic)
    wrong[0] ^= 0x01
    const client = initiator({ serverStaticPublic: wrong })
    client.writeMessage1(payload1)
    expect(() => client.readMessage2(b64(vectors.message2))).toThrow()
  })

  it('rejects message 2 when a different server static key is substituted wholesale', () => {
    const client = initiator({ serverStaticPublic: b64(vectors.keys.clientStaticPublic) })
    client.writeMessage1(payload1)
    expect(() => client.readMessage2(b64(vectors.message2))).toThrow()
  })
})

describe('Noise IKpsk1 — tampering is rejected at every byte', () => {
  // Every offset, not a sample: a gap in the sweep is a region an intermediary
  // could rewrite, and there is no way to know in advance which region that is.

  it('accepts both messages untouched', () => {
    // Positive control for both sweeps below.
    const { message1, message2, result } = roundTrip()
    expect(message1.length).toBe(103)
    expect(message2.length).toBe(105)
    expect(naclUtil.encodeUTF8(result.payload)).toBe(vectors.payload2Utf8)
  })

  it('rejects message 1 with any single byte flipped', () => {
    const pristine = initiator().writeMessage1(payload1)
    for (let i = 0; i < pristine.length; i++) {
      const tampered = Uint8Array.from(pristine)
      tampered[i] ^= 0x01
      expect(() => responder().readMessage1(tampered)).toThrow()
    }
  })

  it('rejects message 2 with any single byte flipped', () => {
    const pristine = b64(vectors.message2)
    for (let i = 0; i < pristine.length; i++) {
      const tampered = Uint8Array.from(pristine)
      tampered[i] ^= 0x01
      const client = initiator()
      client.writeMessage1(payload1)
      expect(() => client.readMessage2(tampered)).toThrow()
    }
  })

  it('rejects a message 2 truncated below its minimum length', () => {
    const client = initiator()
    client.writeMessage1(payload1)
    expect(() => client.readMessage2(b64(vectors.message2).subarray(0, 47))).toThrow()
  })
})

describe('Noise IKpsk1 — the PSK binds the handshake to the scanned QR', () => {
  // The property this phase exists to create, and the one that can be absent
  // behind a green suite: on the streamer side, deleting the PSK mix from both
  // ends left 14 of 17 tests passing. So these are written to fail when the
  // `MixKeyAndHash(psk)` call is deleted from BOTH halves, not only from one.

  const otherPsk = derivePairPsk('pt_ffffffffffffffffffffffffffffffff')

  it('derives a different PSK for a different pair token', () => {
    // The positive control: if this were false, every assertion below would
    // pass on a handshake that ignores the PSK entirely.
    expect(naclUtil.encodeBase64(otherPsk)).not.toBe(naclUtil.encodeBase64(psk))
  })

  it('produces a different message 1 for a different pair token', () => {
    // Deletion-proof and client-only: with the PSK unmixed these two byte
    // strings are identical, because nothing else about them differs.
    const withScannedToken = initiator().writeMessage1(payload1)
    const withOtherToken = initiator({ psk: otherPsk }).writeMessage1(payload1)
    expect(naclUtil.encodeBase64(withOtherToken)).not.toBe(
      naclUtil.encodeBase64(withScannedToken),
    )
  })

  it('produces a different transcript hash and different traffic keys for a different pair token', () => {
    const scanned = roundTrip()
    const other = roundTrip({ initiatorPsk: otherPsk, responderPsk: otherPsk })

    expect(naclUtil.encodeBase64(other.result.handshakeHash)).not.toBe(
      naclUtil.encodeBase64(scanned.result.handshakeHash),
    )
    expect(naclUtil.encodeBase64(other.result.clientToServerKey)).not.toBe(
      naclUtil.encodeBase64(scanned.result.clientToServerKey),
    )
    expect(naclUtil.encodeBase64(other.result.serverToClientKey)).not.toBe(
      naclUtil.encodeBase64(scanned.result.serverToClientKey),
    )
  })

  it('fails outright when the two sides hold different pair tokens', () => {
    expect(() => roundTrip({ initiatorPsk: otherPsk })).toThrow()
  })

  it('agrees on the transcript hash and traffic keys when both sides hold the scanned token', () => {
    // The positive control for the mismatch case above.
    const client = initiator()
    const server = responder()
    server.readMessage1(client.writeMessage1(payload1))
    const result = client.readMessage2(server.writeMessage2(payload2))
    const [c2s, s2c] = server.split()

    expect(naclUtil.encodeBase64(result.handshakeHash)).toBe(
      naclUtil.encodeBase64(server.handshakeHash()),
    )
    expect(naclUtil.encodeBase64(result.clientToServerKey)).toBe(naclUtil.encodeBase64(c2s))
    expect(naclUtil.encodeBase64(result.serverToClientKey)).toBe(naclUtil.encodeBase64(s2c))
  })
})

describe('Noise IKpsk1 initiator — message ordering', () => {
  it('refuses to read message 2 before message 1 has been written', () => {
    expect(() => initiator().readMessage2(b64(vectors.message2))).toThrow(
      /before message 1/,
    )
  })

  it('refuses to write message 1 twice', () => {
    const client = initiator()
    client.writeMessage1(payload1)
    expect(() => client.writeMessage1(payload1)).toThrow(/already written/)
  })

  it('refuses to read message 2 twice', () => {
    // The state is spent after the split. Without this the AEAD still rejects
    // the second read, but by accident rather than by contract — and a retry in
    // the layer above is exactly what would come to depend on the difference.
    const client = initiator()
    client.writeMessage1(payload1)
    client.readMessage2(b64(vectors.message2))
    expect(() => client.readMessage2(b64(vectors.message2))).toThrow(/already read/)
  })

  it('stays spent after a message 2 that failed to authenticate', () => {
    // Fail closed: a rejected message 2 must not leave a handshake a caller can
    // feed a second, attacker-chosen one to.
    const tampered = Uint8Array.from(b64(vectors.message2))
    tampered[40] ^= 0x01
    const client = initiator()
    client.writeMessage1(payload1)
    expect(() => client.readMessage2(tampered)).toThrow()
    expect(() => client.readMessage2(b64(vectors.message2))).toThrow(/already read/)
  })
})

describe('Noise IKpsk1 — the ChaChaPoly nonce', () => {
  it('is 4 zero bytes then the counter as 64-bit little-endian', () => {
    expect(Array.from(noiseNonce(0))).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
    expect(Array.from(noiseNonce(1))).toEqual([0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0])
    expect(Array.from(noiseNonce(256))).toEqual([0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0])
    // Big-endian would put this byte at the other end of the counter field.
    expect(Array.from(noiseNonce(2 ** 32))).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0])
  })

  it('is the handshake nonce only — the record layer uses the opposite byte order', () => {
    // design.md §3.3 builds the record nonce from `direction(4) || counter(8)`
    // big-endian. This assertion is here so that the day someone reuses
    // `noiseNonce` for a record, the diff has to delete a test that says why
    // it cannot. Byte 4 vs byte 11 is the whole difference.
    expect(noiseNonce(1)[4]).toBe(1)
    expect(noiseNonce(1)[11]).toBe(0)
  })

  it('does not spend a counter on a frame that failed to authenticate', () => {
    // §5.1: on an authentication failure `n` is not incremented. Two states
    // keyed identically, one sealing and one opening — feed the opener a
    // corrupted frame first, and the genuine one must still decrypt. If the
    // rejected frame had consumed counter 0, this would try counter 1 and fail.
    const key = b64(vectors.psk)
    const sealer = new SymmetricState(NOISE_PROTOCOL_NAME)
    const opener = new SymmetricState(NOISE_PROTOCOL_NAME)
    sealer.mixKey(key)
    opener.mixKey(key)

    const sealed = sealer.encryptAndHash(payload1)
    const corrupted = Uint8Array.from(sealed)
    corrupted[0] ^= 0x01

    expect(() => opener.decryptAndHash(corrupted)).toThrow(/authentication failed/)
    expect(naclUtil.encodeUTF8(opener.decryptAndHash(sealed))).toBe(vectors.payload1Utf8)
  })

  it('refuses a counter it cannot represent rather than repeating a nonce', () => {
    // A JS number cannot carry the spec's 2^64 range. Above 2^53 the arithmetic
    // stops being exact and consecutive counters start producing the same
    // nonce — which fails silently, and silently is the one way a nonce must
    // never fail. Unreachable in a handshake; the guard is here so a transport
    // layer reusing this cannot inherit the question.
    expect(() => noiseNonce(Number.MAX_SAFE_INTEGER + 1)).toThrow(/representable range/)
    expect(() => noiseNonce(-1)).toThrow(/representable range/)
    expect(() => noiseNonce(1.5)).toThrow(/representable range/)
    // The positive control: the bound is a bound, not a blanket refusal.
    expect(() => noiseNonce(Number.MAX_SAFE_INTEGER)).not.toThrow()
  })
})
