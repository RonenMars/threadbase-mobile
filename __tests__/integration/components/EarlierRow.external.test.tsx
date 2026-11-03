import React from 'react'
import { render } from '@testing-library/react-native'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { EarlierRow } from '@/components/sessions/now/EarlierRow'
import type { MultiConversation } from '@/types/api'
import i18n from '@/test-utils/i18n-setup'

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({}),
}))

const conv = (o: Partial<MultiConversation> = {}): MultiConversation => ({
  id: 'c1',
  serverId: 'srv-1',
  title: 'Earlier chat',
  projectPath: '/tmp/project',
  messageCount: 2,
  lastActivity: '2026-10-30T10:00:00.000Z',
  ...o,
})

const renderRow = (c: MultiConversation) =>
  render(
    <ThemeProvider>
      <EarlierRow
        item={{ kind: 'conversation', ms: Date.parse(c.lastActivity), item: c }}
        title={c.title}
      />
    </ThemeProvider>,
  )

beforeEach(async () => {
  await i18n.changeLanguage('en')
})

describe('EarlierRow — conversation', () => {
  it('marks a live-outside conversation as Observed', async () => {
    const { getByText } = await renderRow(conv({ ownership: 'external', processLiveness: 'alive' }))
    expect(getByText('Observed')).toBeTruthy()
  })

  it('renders as before without the fields', async () => {
    const { queryByText } = await renderRow(conv())
    expect(queryByText('Observed')).toBeNull()
  })
})
