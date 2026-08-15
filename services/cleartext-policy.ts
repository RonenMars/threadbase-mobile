/**
 * Which plain-HTTP destinations this app will talk to.
 *
 * Android's platform policy is blanket: `usesCleartextTraffic` is a single
 * boolean on `<application>`, and `network-security-config`'s `<domain>`
 * matching is hostname-based with no CIDR support, so "cleartext on the LAN,
 * TLS everywhere else" is not expressible natively (see
 * docs/adr/0002-android-cleartext-policy.md). iOS expresses exactly that policy
 * declaratively — `NSAllowsArbitraryLoads=false` with `NSAllowsLocalNetworking=true`
 * in ios/Threadbase/Info.plist. This module is what keeps Android to the same
 * rule with the platform gate open.
 *
 * It is advisory, and deliberately so: it constrains the three places this app
 * builds a URL to a streamer, not the platform. A native module that opens its
 * own socket is not covered, and cannot be — that is the cost of the platform
 * having no expressible middle ground, not a gap to be closed here.
 */

/** A dotted quad, captured. Anything else is a hostname or an IPv6 literal. */
const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/

/**
 * Whether a dotted-quad address is on a network the user controls.
 *
 * Parsed into octets rather than prefix-matched, because a prefix pattern
 * matches far more than the range it names: `/^192\.168\./` accepts the
 * perfectly public domain `192.168.0.1.example.com`, and `/^10\./` accepts
 * `10.example.com`. Both are registrable, and both would have been permitted
 * silently.
 *
 * The CGNAT block is not an oversight. Tailscale addresses live in 100.64/10
 * and the onboarding copy offers a Tailscale IP as a supported way to reach a
 * server; omitting it would deny a flow the app tells users to use.
 */
function isLocalIPv4(host: string): boolean {
  const match = IPV4.exec(host)
  if (!match) return false
  const octets = match.slice(1).map(Number)
  if (octets.some((octet) => octet > 255)) return false
  const [a, b] = octets
  if (a === 127) return true // loopback
  if (a === 10) return true // RFC1918
  if (a === 192 && b === 168) return true // RFC1918
  if (a === 172 && b >= 16 && b <= 31) return true // RFC1918
  if (a === 100 && b >= 64 && b <= 127) return true // CGNAT / Tailscale
  if (a === 169 && b === 254) return true // link-local
  return false
}

/**
 * Hosts reachable only from the user's own network, where a plain-HTTP hop
 * stays on a link the user controls.
 */
function isLocalHost(host: string): boolean {
  if (host.includes(':')) {
    // IPv6 literal: loopback, link-local fe80::/10, unique-local fc00::/7.
    return /^::1$/.test(host) || /^fe[89ab]/i.test(host) || /^f[cd]/i.test(host)
  }
  if (IPV4.test(host)) return isLocalIPv4(host)
  // An unqualified name resolves only against the local network's own
  // resolver, and `.local` is mDNS by definition.
  return !host.includes('.') || /\.local$/i.test(host)
}

/**
 * The host a URL addresses, with userinfo, port and IPv6 brackets removed.
 *
 * Hand-parsed rather than via `URL`: Hermes' implementation has shipped in
 * states where `new URL()` on an IPv6 literal or a port-only authority throws,
 * and a policy check that throws fails open at the call site that forgot to
 * catch it. Returns '' for anything it cannot read, which every caller treats
 * as not-local.
 */
export function hostOf(url: string): string {
  const authority = url.replace(/^[a-z][a-z\d+.-]*:\/\//i, '').split(/[/?#]/)[0] ?? ''
  const hostPort = authority.slice(authority.lastIndexOf('@') + 1)
  if (hostPort.startsWith('[')) {
    const close = hostPort.indexOf(']')
    return close === -1 ? '' : hostPort.slice(1, close)
  }
  return hostPort.replace(/:\d+$/, '')
}

/**
 * Whether this app will send `url` unencrypted.
 *
 * `true` for every scheme that is not cleartext, so callers can gate on this
 * without first working out whether the URL is even plain-HTTP — an `https://`
 * or `wss://` target is not this module's business.
 */
export function isCleartextAllowed(url: string): boolean {
  if (!/^(?:http|ws):\/\//i.test(url)) return true
  const host = hostOf(url)
  return host !== '' && isLocalHost(host)
}

/**
 * A plain-HTTP request to a host outside the user's own network was refused
 * before it was sent.
 *
 * The message is an English diagnostic for logs, like `AuthError`'s; the
 * user-facing wording is the render site's job. `host` is on the error because
 * the remedy names it and the URL is gone by the time this reaches a screen.
 */
export class CleartextBlockedError extends Error {
  readonly host: string

  constructor(url: string) {
    const host = hostOf(url)
    super(
      `Refused to send unencrypted traffic to ${host} — it is not a local-network address. Use https:// or the tunnel.`,
    )
    this.name = 'CleartextBlockedError'
    this.host = host
  }
}
