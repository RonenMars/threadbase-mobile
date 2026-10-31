import React from 'react'
import { act, fireEvent } from '@testing-library/react-native'
import { TreeSessionsList } from '@/components/sessions/tree/TreeSessionsList'
import { renderWithI18n } from '@/test-utils/render'
import i18n from '@/test-utils/i18n-setup'
import type { MultiConversation, MultiSession } from '@/types/api'

jest.mock('use-debounce', () => ({
  useDebounce: <T,>(value: T): [T] => [value],
}))

const mockSearch = jest.fn()
jest.mock('@/hooks/useConversations', () => ({
  useConversationSearch: () => mockSearch(),
}))

function session(id: string): MultiSession {
  return {
    id,
    serverId: 'srv-1',
    status: 'idle',
    ptyAttached: false,
    lifecycle: 'attached',
    subStatus: null,
    projectPath: '/home/user/needle',
    projectName: 'needle',
    lastOutput: '',
    elapsedMs: 1000,
    promptCount: 1,
    startedAt: new Date().toISOString(),
  }
}

function conversation(id: string): MultiConversation {
  return {
    id,
    serverId: 'srv-1',
    projectPath: '/home/user/needle',
    projectName: 'needle',
    messageCount: 3,
    lastActivity: new Date().toISOString(),
    preview: 'hello',
  } as MultiConversation
}

beforeEach(async () => {
  await i18n.changeLanguage('en')
})

it('renders pluralised, translated search section headers', async () => {
  mockSearch.mockReturnValue({ data: { conversations: [conversation('c1')] } })
  const { getByPlaceholderText, getByText } = await renderWithI18n(
    <TreeSessionsList
      sessions={[session('s1'), session('s2')]}
      summaries={[]}
      refreshing={false}
      onRefresh={() => {}}
      searchOpen
    />,
  )
  await act(async () => {
    fireEvent.changeText(getByPlaceholderText('Search sessions & conversations…'), 'needle')
  })
  expect(getByText('Conversations · 1 result')).toBeTruthy()
  expect(getByText('Sessions · 2 results')).toBeTruthy()
})
