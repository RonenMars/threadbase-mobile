import React from 'react'
import { fireEvent, waitFor } from '@testing-library/react-native'
import { CacheAlertModal } from '@/components/servers/CacheAlertModal'
import { useServersStore } from '@/stores/servers'
import { resolveCacheAlert, getCacheAlert } from '@/services/api-client'
import { renderWithI18n } from '@/test-utils/render'
import { queryClient } from '@/services/query-client'
import type { MultiConversation, MultiSession } from '@/types/api'
import { useSessionsStore } from '@/stores/sessions'

jest.mock('@/services/api-client', () => ({
  resolveCacheAlert: jest.fn(),
  getCacheAlert: jest.fn(),
}))

const mockResolve = resolveCacheAlert as jest.Mock
const mockGetAlert = getCacheAlert as jest.Mock

const SERVER_ID = 'srv_test1'

function seedAlert(overrides: Partial<import('@/types/api').CacheAlert> = {}) {
  const alert = {
    fingerprint: 'fp1',
    severity: 'high' as const,
    detectedAt: '2026-07-18T00:00:00.000Z',
    missingCount: 2,
    totalRows: 10,
    missing: [
      { id: 'a', filePath: '/a.jsonl', title: 'Session A', tailed: false },
      { id: 'b', filePath: '/b.jsonl', title: 'Session B', tailed: false },
    ],
    ...overrides,
  }
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
    cacheAlert: { [SERVER_ID]: alert },
  })
  return alert
}

beforeEach(() => {
  jest.clearAllMocks()
  queryClient.clear()
  useSessionsStore.setState({ promptQueues: {} })
  useServersStore.setState({
    servers: {},
    activeServerIds: [],
    displayedServerIds: [],
    isLoading: false,
    cacheAlert: {},
  })
})

