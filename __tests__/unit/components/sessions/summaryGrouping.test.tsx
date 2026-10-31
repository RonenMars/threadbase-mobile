import { renderHook } from '@testing-library/react-native'
import { basename } from '@/components/sessions/shared/pathTail'
import { buildTree, compactTree, hasLiveSession, activeSessionColor } from '@/components/sessions/tree/treeUtils'
import { useProjectGroups } from '@/components/sessions/hub/useProjectGroups'
import type { MultiProjectSummary } from '@/hooks/useProjectSummaries'
import type { MultiSession } from '@/types/api'

const summary = (path: string, count: number, lastActivity: string): MultiProjectSummary => ({
  path,
  name: basename(path) ?? path,
  conversationCount: count,
  lastActivity,
  serverId: 'srv-1',
  serverLabel: 'Server 1',
})

const session: MultiSession = {
  id: 's1',
  serverId: 'srv-1',
  serverLabel: 'Server 1',
  status: 'running',
  ptyAttached: true,
  subStatus: null,
  projectId: 'project-1',
  projectPath: '/dev/tb-mobile',
  projectName: 'tb-mobile',
  lastOutput: '',
  elapsedMs: 0,
  promptCount: 1,
  startedAt: '2026-08-08T10:00:00.000Z',
}

describe('tree built from project summaries', () => {
  it('counts a project by its summary without holding any conversation rows', () => {
    const tree = compactTree(
      buildTree([session], [
        summary('/dev/tb-mobile', 171, '2026-08-09T03:45:12.289Z'),
        summary('/dev/blog', 2, '2026-08-05T10:01:15.663Z'),
      ]),
    )

    // 171 + 2 conversations + 1 session, none of them materialized as rows.
    expect(tree.totalCount).toBe(174)

    const dev = tree.children.get('dev')!
    const mobile = dev.children.get('tb-mobile')!
    expect(mobile.conversationCount).toBe(171)
    expect(mobile.sessions).toHaveLength(1)
    // The verbatim server path, not the reassembled one — this is what gets
    // sent back as ?project= when the node is opened.
    expect(mobile.projectPath).toBe('/dev/tb-mobile')
  })

  it('keeps a Windows project path verbatim even though fullPath is normalised', () => {
    const tree = buildTree([], [summary('C:\\dev\\app', 3, '2026-08-08T00:00:00.000Z')])
    const node = tree.children.get('C:')!.children.get('dev')!.children.get('app')!
    expect(node.fullPath).toBe('/C:/dev/app')
    expect(node.projectPath).toBe('C:\\dev\\app')
  })
})

describe('useProjectGroups with summaries', () => {
  it('merges a summary into the group its live session already created', async () => {
    const { result } = await renderHook(() =>
      useProjectGroups(
        [session],
        [summary('/dev/tb-mobile', 171, '2026-08-09T03:45:12.289Z')],
        'lastActivity',
        'desc',
      ),
    )

    expect(result.current).toHaveLength(1)
    expect(result.current[0]).toMatchObject({
      projectPath: '/dev/tb-mobile',
      serverId: 'srv-1',
      conversationCount: 171,
    })
    expect(result.current[0].sessions).toHaveLength(1)
  })

  it('keeps the same project on two servers as two groups', async () => {
    const otherServer: MultiProjectSummary = {
      ...summary('/dev/tb-mobile', 4, '2026-08-01T00:00:00.000Z'),
      serverId: 'srv-2',
      serverLabel: 'Server 2',
    }

    const { result } = await renderHook(() =>
      useProjectGroups(
        [],
        [summary('/dev/tb-mobile', 171, '2026-08-09T03:45:12.289Z'), otherServer],
        'lastActivity',
        'desc',
      ),
    )

    expect(result.current.map((g) => [g.serverId, g.conversationCount])).toEqual([
      ['srv-1', 171],
      ['srv-2', 4],
    ])
  })
})

describe('liveExternalCount from project summaries', () => {
  const withLive = (path: string, n: number | undefined): MultiProjectSummary => ({
    ...summary(path, 3, '2026-08-09T03:45:12.289Z'),
    ...(n === undefined ? {} : { liveExternalCount: n }),
  })

  it('lands on the tree node and the hub group', async () => {
    const tree = (buildTree([], [withLive('/dev/a', 2)]))
    expect(tree.children.get('dev')!.children.get('a')!.liveExternalCount).toBe(2)

    const { result } = await renderHook(() => useProjectGroups([], [withLive('/dev/a', 2)], 'lastActivity', 'desc'))
    expect(result.current[0].liveExternalCount).toBe(2)
  })

  it('is 0 for a streamer that predates the field', async () => {
    const tree = (buildTree([], [withLive('/dev/a', undefined)]))
    expect(tree.children.get('dev')!.children.get('a')!.liveExternalCount).toBe(0)

    const { result } = await renderHook(() => useProjectGroups([], [withLive('/dev/a', undefined)], 'lastActivity', 'desc'))
    expect(result.current[0].liveExternalCount).toBe(0)
  })

  it('treats a non-numeric value as 0', () => {
    const bad = Object.assign(withLive('/dev/a', 1), { liveExternalCount: 'lots' })
    const tree = (buildTree([], [bad]))
    expect(tree.children.get('dev')!.children.get('a')!.liveExternalCount).toBe(0)
  })

  it('marks a node with only external conversations live', () => {
    const live = buildTree([], [withLive('/dev/a', 2)]).children.get('dev')!.children.get('a')!
    const quiet = buildTree([], [withLive('/dev/a', undefined)]).children.get('dev')!.children.get('a')!
    expect(hasLiveSession(live)).toBe(true)
    expect(activeSessionColor(live)).not.toBeNull()
    expect(hasLiveSession(quiet)).toBe(false)
    expect(activeSessionColor(quiet)).toBeNull()
  })
})
