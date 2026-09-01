/**
 * REST context lifecycle: one live context per server id, rollover on
 * 24 h / 1 GiB / foreground, 10 s drain of the retired context.
 */
import {
  CHANNEL_REST_REQUEST,
  CHANNEL_REST_RESPONSE,
  DIRECTION_CLIENT_TO_SERVER,
  DIRECTION_SERVER_TO_CLIENT,
  createRecordState,
} from '@/services/e2ee/record'
import type { TransportContext } from '@/services/e2ee/context'
import {
  REST_BYTE_LIMIT,
  REST_DRAIN_MS,
  _markRestForegroundForTests,
  _resetRestSessionsForTests,
  _setRestNowForTests,
  _setRestOpenForTests,
  acquireRestContext,
  noteRestBytes,
} from '@/services/e2ee/rest-session'
import vectors from '../fixtures/e2ee-record-vectors.json'

const b64 = (s: string): Uint8Array => Uint8Array.from(Buffer.from(s, 'base64'))
const ctxIdRaw = b64(vectors.ctxId)

function makeRestContext(expiresAt: number): TransportContext {
  const send = createRecordState({
    key: b64(vectors.clientToServerKey),
    ctxId: ctxIdRaw,
    direction: DIRECTION_CLIENT_TO_SERVER,
    channel: CHANNEL_REST_REQUEST,
  })
  const recv = createRecordState({
    key: b64(vectors.serverToClientKey),
    ctxId: ctxIdRaw,
    direction: DIRECTION_SERVER_TO_CLIENT,
    channel: CHANNEL_REST_RESPONSE,
  })
  return {
    ctxId: vectors.ctxIdBase64Url,
    kind: 'rest',
    expiresAt,
    provisional: false,
    send,
    recv,
    destroy() {
      send.destroy()
      recv.destroy()
    },
  }
}

const args = {
  serverId: 'srv-1',
  baseUrl: 'https://box.example.com',
  serverPublicKey: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  kind: 'rest' as const,
}

describe('REST session lifecycle', () => {
  afterEach(() => {
    _resetRestSessionsForTests()
  })

  it('concurrent waiters share one open', async () => {
    let opens = 0
    let release: (ctx: TransportContext) => void = () => {}
    const pending = new Promise<TransportContext>((resolve) => {
      release = resolve
    })
    _setRestOpenForTests(async () => {
      opens += 1
      return pending
    })
    const first = acquireRestContext(args)
    const second = acquireRestContext(args)
    const ctx = makeRestContext(1_000_000)
    release(ctx)
    expect(await first).toBe(ctx)
    expect(await second).toBe(ctx)
    expect(opens).toBe(1)
  })

  it('rolls over after expiresAt and drains the old context for 10 s', async () => {
    const old = makeRestContext(1_000)
    const next = makeRestContext(1_000_000_000)
    const contexts = [old, next]
    _setRestOpenForTests(async () => {
      const ctx = contexts.shift()
      if (!ctx) throw new Error('unexpected extra open')
      return ctx
    })
    _setRestNowForTests(() => 0)
    expect(await acquireRestContext(args)).toBe(old)

    _setRestNowForTests(() => 1_000)
    expect(await acquireRestContext(args)).toBe(next)
    expect(() => old.send.seal(new Uint8Array(0), new Uint8Array(32))).not.toThrow()

    _setRestNowForTests(() => 1_000 + REST_DRAIN_MS)
    expect(await acquireRestContext(args)).toBe(next)
    expect(() => old.send.seal(new Uint8Array(0), new Uint8Array(32))).toThrow(/destroyed/)
  })

  it('rolls over after 1 GiB of sealed frame bytes', async () => {
    const first = makeRestContext(1_000_000_000)
    const second = makeRestContext(1_000_000_000)
    const contexts = [first, second]
    _setRestOpenForTests(async () => {
      const ctx = contexts.shift()
      if (!ctx) throw new Error('unexpected extra open')
      return ctx
    })
    expect(await acquireRestContext(args)).toBe(first)
    noteRestBytes('srv-1', REST_BYTE_LIMIT)
    expect(await acquireRestContext(args)).toBe(second)
  })

  it('rolls over when the app returns to the foreground', async () => {
    const first = makeRestContext(1_000_000_000)
    const second = makeRestContext(1_000_000_000)
    const contexts = [first, second]
    _setRestOpenForTests(async () => {
      const ctx = contexts.shift()
      if (!ctx) throw new Error('unexpected extra open')
      return ctx
    })
    expect(await acquireRestContext(args)).toBe(first)
    _markRestForegroundForTests()
    expect(await acquireRestContext(args)).toBe(second)
  })
})
