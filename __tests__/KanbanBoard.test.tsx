import React from 'react'
import { render } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { KanbanBoard } from '@/components/sessions/KanbanBoard'
import type { Session, SessionStatus } from '@/types/api'

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

const makeSession = (id: string, status: SessionStatus): Session => ({
  id,
  status,
  projectPath: `/home/user/projects/${id}`,
  projectName: id,
  lastOutput: `Output from ${id}`,
  elapsedMs: 12345,
  promptCount: 3,
  startedAt: new Date().toISOString(),
})

const mockSessions: Record<SessionStatus, Session[]> = {
  running: [makeSession('proj-a', 'running'), makeSession('proj-b', 'running')],
  waiting_input: [makeSession('proj-c', 'waiting_input')],
  completed: [makeSession('proj-d', 'completed')],
  failed: [],
  idle: [],
}

describe('KanbanBoard', () => {
  it('renders all four columns', () => {
    const { getAllByText, getByText } = render(
      <KanbanBoard
        sessionsByStatus={mockSessions}
        onRefresh={jest.fn()}
        refreshing={false}
      />,
      { wrapper }
    )
    // "Running" appears in both the column header and each session's status badge
    expect(getAllByText('Running').length).toBeGreaterThanOrEqual(1)
    // These are unique (only one session in waiting/completed, no sessions in failed)
    expect(getAllByText('Waiting for Input').length).toBeGreaterThanOrEqual(1)
    expect(getAllByText('Completed').length).toBeGreaterThanOrEqual(1)
    expect(getByText('Failed')).toBeTruthy()
  })

  it('shows correct counts per column', () => {
    const { getAllByText } = render(
      <KanbanBoard
        sessionsByStatus={mockSessions}
        onRefresh={jest.fn()}
        refreshing={false}
      />,
      { wrapper }
    )
    // Running column header badge: 2
    const twoBadges = getAllByText('2')
    expect(twoBadges.length).toBeGreaterThanOrEqual(1)
  })

  it('renders session project names', () => {
    const { getByText } = render(
      <KanbanBoard
        sessionsByStatus={mockSessions}
        onRefresh={jest.fn()}
        refreshing={false}
      />,
      { wrapper }
    )
    expect(getByText('proj-a')).toBeTruthy()
    expect(getByText('proj-c')).toBeTruthy()
  })

  it('shows empty state for column with no sessions', () => {
    const { getByText } = render(
      <KanbanBoard
        sessionsByStatus={mockSessions}
        onRefresh={jest.fn()}
        refreshing={false}
      />,
      { wrapper }
    )
    expect(getByText('No failed sessions')).toBeTruthy()
  })
})
