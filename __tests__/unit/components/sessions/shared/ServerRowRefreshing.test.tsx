import { render } from '@testing-library/react-native'
import { ServerHeaderRow } from '@/components/sessions/tree/ServerHeaderRow'
import { ServerRootRow } from '@/components/sessions/tree/ServerRootRow'
import { SyncCachedNotice } from '@/components/sessions/SyncCachedNotice'
import type { TreeNode } from '@/components/sessions/tree/types'

const node: TreeNode = {
  name: 'root',
  fullPath: '/',
  children: new Map(),
  sessions: [],
  conversations: [],
  totalCount: 0,
  directCount: 0,
}

describe('ServerHeaderRow refresh spinner', () => {
  it('shows the spinner when isRefreshing', async () => {
    const { getByTestId } = await render(
      <ServerHeaderRow serverId="s1" serverLabel="Server 1" totalCount={3} isRefreshing />,
    )
    expect(getByTestId('server-header-refreshing-s1')).toBeTruthy()
  })

  it('shows the spinner in collapsible mode too', async () => {
    const { getByTestId } = await render(
      <ServerHeaderRow serverId="s1" serverLabel="Server 1" totalCount={3} collapsible isExpanded onToggle={jest.fn()} isRefreshing />,
    )
    expect(getByTestId('server-header-refreshing-s1')).toBeTruthy()
  })

  it('hides the spinner when not refreshing', async () => {
    const { queryByTestId, queryByText } = await render(
      <ServerHeaderRow serverId="s1" serverLabel="Server 1" totalCount={3} />,
    )
    expect(queryByTestId('server-header-refreshing-s1')).toBeNull()
    expect(queryByText('Showing cached data')).toBeNull()
  })

  it('shows the cached-data chip when refreshing', async () => {
    const { getByText } = await render(
      <ServerHeaderRow serverId="s1" serverLabel="Server 1" totalCount={3} isRefreshing />,
    )
    expect(getByText('Showing cached data')).toBeTruthy()
  })
})

describe('ServerRootRow refresh spinner', () => {
  it('shows the spinner when isRefreshing', async () => {
    const { getByTestId } = await render(
      <ServerRootRow node={node} serverLabel="Server 1" collapsible isExpanded onToggle={jest.fn()} onSelectLeaf={jest.fn()} isRefreshing />,
    )
    expect(getByTestId('server-root-refreshing')).toBeTruthy()
  })

  it('hides the spinner when not refreshing', async () => {
    const { queryByTestId } = await render(
      <ServerRootRow node={node} serverLabel="Server 1" collapsible={false} isExpanded={false} onToggle={jest.fn()} onSelectLeaf={jest.fn()} />,
    )
    expect(queryByTestId('server-root-refreshing')).toBeNull()
  })

  it('shows the cached-data chip only in multi-server (collapsible) mode', async () => {
    const multi = await render(
      <ServerRootRow node={node} serverLabel="Server 1" collapsible isExpanded onToggle={jest.fn()} onSelectLeaf={jest.fn()} isRefreshing />,
    )
    expect(multi.getByText('Showing cached data')).toBeTruthy()

    const single = await render(
      <ServerRootRow node={node} serverLabel="Server 1" collapsible={false} isExpanded={false} onToggle={jest.fn()} onSelectLeaf={jest.fn()} isRefreshing />,
    )
    expect(single.queryByText('Showing cached data')).toBeNull()
  })
})

describe('SyncCachedNotice', () => {
  it('renders the full syncing message when visible', async () => {
    const { getByText, getByTestId } = await render(<SyncCachedNotice visible variant="banner" />)
    expect(getByText('Showing cached data — syncing…')).toBeTruthy()
    expect(getByTestId('sync-cached-notice-banner')).toBeTruthy()
  })

  it('renders the caption variant with its own testID', async () => {
    const { getByTestId } = await render(<SyncCachedNotice visible variant="caption" />)
    expect(getByTestId('sync-cached-notice-caption')).toBeTruthy()
  })

  it('renders nothing when not visible', async () => {
    const { queryByText } = await render(<SyncCachedNotice visible={false} variant="banner" />)
    expect(queryByText('Showing cached data — syncing…')).toBeNull()
  })
})
