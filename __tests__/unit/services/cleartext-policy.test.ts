/**
 * The Android platform gate is blanket (app.json → expo-build-properties →
 * `usesCleartextTraffic`), so this module is the whole of the policy: if it
 * says yes, the traffic goes out unencrypted. That makes the negative cases the
 * load-bearing ones — a pattern that accidentally matches a public host is the
 * failure mode, and it is silent.
 */

import {
  CleartextBlockedError,
  hostOf,
  isCleartextAllowed,
} from '@/services/cleartext-policy'

describe('hostOf', () => {
  it.each([
    ['http://192.168.68.102:8766', '192.168.68.102'],
    ['http://192.168.68.102:8766/api/pair/exchange', '192.168.68.102'],
    ['ws://host.local/ws?key=abc', 'host.local'],
    ['https://tb.rbv1000.win', 'tb.rbv1000.win'],
    ['http://user:pw@10.0.0.4:8766/x', '10.0.0.4'],
    ['http://[fe80::1]:8766/api', 'fe80::1'],
    ['http://[::1]', '::1'],
    ['http://localhost', 'localhost'],
  ])('reads %s as %s', (url, host) => {
    expect(hostOf(url)).toBe(host)
  })

  it('gives up rather than guessing on an unterminated IPv6 literal', () => {
    expect(hostOf('http://[fe80::1')).toBe('')
  })
})

describe('isCleartextAllowed', () => {
  it.each([
    'http://192.168.68.102:8766',
    'http://10.0.2.2:7071',
    'http://172.16.0.9',
    'http://172.31.255.255',
    'http://127.0.0.1:8766',
    'http://localhost:8766',
    'http://mac-mini/api',
    'http://mac-mini.local:8766',
    'http://100.101.102.103:8766', // Tailscale
    'http://169.254.10.4',
    'ws://192.168.68.102:8766/ws?key=k',
    'http://[::1]:8766',
    'http://[fe80::1cd3]:8766',
    'http://[fd00::5]:8766',
  ])('permits %s', (url) => {
    expect(isCleartextAllowed(url)).toBe(true)
  })

  it.each([
    'http://tb.rbv1000.win',
    'http://example.com:8766',
    'http://93.184.216.34',
    'ws://example.com/ws?key=k',
    // Adjacent to RFC1918 on either side, and public.
    'http://172.15.0.1',
    'http://172.32.0.1',
    'http://11.0.0.1',
    'http://191.168.0.1',
    'http://192.169.0.1',
    // Outside CGNAT, which ends at 100.127.255.255.
    'http://100.63.0.1',
    'http://100.128.0.1',
    // A public host cannot buy permission by looking local.
    'http://192.168.0.1.example.com',
    'http://notlocal.example',
    'http://local.example.com',
    'http://[2001:db8::1]:8766',
    // Nor by being an address written in a form this parser does not read and
    // a resolver may. `inet_aton` accepts a bare 32-bit integer, so 134744072
    // is 8.8.8.8 and 2130706433 is 127.0.0.1; a leading 0 makes an octet octal,
    // so 010.0.0.1 is 8.0.0.1 to the platform and 10.0.0.1 to Number().
    'http://134744072:8766',
    'http://2130706433',
    'http://0x08080808',
    'http://010.0.0.1',
    'http://0177.0.0.1',
    // Userinfo is the classic bypass: the host is what follows the last '@'.
    'http://192.168.1.1@evil.com/',
  ])('refuses %s', (url) => {
    expect(isCleartextAllowed(url)).toBe(false)
  })

  it.each([
    'https://example.com',
    'wss://example.com/ws',
    'https://192.168.68.102:8766',
  ])('does not apply to %s', (url) => {
    expect(isCleartextAllowed(url)).toBe(true)
  })

  it('refuses a URL whose host it cannot read', () => {
    expect(isCleartextAllowed('http://')).toBe(false)
  })

  // Deliberate false negatives, pinned so they are not "fixed" into holes.
  //
  // `inet_aton`'s short forms are real: 127.1 is loopback and 192.168.1 is
  // 192.168.0.1, and a user may well type the first. Accepting them means
  // teaching this module to parse the same short forms the platform does —
  // which is precisely the parser-disagreement class the numeric guards above
  // exist to close, reopened for a convenience. They stay denied: the cost is a
  // confusing error on an address the user can rewrite in full, and the cost of
  // the alternative is a bypass.
  it.each(['http://127.1', 'http://192.168.1', 'http://10.1'])(
    'refuses the shorthand %s even though it is local',
    (url) => {
      expect(isCleartextAllowed(url)).toBe(false)
    },
  )
})

describe('CleartextBlockedError', () => {
  it('carries the host so the remedy can name it', () => {
    const err = new CleartextBlockedError('http://example.com:8766/api/profiles')
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe('CleartextBlockedError')
    expect(err.host).toBe('example.com')
    expect(err.message).toContain('example.com')
  })
})
