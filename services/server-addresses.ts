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
 * then the one the server advertised (threadbase-mobile#734). Tried in turn,
 * never raced, and every attempt starts again at the first — nothing records
 * which one answered last time.
 *
 * Only a pinned server gets `publicUrl`. Its value came from the authenticated
 * handshake and every request to it is sealed. An unpinned server's `publicUrl`
 * came from an unauthenticated pairing reply (pair-exchange.ts), and dialling
 * it would hand the API key to whoever wrote that reply (TB-M-03).
 *
 * `publicUrl` is also left out when it is not http(s), is the same address, or
 * the cleartext policy would refuse it. `url` itself is never filtered here: a
 * refused `url` keeps producing the refusal its callers already surface.
 */
export function serverAddresses(target: {
  url: string
  publicUrl?: string
  serverPublicKey?: string
  requireEncryption?: boolean
}): string[] {
  const url = trimSlash(target.url)
  const pinned = target.requireEncryption === true && !!target.serverPublicKey
  const publicUrl = pinned && target.publicUrl ? trimSlash(target.publicUrl) : ''
  return /^https?:\/\//i.test(publicUrl) && publicUrl !== url && isCleartextAllowed(publicUrl)
    ? [url, publicUrl]
    : [url]
}
