import { render } from '@testing-library/react-native'
import { ServerHeaderRow } from '@/components/sessions/tree/ServerHeaderRow'
import { ServerRootRow } from '@/components/sessions/tree/ServerRootRow'
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
  it('shows the spinner when isRefreshing', () => {
    const { getByTestId } = render(
      <ServerHeaderRow serverId="s1" serverLabel="Server 1" totalCount={3} isRefreshing />,
    )
    expect(getByTestId('server-header-refreshing-s1')).toBeTruthy()
  })

  it('shows the spinner in collapsible mode too', () => {
    const { getByTestId } = render(
      <ServerHeaderRow serverId="s1" serverLabel="Server 1" totalCount={3} collapsible isExpanded onToggle={jest.fn()} isRefreshing />,
    )
    expect(getByTestId('server-header-refreshing-s1')).toBeTruthy()
  })

  it('hides the spinner when not refreshing', () => {
    const { queryByTestId } = render(
      <ServerHeaderRow serverId="s1" serverLabel="Server 1" totalCount={3} />,
    )
    expect(queryByTestId('server-header-refreshing-s1')).toBeNull()
  })
})

describe('ServerRootRow refresh spinner', () => {
  it('shows the spinner when isRefreshing', () => {
    const { getByTestId } = render(
      <ServerRootRow node={node} serverLabel="Server 1" collapsible isExpanded onToggle={jest.fn()} onSelectLeaf={jest.fn()} isRefreshing />,
    )
    expect(getByTestId('server-root-refreshing')).toBeTruthy()
  })

  it('hides the spinner when not refreshing', () => {
    const { queryByTestId } = render(
      <ServerRootRow node={node} serverLabel="Server 1" collapsible={false} isExpanded={false} onToggle={jest.fn()} onSelectLeaf={jest.fn()} />,
    )
    expect(queryByTestId('server-root-refreshing')).toBeNull()
  })
})
