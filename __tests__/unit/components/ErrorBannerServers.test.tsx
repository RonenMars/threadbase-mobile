import { ErrorBanner } from '@/components/ErrorBanner'
import { useLoadingStateStore } from '@/stores/loading-state'
import { useServerFetchStatusStore } from '@/stores/serverFetchStatus'
import { useServersStore } from '@/stores/servers'
import { useErrorSheetStore } from '@/stores/errorSheet'
import { renderWithI18n } from '@/test-utils/render'
import { queryClient } from '@/services/query-client'
import { fireEvent, waitFor } from '@testing-library/react-native'
import type { ServerConfig } from '@/types/api'

function server(id: string, url: string, label?: string): ServerConfig {
  return { id, url, apiKey: '', label, isConnected: false, serverInfo: null, connectionError: null }
}

function seedFailures(count: number) {
  const servers: Record<string, ServerConfig> = {}
  const statuses: Record<string, { status: 'error'; error: string; lastCheckedAt: number }> = {}
  for (let i = 0; i < count; i++) {
    const id = `s${i}`
    // Only the first server carries a label; the rest fall back to their address.
    servers[id] = server(id, `https://host-${i}.example`, i === 0 ? 'Studio Mac' : undefined)
    statuses[id] = { status: 'error', error: `unreachable ${i}`, lastCheckedAt: 0 }
  }
  useServersStore.setState({ servers })
  useServerFetchStatusStore.setState({ statuses })
  useLoadingStateStore.setState({
    errors: [{ id: 'sessions', category: 'sessions', message: 'network down' }],
  })
}

describe('ErrorBanner server rows', () => {
  beforeEach(() => {
    useErrorSheetStore.setState({ open: false })
    useLoadingStateStore.setState({ errors: [] })
    useServerFetchStatusStore.setState({ statuses: {} })
    useServersStore.setState({ servers: {} })
  })

  it('renders one row per failing server, named or addressed, and opens the sheet automatically', async () => {
    seedFailures(3)
    const { getByTestId, getByText } = await renderWithI18n(<ErrorBanner />)

    getByTestId('error-sheet-row-s0')
    getByTestId('error-sheet-row-s1')
    getByTestId('error-sheet-row-s2')
    getByText('Studio Mac')
    getByText('https://host-1.example')
    expect(useErrorSheetStore.getState().open).toBe(true)
  })

  it('offers Retry all only when more than one thing failed', async () => {
    seedFailures(3)
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined)
    const { getByText } = await renderWithI18n(<ErrorBanner />)

    fireEvent.press(getByText('Retry all'))
    // No key filter — every failing server and category is in the list.
    expect(invalidate).toHaveBeenCalledWith()
    expect(useLoadingStateStore.getState().errors).toHaveLength(0)
    invalidate.mockRestore()
  })

  it('shows no Retry all for a single failure', async () => {
    seedFailures(1)
    const { queryByText, getByTestId } = await renderWithI18n(<ErrorBanner />)

    getByTestId('error-sheet-row-s0')
    expect(queryByText('Retry all')).toBeNull()
  })

  it('drills a row into ServerErrorModal, falling back to the fetch error', async () => {
    seedFailures(2)
    const { getByTestId, findByText } = await renderWithI18n(<ErrorBanner />)

    fireEvent.press(getByTestId('error-sheet-row-s1'))

    // connectionError is null on these servers, so the modal would show an empty
    // error box without the serverFetchStatus fallback.
    await findByText('unreachable 1')
    // A DetailRow label only ServerErrorModal renders, proving the drill-in
    // landed there rather than just expanding the row in place.
    await findByText('URL')
  })

  it('skips a failing server that is no longer in the store', async () => {
    seedFailures(1)
    // The shape removeServer used to leave behind: a status entry outliving its
    // ServerConfig. Its row titled itself with the raw id and tapped into a
    // modal that renders null.
    useServerFetchStatusStore.setState({
      statuses: {
        ...useServerFetchStatusStore.getState().statuses,
        srv_ghost: { status: 'error', error: 'gone', lastCheckedAt: 0 },
      },
    })

    const { queryByTestId } = await renderWithI18n(<ErrorBanner />)

    queryByTestId('error-sheet-row-s0')
    expect(queryByTestId('error-sheet-row-srv_ghost')).toBeNull()
  })

  it('disables the retry icon while its retry is in flight, then re-enables it', async () => {
    seedFailures(1)
    let resolveInvalidate: () => void = () => {}
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries').mockReturnValue(
      new Promise((resolve) => { resolveInvalidate = () => resolve(undefined) }),
    )
    const { getByTestId } = await renderWithI18n(<ErrorBanner />)

    fireEvent.press(getByTestId('error-sheet-retry-s0'))
    await waitFor(() => {
      expect(getByTestId('error-sheet-retry-s0').props.accessibilityState?.disabled).toBe(true)
    })

    resolveInvalidate()
    await waitFor(() => {
      expect(getByTestId('error-sheet-retry-s0').props.accessibilityState?.disabled).toBeFalsy()
    })
    invalidate.mockRestore()
  })
})