describe('CacheAlertModal', () => {
  it('renders nothing when there is no pending alert for the server', async () => {
    const { toJSON } = await renderWithI18n(
      <CacheAlertModal visible serverId={null} onClose={jest.fn()} onResolved={jest.fn()} />
    )
    expect(toJSON()).toBeNull()
  })

  it('shows the backup hint for high severity', async () => {
    seedAlert({ severity: 'high' })
    const { findByText } = await renderWithI18n(
      <CacheAlertModal visible serverId={SERVER_ID} onClose={jest.fn()} onResolved={jest.fn()} />
    )
    expect(await findByText(/Time Machine/)).toBeTruthy()
  }, 15_000)

  it('does not show the backup hint for low severity', async () => {
    seedAlert({ severity: 'low' })
    const { queryByText } = await renderWithI18n(
      <CacheAlertModal visible serverId={SERVER_ID} onClose={jest.fn()} onResolved={jest.fn()} />
    )
    expect(queryByText(/Time Machine/)).toBeNull()
  })

  it('requires a confirm step before calling resolveCacheAlert for prune_all', async () => {
    seedAlert()
    mockResolve.mockResolvedValue({ ok: true, action: 'prune_all', pruned: 2 })
    const { findByText } = await renderWithI18n(
      <CacheAlertModal visible serverId={SERVER_ID} onClose={jest.fn()} onResolved={jest.fn()} />
    )
    await fireEvent.press(await findByText('Prune All'))
    expect(mockResolve).not.toHaveBeenCalled()
    expect(await findByText('Are you sure?')).toBeTruthy()

    await fireEvent.press(await findByText('Proceed'))
    await waitFor(() => expect(mockResolve).toHaveBeenCalledWith(SERVER_ID, {
      fingerprint: 'fp1',
      action: 'prune_all',
      ids: undefined,
    }))
  })

  it('does not require a confirm step for ignore', async () => {
    seedAlert()
    mockResolve.mockResolvedValue({ ok: true, action: 'ignore' })
    const { findByText } = await renderWithI18n(
      <CacheAlertModal visible serverId={SERVER_ID} onClose={jest.fn()} onResolved={jest.fn()} />
    )
    await fireEvent.press(await findByText('Ignore'))
    await waitFor(() => expect(mockResolve).toHaveBeenCalledWith(SERVER_ID, {
      fingerprint: 'fp1',
      action: 'ignore',
      ids: undefined,
    }))
  })

  it('blocks prune_selected with no selection and shows an error', async () => {
    seedAlert()
    const { findByText } = await renderWithI18n(
      <CacheAlertModal visible serverId={SERVER_ID} onClose={jest.fn()} onResolved={jest.fn()} />
    )
    await fireEvent.press(await findByText('Prune Selected'))
    expect(await findByText('Select at least one conversation to prune.')).toBeTruthy()
    expect(mockResolve).not.toHaveBeenCalled()
  })

  it('sends selected ids for prune_selected after confirming', async () => {
    seedAlert()
    mockResolve.mockResolvedValue({ ok: true, action: 'prune_selected', pruned: 1 })
    const targetConversation = { id: 'target-conv', serverId: SERVER_ID } as MultiConversation
    queryClient.setQueryData(['conversations-eager', undefined, 0, SERVER_ID], [targetConversation])
    const { findByText } = await renderWithI18n(
      <CacheAlertModal visible serverId={SERVER_ID} onClose={jest.fn()} onResolved={jest.fn()} />
    )
    await fireEvent.press(await findByText('Session A'))
    await fireEvent.press(await findByText('Prune Selected'))
    await fireEvent.press(await findByText('Proceed'))
    await waitFor(() => expect(mockResolve).toHaveBeenCalledWith(SERVER_ID, {
      fingerprint: 'fp1',
      action: 'prune_selected',
      ids: ['a'],
    }))
    expect(queryClient.getQueryData(['conversations-eager', undefined, 0, SERVER_ID])).toEqual([])
  })

  it('clears server state after reset_rescan succeeds', async () => {
    seedAlert()
    mockResolve.mockResolvedValue({ ok: true, action: 'reset_rescan' })
    const targetSession = { id: 'target-session', serverId: SERVER_ID } as MultiSession
    queryClient.setQueryData(['sessions-eager', 'lastActivityAt', 'desc', '', SERVER_ID], [targetSession])

    const { findByText } = await renderWithI18n(
      <CacheAlertModal visible serverId={SERVER_ID} onClose={jest.fn()} onResolved={jest.fn()} />
    )
    await fireEvent.press(await findByText('Reset & Rescan'))
    await fireEvent.press(await findByText('Proceed'))

    await waitFor(() => expect(mockResolve).toHaveBeenCalledWith(SERVER_ID, {
      fingerprint: 'fp1',
      action: 'reset_rescan',
      ids: undefined,
    }))
    expect(queryClient.getQueryData(['sessions-eager', 'lastActivityAt', 'desc', '', SERVER_ID])).toEqual([])
  })

  it('calls onResolved with the backup path on success', async () => {
    seedAlert()
    mockResolve.mockResolvedValue({ ok: true, action: 'prune_all', pruned: 2, backupPath: '/backup/x' })
    const onResolved = jest.fn()
    const { findByText } = await renderWithI18n(
      <CacheAlertModal visible serverId={SERVER_ID} onClose={jest.fn()} onResolved={onResolved} />
    )
    await fireEvent.press(await findByText('Prune All'))
    await fireEvent.press(await findByText('Proceed'))
    await waitFor(() => expect(onResolved).toHaveBeenCalledWith('/backup/x'))
  })

  it('waits for destructive success, clears only that server, and refetches the lists', async () => {
    seedAlert()
    const otherConversation = { id: 'other-conv', serverId: 'srv_other' } as MultiConversation
    const targetConversation = { id: 'target-conv', serverId: SERVER_ID } as MultiConversation
    const otherSession = { id: 'other-session', serverId: 'srv_other' } as MultiSession
    const targetSession = { id: 'target-session', serverId: SERVER_ID } as MultiSession
    queryClient.setQueryData(['conversations-eager', undefined, 0, SERVER_ID], [targetConversation, otherConversation])
    queryClient.setQueryData(['sessions-eager', 'lastActivityAt', 'desc', '', SERVER_ID], [targetSession, otherSession])
    queryClient.setQueryData(['conversation', SERVER_ID, 'target-conv'], { stale: true })
    queryClient.setQueryData(['session', SERVER_ID, 'target-session'], { stale: true })
    queryClient.setQueryData(['conversations', 'search', 'term', SERVER_ID], [targetConversation, otherConversation])
    useSessionsStore.setState({
      promptQueues: {
        [`${SERVER_ID}::target-session`]: [],
        'srv_other::other-session': [],
      },
    })
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries')
    mockResolve.mockImplementation(async () => {
      expect(queryClient.getQueryData(['conversations-eager', undefined, 0, SERVER_ID])).toEqual([
        targetConversation,
        otherConversation,
      ])
      expect(invalidate).not.toHaveBeenCalled()
      return { ok: true, action: 'prune_all', pruned: 1 }
    })

    const { findByText } = await renderWithI18n(
      <CacheAlertModal visible serverId={SERVER_ID} onClose={jest.fn()} onResolved={jest.fn()} />
    )
    await fireEvent.press(await findByText('Prune All'))
    await fireEvent.press(await findByText('Proceed'))

    await waitFor(() => {
      expect(queryClient.getQueryData(['conversations-eager', undefined, 0, SERVER_ID])).toEqual([
        otherConversation,
      ])
    })
    expect(queryClient.getQueryData(['sessions-eager', 'lastActivityAt', 'desc', '', SERVER_ID])).toEqual([
      otherSession,
    ])
    expect(queryClient.getQueryData(['conversation', SERVER_ID, 'target-conv'])).toBeUndefined()
    expect(queryClient.getQueryData(['session', SERVER_ID, 'target-session'])).toBeUndefined()
    expect(queryClient.getQueryData(['conversations', 'search', 'term', SERVER_ID])).toEqual([
      otherConversation,
    ])
    expect(useSessionsStore.getState().promptQueues).toEqual({
      'srv_other::other-session': [],
    })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['conversations-eager'] })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['conversations'] })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['sessions-eager'] })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['sessions'] })
    invalidate.mockRestore()
  })

  it('does not clear list state after ignore succeeds', async () => {
    seedAlert()
    mockResolve.mockResolvedValue({ ok: true, action: 'ignore' })
    const targetConversation = { id: 'target-conv', serverId: SERVER_ID } as MultiConversation
    queryClient.setQueryData(['conversations-eager', undefined, 0, SERVER_ID], [targetConversation])

    const { findByText } = await renderWithI18n(
      <CacheAlertModal visible serverId={SERVER_ID} onClose={jest.fn()} onResolved={jest.fn()} />
    )
    await fireEvent.press(await findByText('Ignore'))

    await waitFor(() => expect(mockResolve).toHaveBeenCalled())
    expect(queryClient.getQueryData(['conversations-eager', undefined, 0, SERVER_ID])).toEqual([
      targetConversation,
    ])
  })

  it('on 409 conflict, refetches the alert instead of calling onResolved', async () => {
    seedAlert()
    mockResolve.mockResolvedValue({ ok: false, conflict: true, currentFingerprint: 'fp2' })
    mockGetAlert.mockResolvedValue({
      fingerprint: 'fp2',
      severity: 'high',
      detectedAt: '2026-07-18T00:01:00.000Z',
      missingCount: 1,
      totalRows: 10,
    })
    const onResolved = jest.fn()
    const { findByText } = await renderWithI18n(
      <CacheAlertModal visible serverId={SERVER_ID} onClose={jest.fn()} onResolved={onResolved} />
    )
    await fireEvent.press(await findByText('Prune All'))
    await fireEvent.press(await findByText('Proceed'))

    await waitFor(() => expect(mockGetAlert).toHaveBeenCalledWith(SERVER_ID))
    expect(onResolved).not.toHaveBeenCalled()
    expect(useServersStore.getState().cacheAlert[SERVER_ID]?.fingerprint).toBe('fp2')
  })
})
