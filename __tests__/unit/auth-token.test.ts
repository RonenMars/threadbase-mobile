// Which credential the app presents to a streamer.
//
// The pair exchange has minted a scoped, individually revocable device token
// since C5. The app stored it in SecureStore and then sent the OWNER's shared
// API key — which carries `admin` on the streamer — on every single request, so
// a lost phone leaked the ability to rotate the key and revoke other devices
// rather than a scope that could be revoked on its own.
//
// The `devicesDurable` gate is not decoration: on a streamer that keeps its
// device registry inside the deletable conversation cache, `tb-streamer cache
// clear` invalidates the token, and preferring it there would turn a documented
// troubleshooting step into "re-pair every device".

import { authToken } from '@/types/api'
import type { ServerConfig, ServerInfo } from '@/types/api'

type Cred = Pick<ServerConfig, 'apiKey' | 'deviceToken' | 'serverInfo'>

const info = (over: Partial<ServerInfo> = {}): ServerInfo => ({
  version: '1.52.3',
  machineName: 'box',
  platform: 'darwin',
  activeSessions: 0,
  ...over,
})

const server = (over: Partial<Cred> = {}): Cred => ({
  apiKey: 'tb_deadbeefdeadbeefdeadbeefdeadbeef',
  deviceToken: undefined,
  serverInfo: null,
  ...over,
})

describe('authToken', () => {
  it('prefers the scoped device token when the server stores devices durably', () => {
    expect(
      authToken(server({ deviceToken: 'dev_tok', serverInfo: info({ devicesDurable: true }) })),
    ).toBe('dev_tok')
  })

  // The positive control for every negative case below: without it, a helper
  // that always returned apiKey would pass all of them.
  it('falls back to the shared key when there is no device token', () => {
    expect(authToken(server({ serverInfo: info({ devicesDurable: true }) }))).toBe(
      'tb_deadbeefdeadbeefdeadbeefdeadbeef',
    )
  })

  it('falls back on a server that stores devices in the deletable cache', () => {
    expect(
      authToken(server({ deviceToken: 'dev_tok', serverInfo: info({ devicesDurable: false }) })),
    ).toBe('tb_deadbeefdeadbeefdeadbeefdeadbeef')
  })

  // Absent means "older server" and must read as not-durable, never as unknown-
  // so-try-it. This is the whole backward-compatibility contract.
  it('falls back when the server never reports the field at all', () => {
    expect(authToken(server({ deviceToken: 'dev_tok', serverInfo: info() }))).toBe(
      'tb_deadbeefdeadbeefdeadbeefdeadbeef',
    )
  })

  // The first request after pairing: serverInfo has not been fetched yet, so
  // the shared key is the only credential we can justify sending.
  it('falls back before serverInfo has been fetched', () => {
    expect(authToken(server({ deviceToken: 'dev_tok', serverInfo: null }))).toBe(
      'tb_deadbeefdeadbeefdeadbeefdeadbeef',
    )
  })

  // Deliberately NOT a 401-retry fallback: re-presenting the shared key after a
  // device token is refused would let a revoked device keep working, which is
  // the one thing revocation exists to prevent. The helper is pure and has no
  // knowledge of responses — this test documents that as intent, not accident.
  it('is a pure function of stored state, with no response-driven fallback', () => {
    const s = server({ deviceToken: 'dev_tok', serverInfo: info({ devicesDurable: true }) })
    expect(authToken(s)).toBe('dev_tok')
    expect(authToken(s)).toBe('dev_tok')
  })
})
