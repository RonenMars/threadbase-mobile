import React from 'react'
import { screen } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NeedsYouCard } from '@/components/sessions/now/NeedsYouCard'
import { renderWithI18n } from '@/test-utils/render'
import type { MultiSession, Prompt } from '@/types/api'

jest.mock('@/hooks/useSessionActions', () => ({
  useSessionActions: () => ({
    stopSession: { mutateAsync: jest.fn(), isPending: false },
    stopWhenIdle: { mutateAsync: jest.fn(), isPending: false },
  }),
}))

const CLEAR_HINT = '\x1b[?25l\rnew task? /clear to save 165.2k tokens ·\x1b[?25h'

const openPrompt = {
  promptId: 'p1',
  revision: 1,
  state: 'open',
  questions: [{ questionId: 'q1', text: 'Run the migration?', inputMode: 'single', options: [], allowOther: false, secret: false }],
} as unknown as Prompt

const session = (overrides: Partial<MultiSession> = {}): MultiSession => ({
  id: 'sid',
  serverId: 'server-1',
  status: 'waiting_input',
  ptyAttached: true,
  lifecycle: 'attached',
  subStatus: null,
  projectPath: '/home/user/tb-mobile',
  projectName: 'tb-mobile',
  branch: 'main',
  lastOutput: CLEAR_HINT,
  elapsedMs: 1000,
  promptCount: 1,
  startedAt: new Date().toISOString(),
  ...overrides,
})

function renderCard(s: MultiSession) {
  return renderWithI18n(
    <QueryClientProvider client={new QueryClient()}>
      <NeedsYouCard session={s} title="Fix login redirect" />
    </QueryClientProvider>,
  )
}

describe('NeedsYouCard mono line', () => {
  it('shows no terminal noise when the streamer says no question is open', async () => {
    await renderCard(session({ hasOpenPrompt: false }))
    expect(screen.queryByText(/clear to save/)).toBeNull()
  })

  it('shows the open question text instead of the terminal tail', async () => {
    await renderCard(session({ hasOpenPrompt: true, pendingPrompts: [openPrompt] }))
    expect(screen.getByText('Run the migration?')).toBeTruthy()
    expect(screen.queryByText(/clear to save/)).toBeNull()
  })

  it('keeps the terminal tail on an older streamer that omits hasOpenPrompt', async () => {
    await renderCard(session({ hasOpenPrompt: undefined, lastOutput: 'Allow this edit? (y/n)' }))
    expect(screen.getByText('Allow this edit? (y/n)')).toBeTruthy()
  })
})
