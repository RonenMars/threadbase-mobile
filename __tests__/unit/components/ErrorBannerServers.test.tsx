import { AlertHost } from '@/components/alerts/AlertHost'
import { useLoadingStateStore } from '@/stores/loading-state'
import { useServerFetchStatusStore } from '@/stores/serverFetchStatus'
import { useServersStore } from '@/stores/servers'
import { useErrorSheetStore } from '@/stores/errorSheet'
import { useAlertStore } from '@/stores/alerts'
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

describe('Status sheet server rows', () => {
  beforeEach(() => {
    useErrorSheetStore.setState({ open: false })
    useAlertStore.getState().reset()
    useLoadingStateStore.setState({ errors: [] })
    useServerFetchStatusStore.setState({ statuses: {} })
    useServersStore.setState({ servers: {} })
  })

  it('renders one row per failing server, named or addressed, once the sheet is opened', async () => {
    seedFailures(3)
    useErrorSheetStore.setState({ open: true })
    const { getByTestId, getByText } = await renderWithI18n(<AlertHost />)

    getByTestId('error-sheet-row-s0')
    getByTestId('error-sheet-row-s1')
    getByTestId('error-sheet-row-s2')
    getByText('Studio Mac')
    getByText('https://host-1.example')
    expect(useErrorSheetStore.getState().open).toBe(true)
  })

  it('offers Retry everything only when more than one thing failed', async () => {
    seedFailures(3)
    useErrorSheetStore.setState({ open: true })
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined)
    const { getByText } = await renderWithI18n(<AlertHost />)

    fireEvent.press(getByText('Retry everything'))
    expect(invalidate).toHaveBeenCalledTimes(3)
    invalidate.mockRestore()
  })

  it('shows no Retry everything for a single failure', async () => {
    seedFailures(1)
    useErrorSheetStore.setState({ open: true })
    const { queryByText, getByTestId } = await renderWithI18n(<AlertHost />)

    getByTestId('error-sheet-row-s0')
    expect(queryByText('Retry everything')).toBeNull()
  })

  it('expands technical details with the fetch error instead of drilling into ServerErrorModal', async () => {
    seedFailures(2)
    useErrorSheetStore.setState({ open: true })
    const { getByTestId, findByText, queryByText } = await renderWithI18n(<AlertHost />)

    fireEvent.press(getByTestId('status-row-details-s1'))

    await findByText('unreachable 1')
    expect(queryByText('URL')).toBeNull()
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

    useErrorSheetStore.setState({ open: true })
    const { queryByTestId } = await renderWithI18n(<AlertHost />)

    expect(queryByTestId('error-sheet-row-s0')).toBeTruthy()
    expect(queryByTestId('error-sheet-row-srv_ghost')).toBeNull()
  })

  it('disables the retry button while its retry is in flight, then re-enables it', async () => {
    seedFailures(1)
    useErrorSheetStore.setState({ open: true })
    let resolveInvalidate: () => void = () => {}
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries').mockReturnValue(
      new Promise((resolve) => { resolveInvalidate = () => resolve(undefined) }),
    )
    const { getByTestId } = await renderWithI18n(<AlertHost />)

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
