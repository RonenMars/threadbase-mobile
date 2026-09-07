import { useServersStore } from '@/stores/servers'
import { unregisterPushToken } from './push'

/**
 * Remove a server, first telling its streamer to drop this device's push token.
 *
 * The order is the point: the DELETE has to authenticate, and `removeServer`
 * erases the credentials it would use. `unregisterPushToken` swallows its own
 * failures, so an unreachable server — a very common reason to remove one —
 * still gets removed.
 *
 * This lives beside the store rather than inside it because `services/api-client`
 * imports the store, so a store that reached the push service would close a
 * require cycle (`api-client → servers → push → api-client`) and leave
 * `api-client` half-initialised for anything loading it first.
 */
export async function removeServerAndUnregisterPush(serverId: string): Promise<void> {
  // `unregisterPushToken` swallows its own failures; this catch is the second
  // line of that defence. Being unable to delete a server would be a worse
  // outcome than a token row outliving the pairing, and the streamer expires
  // tokens whose device is revoked, so that row is not permanent either.
  await unregisterPushToken(serverId).catch(() => {})
  await useServersStore.getState().removeServer(serverId)
}
