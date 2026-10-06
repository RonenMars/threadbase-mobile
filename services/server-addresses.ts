import { isCleartextAllowed } from '@/services/cleartext-policy'

/**
 * How long the first of two addresses gets before the second is tried. A LAN
 * answer takes milliseconds; a LAN address dialled from outside is usually
 * black-holed and never answers at all, so without this bound the fallback
 * would wait out the full 15 s socket / 10 s `/open` timeout first.
 */
export const FIRST_ADDRESS_TIMEOUT_MS = 4_000

const trimSlash = (url: string) => url.replace(/\/$/, '')

/**
 * The addresses a connection attempt tries, in order: the one the user gave,
 * the one the server advertised (threadbase-mobile#734), then the server's
 * route on the Threadbase relay. Tried in turn,
 * never raced, and every attempt starts again at the first — nothing records
 * which one answered last time.
 *
 * Only a pinned server gets more than `url`. Those values came from the
 * authenticated handshake or a sealed response, and every request to them is
 * sealed. An unpinned server's `publicUrl` came from an unauthenticated pairing
 * reply (pair-exchange.ts), and dialling it would hand the API key to whoever
 * wrote that reply (TB-M-03).
 *
 * The relay is last because it is the only address that is somebody else's
 * machine: it carries sealed traffic it cannot read, but it does see that a
 * connection exists, so it is used only when the user's own addresses fail.
 *
 * An extra address is also left out when it is not http(s), is a duplicate, or
 * the cleartext policy would refuse it. `url` itself is never filtered here: a
 * refused `url` keeps producing the refusal its callers already surface.
 */
export function serverAddresses(target: {
  url: string
  publicUrl?: string
  relayUrl?: string
  relayDisabled?: boolean
  serverPublicKey?: string
  requireEncryption?: boolean
}): string[] {
  const addresses = [trimSlash(target.url)]
  if (target.requireEncryption !== true || !target.serverPublicKey) return addresses
  for (const extra of [target.publicUrl, target.relayDisabled ? undefined : target.relayUrl]) {
    const address = extra ? trimSlash(extra) : ''
    if (/^https?:\/\//i.test(address) && !addresses.includes(address) && isCleartextAllowed(address)) {
      addresses.push(address)
    }
  }
  return addresses
}
