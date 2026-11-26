import React from 'react'
import { Keyboard } from 'react-native'
import { ConversationList } from '@/components/conversation/ConversationList'
import { renderWithI18n } from '@/test-utils/render'

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }))

const list = (searchPending: boolean) => (
  <ConversationList conversations={[]} refreshing={false} onRefresh={() => {}} onEndReached={() => {}} searchQuery="wombat" onSearchChange={() => {}} searchPending={searchPending} />
)

afterEach(() => jest.restoreAllMocks())

it('shows the searching animation while in flight, then "No results"', async () => {
  const r = await renderWithI18n(list(true))
  expect(r.getByTestId('searching-animation')).toBeTruthy()
  expect(r.queryByText('No results')).toBeNull()
  const answered = await renderWithI18n(list(false))
  expect(answered.getByText('No results')).toBeTruthy()
  expect(answered.queryByTestId('searching-animation')).toBeNull()
})

it('covers its results with the keyboard overlay while searching', async () => {
  jest.spyOn(Keyboard, 'isVisible').mockReturnValue(true)
  const r = await renderWithI18n(list(false))
  expect(r.getByTestId('keyboard-dismiss-overlay')).toBeTruthy()
})
