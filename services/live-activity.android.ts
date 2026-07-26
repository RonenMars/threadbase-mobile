import * as Notifications from 'expo-notifications'

import { decideActions, liveActivityKey, toLiveState, type TrackedActivity } from './live-activity'
import type { Session } from '@/types/api'
import type { LiveSessionState } from '@/types/live-activity'

/**
 * Android has no Live Activity. A running session is surfaced as an ongoing
 * notification instead, reusing `decideActions` unchanged so the cap and
 * eviction policy stay identical across platforms.
 *
 * Android 16 (API 36) can promote such a notification to a status-bar chip via
 * `setRequestPromotedOngoing`, with `setUsesChronometer` for a self-ticking
 * elapsed time. `expo-notifications` exposes neither — only `sticky`, which maps
 * to `setOngoing`. So this is the plain ongoing notification the runbook names
 * as the acceptable floor: no chip, and elapsed time is not shown at all rather
 * than shown frozen, since without a chronometer it could only be a snapshot
 * that silently goes stale.
 */
const CHANNEL_ID = 'live-sessions'

interface AndroidHandle extends TrackedActivity {
  notificationId: string
}

const handles = new Map<string, AndroidHandle>()

// Ordering only — see the iOS module for why this is a counter and not a clock.
let touchCounter = 0

let channelReady: Promise<void> | null = null

function ensureChannel(): Promise<void> {
  channelReady ??= Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Live sessions',
    // Anything below DEFAULT forfeits promotion on API 36+ and can be collapsed
    // out of the shade entirely.
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: null,
    enableVibrate: false,
    showBadge: false,
  }).then(() => undefined)
  return channelReady
}

function body(state: LiveSessionState): string {
  const status = state.status === 'waiting_input' ? 'Waiting for input' : 'Running'
  return state.lastOutput ? `${status} — ${state.lastOutput}` : status
}

async function present(key: string, state: LiveSessionState): Promise<void> {
  await ensureChannel()
  const notificationId = await Notifications.scheduleNotificationAsync({
    identifier: handles.get(key)?.notificationId,
    content: {
      title: state.projectName,
      body: body(state),
      sticky: true,
      autoDismiss: false,
      // `liveSession` marks this as ours: push notifications also carry a
      // sessionId, and adoption must not dismiss those.
      data: { liveSession: true, sessionId: state.sessionId, serverId: state.serverId },
    },
    trigger: null,
  })
  handles.set(key, { key, lastUpdatedAt: ++touchCounter, notificationId })
}

async function dismiss(key: string): Promise<void> {
  const handle = handles.get(key)
  if (!handle) return
  handles.delete(key)
  await Notifications.dismissNotificationAsync(handle.notificationId)
}

export async function reconcile(serverId: string, session: Session): Promise<void> {
  const key = liveActivityKey(serverId, session.id)
  const tracked: TrackedActivity[] = [...handles.values()].map(({ key: k, lastUpdatedAt }) => ({
    key: k,
    lastUpdatedAt,
  }))
  for (const action of decideActions(tracked, toLiveState(session, serverId), key)) {
    if (action.type === 'end') {
      await dismiss(action.key)
    } else {
      // start and update are the same call: posting with an existing id replaces
      // the notification in place rather than stacking a second one.
      await present(action.key, action.state)
    }
  }
}

/**
 * Ongoing notifications outlive the JS context, so a restart would leave
 * untouchable surfaces frozen on stale data. Clearing them is the honest option;
 * the next `session_update` re-posts anything still live.
 *
 * Only this channel's notifications are dismissed — push notifications live on
 * other channels and are not ours to clear.
 */
export async function adoptRunningActivities(): Promise<void> {
  handles.clear()
  const presented = await Notifications.getPresentedNotificationsAsync()
  await Promise.all(
    presented
      .filter((n) => n.request.content.data?.liveSession === true)
      .map((n) => Notifications.dismissNotificationAsync(n.request.identifier)),
  )
}

/** Test seam — the module-level map would otherwise leak between cases. */
export function resetLiveActivities(): void {
  handles.clear()
}
