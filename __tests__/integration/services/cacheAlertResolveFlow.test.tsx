import React from 'react'
import { fireEvent, waitFor } from '@testing-library/react-native'
import { getCacheAlert } from '@/services/api-client'
import { useServersStore } from '@/stores/servers'
import { CacheAlertModal } from '@/components/servers/CacheAlertModal'
import { CacheAlertBanner } from '@/components/servers/CacheAlertBanner'
import { renderWithI18n } from '@/test-utils/render'

// End-to-end resolve flow against a mocked fetch transport (not a mocked
// api-client), so getCacheAlert's 404-as-feature-detection and
// resolveCacheAlert's 409-as-conflict paths are exercised for real.
const mockFetch = jest.fn()
global.fetch = mockFetch

const SERVER_ID = 'srv_test1'

function seedServer() {
  useServersStore.setState({
    servers: {
      [SERVER_ID]: {
        id: SERVER_ID,
        url: 'http://test.local',
        label: 'My Server',
        apiKey: 'k',
        isConnected: true,
        serverInfo: null,
        connectionError: null,
      },
    },
    activeServerIds: [SERVER_ID],
    displayedServerIds: [SERVER_ID],
    isLoading: false,
    cacheAlert: {},
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  seedServer()
})

describe('cache alert resolve flow (integration)', () => {
  it('getCacheAlert against an old server (404) returns null and the feature stays fully hidden', async () => {
    mockFetch.mockResolvedValueOnce({ status: 404, ok: false, json: async () => ({}) })

    const pending = await getCacheAlert(SERVER_ID)
    expect(pending).toBeNull()

    useServersStore.getState().setCacheAlert(SERVER_ID, pending)
    const { toJSON: bannerJson } = await renderWithI18n(<CacheAlertBanner onPress={jest.fn()} />)
    const { toJSON: modalJson } = await renderWithI18n(
      <CacheAlertModal visible serverId={SERVER_ID} onClose={jest.fn()} onResolved={jest.fn()} />
    )
    expect(bannerJson()).toBeNull()
    expect(modalJson()).toBeNull()
  })

  it('normal success: fetches a pending alert, resolves it, and reports the backup path', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: async () => ({
        pending: {
          fingerprint: 'fp1',
          severity: 'high',
          detectedAt: '2026-07-18T00:00:00.000Z',
          missingCount: 2,
          totalRows: 10,
          missing: [{ id: 'a', filePath: '/a.jsonl', title: 'Session A', tailed: false }],
        },
      }),
    })
    const pending = await getCacheAlert(SERVER_ID)
    useServersStore.getState().setCacheAlert(SERVER_ID, pending)

    mockFetch.mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: async () => ({ ok: true, action: 'prune_all', pruned: 2, backupPath: '/backup/x' }),
    })

    const onResolved = jest.fn()
    const { findByText } = await renderWithI18n(
      <CacheAlertModal visible serverId={SERVER_ID} onClose={jest.fn()} onResolved={onResolved} />
    )
    await fireEvent.press(await findByText('Prune All'))
    await fireEvent.press(await findByText('Proceed'))

    await waitFor(() => expect(onResolved).toHaveBeenCalledWith('/backup/x'))
    expect(mockFetch).toHaveBeenLastCalledWith(
      'http://test.local/api/cache/alert/resolve',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('409 fingerprint_mismatch: refetches state and re-renders instead of erroring', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: async () => ({
        pending: {
          fingerprint: 'fp1',
          severity: 'high',
          detectedAt: '2026-07-18T00:00:00.000Z',
          missingCount: 2,
          totalRows: 10,
        },
      }),
    })
    const pending = await getCacheAlert(SERVER_ID)
    useServersStore.getState().setCacheAlert(SERVER_ID, pending)

    // resolve → 409
    mockFetch.mockResolvedValueOnce({
      status: 409,
      ok: false,
      json: async () => ({ error: 'fingerprint_mismatch', currentFingerprint: 'fp2' }),
    })
    // subsequent refetch of GET /api/cache/alert returns the new pending state
    mockFetch.mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: async () => ({
        pending: {
          fingerprint: 'fp2',
          severity: 'high',
          detectedAt: '2026-07-18T00:01:00.000Z',
          missingCount: 1,
          totalRows: 10,
        },
      }),
    })

    const onResolved = jest.fn()
    const { findByText } = await renderWithI18n(
      <CacheAlertModal visible serverId={SERVER_ID} onClose={jest.fn()} onResolved={onResolved} />
    )
    await fireEvent.press(await findByText('Prune All'))
    await fireEvent.press(await findByText('Proceed'))

    await waitFor(() =>
      expect(useServersStore.getState().cacheAlert[SERVER_ID]?.fingerprint).toBe('fp2'),
    )
    expect(onResolved).not.toHaveBeenCalled()
    expect(mockFetch).toHaveBeenCalledTimes(3)
  })

  it('propagates a real server error from getCacheAlert instead of silently hiding the feature', async () => {
    mockFetch.mockResolvedValueOnce({ status: 500, ok: false, json: async () => ({ error: 'boom' }) })
    await expect(getCacheAlert(SERVER_ID)).rejects.toThrow()
  })
})
