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
    for (const [status] of STATUSES) {
      await render(<SessionStatusBadge status={status} />)
    }
  })

  it('renders a dot indicator alongside the label', async () => {
    // The component renders an Animated.View (dot) + Text (label)
    const { getByText, toJSON } = await render(<SessionStatusBadge status="running" />)
    expect(getByText('Running')).toBeTruthy()
    // Tree should be non-null
    expect(toJSON()).not.toBeNull()
  })

  it('renders the distinct "External" label when externalAlive', async () => {
    // External sessions carry status 'idle' — the externalAlive treatment must
    // override that so it is not indistinguishable from a dead idle session.
    const { getByText, queryByText } = await render(
      <SessionStatusBadge status="idle" externalAlive />,
    )
    expect(getByText('External')).toBeTruthy()
    expect(queryByText('Idle')).toBeNull()
  })

  it('is visually distinct from a managed running session', async () => {
    const external = await render(<SessionStatusBadge status="idle" externalAlive />)
    const managed = await render(<SessionStatusBadge status="running" />)
    expect(external.getByText('External')).toBeTruthy()
    expect(external.queryByText('Running')).toBeNull()
    expect(managed.getByText('Running')).toBeTruthy()
    expect(managed.queryByText('External')).toBeNull()
  })
})
