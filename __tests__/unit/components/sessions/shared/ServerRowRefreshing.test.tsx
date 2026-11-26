import { render } from '@testing-library/react-native'
import { ServerHeaderRow } from '@/components/sessions/tree/ServerHeaderRow'
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

describe('KnightRiderScanner', () => {
  it('exposes the cached-data label to assistive tech', async () => {
    const { getByLabelText } = await render(<KnightRiderScanner testID="scanner" />)
    expect(getByLabelText('Showing cached data')).toBeTruthy()
  })
})
