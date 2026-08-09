import { useServerGroups } from '@/components/sessions/hub/useServerGroups'
import type { ProjectGroup } from '@/components/sessions/hub/useProjectGroups'
import { renderHook } from '@testing-library/react-native'

function makeGroup(
  overrides: Partial<ProjectGroup> & Pick<ProjectGroup, 'projectId' | 'projectPath' | 'serverId'>,
): ProjectGroup {
  return {
    projectName: 'proj',
    sessions: [],
    conversationCount: 0,
    latestActivityMs: 0,
    earliestStartMs: 0,
    ...overrides,
  }
}

describe('useServerGroups', () => {
  it('keeps empty/offline servers visible as zero-count sections', async () => {
    const groups = [
      makeGroup({
        projectId: '/tmp/a',
        projectPath: '/tmp/a',
        serverId: 'srv-A',
        conversationCount: 1,
      }),
    ]

    const { result } = await renderHook(() =>
      useServerGroups(groups, ['srv-A', 'srv-B'], {
        'srv-A': 'Alpha',
        'srv-B': 'Beta',
      }),
    )

    expect(result.current).toHaveLength(2)
    expect(result.current[0]).toMatchObject({ serverId: 'srv-A', totalCount: 1 })
    expect(result.current[1]).toMatchObject({
      serverId: 'srv-B',
      totalCount: 0,
      groups: [],
    })
  })
})
