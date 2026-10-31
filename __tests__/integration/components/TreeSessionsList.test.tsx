import React from 'react'
import { waitFor } from '@testing-library/react-native'
import { TreeSessionsList } from '@/components/sessions/tree/TreeSessionsList'
import { renderWithI18n } from '@/test-utils/render'
import i18n from '@/test-utils/i18n-setup'
import type { MultiSession } from '@/types/api'

jest.mock('@/hooks/useConversations', () => ({
  useConversationSearch: () => ({ data: undefined }),
}))

function session(id: string, projectName: string): MultiSession {
  return {
    id,
    serverId: 'srv-1',
    status: 'idle',
    ptyAttached: false,
    lifecycle: 'detached',
    subStatus: null,
    projectPath: `/home/user/${projectName}`,
    projectName,
    lastOutput: '',
    elapsedMs: 1000,
    promptCount: 1,
    startedAt: new Date().toISOString(),
  }
}

function renderTree(searchQuery: string) {
  return renderWithI18n(
    <TreeSessionsList
      sessions={[session('hit', 'needle-app'), session('miss', 'other-app')]}
      summaries={[]}
      refreshing={false}
      onRefresh={() => {}}
      searchOpen
      searchQuery={searchQuery}
    />,
  )
}

beforeEach(async () => {
  await i18n.changeLanguage('en')
})

describe('TreeSessionsList search', () => {
  it('replaces the tree with the sessions that match the query the screen passes in', async () => {
    const { getByTestId, queryByTestId } = await renderTree('needle')
    await waitFor(() => expect(getByTestId('session-row-hit')).toBeTruthy())
    expect(queryByTestId('session-row-miss')).toBeNull()
  })
})
