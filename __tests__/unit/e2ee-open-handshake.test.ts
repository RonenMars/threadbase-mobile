/**
 * The `/api/e2ee/open` handshake — psk-less `IK`, its own protocol name, its own
 * prologue (NONCE-DESIGN §11), against the streamer's committed vector at tag
 * `v1.72.0`.
 *
 * The only other committed handshake fixture is the pairing `IKpsk1` transcript,
 * which uses a different protocol name, a different prologue and a PSK step — it
 * cannot check a psk-less `IK` implementation at all. Driving the handshake live
 * against our own responder would not substitute either: that compares one
 * reading of the spec against itself.
 */
import vectors from '../fixtures/e2ee-record-vectors.json'
import { NOISE_OPEN_PROTOCOL_NAME, createNoiseInitiator } from '@/services/e2ee/noise'
import { OPEN_PROLOGUE, openMessage1Payload } from '@/services/e2ee/pair-handshake'

const b64 = (s: string): Uint8Array => Uint8Array.from(Buffer.from(s, 'base64'))
const toB64 = (b: Uint8Array): string => Buffer.from(b).toString('base64')
const utf8 = (s: string): Uint8Array => Uint8Array.from(Buffer.from(s, 'utf8'))

const open = vectors.open

function initiator(overrides: Record<string, unknown> = {}) {
  return createNoiseInitiator({
    pattern: 'IK',
    serverStaticPublic: b64(open.keys.serverStaticPublic),
    clientStaticPrivate: b64(open.keys.clientStaticPrivate),
    prologue: utf8(OPEN_PROLOGUE),
    ephemeralPrivate: b64(open.keys.clientEphemeralPrivate),
    ...overrides,
  })
}

describe('/open handshake — psk-less IK against the v1.72.0 vector', () => {
  it('pins the protocol name and the prologue exactly', () => {
    expect(NOISE_OPEN_PROTOCOL_NAME).toBe(open.protocolName)
    expect(OPEN_PROLOGUE).toBe(open.prologueUtf8)
    expect(open.psk).toBeNull()
  })

  it('builds message 1 byte for byte', () => {
    const msg1 = initiator().writeMessage1(utf8(open.payload1Utf8))
    expect(toB64(msg1)).toBe(open.message1)
  })

  it('reads message 2 and derives both traffic keys and the handshake hash', () => {
    const h = initiator()
    h.writeMessage1(utf8(open.payload1Utf8))
    const result = h.readMessage2(b64(open.message2))

    expect(Buffer.from(result.payload).toString('utf8')).toBe(open.payload2Utf8)
    expect(toB64(result.handshakeHash)).toBe(open.handshakeHash)
    expect(toB64(result.clientToServerKey)).toBe(open.clientToServerKey)
    expect(toB64(result.serverToClientKey)).toBe(open.serverToClientKey)
  })

  it('msg1 payload carries the required `kind`, authenticated inside the AEAD', () => {
    expect(openMessage1Payload('ws')).toBe(open.payload1Utf8)
    expect(JSON.parse(openMessage1Payload('rest'))).toEqual({ v: 1, kind: 'rest' })
  })

  it('REFUSES a valid pairing message 1 read under the /open prologue', () => {
    // The vector that makes "default the prologue" a seeable mutation. Without
    // it, dropping the domain separation would silently pass everything else.
    const h = initiator()
    h.writeMessage1(utf8(open.payload1Utf8))
    expect(() => h.readMessage2(b64(open.pairingMessage1RejectedHere.message1))).toThrow()
    expect(open.pairingMessage1RejectedHere.expect).toBe('seal-failed')
  })

  it('a pairing prologue produces a different message 1 — the separation is real', () => {
    const wrong = initiator({ prologue: utf8('threadbase-e2ee/1 pair') })
    expect(toB64(wrong.writeMessage1(utf8(open.payload1Utf8)))).not.toBe(open.message1)
  })

  it('the IKpsk1 protocol name produces a different message 1', () => {
    // Domain separation comes from the protocol name too, not the prologue alone.
    const psk = new Uint8Array(32).fill(7)
    const asPairing = createNoiseInitiator({
      pattern: 'IKpsk1',
      serverStaticPublic: b64(open.keys.serverStaticPublic),
      clientStaticPrivate: b64(open.keys.clientStaticPrivate),
      psk,
      prologue: utf8(OPEN_PROLOGUE),
      ephemeralPrivate: b64(open.keys.clientEphemeralPrivate),
    })
    expect(toB64(asPairing.writeMessage1(utf8(open.payload1Utf8)))).not.toBe(open.message1)
  })
})

describe('pattern selection is explicit, never inferred from `psk` presence', () => {
  const base = {
    serverStaticPublic: b64(open.keys.serverStaticPublic),
    clientStaticPrivate: b64(open.keys.clientStaticPrivate),
    prologue: utf8(OPEN_PROLOGUE),
  }

  it('IKpsk1 without a psk throws', () => {
    expect(() => createNoiseInitiator({ ...base, pattern: 'IKpsk1' })).toThrow(/requires a psk/)
  })

  it('IK with a psk throws', () => {
    expect(() =>
      createNoiseInitiator({ ...base, pattern: 'IK', psk: new Uint8Array(32) }),
    ).toThrow(/must not be given a psk/)
  })

  it('refuses a zero-length psk on IKpsk1 — an empty Uint8Array is truthy', () => {
    // The exact W1a round-4 finding: a truthiness check ran a full IKpsk1
    // binding a constant. `.length`-style checks do not close this either.
    expect(() =>
      createNoiseInitiator({ ...base, pattern: 'IKpsk1', psk: new Uint8Array(0) }),
    ).toThrow(/exactly 32 bytes/)
  })

  it('refuses a psk that is the right length but the wrong element type', () => {
    expect(() =>
      createNoiseInitiator({
        ...base,
        pattern: 'IKpsk1',
        psk: new Float64Array(32) as unknown as Uint8Array,
      }),
    ).toThrow(/byte array|Uint8Array/)
  })

  it('refuses a missing pattern rather than defaulting one', () => {
    expect(() =>
      createNoiseInitiator({ ...base } as unknown as Parameters<typeof createNoiseInitiator>[0]),
    ).toThrow(/pattern is required/)
  })

  it('refuses a missing prologue rather than defaulting one', () => {
    expect(() =>
      createNoiseInitiator({
        pattern: 'IK',
        serverStaticPublic: base.serverStaticPublic,
        clientStaticPrivate: base.clientStaticPrivate,
      } as unknown as Parameters<typeof createNoiseInitiator>[0]),
    ).toThrow(/prologue is required/)
  })

  it('a polluted Object.prototype cannot inject a psk into a psk-less IK', () => {
    const proto = Object.prototype as unknown as Record<string, unknown>
    try {
      proto.psk = new Uint8Array(32).fill(9)
      // A `config.psk ?? null` read would find the prototype's value and either
      // throw here or, worse, bind it. `Object.hasOwn` does not see it.
      const h = createNoiseInitiator({ ...base, pattern: 'IK', ephemeralPrivate: b64(open.keys.clientEphemeralPrivate) })
      expect(toB64(h.writeMessage1(utf8(open.payload1Utf8)))).toBe(open.message1)
    } finally {
      delete proto.psk
    }
    expect(Object.hasOwn(Object.prototype, 'psk')).toBe(false)
  })
})
