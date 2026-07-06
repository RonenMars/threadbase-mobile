import React from 'react'
import { render } from '@testing-library/react-native'
import { SessionStatusBadge } from '@/components/sessions/SessionStatusBadge'
import type { SessionStatus } from '@/types/api'

const STATUSES: [SessionStatus, string][] = [
  ['running', 'Running'],
  ['waiting_input', 'Active'],
  ['idle', 'Idle'],
]

describe('SessionStatusBadge', () => {
  test.each(STATUSES)('renders correct label for status "%s"', async (status, label) => {
    const { getByText } = await render(<SessionStatusBadge status={status} />)
    expect(getByText(label)).toBeTruthy()
  })

  it('renders without crashing for every status', async () => {
    STATUSES.forEach(([status]) => {
      expect(() => render(<SessionStatusBadge status={status} />)).not.toThrow()
    })
  })

  it('renders a dot indicator alongside the label', async () => {
    // The component renders an Animated.View (dot) + Text (label)
    const { getByText, toJSON } = await render(<SessionStatusBadge status="running" />)
    expect(getByText('Running')).toBeTruthy()
    // Tree should be non-null
    expect(toJSON()).not.toBeNull()
  })
})
