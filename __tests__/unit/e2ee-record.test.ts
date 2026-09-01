/**
 * Byte-for-byte interoperability against the streamer's record vectors at tag
 * `v1.72.0` (`d7a27ab5d7ec963ae9350b60a99b8d48b0c1b99b`).
 *
 * **Positive vectors alone prove very little.** A client that matches only
 * positive vectors can still accept a mutated AAD field, a reflected direction
 * or a counter gap — the "correct output sitting above a defect" shape Phase 2
 * warned about. The `negative` half is the half that matters, and it is why
 * every case there is asserted with its *specific* verdict rather than merely
 * "threw something".
 */
import vectors from '../fixtures/e2ee-record-vectors.json'
import type { RecordVectors } from '@/services/e2ee/record-vectors'
import {
  CHANNEL_REST_REQUEST,
  CHANNEL_REST_RESPONSE,
  CHANNEL_WEBSOCKET,
  DIRECTION_CLIENT_TO_SERVER,
  DIRECTION_SERVER_TO_CLIENT,
  MAX_COUNTER,
  RecordError,
  createRecordState,
  recordAad,
  recordNonce,
  restTargetHash,
  type RecordChannel,
  type RecordDirection,
} from '@/services/e2ee/record'

const b64 = (s: string): Uint8Array => Uint8Array.from(Buffer.from(s, 'base64'))
const toB64 = (b: Uint8Array): string => Buffer.from(b).toString('base64')
const fixture = vectors as RecordVectors

const ctxId = b64(fixture.ctxId)

/** A state seeded to the vector's counter, so each vector stands alone. */
function stateFor(v: { key: string; direction: number; channel: number; counter: string }) {
  return createRecordState({
    key: b64(v.key),
    ctxId,
    direction: v.direction as RecordDirection,
    channel: v.channel as RecordChannel,
    initialCounter: BigInt(v.counter),
  })
}

function targetFor(v: { channel: number }): Uint8Array | undefined {
  if (v.channel === CHANNEL_REST_REQUEST || v.channel === CHANNEL_REST_RESPONSE) {
    return b64(fixture.restResponse.target.hash)
  }
  return undefined
}

