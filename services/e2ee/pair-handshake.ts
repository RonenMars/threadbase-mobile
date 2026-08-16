/**
 * The app-level half of the pairing handshake: which namespace it runs in, how
 * the scanned QR becomes a PSK, where this device's static key is kept, and the
 * capability gate in front of all of it.
 *
 * `noise.ts` is the protocol; this file is everything about it that is a
 * Threadbase decision rather than a Noise one.
 */
import { hash as sha256 } from '@stablelib/sha256'
import { randomBytes } from 'tweetnacl'
import naclUtil from 'tweetnacl-util'
import { E2EE_CLIENT_VERSION } from '@/types/api'
import * as SecureStore from '@/services/secure-store'
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

/**
 * Message 1's payload, and the committed vector pins these exact bytes.
 *
 * The server ignores the payload entirely and takes the client's static key out
 * of the transcript, which is why it can be this small. design.md §2.4's prose
 * sketches a richer one (`deviceName`, `capabilitiesRequested`,
 * `clientIdentityPub`); the vector is what the two implementations actually
 * agree on, so the vector wins.
 */
export const PAIR_MESSAGE1_PAYLOAD = JSON.stringify({ v: E2EE_CLIENT_VERSION })

/** X25519 private keys are 32 bytes, and `@stablelib` treats them as a seed. */
const DEVICE_STATIC_KEY_BYTES = 32

/** 32 bytes of X25519 public key, unpadded base64url — the QR's `spk`. */
const SERVER_STATIC_KEY_CHARS = 43

export function derivePairPsk(pairToken: string): Uint8Array {
  return sha256(concatBytes(naclUtil.decodeUTF8(PSK_LABEL), naclUtil.decodeUTF8(pairToken)))
}

/**
 * Per-server, alongside `threadbase_api_key_<id>` and
 * `threadbase_device_token_<id>` in `stores/servers.ts`.
 */
function deviceStaticKeyStoreKey(serverId: string): string {
  return `threadbase_e2ee_device_key_${serverId}`
}

/**
 * Forgets this device's static key for a server.
 *
 * Exported so `stores/servers.ts` can clear it on the same terms as the device
 * token; the key itself is never handed back to a caller.
 */
export async function clearDeviceStaticKey(serverId: string): Promise<void> {
  await SecureStore.deleteItemAsync(deviceStaticKeyStoreKey(serverId))
}

/** The QR emits base64url; `tweetnacl-util` only decodes standard base64. */
function decodeServerStaticKey(spk: string): Uint8Array {
  if (spk.length !== SERVER_STATIC_KEY_CHARS) {
    throw new Error('E2EE: the server key in this pairing code is the wrong length')
  }
  const standard = spk.replace(/-/g, '+').replace(/_/g, '/')
  try {
    return naclUtil.decodeBase64(`${standard}=`)
  } catch {
    throw new Error('E2EE: the server key in this pairing code is not valid base64url')
  }
}

export interface PairHandshakeArgs {
  /** Which server record this device's static key belongs to. */
  serverId: string
  /**
   * The QR's `spk`. Absent means a streamer that offered no key, which is the
   * only signal available at pairing — `GET /api/info` is authenticated and
   * pairing is the request that mints the credential, so there is nothing to
   * probe with. design.md §6.2 names the QR as discovery surface #1 for exactly
   * this moment.
   */
  serverPublicKey?: string
  /** The token carried by the scanned QR. Binds this handshake to that scan. */
  pairToken: string
  /** Test-only injection. A real pairing mints a fresh key from the system CSPRNG. */
  clientStaticPrivate?: Uint8Array
  /** Test-only injection, forwarded verbatim to the Noise initiator. */
  ephemeralPrivate?: Uint8Array
}

export type PairHandshakeStart =
  | { ok: true; handshake: NoiseInitiator }
  | { ok: false; reason: 'server-offered-no-key' }

/**
 * Starts a pairing handshake, or declines because the QR carried no server key.
 * Declining is not the same as concluding plaintext is acceptable — that
 * question belongs to this device's `requireEncryption` pin.
 *
 * A present-but-unusable `spk` throws rather than declining: a downgrade must
 * never be reachable by corrupting one QR parameter (mobile-design §3.2).
 *
 * **The device's private key is written to SecureStore before this returns**,
 * so it is on disk before message 1 can be built, let alone sent. The server
 * registers the public half before it can tell the client anything; a client
 * that only kept its own half once a response arrived would leave the server
 * holding a key nobody can use — a device row that looks provisioned and fails
 * weeks later, at the connection, with nothing pointing back to here.
 */
export async function beginPairHandshake(args: PairHandshakeArgs): Promise<PairHandshakeStart> {
  if (!args.serverPublicKey) {
    return { ok: false, reason: 'server-offered-no-key' }
  }
  const serverStaticPublic = decodeServerStaticKey(args.serverPublicKey)
  const clientStaticPrivate = args.clientStaticPrivate ?? randomBytes(DEVICE_STATIC_KEY_BYTES)

  await SecureStore.setItemAsync(
    deviceStaticKeyStoreKey(args.serverId),
    naclUtil.encodeBase64(clientStaticPrivate),
    // The default Keychain class syncs to iCloud and restores onto a new
    // device, which would make "revoke this lost phone" incomplete.
    { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY },
  )

  return {
    ok: true,
    handshake: createNoiseInitiator({
      serverStaticPublic,
      clientStaticPrivate,
      psk: derivePairPsk(args.pairToken),
      prologue: naclUtil.decodeUTF8(PAIR_PROLOGUE),
      ephemeralPrivate: args.ephemeralPrivate,
    }),
  }
}
