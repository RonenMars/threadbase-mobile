import { Text } from 'react-native'
import { act } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { RecoveryHost, RECOVERY_OVERLAY_MAX_MS } from '@/components/alerts/RecoveryHost'
import { selectIsRecovering, useQueryRecoveryStore } from '@/stores/query-recovery'
import { withSilentRetries } from '@/services/error-policy'
import { useServersStore } from '@/stores/servers'
import type { ServerConfig } from '@/types/api'
import { renderWithI18n } from '@/test-utils/render'
import { addSafeBreadcrumb, captureSafeMessage } from '@/services/sentry'

jest.mock('@/hooks/useQueryRecoveryAlerts', () => ({ useQueryRecoveryAlerts: jest.fn() }))
jest.mock('@/services/sentry', () => ({ addSafeBreadcrumb: jest.fn(), captureSafeMessage: jest.fn() }))
jest.mock('@/services/query-client', () => ({ describeRecovery: () => ({ sessions_paused: 1, online: true }) }))

function server(id: string): ServerConfig {
  return { id, url: `https://${id}.test`, apiKey: 'k', isConnected: true, serverInfo: null, connectionError: null }
}

const oneServer = { a: server('a') }

beforeEach(() => {
  jest.clearAllMocks()
  jest.useFakeTimers()
  useQueryRecoveryStore.setState({ recovering: false, blockingRecovering: false, nestedRetryCount: 0, blockingNestedRetryCount: 0 })
  useServersStore.setState({ servers: oneServer })
})

afterEach(() => {
  jest.useRealTimers()
})

describe('RecoveryHost overlay timeout', () => {
  it('shows the overlay while a single-server install is recovering', async () => {
    const { queryByTestId } = await renderWithI18n(<RecoveryHost />)
    await act(async () => useQueryRecoveryStore.setState({ recovering: true, blockingRecovering: true }))
    expect(queryByTestId('recovery-overlay')).not.toBeNull()
  })

  it('never intercepts a touch and shows the scanner', async () => {
    const { getByTestId } = await renderWithI18n(<RecoveryHost />)
    await act(async () => useQueryRecoveryStore.setState({ recovering: true }))
    expect(getByTestId('recovery-overlay').props.pointerEvents).toBe('none')
    expect(getByTestId('recovery-scanner')).toBeTruthy()
  })

  it('hands the screen back once the recovery has outlasted the cap', async () => {
    const { queryByTestId } = await renderWithI18n(<RecoveryHost />)
    await act(async () => useQueryRecoveryStore.setState({ recovering: true, blockingRecovering: true }))
    await act(async () => jest.advanceTimersByTime(RECOVERY_OVERLAY_MAX_MS - 1))
    expect(queryByTestId('recovery-overlay')).not.toBeNull()
    await act(async () => jest.advanceTimersByTime(1))
    expect(queryByTestId('recovery-overlay')).toBeNull()
  })

  it('gives a later recovery a fresh window after the first one ended', async () => {
    const { queryByTestId } = await renderWithI18n(<RecoveryHost />)
    await act(async () => useQueryRecoveryStore.setState({ recovering: true, blockingRecovering: true }))
    await act(async () => jest.advanceTimersByTime(RECOVERY_OVERLAY_MAX_MS))
    await act(async () => useQueryRecoveryStore.setState({ recovering: false, blockingRecovering: false }))
    await act(async () => useQueryRecoveryStore.setState({ recovering: true, blockingRecovering: true }))
    expect(queryByTestId('recovery-overlay')).not.toBeNull()
  })

  it('never shows with more than one server', async () => {
    useServersStore.setState({ servers: { ...oneServer, b: server('b') } })
    const { queryByTestId } = await renderWithI18n(<RecoveryHost />)
    await act(async () => useQueryRecoveryStore.setState({ recovering: true, blockingRecovering: true }))
    expect(queryByTestId('recovery-overlay')).toBeNull()
  })

  it('reports what held the flag once, only when the cap is reached', async () => {
    await renderWithI18n(<RecoveryHost />)
    await act(async () => useQueryRecoveryStore.setState({ recovering: true, blockingRecovering: true }))
    await act(async () => jest.advanceTimersByTime(RECOVERY_OVERLAY_MAX_MS - 1))
    expect(captureSafeMessage).not.toHaveBeenCalled()
    await act(async () => jest.advanceTimersByTime(1))
    expect(addSafeBreadcrumb).toHaveBeenCalledWith('recovery_overlay_expired', { sessions_paused: 1, online: true })
    expect(captureSafeMessage).toHaveBeenCalledTimes(1)
    expect(captureSafeMessage).toHaveBeenCalledWith('recovery_overlay_expired')
  })

  it('reports nothing when the recovery ends before the cap', async () => {
    await renderWithI18n(<RecoveryHost />)
    await act(async () => useQueryRecoveryStore.setState({ recovering: true, blockingRecovering: true }))
    await act(async () => jest.advanceTimersByTime(RECOVERY_OVERLAY_MAX_MS - 1))
    await act(async () => useQueryRecoveryStore.setState({ recovering: false, blockingRecovering: false }))
    await act(async () => jest.advanceTimersByTime(RECOVERY_OVERLAY_MAX_MS))
    expect(captureSafeMessage).not.toHaveBeenCalled()
  })
})

describe('RecoveryHost over a Hub list fetch', () => {
  // Every attempt times out after the sessions list's 12 s per-call budget.
  const timingOut = () => new Promise<string[]>((_, reject) => setTimeout(() => reject({ code: 'TIMEOUT' }), 12_000))

  function List() {
    const { data } = useQuery({
      queryKey: ['sessions'],
      queryFn: ({ client, queryKey }) =>
        withSilentRetries(timingOut, { background: client.getQueryData(queryKey) !== undefined }),
      retry: false,
    })
    return <Text testID="list">{data?.join(',')}</Text>
  }

  async function renderList(client: QueryClient) {
    return renderWithI18n(
      <QueryClientProvider client={client}>
        <List />
        <RecoveryHost />
      </QueryClientProvider>,
    )
  }

  it('keeps a loaded list usable while its refetch retries', async () => {
    const client = new QueryClient()
    client.setQueryData(['sessions'], ['cached'])
    const ui = await renderList(client)
    void client.refetchQueries({ queryKey: ['sessions'] })
    await act(async () => { await jest.advanceTimersByTimeAsync(12_000) })
    expect(selectIsRecovering(useQueryRecoveryStore.getState())).toBe(true)
    expect(ui.getByTestId('list').props.children).toBe('cached')
    expect(ui.queryByTestId('recovery-overlay')).toBeNull()
  })

  it('covers the screen while a first load retries (the control)', async () => {
    const ui = await renderList(new QueryClient())
    await act(async () => { await jest.advanceTimersByTimeAsync(12_000) })
    expect(ui.queryByTestId('recovery-overlay')).not.toBeNull()
  })
})
