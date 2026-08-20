import { render } from '@testing-library/react-native'
import { ServerHeaderRow } from '@/components/sessions/tree/ServerHeaderRow'
import { ServerRootRow } from '@/components/sessions/tree/ServerRootRow'
import { SyncCachedNotice } from '@/components/sessions/SyncCachedNotice'
import { KnightRiderScanner } from '@/components/sessions/KnightRiderScanner'
import type { TreeNode } from '@/components/sessions/tree/types'

const node: TreeNode = {
  name: 'root',
  fullPath: '/',
  children: new Map(),
  sessions: [],
  conversationCount: 0,
  conversationActivityMs: 0,
  totalCount: 0,
  directCount: 0,
}

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

describe('ServerRootRow refresh spinner', () => {
  it('shows the scanner when isRefreshing', async () => {
    const { getByTestId } = await render(
      <ServerRootRow node={node} serverLabel="Server 1" collapsible isExpanded onToggle={jest.fn()} onSelectLeaf={jest.fn()} isRefreshing />,
    )
    expect(getByTestId('server-root-refreshing')).toBeTruthy()
  })

  it('hides the scanner when not refreshing', async () => {
    const { queryByTestId } = await render(
      <ServerRootRow node={node} serverLabel="Server 1" collapsible={false} isExpanded={false} onToggle={jest.fn()} onSelectLeaf={jest.fn()} />,
    )
    expect(queryByTestId('server-root-refreshing')).toBeNull()
  })

  it('shows the scanner in both multi-server and single-server modes', async () => {
    const multi = await render(
      <ServerRootRow node={node} serverLabel="Server 1" collapsible isExpanded onToggle={jest.fn()} onSelectLeaf={jest.fn()} isRefreshing />,
    )
    expect(multi.getByTestId('server-root-refreshing')).toBeTruthy()

    const single = await render(
      <ServerRootRow node={node} serverLabel="Server 1" collapsible={false} isExpanded={false} onToggle={jest.fn()} onSelectLeaf={jest.fn()} isRefreshing />,
    )
    expect(single.getByTestId('server-root-refreshing')).toBeTruthy()
    expect(single.queryByText('Showing cached data')).toBeNull()
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
