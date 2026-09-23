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
 * `publicUrl` is left out when it is the same address, or when the cleartext
 * policy would refuse it anyway. `url` itself is never filtered here: a refused
 * `url` keeps producing the refusal its callers already surface.
 */
export function serverAddresses(target: { url: string; publicUrl?: string }): string[] {
  const url = trimSlash(target.url)
  const publicUrl = target.publicUrl ? trimSlash(target.publicUrl) : ''
  return publicUrl && publicUrl !== url && isCleartextAllowed(publicUrl) ? [url, publicUrl] : [url]
}
