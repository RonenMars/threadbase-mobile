import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import { SessionCard } from '@/components/sessions/SessionCard'
import type { MultiSession } from '@/types/api'

const mockPush = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({}),
}))

jest.mock('@/hooks/useSessionActions', () => ({
  useSessionActions: () => ({
    cancelSession: { mutate: jest.fn(), isPending: false },
    sendInput: { mutate: jest.fn(), isPending: false },
  }),
}))

const makeSession = (overrides: Partial<MultiSession> = {}): MultiSession => ({
  id: 'sess-1',
  serverId: 'server-1',
  status: 'idle',
  ptyAttached: false,
  projectPath: '/home/user/my-project',
  projectName: 'my-project',
  lastOutput: '',
  elapsedMs: 1000,
  promptCount: 0,
  startedAt: '2024-01-01T00:00:00Z',
  ...overrides,
})

beforeEach(() => {
  mockPush.mockClear()
})

describe('SessionCard — external session', () => {
  it('renders the distinct "External" indicator for an alive external session', async () => {
    const session = makeSession({ ownership: 'external', processLiveness: 'alive' })
    const { getByText, queryByText } = await render(<SessionCard session={session} />)
    expect(getByText('External')).toBeTruthy()
    // Not indistinguishable from a dead idle session.
    expect(queryByText('Idle')).toBeNull()
  })

  it('is visually distinct from a managed running session', async () => {
    const managed = await render(
      <SessionCard session={makeSession({ id: 'm', status: 'running', ptyAttached: true })} />,
    )
    expect(managed.getByText('Running')).toBeTruthy()
    expect(managed.queryByText('External')).toBeNull()
  })

  it('routes an external row to the read-only conversation view, not /session', async () => {
    const session = makeSession({
      id: 'sess-1',
      ownership: 'external',
      processLiveness: 'alive',
      conversationId: 'conv-abc',
    })
    const { getByRole } = await render(<SessionCard session={session} />)
    await fireEvent.press(getByRole('button'))
    expect(mockPush).toHaveBeenCalledWith('/conversation/conv-abc?server=server-1')
    expect(mockPush).not.toHaveBeenCalledWith(expect.stringContaining('/session/'))
  })

  it('prefers boundConversationId when routing an external row', async () => {
    const session = makeSession({
      id: 'sess-1',
      ownership: 'external',
      processLiveness: 'alive',
      conversationId: 'conv-abc',
      boundConversationId: 'rollout-xyz',
    })
    const { getByRole } = await render(<SessionCard session={session} />)
    await fireEvent.press(getByRole('button'))
    expect(mockPush).toHaveBeenCalledWith('/conversation/rollout-xyz?server=server-1')
  })

  it('routes a managed row to the PTY session screen', async () => {
    const session = makeSession({ id: 'sess-1', status: 'running', ptyAttached: true })
    const { getByRole } = await render(<SessionCard session={session} />)
    await fireEvent.press(getByRole('button'))
    expect(mockPush).toHaveBeenCalledWith('/session/sess-1?server=server-1')
  })

  it('renders an older-server payload (pid only, no new fields) without crashing', async () => {
    // Older servers omit ownership/processLiveness/activity but still send pid
    // for a discovered process — the pid fallback surfaces the alive indicator.
    const session = makeSession({ pid: 4242 })
    const { getByText, queryByText } = await render(<SessionCard session={session} />)
    expect(getByText('External')).toBeTruthy()
    expect(queryByText('Idle')).toBeNull()
  })

  it('renders a plain older-server session (no pid, no new fields) as its status', async () => {
    const session = makeSession({ status: 'idle' })
    const { getByText } = await render(<SessionCard session={session} />)
    expect(getByText('Idle')).toBeTruthy()
  })
})
