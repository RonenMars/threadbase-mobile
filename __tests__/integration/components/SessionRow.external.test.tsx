/**
 * SessionRow (project hub) — external-session routing + alive indicator (M/P3).
 *
 * An external row must never reach the PTY screen (whose discovered-session
 * variant exposes the destructive Overtake path) and must never open the
 * input-oriented long-press actions.
 */
import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import { Alert } from 'react-native'
import { SessionRow } from '@/components/sessions/hub/SessionRow'
import type { MultiSession } from '@/types/api'

const mockPush = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({}),
}))

const mockCancel = jest.fn()
jest.mock('@/hooks/useSessionActions', () => ({
  useSessionActions: () => ({
    cancelSession: { mutate: mockCancel, isPending: false },
  }),
}))

const makeSession = (overrides: Partial<MultiSession> = {}): MultiSession => ({
  id: 'sess-1',
  serverId: 'server-1',
  status: 'idle',
  ptyAttached: false,
  subStatus: null,
  projectPath: '/home/user/my-project',
  projectName: 'my-project',
  lastOutput: '',
  elapsedMs: 1000,
  promptCount: 0,
  startedAt: '2026-01-01T00:00:00Z',
  ...overrides,
})

beforeEach(() => {
  mockPush.mockClear()
  mockCancel.mockClear()
})

describe('SessionRow — external session', () => {
  it('marks an alive external row with the distinct EXTERNAL pill', async () => {
    const { getByText, queryByText } = await render(
      <SessionRow session={makeSession({ ownership: 'external', processLiveness: 'alive' })} />,
    )
    expect(getByText('EXTERNAL')).toBeTruthy()
    expect(queryByText('LIVE')).toBeNull()
  })

  it('marks a managed live row with the interactive LIVE pill', async () => {
    const { getByText, queryByText } = await render(
      <SessionRow session={makeSession({ status: 'running', ptyAttached: true })} />,
    )
    expect(getByText('LIVE')).toBeTruthy()
    expect(queryByText('EXTERNAL')).toBeNull()
  })

  it('routes an external row to the read-only conversation view, not /session', async () => {
    const session = makeSession({
      ownership: 'external',
      processLiveness: 'alive',
      conversationId: 'conv-abc',
    })
    const { getByTestId } = await render(<SessionRow session={session} />)
    await fireEvent.press(getByTestId('session-row-sess-1'))
    expect(mockPush).toHaveBeenCalledWith('/conversation/conv-abc?server=server-1')
    expect(mockPush).not.toHaveBeenCalledWith(expect.stringContaining('/session/'))
  })

  it('prefers boundConversationId when routing an external row', async () => {
    const session = makeSession({
      ownership: 'external',
      conversationId: 'conv-abc',
      boundConversationId: 'rollout-xyz',
    })
    const { getByTestId } = await render(<SessionRow session={session} />)
    await fireEvent.press(getByTestId('session-row-sess-1'))
    expect(mockPush).toHaveBeenCalledWith('/conversation/rollout-xyz?server=server-1')
  })

  it('routes a managed row to the PTY session screen', async () => {
    const { getByTestId } = await render(
      <SessionRow session={makeSession({ status: 'running', ptyAttached: true })} />,
    )
    await fireEvent.press(getByTestId('session-row-sess-1'))
    expect(mockPush).toHaveBeenCalledWith('/session/sess-1?server=server-1')
  })

  it('suppresses the long-press Cancel actions for an external row', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    try {
      const { getByTestId } = await render(
        <SessionRow session={makeSession({ ownership: 'external' })} />,
      )
      await fireEvent(getByTestId('session-row-sess-1'), 'longPress')
      expect(alertSpy).not.toHaveBeenCalled()
      expect(mockCancel).not.toHaveBeenCalled()
    } finally {
      alertSpy.mockRestore()
    }
  })

  it('renders an older-server payload (no new fields) without crashing', async () => {
    const { getByTestId, queryByText } = await render(<SessionRow session={makeSession()} />)
    expect(getByTestId('session-row-sess-1')).toBeTruthy()
    expect(queryByText('EXTERNAL')).toBeNull()
    expect(queryByText('LIVE')).toBeNull()
  })
})
