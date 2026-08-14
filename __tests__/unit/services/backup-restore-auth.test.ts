// restoreBackup's apply path uses authedFetch directly rather than
// createApiForServer, because a 409 RESTORE_CONFLICT carries the plan and must
// not be flattened into a NetworkError. That gives it its own catch body, and
// therefore its own need to rethrow AuthError ahead of the network-failure
// path — a 401 there previously fell through to the generic `!response.ok`
// branch and surfaced as "Server returned 401".

import { restoreBackup } from '@/services/backup'
import { AuthError } from '@/services/api-client'
import type { BackupArchive } from '@/types/backup'

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
})

describe('restoreBackup (apply)', () => {
  it('surfaces a 401 as AuthError rather than a generic server error', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 401, json: jest.fn().mockResolvedValue({}) })
    await expect(restoreBackup('srv_test', archive, { apply: true })).rejects.toBeInstanceOf(
      AuthError,
    )
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })
})
