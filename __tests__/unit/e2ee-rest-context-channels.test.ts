/**
 * REST `contextFor` is the only place that picks the record channel. Tests
 * that stub `acquireRestContext` never reach it, so this file drives
 * `openContext({ kind: 'rest' })` itself.
 */
import { createOpenInitiator } from '@/services/e2ee/pair-handshake'
import { openContext } from '@/services/e2ee/context'
import {
  CHANNEL_REST_REQUEST,
  CHANNEL_REST_RESPONSE,
  HEADER_BYTES,
  restTargetHash,
} from '@/services/e2ee/record'
import vectors from '../fixtures/e2ee-record-vectors.json'

jest.mock('@/services/e2ee/pair-handshake', () => {
  const actual = jest.requireActual('@/services/e2ee/pair-handshake') as typeof import('@/services/e2ee/pair-handshake')
  return {
    ...actual,
    createOpenInitiator: jest.fn(),
  }
})

const mockedOpen = createOpenInitiator as jest.MockedFunction<typeof createOpenInitiator>
const b64 = (s: string): Uint8Array => Uint8Array.from(Buffer.from(s, 'base64'))

describe('REST open binds request/response channels, not websocket', () => {
  it('seals REST traffic on channel 0x02 / 0x03', async () => {
    mockedOpen.mockResolvedValue({
      ok: true,
      handshake: {
        writeMessage1: () => new Uint8Array(48),
        readMessage2: () => ({
          payload: new TextEncoder().encode(
            JSON.stringify({
              v: 1,
              ctxId: vectors.ctxIdBase64Url,
              expiresAt: Date.now() + 86_400_000,
            }),
          ),
          clientToServerKey: b64(vectors.clientToServerKey),
          serverToClientKey: b64(vectors.serverToClientKey),
          handshakeHash: new Uint8Array(32),
        }),
      },
    } as Awaited<ReturnType<typeof createOpenInitiator>>)

    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ e2ee: { v: 1, noise: 'YQ==' } }),
    }) as unknown as typeof fetch

    const ctx = await openContext({
      serverId: 'srv-1',
      baseUrl: 'https://box.example.com',
      serverPublicKey: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      kind: 'rest',
      fetchImpl,
    })

    const target = restTargetHash('GET', '/api/info', '')
    const request = ctx.send.seal(new Uint8Array(0), target)
    expect(request[HEADER_BYTES - 1]).toBe(CHANNEL_REST_REQUEST)
    expect(request[HEADER_BYTES - 1]).not.toBe(1)

    const response = ctx.recv.seal(new Uint8Array(0), target)
    expect(response[HEADER_BYTES - 1]).toBe(CHANNEL_REST_RESPONSE)
    ctx.destroy()
  })
})
