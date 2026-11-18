import type { Href } from 'expo-router'
import { conversationHref } from '@/lib/conversationHref'
import { historyConversationIdFor } from '@/lib/sessionPresentation'

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
  serverId?: string
  path: Href
}

function route(sessionId: string, serverId: string | null | undefined): SessionRoute {
  return {
    sessionId,
    serverId: serverId || undefined,
    path: serverId ? `/session/${sessionId}?server=${serverId}` : `/session/${sessionId}`,
  }
}

/** `threadbase[-dev]://session/<id>?server=<serverId>` → a route, or null. */
export function sessionRouteFromUrl(url: string | null | undefined): SessionRoute | null {
  if (!url) return null
  const match = /^threadbase(?:-dev)?:\/\/session\/([^/?#]+)(?:\?(.*))?$/.exec(url)
  if (!match) return null
  const sessionId = decodeURIComponent(match[1])
  if (!sessionId) return null
  return route(sessionId, new URLSearchParams(match[2] ?? '').get('server'))
}

/**
 * Notification payloads carry the same identity as fields rather than a URL.
 *
 * `isKnownServer` drops a `serverId` this app has no entry for. A streamer that
 * predates the id echo (see `PushRegisterPayload.serverId`) sends its own
 * hostname there, which `api-client` rejects as `Unknown server` before any
 * request is made — and the session screen then reads that as "Session not
 * found". Without the server param the screen uses the default server instead.
 */
export function sessionRouteFromNotificationData(
  data: { sessionId?: string; serverId?: string },
  isKnownServer?: (serverId: string) => boolean,
): SessionRoute | null {
  if (!data.sessionId) return null
  const serverId = data.serverId && isKnownServer && !isKnownServer(data.serverId) ? undefined : data.serverId
  return route(data.sessionId, serverId)
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
export function resolveColdStartRoute(
  launch: ColdStartLaunch,
  isKnownServer?: (serverId: string) => boolean,
): SessionRoute | null {
  return (
    sessionRouteFromUrl(launch.url) ??
    (launch.notificationData
      ? sessionRouteFromNotificationData(launch.notificationData, isKnownServer)
      : null)
  )
}

/** How long a tap waits for the session's current state before opening the
 *  session screen anyway, which resolves the same route once it loads. */
export const TAP_STATUS_TIMEOUT_MS = 3000

/**
 * Asks the streamer what the session is now, at tap time, and opens the
 * surface that fits: a push can be tapped hours after it was sent, and an
 * external session has no live screen at all. Any failure or a slow answer
 * keeps the session route; the session screen applies the same rule
 * (`historyConversationIdFor`) when its own fetch lands.
 */
export async function resolveTapRoute(
  target: SessionRoute,
  fetchSession: (sessionId: string, serverId: string) => Promise<Parameters<typeof historyConversationIdFor>[0]>,
  timeoutMs = TAP_STATUS_TIMEOUT_MS,
): Promise<SessionRoute> {
  const { serverId } = target
  if (!serverId) return target
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const session = await Promise.race([
      fetchSession(target.sessionId, serverId),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), timeoutMs)
      }),
    ])
    const convId = session ? historyConversationIdFor(session) : null
    return convId ? { ...target, path: conversationHref(convId, serverId) } : target
  } catch {
    return target
  } finally {
    clearTimeout(timer)
  }
}