describe('record layer interop — streamer v1.72.0 fixtures', () => {
  it('pins the fixture provenance to the exact streamer tag', () => {
    expect(fixture.$provenance).toContain('v1.72.0')
    expect(fixture.$provenance).toContain('d7a27ab5d7ec963ae9350b60a99b8d48b0c1b99b')
  })

  describe.each(fixture.records.map((r) => [r.name, r] as const))('positive vector: %s', (_name, v) => {
    it('reproduces the nonce, the AAD and the frame byte for byte', () => {
      const counter = BigInt(v.counter)
      const direction = v.direction as RecordDirection
      const channel = v.channel as RecordChannel

      expect(toB64(recordNonce(direction, counter))).toBe(v.nonce)

      const target = channel === CHANNEL_WEBSOCKET ? undefined : b64(v.target!.hash)
      const aad = recordAad(
        target === undefined
          ? { ctxId, direction, counter, channel }
          : { ctxId, direction, counter, channel, target },
      )
      expect(toB64(aad)).toBe(v.aad)

      const frame = stateFor(v).seal(Buffer.from(v.plaintextUtf8, 'utf8'), target)
      expect(toB64(frame)).toBe(v.frame)
    })

    it('round-trips: the plaintext is recoverable only after unseal', () => {
      const channel = v.channel as RecordChannel
      const target = channel === CHANNEL_WEBSOCKET ? undefined : b64(v.target!.hash)
      const opened = stateFor(v).unseal(b64(v.frame), target)
      expect(Buffer.from(opened).toString('utf8')).toBe(v.plaintextUtf8)
    })
  })

  it('seals a counter above 32 bits without losing precision', () => {
    const v = fixture.records.find((r) => r.counter === String(2 ** 32))!
    expect(v).toBeDefined()
    expect(toB64(stateFor(v).seal(Buffer.from(v.plaintextUtf8, 'utf8')))).toBe(v.frame)
  })

  describe('negative vectors — each must be rejected, with the right verdict', () => {
    const base = fixture.negative.base

    it.each(fixture.negative.cases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
      const target =
        c.channel === CHANNEL_REST_REQUEST || c.channel === CHANNEL_REST_RESPONSE
          ? b64(c.target!.hash)
          : targetFor(base)

      const state = createRecordState({
        key: b64(c.key ?? base.key),
        ctxId,
        direction: (c.direction ?? base.direction) as RecordDirection,
        channel: (c.channel ?? base.channel) as RecordChannel,
        initialCounter: BigInt(c.counter ?? base.counter),
      })

      if (c.expect.startsWith('sequence-violation')) {
        // A counter repeat only violates on the SECOND delivery — the first is
        // authentic and in sequence. Feeding it once and asserting a throw
        // would pass for entirely the wrong reason.
        if (c.name.includes('repeat')) {
          expect(Buffer.from(state.unseal(b64(base.frame))).toString('utf8')).toBe(base.plaintextUtf8)
        }
        let thrown: unknown
        try {
          state.unseal(b64(c.frame), target)
        } catch (e) {
          thrown = e
        }
        expect(thrown).toBeInstanceOf(RecordError)
        expect((thrown as RecordError).code).toBe('E2EE_SEQUENCE_VIOLATION')
      } else {
        let thrown: unknown
        try {
          state.unseal(b64(c.frame), target)
        } catch (e) {
          thrown = e
        }
        expect(thrown).toBeInstanceOf(RecordError)
        expect((thrown as RecordError).code).toBe('E2EE_SEAL_FAILED')
      }
    })

    it('a gap and a repeat authenticate first — an unauthentic frame is never a sequence violation', () => {
      // §5 R2 ordering, and the reason it is not cosmetic: a client that
      // checked the counter first would answer SEQUENCE_VIOLATION here and
      // blame a peer for a frame the peer never sent.
      const state = createRecordState({
        key: b64(base.key),
        ctxId,
        direction: base.direction as RecordDirection,
        channel: base.channel as RecordChannel,
        initialCounter: BigInt(base.counter),
      })
      const corrupted = vectors.negative.cases.find((c) => c.name === 'tag corrupted')!
      expect(() => state.unseal(b64(corrupted.frame))).toThrow(
        expect.objectContaining({ code: 'E2EE_SEAL_FAILED' }),
      )
    })

    it('a rejected frame advances the counter in neither branch (§5 R3)', () => {
      const state = createRecordState({
        key: b64(base.key),
        ctxId,
        direction: base.direction as RecordDirection,
        channel: base.channel as RecordChannel,
        initialCounter: BigInt(base.counter),
      })
      const before = state.counter
      const corrupted = vectors.negative.cases.find((c) => c.name === 'tag corrupted')!
      expect(() => state.unseal(b64(corrupted.frame))).toThrow()
      expect(state.counter).toBe(before)

      const gap = vectors.negative.cases.find((c) => c.name.startsWith('counter gap'))!
      expect(() => state.unseal(b64(gap.frame))).toThrow()
      expect(state.counter).toBe(before)

      // Still able to accept the authentic in-sequence frame afterwards.
      expect(Buffer.from(state.unseal(b64(base.frame))).toString('utf8')).toBe(base.plaintextUtf8)
      expect(state.counter).toBe(before + 1n)
    })
  })
})

