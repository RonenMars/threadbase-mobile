// Whether to attempt an encrypted handshake with a streamer (#698, GATE 2).
//
// This lands BEFORE the handshake it gates. The QR format and the pairing
// exchange both move in Phase 2, across two repos that cannot merge atomically,
// so without a negotiated capability there is a window where one repo's `main`
// is ahead of the other and pairing is broken. With it, a half-landed state is
// inert: this app only attempts a handshake against a server that says it has
// one, and every older streamer says nothing.
//
// So these assert the properties that make it inert, not that a field parses.

import { E2EE_CLIENT_VERSION, serverSpeaksE2ee } from '@/types/api'
import type { E2eeCapability, ServerInfo } from '@/types/api'

const info = (e2ee?: Partial<E2eeCapability>): ServerInfo => ({
  version: '1.55.3',
  machineName: 'box',
  platform: 'darwin',
  activeSessions: 0,
  ...(e2ee
    ? {
        e2ee: {
          supported: true,
          enabled: true,
          version: E2EE_CLIENT_VERSION,
          required: false,
          ...e2ee,
        },
      }
    : {}),
})

describe('serverSpeaksE2ee', () => {
  it('accepts a server that supports it, has it on, and speaks our version', () => {
    // The positive control. Without it every assertion below passes on a
    // function that returns false unconditionally.
    expect(serverSpeaksE2ee(info({}))).toBe(true)
  })

  // Every streamer in the field today. The field is absent, and the only safe
  // reading of absent is "do not attempt" — attempting would POST a handshake
  // to an endpoint that does not exist.
  it('declines a server that says nothing about encryption', () => {
    expect(serverSpeaksE2ee(info())).toBe(false)
  })

  it('declines when there is no server info at all', () => {
    expect(serverSpeaksE2ee(null)).toBe(false)
    expect(serverSpeaksE2ee(undefined)).toBe(false)
  })

  // The GATE 2 guarantee from the other side: a streamer that has shipped the
  // capability object but not the handshake reports `supported: false`, and this
  // app must not attempt one however the flag is set over there.
  it('declines a build that advertises the capability but not the handshake', () => {
    expect(serverSpeaksE2ee(info({ supported: false, enabled: false }))).toBe(false)
    // enabled:true with supported:false is a server bug rather than a state it
    // can reach — asserted anyway, because "which field do I trust" is the
    // question a malformed capability object poses, and the answer is "both".
    expect(serverSpeaksE2ee(info({ supported: false, enabled: true }))).toBe(false)
  })

  it('declines a server that supports encryption but has it switched off', () => {
    expect(serverSpeaksE2ee(info({ enabled: false, reason: 'disabled by the flag' }))).toBe(false)
  })

  /**
   * A version this build does not implement is not a version to try.
   *
   * The handshake transcript is bound to the protocol name, so a `version: 2`
   * server would fail *after* the exchange rather than before it — which on the
   * pairing path means a consumed single-use token and a user who has to mint a
   * new QR to try again.
   */
  it('declines a version this build does not speak', () => {
    expect(serverSpeaksE2ee(info({ version: E2EE_CLIENT_VERSION + 1 }))).toBe(false)
    expect(serverSpeaksE2ee(info({ version: 0 }))).toBe(false)
  })

  /**
   * `required` is the streamer's own stage-3 bit — it refuses plaintext from any
   * client — and it is NOT this device's pin. It must not change whether we
   * attempt a handshake: a stripped or forged `required` would otherwise steer
   * the client, and `/api/info` crosses the network unauthenticated.
   */
  it('ignores the server-side required bit either way', () => {
    expect(serverSpeaksE2ee(info({ required: true }))).toBe(true)
    expect(serverSpeaksE2ee(info({ enabled: false, required: true }))).toBe(false)
  })
})
