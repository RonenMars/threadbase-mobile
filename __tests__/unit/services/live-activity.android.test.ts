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

  it('posts an ongoing notification carrying the session identity', async () => {
    await reconcile('srv-1', session())
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

  it('distinguishes waiting_input from running in the body', async () => {
    await reconcile('srv-1', session({ status: 'waiting_input' }))
    expect(schedule.mock.calls[0][0].content.body).toContain('Waiting for input')
  })

  it('replaces in place on update rather than stacking a second notification', async () => {
    await reconcile('srv-1', session())
    await reconcile('srv-1', session({ lastOutput: 'still going' }))
    expect(schedule).toHaveBeenCalledTimes(2)
    expect(schedule.mock.calls[1][0].identifier).toBe('notif-1')
  })

  it('dismisses the notification when the session turns terminal', async () => {
    await reconcile('srv-1', session())
    await reconcile('srv-1', session({ processLiveness: 'gone' }))
    expect(dismiss).toHaveBeenCalledWith('notif-1')
  })

  it('honors the shared cap, evicting the least recently updated', async () => {
    await reconcile('srv-1', session({ id: 'a' }))
    await reconcile('srv-1', session({ id: 'b' }))
    await reconcile('srv-1', session({ id: 'c' }))
    await reconcile('srv-1', session({ id: 'a', lastOutput: 'fresh' }))
    await reconcile('srv-1', session({ id: 'd' }))
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
