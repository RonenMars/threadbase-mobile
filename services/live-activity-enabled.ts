// Whether a given streamer wants live session surfaces drawn at all.
//
// The streamer owns this decision (its `liveActivityPush` feature flag, off by
// default) because the two halves of the feature are one product: the server
// pushes updates while the app is backgrounded, and the app draws the surface
// while it is foregrounded. Leaving the client half on against a server with
// the flag off produces the worst version of the feature — a Lock Screen card
// that only updates while you are already looking at the phone, then freezes
// and expires silently ~8h later.
//
// Deliberately synchronous. `reconcile()` runs on every `session_update` frame,
// so it cannot await an HTTP round-trip per frame. The flag is fetched once per
// server, in the background, and every frame before the answer lands is treated
// as "off" — matching the registry default, and erring toward not drawing a
// surface we may have to tear down a moment later.

import { clientLog } from '@/lib/clientLog'
import { getFeatureFlags } from '@/services/api-client'

const FLAG_ID = 'liveActivityPush'

/** Resolved answers, one per server. Only successful lookups land here. */
const resolved = new Map<string, boolean>()
/** In-flight lookups, so a burst of frames triggers one request, not twenty. */
const pending = new Map<string, Promise<void>>()

function lookup(serverId: string): void {
  if (pending.has(serverId)) return
  const p = getFeatureFlags(serverId)
    .then((cfg) => {
      // A 404 (cfg === null) is a server predating feature flags. It is also a
      // server predating any coordinated way to turn this off, so it counts as
      // "did not ask for it" rather than grandfathering the surface on.
      //
      // Logged because this is the one path where surfaces stop appearing
      // without anyone having asked for that — the user updated the app and an
      // old server's answer decided it. Distinguishing it from a server that
      // explicitly said false is the difference between "upgrade the streamer"
      // and "check the flag", and the surface's absence looks identical either
      // way from the phone.
      if (cfg === null) {
        clientLog.info(
          'liveActivity.legacyServer',
          'server predates feature flags; live surfaces stay off',
          { serverId },
        )
      }
      resolved.set(serverId, cfg?.values?.[FLAG_ID] === true)
    })
    .catch(() => {
      // Left unresolved on purpose: a transient network failure must not pin
      // the feature off until the app restarts. The next frame retries.
    })
    .finally(() => {
      pending.delete(serverId)
    })
  pending.set(serverId, p)
}

/**
 * True only once this server has been asked and said yes. Kicks off the lookup
 * on first call for a server and returns false until it answers.
 */
export function isLiveActivityEnabled(serverId: string): boolean {
  const known = resolved.get(serverId)
  if (known !== undefined) return known
  lookup(serverId)
  return false
}

/** Test seam — module-level maps would otherwise leak between cases. */
export function resetLiveActivityEnabled(): void {
  resolved.clear()
  pending.clear()
}
