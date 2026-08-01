import React from 'react'
import { render } from '@testing-library/react-native'
import { SessionStatusBadge } from '@/components/sessions/SessionStatusBadge'
import type { SessionPresentationInput } from '@/lib/sessionPresentation'
import type { SessionStatus } from '@/types/api'

const managed = (status: SessionStatus): SessionPresentationInput => ({
  status,
  ownership: 'managed',
  ptyAttached: status === 'running' || status === 'waiting_input',
})

const STATUSES: [SessionStatus, string][] = [
  ['running', 'Running'],
  ['waiting_input', 'Waiting'],
  ['idle', 'Idle'],
]

describe('SessionStatusBadge', () => {
  test.each(STATUSES)('renders correct label for status "%s"', async (status, label) => {
    const { getByText } = await render(<SessionStatusBadge session={managed(status)} />)
    expect(getByText(label)).toBeTruthy()
  })

  it('renders without crashing for every status', async () => {
    for (const [status] of STATUSES) {
      await render(<SessionStatusBadge session={managed(status)} />)
    }
  })

  it('renders a dot indicator alongside the label', async () => {
    const { getByText, toJSON } = await render(<SessionStatusBadge session={managed('running')} />)
    expect(getByText('Running')).toBeTruthy()
    expect(toJSON()).not.toBeNull()
  })

  it('renders the distinct "External" label for an alive external process', async () => {
    const { getByText, queryByText } = await render(
      <SessionStatusBadge
        session={{ status: 'idle', ownership: 'external', processLiveness: 'alive' }}
      />,
    )
    expect(getByText('External')).toBeTruthy()
    expect(queryByText('Idle')).toBeNull()
  })

  it('is visually distinct from a managed running session', async () => {
    const external = await render(
      <SessionStatusBadge
        session={{ status: 'idle', ownership: 'external', processLiveness: 'alive' }}
      />,
    )
    const running = await render(<SessionStatusBadge session={managed('running')} />)
    expect(external.getByText('External')).toBeTruthy()
    expect(external.queryByText('Running')).toBeNull()
    expect(running.getByText('Running')).toBeTruthy()
    expect(running.queryByText('External')).toBeNull()
  })

  it('uses presentation kind from a full session payload', async () => {
    const { getByTestId, getByText } = await render(
      <SessionStatusBadge
        session={{
          status: 'running',
          ownership: 'managed',
          ptyAttached: true,
          resumedFromConversationId: 'c1',
        }}
      />,
    )
    expect(getByTestId('session-status-resumed')).toBeTruthy()
    expect(getByText('Resumed')).toBeTruthy()
  })

  it('labels a recovered session by what interrupted it', async () => {
    const { getByTestId, getByText } = await render(
      <SessionStatusBadge
        session={{
          status: 'idle',
          ownership: 'historical',
          ptyAttached: false,
          interruptedStatus: 'running',
        }}
      />,
    )
    expect(getByTestId('session-status-historical')).toBeTruthy()
    expect(getByText('Interrupted')).toBeTruthy()
  })
})
