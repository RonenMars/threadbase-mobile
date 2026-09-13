import React from 'react'
import { ClassicSessionsList } from '@/components/sessions/classic/ClassicSessionsList'
import { renderWithI18n } from '@/test-utils/render'
import i18n from '@/test-utils/i18n-setup'
import type { MultiSession } from '@/types/api'

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({}),
}))

jest.mock('@/hooks/useSessionActions', () => ({
  useSessionActions: () => ({
    cancelSession: { mutate: jest.fn(), isPending: false },
    sendInput: { mutate: jest.fn(), isPending: false },
    addToQueue: { mutate: jest.fn(), isPending: false },
    removeFromQueue: { mutate: jest.fn(), isPending: false },
  }),
}))

const makeSession = (overrides: Partial<MultiSession>): MultiSession => ({
  id: 'session-1',
  serverId: 'server-1',
  status: 'running',
  ptyAttached: true,
  subStatus: null,
  projectPath: '/home/user/my-project',
  projectName: 'my-project',
  lastOutput: '',
  elapsedMs: 1000,
  promptCount: 1,
  startedAt: '2024-01-01T00:00:00Z',
  ...overrides,
})

// A held session keeps `status: 'waiting_input'` on the wire after its process
// is gone; only `lifecycle` says so. The eyebrow must not count it as live.
const held = makeSession({ id: 'held', status: 'waiting_input', ptyAttached: false, lifecycle: 'resumable' })
const attached = makeSession({ id: 'live', status: 'running', lifecycle: 'attached' })

beforeEach(async () => {
  await i18n.changeLanguage('en')
})

describe('ClassicSessionsList live gate', () => {
  it('counts only process-live sessions under LIVE', async () => {
    const { getByText } = await renderWithI18n(
      <ClassicSessionsList sessions={[held, attached]} refreshing={false} onRefresh={() => {}} />,
    )
    expect(getByText('LIVE · 1')).toBeTruthy()
  })

  it('reads IDLE when every session is held', async () => {
    const { getByText } = await renderWithI18n(
      <ClassicSessionsList sessions={[held]} refreshing={false} onRefresh={() => {}} />,
    )
    expect(getByText('IDLE · 1')).toBeTruthy()
  })
})
