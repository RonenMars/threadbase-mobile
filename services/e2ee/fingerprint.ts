/**
 * Renders a server's Noise static public key as a short string a human can
 * compare against the `tb-streamer identity` CLI output on the machine
 * they're pairing with — the one out-of-band channel this actually has.
 *
 * This is display-only. It is not what proves the server holds the private
 * key for `spk` — the Noise `IK` handshake in `pair-handshake.ts` does that.
 * This module exists only so the proof has a string a person can read aloud.
 */
import naclUtil from 'tweetnacl-util'
import { hash as sha256 } from '@stablelib/sha256'

const FINGERPRINT_BYTES = 16
const HEX_GROUP_SIZE = 4

// `spk` on the wire (QR, deep link, `PairUri.spk`) is unpadded base64url —
// see `SERVER_PUBLIC_KEY_SHAPE` in `services/pair-exchange.ts`. `tweetnacl-util`
// only decodes standard base64, so the alphabet is translated and padding is
// restored before decoding.
function base64UrlToBase64(input: string): string {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/')
  const remainder = base64.length % 4
  return remainder === 0 ? base64 : base64 + '='.repeat(4 - remainder)
}

/**
 * `SHA-256(rawKeyBytes)`, truncated to 16 bytes, lowercase hex in 4-char
 * groups — e.g. `3cfe 00ad 6d01 6dd3 782c 8628 4b1d a1d2`.
 *
 * Hashing rather than showing the raw key mirrors SSH/TLS/PGP fingerprint
 * convention and halves what the user has to eyeball. The one thing that must
 * not happen: hashing the base64url *string* instead of the decoded bytes is
 * the plausible, silently-wrong variant — every implementation reading this
 * must decode `spk` first.
 */
export function formatFingerprint(serverPublicKeyBase64Url: string): string {
  const raw = naclUtil.decodeBase64(base64UrlToBase64(serverPublicKeyBase64Url))
  const digest = sha256(raw).subarray(0, FINGERPRINT_BYTES)
  const hex = Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('')
  const groups: string[] = []
  for (let i = 0; i < hex.length; i += HEX_GROUP_SIZE) {
    groups.push(hex.slice(i, i + HEX_GROUP_SIZE))
  }
  return groups.join(' ')
}
