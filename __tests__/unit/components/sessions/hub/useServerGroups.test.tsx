import { useServerGroups } from '@/components/sessions/hub/useServerGroups'
import type { ProjectGroup } from '@/components/sessions/hub/useProjectGroups'
import type { MultiConversation } from '@/types/api'
import { renderHook } from '@testing-library/react-native'

function makeGroup(
  overrides: Partial<ProjectGroup> & Pick<ProjectGroup, 'projectId' | 'projectPath'>,
): ProjectGroup {
  return {
    projectName: 'proj',
    sessions: [],
    conversations: [],
    latestActivityMs: 0,
    earliestStartMs: 0,
    ...overrides,
  }
}

describe('useServerGroups', () => {
  it('keeps empty/offline servers visible as zero-count sections', async () => {
    const conversation = {
      id: 'c1',
      serverId: 'srv-A',
      projectPath: '/tmp/a',
      projectName: 'a',
      title: 'c1',
      messageCount: 1,
      lastActivity: '2026-07-01T00:00:00.000Z',
    } as MultiConversation

    const groups = [
      makeGroup({
        projectId: '/tmp/a',
        projectPath: '/tmp/a',
        conversations: [conversation],
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
