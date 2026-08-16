import React from 'react'
import { render, screen } from '@testing-library/react-native'
import { HistoryLoadBoundary } from '@/components/conversation/HistoryLoadBoundary'

// Three states, one per the boundary's own doc comment: a spinner while a
// page is in flight, a quiet marker while has_more_older is true and idle,
// nothing once the list has walked back to from_index 0 (has_more_older false).
describe('HistoryLoadBoundary', () => {
  it('shows the spinner while a page is in flight, regardless of hasOlder', async () => {
    await render(<HistoryLoadBoundary hasOlder isFetching />)
    expect(screen.getByTestId('history-load-boundary-spinner')).toBeTruthy()
    expect(screen.queryByTestId('history-load-boundary-marker')).toBeNull()
  })

  it('shows the idle marker when older history remains and nothing is in flight', async () => {
    await render(<HistoryLoadBoundary hasOlder isFetching={false} />)
    // Decorative and marked accessibilityElementsHidden — RNTL's default
    // queries skip accessibility-hidden nodes, so opt back in explicitly.
    expect(screen.getByTestId('history-load-boundary-marker', { includeHiddenElements: true })).toBeTruthy()
    expect(screen.queryByTestId('history-load-boundary-spinner')).toBeNull()
  })

  it('renders nothing once from_index reaches 0 (hasOlder false, not fetching)', async () => {
    const { toJSON } = await render(<HistoryLoadBoundary hasOlder={false} isFetching={false} />)
    expect(toJSON()).toBeNull()
  })
})
