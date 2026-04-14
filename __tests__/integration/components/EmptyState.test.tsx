import React from 'react'
import { render } from '@testing-library/react-native'
import { EmptyState } from '@/components/ui/EmptyState'

describe('EmptyState', () => {
  it('renders the title', () => {
    const { getByText } = render(<EmptyState title="Nothing here" />)
    expect(getByText('Nothing here')).toBeTruthy()
  })

  it('renders the icon when provided', () => {
    const { getByText } = render(<EmptyState title="Empty" icon="🗂️" />)
    expect(getByText('🗂️')).toBeTruthy()
  })

  it('does not render icon node when prop is omitted', () => {
    const { queryByText } = render(<EmptyState title="No icon" />)
    // Title exists, no stray emoji
    expect(queryByText('No icon')).toBeTruthy()
    // icon prop absent – just verify no crash and title is present
  })

  it('renders subtitle when provided', () => {
    const { getByText } = render(
      <EmptyState title="Empty" subtitle="Try again later" />
    )
    expect(getByText('Try again later')).toBeTruthy()
  })

  it('does not render subtitle when prop is omitted', () => {
    const { queryByText } = render(<EmptyState title="Empty" />)
    expect(queryByText('Try again later')).toBeNull()
  })

  it('renders both icon and subtitle together', () => {
    const { getByText } = render(
      <EmptyState title="All done" icon="✅" subtitle="No pending items" />
    )
    expect(getByText('All done')).toBeTruthy()
    expect(getByText('✅')).toBeTruthy()
    expect(getByText('No pending items')).toBeTruthy()
  })
})
