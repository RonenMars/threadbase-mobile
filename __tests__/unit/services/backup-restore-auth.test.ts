// restoreBackup's apply path uses authedFetch directly rather than
// createApiForServer, because a 409 RESTORE_CONFLICT carries the plan and must
// not be flattened into a NetworkError. That gives it its own catch body, and
// therefore its own need to rethrow AuthError ahead of the network-failure
// path — a 401 there previously fell through to the generic `!response.ok`
// branch and surfaced as "Server returned 401".

import { restoreBackup } from '@/services/backup'
import { AuthError } from '@/services/api-client'
import { EnvelopeError } from '@/services/authed-fetch'
import {
  CHANNEL_REST_REQUEST,
  CHANNEL_REST_RESPONSE,
  DIRECTION_CLIENT_TO_SERVER,
  DIRECTION_SERVER_TO_CLIENT,
  createRecordState,
} from '@/services/e2ee/record'
import {
  _resetRestSessionsForTests,
  _setRestOpenForTests,
} from '@/services/e2ee/rest-session'
import { useServersStore } from '@/stores/servers'
import type { BackupArchive } from '@/types/backup'
import type { TransportContext } from '@/services/e2ee/context'

jest.mock('@/stores/servers', () => ({
  useServersStore: {
    getState: jest.fn(() => ({
      getServer: (id: string) =>
        id === 'srv_test'
          ? { id: 'srv_test', url: 'http://test.local', apiKey: 'test-api-key', serverInfo: null }
          : undefined,
    })),
  },
}))

jest.mock('@/services/device-id', () => ({
  getDeviceClientId: jest.fn().mockResolvedValue('client-1'),
}))

const mockFetch = jest.fn()
global.fetch = mockFetch

const archive = { version: 1, servers: [] } as unknown as BackupArchive

beforeEach(() => {
  mockFetch.mockReset()
  _resetRestSessionsForTests()
  ;(useServersStore.getState as jest.Mock).mockReturnValue({
    getServer: (id: string) =>
      id === 'srv_test'
        ? { id: 'srv_test', url: 'http://test.local', apiKey: 'test-api-key', serverInfo: null }
        : undefined,
  })
})

describe('restoreBackup (apply)', () => {
  it('surfaces a 401 as AuthError rather than a generic server error', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 401, json: jest.fn().mockResolvedValue({}) })
    await expect(restoreBackup('srv_test', archive, { apply: true })).rejects.toBeInstanceOf(
      AuthError,
    )
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('surfaces EnvelopeError rather than wrapping it as NetworkError', async () => {
    ;(useServersStore.getState as jest.Mock).mockReturnValue({
      getServer: () => ({
        id: 'srv_test',
        url: 'https://box.example.com',
        apiKey: 'test-api-key',
        serverInfo: null,
        serverPublicKey: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        requireEncryption: true,
      }),
    })
    const ctxId = Uint8Array.from(Buffer.from('Dx4tPEtaaXiHlqW0w9Lh8A==', 'base64'))
    const key = new Uint8Array(32).fill(7)
    const send = createRecordState({
      key,
      ctxId,
      direction: DIRECTION_CLIENT_TO_SERVER,
      channel: CHANNEL_REST_REQUEST,
    })
    const recv = createRecordState({
      key: new Uint8Array(32).fill(8),
      ctxId,
      direction: DIRECTION_SERVER_TO_CLIENT,
      channel: CHANNEL_REST_RESPONSE,
    })
    const ctx: TransportContext = {
      ctxId: 'Dx4tPEtaaXiHlqW0w9Lh8A',
      kind: 'rest',
      expiresAt: Date.now() + 86_400_000,
      provisional: false,
      send,
      recv,
      destroy() {
        send.destroy()
        recv.destroy()
      },
    }
    _setRestOpenForTests(async () => ctx)
    mockFetch.mockResolvedValue(new Response('no', { status: 401 }))
    await expect(restoreBackup('srv_test', archive, { apply: true })).rejects.toBeInstanceOf(
      EnvelopeError,
    )
  })
})
