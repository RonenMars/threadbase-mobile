import i18n from '@/test-utils/i18n-setup'
import { getSessionStatusLabel } from '@/components/sessions/sessionStatusLabel'
import type { SessionStatusLabel } from '@/lib/sessionPresentation'

describe('getSessionStatusLabel', () => {
  it.each<[SessionStatusLabel, string]>([
    ['running', 'Running'],
    ['waiting', 'Waiting'],
    ['idle', 'Idle'],
    ['externalLive', 'External'],
    ['historical', 'History'],
    ['interrupted', 'Interrupted'],
    ['interruptedWaiting', 'Was waiting'],
    ['resumed', 'Resumed'],
    ['onHold', 'On hold'],
    ['completed', 'Completed'],
    ['failed', 'Failed'],
    ['unavailablePath', 'Unavailable'],
    ['unavailableWorktree', 'Worktree gone'],
    ['stale', 'Stale'],
    ['starting', 'Starting up'],
  ])('translates the %s semantic status', (status, expected) => {
    expect(getSessionStatusLabel(status, i18n.getFixedT('en', 'sessions'))).toBe(expected)
  })
})
