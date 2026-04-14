import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import { SessionCard } from '@/components/sessions/SessionCard'
import type { Session } from '@/types/api'

const mockPush = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({}),
}))

jest.mock('@/hooks/useSessionActions', () => ({
  useSessionActions: () => ({
    cancelSession: { mutate: jest.fn(), isPending: false },
    sendInput: { mutate: jest.fn(), isPending: false },
    addToQueue: { mutate: jest.fn(), isPending: false },
    removeFromQueue: { mutate: jest.fn(), isPending: false },
    respondToPlan: { mutate: jest.fn(), isPending: false },
  }),
}))

const makeSession = (overrides: Partial<Session> = {}): Session => ({
  id: 'session-1',
  status: 'running',
  projectPath: '/home/user/my-project',
  projectName: 'my-project',
  lastOutput: 'Running tests...',
  elapsedMs: 65000,
  promptCount: 3,
  startedAt: '2024-01-01T00:00:00Z',
  ...overrides,
})

beforeEach(() => {
  mockPush.mockClear()
})

describe('SessionCard', () => {
  it('renders the project name', () => {
    const { getByText } = render(<SessionCard session={makeSession()} />)
    expect(getByText('my-project')).toBeTruthy()
  })

  it('renders the status badge', () => {
    const { getByText } = render(<SessionCard session={makeSession({ status: 'running' })} />)
    expect(getByText('Running')).toBeTruthy()
  })

  it('renders elapsed time in correct format', () => {
    const { getByText } = render(<SessionCard session={makeSession({ elapsedMs: 65000 })} />)
    expect(getByText('1m 5s')).toBeTruthy()
  })

  it('renders elapsed seconds when under a minute', () => {
    const { getByText } = render(<SessionCard session={makeSession({ elapsedMs: 30000 })} />)
    expect(getByText('30s')).toBeTruthy()
  })

  it('renders hours format for long sessions', () => {
    const { getByText } = render(<SessionCard session={makeSession({ elapsedMs: 3660000 })} />)
    expect(getByText('1h 1m')).toBeTruthy()
  })

  it('renders prompt count', () => {
    const { getByText } = render(<SessionCard session={makeSession({ promptCount: 5 })} />)
    expect(getByText('5 prompts')).toBeTruthy()
  })

  it('renders last output text', () => {
    const { getByText } = render(<SessionCard session={makeSession({ lastOutput: 'Test output line' })} />)
    expect(getByText('Test output line')).toBeTruthy()
  })

  it('renders branch badge when branch is set', () => {
    const { getByText } = render(<SessionCard session={makeSession({ branch: 'feature/new-api' })} />)
    expect(getByText('feature/new-api')).toBeTruthy()
  })

  it('does not render branch badge when branch is absent', () => {
    const { queryByText } = render(<SessionCard session={makeSession({ branch: undefined })} />)
    expect(queryByText('feature/new-api')).toBeNull()
  })

  it('renders machine badge when machineName is set', () => {
    const { getByText } = render(<SessionCard session={makeSession({ machineName: 'my-mac' })} />)
    expect(getByText('my-mac')).toBeTruthy()
  })

  it('shows waiting_input status label', () => {
    const { getByText } = render(<SessionCard session={makeSession({ status: 'waiting_input' })} />)
    expect(getByText('Waiting for Input')).toBeTruthy()
  })

  it('navigates to session detail on press', () => {
    const session = makeSession({ id: 'abc-123' })
    const { getByRole } = render(<SessionCard session={session} />)
    fireEvent.press(getByRole('button'))
    expect(mockPush).toHaveBeenCalledWith('/session/abc-123')
  })

  it('has correct accessibility label', () => {
    const session = makeSession({ projectName: 'my-project', status: 'running', elapsedMs: 30000 })
    const { getByLabelText } = render(<SessionCard session={session} />)
    expect(getByLabelText('Session my-project, status running, 30s')).toBeTruthy()
  })
})
