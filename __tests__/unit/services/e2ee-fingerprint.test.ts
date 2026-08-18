// Pinned against the shared fixture rather than a literal pasted here: the
// streamer's own test suite carries the same
// `fingerprintOfServerStaticPublic` value keyed to the same
// `keys.serverStaticPublic`, so a derivation drift on either side shows up as
// a value mismatch instead of two independently-chosen "looks right" numbers.

import { formatFingerprint } from '@/services/e2ee/fingerprint'
import vectors from '@/__tests__/fixtures/noise-ikpsk1-vectors.json'

// The fixture stores keys as standard base64 (shared with the Noise vectors,
// which use `+`/`/`/`=`); `formatFingerprint` takes the base64url shape `spk`
// actually arrives in on the wire (`services/pair-exchange.ts`). Converting
// here is test-only glue for that format mismatch, not a second production
// decoder.
function toBase64Url(base64: string): string {
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

describe('formatFingerprint', () => {
  it('matches the vector shared with the streamer suite', () => {
    const spk = toBase64Url(vectors.keys.serverStaticPublic)
    expect(formatFingerprint(spk)).toBe(vectors.fingerprintOfServerStaticPublic)
  })

  // Positive control: without this, a stub that always returns the vector
  // string would also pass the test above.
  it('produces a different fingerprint for a different key', () => {
    const serverSpk = toBase64Url(vectors.keys.serverStaticPublic)
    const clientSpk = toBase64Url(vectors.keys.clientStaticPublic)
    expect(formatFingerprint(clientSpk)).not.toBe(formatFingerprint(serverSpk))
  })

  it('is deterministic for the same key', () => {
    const spk = toBase64Url(vectors.keys.serverStaticPublic)
    expect(formatFingerprint(spk)).toBe(formatFingerprint(spk))
  })

  it('groups 16 hex bytes into 8 space-separated 4-char blocks', () => {
    const spk = toBase64Url(vectors.keys.serverStaticPublic)
    const result = formatFingerprint(spk)
    expect(result).toMatch(/^[0-9a-f]{4}(?: [0-9a-f]{4}){7}$/)
  })
})
