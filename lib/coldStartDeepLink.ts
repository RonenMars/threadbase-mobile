import type { Href } from 'expo-router'

/**
 * Cold-start routing for taps that launch the app from a terminated state.
 *
 * The warm path is already covered: expo-router handles a URL delivered to a
 * running app, and `addNotificationResponseReceivedListener` handles a
 * notification tap. Neither fires when the tap *starts* the process — the
 * listener is registered after the launch event has already been consumed — so
 * the app lands on `/` instead of the session. Lock Screen and Live Activity
 * taps are overwhelmingly cold starts, which is what makes this path matter.
 */

/** A resolved deep-link destination. `sessionId` is kept so callers can mark
 *  the nav guard without re-parsing the path they were just handed. */
export interface SessionRoute {
  sessionId: string
  path: Href
}

function route(sessionId: string, serverId: string | null | undefined): SessionRoute {
  return {
    sessionId,
    path: serverId ? `/session/${sessionId}?server=${serverId}` : `/session/${sessionId}`,
  }
}

/** `threadbase://session/<id>?server=<serverId>` → a route, or null. */
export function sessionRouteFromUrl(url: string | null | undefined): SessionRoute | null {
  if (!url) return null
  const match = /^threadbase:\/\/session\/([^/?#]+)(?:\?(.*))?$/.exec(url)
  if (!match) return null
  const sessionId = decodeURIComponent(match[1])
  if (!sessionId) return null
  return route(sessionId, new URLSearchParams(match[2] ?? '').get('server'))
}

/** Notification payloads carry the same identity as fields rather than a URL. */
export function sessionRouteFromNotificationData(data: {
  sessionId?: string
  serverId?: string
}): SessionRoute | null {
  if (!data.sessionId) return null
  return route(data.sessionId, data.serverId)
}

/** What the OS hands back when the app is launched by a tap. */
export interface ColdStartLaunch {
  url: string | null
  notificationData: { sessionId?: string; serverId?: string } | null
}

/**
 * Resolves the launch event to a destination. A URL wins over a notification:
 * a Live Activity tap always carries one, and if both are somehow present the
 * URL is the more specific signal.
 */
export function resolveColdStartRoute(launch: ColdStartLaunch): SessionRoute | null {
  return (
    sessionRouteFromUrl(launch.url) ??
    (launch.notificationData
      ? sessionRouteFromNotificationData(launch.notificationData)
      : null)
  )
}
