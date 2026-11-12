import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'
import { ThemeProvider } from '@/contexts/ThemeContext'
import ProjectDetailScreen from '@/app/project/[id]'

const mockHeaderOptions: { current: { headerRight?: () => React.ReactNode } } = { current: {} }

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'proj', path: '%2Fwork%2Fproj', server: 'srv_alpha' }),
  useNavigation: () => ({
    setOptions: (options: { headerRight?: () => React.ReactNode }) => {
      mockHeaderOptions.current = options
    },
  }),
}))

jest.mock('@/hooks/useProjectConversations', () => ({
  useProjectConversations: () => ({
    conversations: [],
    isFetching: false,
    refresh: jest.fn(),
    fetchNextPage: jest.fn(),
    hasNextPage: false,
  }),
}))

jest.mock('@/hooks/useConversations', () => ({
  useConversationSearch: () => ({ data: undefined, isError: false }),
}))

jest.mock('@/components/conversation/ConversationList', () => ({
  ConversationList: ({ searchOpen }: { searchOpen?: boolean }) => {
    const { Text: RNText } = require('react-native')
    return <RNText testID="list-search-open">{String(searchOpen)}</RNText>
  },
}))

async function renderScreen() {
  const view = await render(
    <ThemeProvider>
      <ProjectDetailScreen />
    </ThemeProvider>,
  )
  const header = () => render(<>{mockHeaderOptions.current.headerRight?.()}</>)
  return { ...view, header }
}

describe('ProjectDetailScreen search', () => {
  it('opens with the search closed and a search icon in the header', async () => {
    const { getByTestId, header } = await renderScreen()
    expect(getByTestId('list-search-open').props.children).toBe('false')
    expect((await header()).getByTestId('project-search-btn')).toBeTruthy()
  })

  it('opens the search when the header icon is tapped, and closes it on a second tap', async () => {
    const { getByTestId, header } = await renderScreen()

    await fireEvent.press((await header()).getByTestId('project-search-btn'))
    expect(getByTestId('list-search-open').props.children).toBe('true')

    await fireEvent.press((await header()).getByTestId('project-search-btn'))
    expect(getByTestId('list-search-open').props.children).toBe('false')
  })
})
