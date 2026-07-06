import React from 'react'
import { render } from '@testing-library/react-native'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { EmptyState } from '@/components/ui/EmptyState'

async function wrap(ui: React.ReactElement) {
  return await render(<ThemeProvider>{ui}</ThemeProvider>)
}

describe('EmptyState', () => {
  it('renders the title', async () => {
    const { getByText } = await wrap(<EmptyState title="Nothing here" />)
    expect(getByText('Nothing here')).toBeTruthy()
  })

  it('renders subtitle when provided', async () => {
    const { getByText } = await wrap(
      <EmptyState title="Empty" subtitle="Try again later" />
    )
    expect(getByText('Try again later')).toBeTruthy()
  })

  it('does not render subtitle when prop is omitted', async () => {
    const { queryByText } = await wrap(<EmptyState title="Empty" />)
    expect(queryByText('Try again later')).toBeNull()
  })

  it('renders title and subtitle together', async () => {
    const { getByText } = await wrap(
      <EmptyState title="All done" subtitle="No pending items" />
    )
    expect(getByText('All done')).toBeTruthy()
    expect(getByText('No pending items')).toBeTruthy()
  })
})
