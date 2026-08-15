// The capability gate in front of the pairing handshake (#698).
//
// `serverSpeaksE2ee` and its own tests already live in `types/api.ts` and
// `e2ee-capability.test.ts`. What is asserted here is that the handshake entry
// point actually consults it — a client that attempts a handshake against a
// server which never advertised one recreates the half-landed break the
// capability negotiation exists to prevent.

import naclUtil from 'tweetnacl-util'
import { E2EE_CLIENT_VERSION } from '@/types/api'
import type { E2eeCapability, ServerInfo } from '@/types/api'
import { beginPairHandshake } from '@/services/e2ee/pair-handshake'
import vectors from '@/__tests__/fixtures/noise-ikpsk1-vectors.json'

const info = (e2ee?: Partial<E2eeCapability>): ServerInfo => ({
  version: '1.55.3',
  machineName: 'box',
  platform: 'darwin',
  activeSessions: 0,
  ...(e2ee
    ? { e2ee: { supported: true, enabled: true, version: E2EE_CLIENT_VERSION, required: false, ...e2ee } }
    : {}),
})

const start = (serverInfo: ServerInfo | null) =>
  beginPairHandshake({
    serverInfo,
    pairToken: vectors.pairToken,
    serverStaticPublic: naclUtil.decodeBase64(vectors.keys.serverStaticPublic),
    clientStaticPrivate: naclUtil.decodeBase64(vectors.keys.clientStaticPrivate),
    ephemeralPrivate: naclUtil.decodeBase64(vectors.keys.clientEphemeralPrivate),
  })

describe('beginPairHandshake', () => {
  it('starts a handshake that matches the vector when the server advertises one', () => {
    // The positive control, and also the proof that the prologue and the PSK
    // derivation are really plumbed through rather than merely exported: get
    // either wrong and this message 1 stops matching the streamer's.
    const started = start(info({}))
    expect(started.ok).toBe(true)
    if (!started.ok) return
    const message1 = started.handshake.writeMessage1(naclUtil.decodeUTF8(vectors.payload1Utf8))
    expect(naclUtil.encodeBase64(message1)).toBe(vectors.message1)
  })

  it('declines when the server never mentions encryption', () => {
    // Every streamer in the field today.
    expect(start(info())).toEqual({ ok: false, reason: 'server-does-not-speak-e2ee' })
  })

  it('declines when the server has the code path but it is switched off', () => {
    // Today's state on `main`: `supported: true, enabled: false`.
    expect(start(info({ enabled: false }))).toEqual({
      ok: false,
      reason: 'server-does-not-speak-e2ee',
    })
  })

  it('declines when there is no server info at all', () => {
    expect(start(null)).toEqual({ ok: false, reason: 'server-does-not-speak-e2ee' })
  })

  it('declines when the server speaks an envelope version this build does not', () => {
    expect(start(info({ version: E2EE_CLIENT_VERSION + 1 }))).toEqual({
      ok: false,
      reason: 'server-does-not-speak-e2ee',
    })
  })
})
