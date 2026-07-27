import * as Notifications from 'expo-notifications'

import {
  adoptRunningActivities,
  reconcile,
  resetLiveActivities,
} from '@/services/live-activity.android'
import type { Session } from '@/types/api'

const schedule = jest.mocked(Notifications.scheduleNotificationAsync)
const dismiss = jest.mocked(Notifications.dismissNotificationAsync)
const presented = jest.mocked(Notifications.getPresentedNotificationsAsync)

type Presented = Awaited<ReturnType<typeof Notifications.getPresentedNotificationsAsync>>[number]

/** Only the two fields adoption reads; the real shape is far wider. */
function presentedNotification(identifier: string, data: Record<string, unknown>): Presented {
  const partial: Pick<Presented, 'request'> = {
    request: { identifier, content: { data } } as Presented['request'],
  }
  return partial as Presented
}

function session(overrides: Partial<Session> = {}): Session {
  return {
    id: 'sess-1',
    status: 'running',
    ptyAttached: true,
    projectPath: '/home/dev/threadbase',
    projectName: 'threadbase',
    lastOutput: 'compiling',
    elapsedMs: 1_000,
    promptCount: 1,
    startedAt: '2026-07-25T10:00:00.000Z',
    ...overrides,
  }
}

describe('android live session notifications', () => {
  beforeEach(() => {
    resetLiveActivities()
    schedule.mockClear()
    dismiss.mockClear()
    let n = 0
    schedule.mockImplementation(async () => `notif-${++n}`)
  })

  /** Opens a turn the way the streamer does: waiting_input, then running. */
  async function openTurn(serverId: string, overrides: Partial<Session> = {}): Promise<void> {
    await reconcile(serverId, session({ ...overrides, status: 'waiting_input' }))
    await reconcile(serverId, session({ ...overrides, status: 'running' }))
  }

  it('does nothing for a session’s very first running — no prior turn to open', async () => {
    await reconcile('srv-1', session())
    expect(schedule).not.toHaveBeenCalled()
  })

  it('posts an ongoing notification when a turn opens', async () => {
    await openTurn('srv-1')
    expect(schedule).toHaveBeenCalledTimes(1)
    const request = schedule.mock.calls[0][0]
    expect(request.content).toMatchObject({
      title: 'threadbase',
      sticky: true,
      autoDismiss: false,
      data: { liveSession: true, sessionId: 'sess-1', serverId: 'srv-1' },
    })
    expect(request.trigger).toBeNull()
  })

  it('replaces in place on a same-status re-emit rather than stacking a second notification', async () => {
    await openTurn('srv-1')
    await reconcile('srv-1', session({ status: 'running', lastOutput: 'still going' }))
    expect(schedule).toHaveBeenCalledTimes(2)
    expect(schedule.mock.calls[1][0].identifier).toBe('notif-1')
  })

  it('replaces the ongoing notification with a dismissible finished one when the turn closes', async () => {
    await openTurn('srv-1')
    await reconcile('srv-1', session({ status: 'waiting_input' }))
    expect(dismiss).not.toHaveBeenCalled()
    expect(schedule).toHaveBeenCalledTimes(2)
    const request = schedule.mock.calls[1][0]
    expect(request.identifier).toBe('notif-1')
    expect(request.content).toMatchObject({ sticky: false, autoDismiss: true })
    expect(request.content.body).toContain('Finished')
  })

  it('dismisses the notification with no final frame when a turn dies mid-turn', async () => {
    await openTurn('srv-1')
    await reconcile('srv-1', session({ status: 'running', processLiveness: 'gone' }))
    expect(dismiss).toHaveBeenCalledWith('notif-1')
  })

  it('honors the shared cap, evicting the least recently updated', async () => {
    await openTurn('srv-1', { id: 'a' })
    await openTurn('srv-1', { id: 'b' })
    await openTurn('srv-1', { id: 'c' })
    await reconcile('srv-1', session({ id: 'a', status: 'running', lastOutput: 'fresh' }))
    await openTurn('srv-1', { id: 'd' })
    // 'b' was posted second, so its id is notif-2.
    expect(dismiss).toHaveBeenCalledWith('notif-2')
  })

  it('clears only its own notifications on adoption, leaving push alone', async () => {
    presented.mockResolvedValueOnce([
      presentedNotification('ours', { liveSession: true }),
      presentedNotification('push', { sessionId: 'x' }),
    ])
    await adoptRunningActivities()
    expect(dismiss).toHaveBeenCalledWith('ours')
    expect(dismiss).not.toHaveBeenCalledWith('push')
  })
})