describe('record layer rules that the fixtures cannot express', () => {
  const key = b64(vectors.records[0].key)
  const ws = () =>
    createRecordState({
      key,
      ctxId,
      direction: DIRECTION_CLIENT_TO_SERVER,
      channel: CHANNEL_WEBSOCKET,
    })

  it('§5 R1: the counter advances by exactly 1, after a successful seal', () => {
    const s = ws()
    expect(s.counter).toBe(0n)
    s.seal(Buffer.from('a'))
    expect(s.counter).toBe(1n)
    s.seal(Buffer.from('b'))
    expect(s.counter).toBe(2n)
  })

  it('§7: a sender at 2^64-1 seals once, then refuses and leaves the state unchanged', () => {
    const s = createRecordState({
      key,
      ctxId,
      direction: DIRECTION_CLIENT_TO_SERVER,
      channel: CHANNEL_WEBSOCKET,
      initialCounter: MAX_COUNTER,
    })
    expect(s.seal(Buffer.from('the last record'))).toBeInstanceOf(Uint8Array)
    expect(s.counter).toBe(MAX_COUNTER + 1n)

    const before = s.counter
    expect(() => s.seal(Buffer.from('one too many'))).toThrow(
      expect.objectContaining({ code: 'E2EE_COUNTER_EXHAUSTED' }),
    )
    // The refusal leaves the state unchanged — it does not wrap to 0.
    expect(s.counter).toBe(before)
    expect(s.counter).not.toBe(0n)
  })

  it('§2: the counter is exact past 2^53, where a `number` would silently repeat', () => {
    // The specific colliding pair, chosen deliberately. `2^53` and `2^53 + 1`
    // are the smallest two integers a double cannot tell apart — both round to
    // 9007199254740992. An earlier version of this test used `2^53+1` and
    // `2^53+2`, which ARE distinguishable as doubles, so it stayed green under
    // the very mutation it claimed to catch. Confirm the premise first, then
    // assert the nonces still differ.
    const a = 2n ** 53n
    const b = a + 1n
    expect(Number(a)).toBe(Number(b))
    expect(a).not.toBe(b)

    // The nonce is where the precision loss becomes a repeat. The AAD binds the
    // counter too, so comparing whole frames would hide a nonce collision
    // behind a differing tag — this must look at the nonce itself.
    expect(toB64(recordNonce(DIRECTION_CLIENT_TO_SERVER, a))).not.toBe(
      toB64(recordNonce(DIRECTION_CLIENT_TO_SERVER, b)),
    )
  })

  it('§2: no (direction, counter) pair repeats across a long run', () => {
    const s = ws()
    const seen = new Set<string>()
    for (let i = 0; i < 512; i++) {
      const frame = s.seal(Buffer.from(`frame ${i}`))
      const nonce = toB64(frame.subarray(17, 17 + 12))
      expect(seen.has(nonce)).toBe(false)
      seen.add(nonce)
    }
    expect(seen.size).toBe(512)
  })

  it('§4: recordAad enforces the target rule itself, on both sides', () => {
    expect(() =>
      recordAad({
        ctxId,
        direction: DIRECTION_CLIENT_TO_SERVER,
        counter: 0n,
        channel: CHANNEL_WEBSOCKET,
        target: new Uint8Array(32),
      }),
    ).toThrow(/must not bind a target/)

    expect(() =>
      recordAad({
        ctxId,
        direction: DIRECTION_CLIENT_TO_SERVER,
        counter: 0n,
        channel: CHANNEL_REST_REQUEST,
      }),
    ).toThrow(/must bind a target/)
  })

  it('§4: the REST target is read from the RAW wire target, never a decoded path', () => {
    const c = vectors.restTargetCanonicalization
    const hashed = require('@stablelib/sha256').hash(Buffer.from(c.hashInputUtf8, 'utf8'))
    expect(toB64(hashed)).not.toBe(c.decodedPathMustDiffer.hash)

    const [method, path, query] = c.hashInputUtf8.split('\n')
    expect(toB64(restTargetHash(method, path, query))).toBe(toB64(hashed))
    expect(toB64(restTargetHash(method, c.decodedPathMustDiffer.path, query))).toBe(
      c.decodedPathMustDiffer.hash,
    )

    const rest = fixture.restResponse.target
    expect(toB64(restTargetHash(rest.method ?? '', rest.path ?? '', rest.query ?? ''))).toBe(rest.hash)
  })

  it('§13(a): unsealMatching binds a REST response to its request counter, not a sequential expected', () => {
    const target = b64(fixture.restResponse.target.hash)
    const first = createRecordState({
      key: b64(fixture.serverToClientKey),
      ctxId,
      direction: DIRECTION_SERVER_TO_CLIENT,
      channel: CHANNEL_REST_RESPONSE,
      initialCounter: 5n,
    })
    const second = createRecordState({
      key: b64(fixture.serverToClientKey),
      ctxId,
      direction: DIRECTION_SERVER_TO_CLIENT,
      channel: CHANNEL_REST_RESPONSE,
      initialCounter: 6n,
    })
    const frame5 = first.seal(Buffer.from('five'), target)
    const frame6 = second.seal(Buffer.from('six'), target)
    const recv = createRecordState({
      key: b64(fixture.serverToClientKey),
      ctxId,
      direction: DIRECTION_SERVER_TO_CLIENT,
      channel: CHANNEL_REST_RESPONSE,
    })
    expect(Buffer.from(recv.unsealMatching(frame6, 6n, target)).toString()).toBe('six')
    expect(Buffer.from(recv.unsealMatching(frame5, 5n, target)).toString()).toBe('five')
    expect(() => recv.unsealMatching(frame6, 5n, target)).toThrow(RecordError)
  })

  it('the guard is BYTES_PER_ELEMENT/byteLength, not `.length` — a Float64Array(32) is refused', () => {
    // This exact shape ran a full handshake on the server during W1a's
    // adversary rounds because a `.length` check accepted it.
    expect(() =>
      createRecordState({
        key: new Float64Array(32) as unknown as Uint8Array,
        ctxId,
        direction: DIRECTION_CLIENT_TO_SERVER,
        channel: CHANNEL_WEBSOCKET,
      }),
    ).toThrow(/byte array|Uint8Array/)
  })

  it('reads optional arguments with Object.hasOwn, so a polluted prototype cannot inject a target', () => {
    const proto = Object.prototype as unknown as Record<string, unknown>
    try {
      proto.target = new Uint8Array(32)
      // A `??`-based read would pick the prototype's `target` up here and bind
      // 32 attacker-chosen bytes into a socket-channel AAD.
      expect(() =>
        recordAad({
          ctxId,
          direction: DIRECTION_CLIENT_TO_SERVER,
          counter: 0n,
          channel: CHANNEL_WEBSOCKET,
        }),
      ).not.toThrow()
    } finally {
      delete proto.target
    }
    expect(Object.hasOwn(Object.prototype, 'target')).toBe(false)
  })

  it('exposes no way to read the key back, and destroy() wipes it', () => {
    const s = ws()
    expect(Object.keys(s)).toHaveLength(0)
    expect(JSON.stringify(s)).toBe('{}')
    s.destroy()
    expect(() => s.seal(Buffer.from('after destroy'))).toThrow(/destroyed/)
  })

  it('the counter is a #private field, so an own-property write cannot reset it', () => {
    const s = ws()
    s.seal(Buffer.from('a'))
    expect(s.counter).toBe(1n)
    // The forbidden mutation. Against a TS `private` field this would succeed
    // and silently rewind the counter to a value already used.
    ;(s as unknown as Record<string, unknown>).counter = 0n
    ;(s as unknown as Record<string, unknown>)['#counter'] = 0n
    expect(s.counter).toBe(1n)
  })

  it('refuses a reflected record: a server→client frame fed back as client→server', () => {
    const s2c = createRecordState({
      key,
      ctxId,
      direction: DIRECTION_SERVER_TO_CLIENT,
      channel: CHANNEL_WEBSOCKET,
    })
    const reflected = s2c.seal(Buffer.from('reflect me'))
    expect(() => ws().unseal(reflected)).toThrow(
      expect.objectContaining({ code: 'E2EE_SEAL_FAILED' }),
    )
  })
})
