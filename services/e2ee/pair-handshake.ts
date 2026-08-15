/**
 * The app-level half of the pairing handshake: which namespace it runs in, how
 * the scanned QR becomes a PSK, and the capability gate in front of it.
 *
 * `noise.ts` is the protocol; this file is everything about it that is a
 * Threadbase decision rather than a Noise one.
 */
import { hash as sha256 } from '@stablelib/sha256'
import naclUtil from 'tweetnacl-util'
import { serverSpeaksE2ee } from '@/types/api'
import type { ServerInfo } from '@/types/api'
import { concatBytes, createNoiseInitiator } from '@/services/e2ee/noise'
import type { NoiseInitiator } from '@/services/e2ee/noise'

/**
 * `MixHash`'d before any handshake token. Two `IK` handshakes exist in this
 * design and are otherwise distinguished only by their PSK, so the prologue is
 * what makes a message from one undecryptable in the other. Byte-identical with
 * the streamer or nothing interoperates.
 */
export const PAIR_PROLOGUE = 'threadbase-e2ee/1 pair'

/**
 * No specification states this construction — it was recovered by matching
 * candidates against the committed vector, so treat it as contract-by-bytes: if
 * a future vector's `psk` stops matching its `pairToken`, this label is the
 * first thing to re-derive.
 */
const PSK_LABEL = 'threadbase-e2ee/1 psk'

export function derivePairPsk(pairToken: string): Uint8Array {
  return sha256(concatBytes(naclUtil.decodeUTF8(PSK_LABEL), naclUtil.decodeUTF8(pairToken)))
}

export interface PairHandshakeArgs {
  /** From `GET /api/info`. The gate below is the only thing that reads it. */
  serverInfo: ServerInfo | null | undefined
  /** The token carried by the scanned QR. Binds this handshake to that scan. */
  pairToken: string
  serverStaticPublic: Uint8Array
  clientStaticPrivate: Uint8Array
  /** Test-only injection, forwarded verbatim to the Noise initiator. */
  ephemeralPrivate?: Uint8Array
}

export type PairHandshakeStart =
  | { ok: true; handshake: NoiseInitiator }
  | { ok: false; reason: 'server-does-not-speak-e2ee' }

/**
 * Starts a pairing handshake, or declines because the server never advertised
 * one. Declining is not the same as concluding plaintext is acceptable — that
 * question belongs to this device's `requireEncryption` pin.
 */
export function beginPairHandshake(args: PairHandshakeArgs): PairHandshakeStart {
  if (!serverSpeaksE2ee(args.serverInfo)) {
    return { ok: false, reason: 'server-does-not-speak-e2ee' }
  }
  return {
    ok: true,
    handshake: createNoiseInitiator({
      serverStaticPublic: args.serverStaticPublic,
      clientStaticPrivate: args.clientStaticPrivate,
      psk: derivePairPsk(args.pairToken),
      prologue: naclUtil.decodeUTF8(PAIR_PROLOGUE),
      ephemeralPrivate: args.ephemeralPrivate,
    }),
  }
}
