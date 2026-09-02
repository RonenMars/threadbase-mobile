import { ErrorBanner } from '@/components/ErrorBanner'
import { BannerHost } from '@/components/ui/BannerHost'
import { useLoadingStateStore } from '@/stores/loading-state'
import { useServerFetchStatusStore } from '@/stores/serverFetchStatus'
import { useServersStore } from '@/stores/servers'
import { useBannerStore } from '@/stores/banners'
import { renderWithI18n } from '@/test-utils/render'
import { queryClient } from '@/services/query-client'
import { fireEvent } from '@testing-library/react-native'
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
    useBannerStore.setState({ banners: [] })
    useLoadingStateStore.setState({ errors: [] })
    useServerFetchStatusStore.setState({ statuses: {} })
    useServersStore.setState({ servers: {} })
  })

  it('renders one row per failing server, named or addressed', async () => {
    seedFailures(3)
    const { getByTestId, getByText } = await renderWithI18n(
      <>
        <ErrorBanner />
        <BannerHost />
      </>,
    )

    getByTestId('banner-row-s0')
    getByTestId('banner-row-s1')
    getByTestId('banner-row-s2')
    getByText('Studio Mac')
    getByText('https://host-1.example')
  })

  it('survives a full 68-server outage as 68 rows under one banner', async () => {
    seedFailures(68)
    const { getByTestId, queryAllByTestId } = await renderWithI18n(
      <>
        <ErrorBanner />
        <BannerHost />
      </>,
    )

    // One banner, not 68 — and the header reads as a summary, not a server name.
    expect(useBannerStore.getState().banners).toHaveLength(1)
    expect(useBannerStore.getState().banners[0].items).toHaveLength(68)
    getByTestId('banner-row-s0')
    // FlatList windows the rest; only a screenful is mounted.
    expect(queryAllByTestId(/^banner-row-s/).length).toBeLessThan(68)
  })

  it('offers Retry all only when more than one thing failed', async () => {
    seedFailures(3)
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined)
    const { getByText } = await renderWithI18n(
      <>
        <ErrorBanner />
        <BannerHost />
      </>,
    )

    fireEvent.press(getByText('Retry all'))
    // No key filter — every failing server and category is in the list.
    expect(invalidate).toHaveBeenCalledWith()
    expect(useLoadingStateStore.getState().errors).toHaveLength(0)
    invalidate.mockRestore()
  })

  it('shows no Retry all for a single failure', async () => {
    seedFailures(1)
    const { queryByText, getByTestId } = await renderWithI18n(
      <>
        <ErrorBanner />
        <BannerHost />
      </>,
    )

    getByTestId('banner-row-s0')
    expect(queryByText('Retry all')).toBeNull()
  })

  it('drills a row into ServerErrorModal, falling back to the fetch error', async () => {
    seedFailures(2)
    const { getByTestId, findByText } = await renderWithI18n(
      <>
        <ErrorBanner />
        <BannerHost />
      </>,
    )

    fireEvent.press(getByTestId('banner-row-s1'))

    // connectionError is null on these servers, so the modal would show an empty
    // error box without the serverFetchStatus fallback.
    await findByText('unreachable 1')
    // A DetailRow label only ServerErrorModal renders, proving the drill-in
    // landed there rather than just expanding the row in place.
    await findByText('URL')
  })
})
