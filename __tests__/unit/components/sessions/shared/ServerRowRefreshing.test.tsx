import { render } from '@testing-library/react-native'
import { ServerHeaderRow } from '@/components/sessions/tree/ServerHeaderRow'
import { SyncCachedNotice } from '@/components/sessions/SyncCachedNotice'
import { KnightRiderScanner } from '@/components/sessions/KnightRiderScanner'

describe('ServerHeaderRow refresh spinner', () => {
  it('shows the scanner when isRefreshing', async () => {
    const { getByTestId } = await render(
      <ServerHeaderRow serverId="s1" serverLabel="Server 1" totalCount={3} isRefreshing />,
    )
    expect(getByTestId('server-header-refreshing-s1')).toBeTruthy()
  })

  it('shows the scanner in collapsible mode too', async () => {
    const { getByTestId } = await render(
      <ServerHeaderRow serverId="s1" serverLabel="Server 1" totalCount={3} collapsible isExpanded onToggle={jest.fn()} isRefreshing />,
    )
    expect(getByTestId('server-header-refreshing-s1')).toBeTruthy()
  })

  it('hides the scanner when not refreshing', async () => {
    const { queryByTestId, queryByText } = await render(
      <ServerHeaderRow serverId="s1" serverLabel="Server 1" totalCount={3} />,
    )
    expect(queryByTestId('server-header-refreshing-s1')).toBeNull()
    expect(queryByText('Showing cached data')).toBeNull()
  })
})

describe('SyncCachedNotice', () => {
  it('renders the banner scanner when visible', async () => {
    const { getByTestId, queryByText } = await render(<SyncCachedNotice visible variant="banner" />)
    expect(getByTestId('sync-cached-notice-banner')).toBeTruthy()
    expect(queryByText('Showing cached data — syncing…')).toBeNull()
  })

  it('renders the caption variant with its own testID', async () => {
    const { getByTestId } = await render(<SyncCachedNotice visible variant="caption" />)
    expect(getByTestId('sync-cached-notice-caption')).toBeTruthy()
  })

  it('renders nothing when not visible', async () => {
    const { queryByTestId } = await render(<SyncCachedNotice visible={false} variant="banner" />)
    expect(queryByTestId('sync-cached-notice-banner')).toBeNull()
  })
})

describe('KnightRiderScanner', () => {
  it('exposes the cached-data label to assistive tech', async () => {
    const { getByLabelText } = await render(<KnightRiderScanner testID="scanner" />)
    expect(getByLabelText('Showing cached data')).toBeTruthy()
  })
})
