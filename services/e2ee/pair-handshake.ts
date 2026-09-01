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

/** What message 1 authenticates about this device, per design.md §2.4. */
export interface PairMessage1Fields {
  /**
   * A display label, and the only field here that may be absent — see the
   * asymmetry note on `pairMessage1Payload`. Already trimmed and capped by the
   * caller, so the authenticated copy and the outer one carry one value.
   */
  deviceName?: string
  /**
   * Which capability preset this device is asking for. **Required, never
   * conditional** — this is a claim, not a label, and the reason is on
   * `pairMessage1Payload` because that is where someone would try to remove it.
   */
  readOnly: boolean
}

/**
 * Message 1's authenticated payload: `{ v, deviceName?, readOnly }`.
 *
 * These values used to travel **only** in the outer request body, which nothing
 * authenticates — so an intermediary could rename the device or widen its
 * capability preset in transit and the server would believe it. That is the same
 * substitution the msg2 validation closes in the other direction; this is the
 * outbound half of GATE 4.
 *
 * **Why `deviceName` may be absent and `readOnly` may not**, since the two sit
 * side by side and look like they should match:
 *
 * - `deviceName` is **cosmetic**. A server that receives none shows no label,
 *   which is a display outcome and nothing else.
 * - `readOnly` is a **capability claim**, and a claim that was not made cannot
 *   be defaulted. Omit it and the server either refuses the pairing or invents
 *   an answer — and inventing `false` grants the wider preset off something this
 *   device never said. The streamer refuses, deliberately.
 *
 * So `readOnly` is always present, including when it is `false`. Collapsing it
 * into a `...(readOnly ? { readOnly } : {})` spread to match `deviceName` above
 * is the tempting edit, and it produces `{"v":1}` on an ordinary pairing — which
 * every current streamer rejects. Three implementers independently read the
 * contract's `{ v, deviceName?, readOnly }` as making `readOnly` optional, so
 * this is a known trap rather than a hypothetical one.
 *
 * The outer body keeps its own copy for released servers — it stops being
 * authoritative, not sent.
 */
export function pairMessage1Payload({ deviceName, readOnly }: PairMessage1Fields): string {
  return JSON.stringify({
    v: E2EE_CLIENT_VERSION,
    ...(deviceName ? { deviceName } : {}),
    readOnly,
  })
}

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

/**
 * A previously stored device key, or `null` when there is none and when what is
 * there cannot be one. A corrupt entry is treated as absent so a re-pair mints a
 * usable key rather than failing forever on a value nothing can repair.
 */
function decodeStoredDeviceKey(raw: string | null): Uint8Array | null {
  if (!raw) return null
  try {
    const decoded = naclUtil.decodeBase64(raw)
    return decoded.length === DEVICE_STATIC_KEY_BYTES ? decoded : null
  } catch {
    return null
  }
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
 * **The device's private key is load-or-create, and a new one is written to
 * SecureStore before this returns**, so it is on disk before message 1 can be
 * built, let alone sent. The server registers the public half before it can
 * tell the client anything; a client that only kept its own half once a
 * response arrived would leave the server holding a key nobody can use — a
 * device row that looks provisioned and fails weeks later, at the connection,
 * with nothing pointing back to here.
 *
 * Writing first is not sufficient on its own. The streamer deduplicates device
 * rows on this key, so regenerating it per attempt makes a response-loss retry
 * or a later re-pair grow a *second* row for one phone. Reuse is what keeps the
 * two sides describing the same device.
 */
export async function beginPairHandshake(args: PairHandshakeArgs): Promise<PairHandshakeStart> {
  if (!args.serverPublicKey) {
    return { ok: false, reason: 'server-offered-no-key' }
  }
  const serverStaticPublic = decodeServerStaticKey(args.serverPublicKey)

  const storeKey = deviceStaticKeyStoreKey(args.serverId)
  const storedKey = await SecureStore.getItemAsync(storeKey)
  const clientStaticPrivate =
    args.clientStaticPrivate ?? decodeStoredDeviceKey(storedKey) ?? randomBytes(DEVICE_STATIC_KEY_BYTES)
  const encodedKey = naclUtil.encodeBase64(clientStaticPrivate)

  // Only a key this server does not already hold for us is written, and it is
  // written before the initiator exists to build message 1 with.
  if (encodedKey !== storedKey) {
    await SecureStore.setItemAsync(
      storeKey,
      encodedKey,
      // The default Keychain class syncs to iCloud and restores onto a new
      // device, which would make "revoke this lost phone" incomplete.
      { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY },
    )
  }

  return {
    ok: true,
    handshake: createNoiseInitiator({
      pattern: 'IKpsk1',
      serverStaticPublic,
      clientStaticPrivate,
      psk: derivePairPsk(args.pairToken),
      prologue: naclUtil.decodeUTF8(PAIR_PROLOGUE),
      ephemeralPrivate: args.ephemeralPrivate,
    }),
  }
}

/**
 * `MixHash`'d before any token of the `/api/e2ee/open` handshake.
 *
 * **Explicit, never the default `PAIR_PROLOGUE`** (NONCE-DESIGN §11, §14).
 * Together with the psk-less protocol name it is the whole of the domain
 * separation between opening a transport context and pairing a device: a valid
 * *pairing* message 1 read under this prologue must fail, and the committed
 * `open.pairingMessage1RejectedHere` vector is what proves it still does.
 */
export const OPEN_PROLOGUE = 'threadbase-e2ee/1 open'

/**
 * Which kind of context an `/open` is asking for. **Required, no default**
 * (NONCE-DESIGN §11): the two kinds have different lifetimes, different receive
 * state and different contents, so the handshake has to say which one it is
 * opening. It travels *inside* the encrypted payload, so an intermediary cannot
 * flip a socket context into a REST one.
 */
export type OpenContextKind = 'ws' | 'rest'

export type OpenHandshakeStart =
  | { ok: true; handshake: NoiseInitiator }
  /** No stored device key for this server: this device is not paired. */
  | { ok: false; reason: 'not-paired' }

export interface OpenHandshakeArgs {
  serverId: string
  /** The pinned server static key, base64url, from the server record. */
  serverPublicKey: string
  /** Test-only injection, forwarded verbatim to the Noise initiator. */
  ephemeralPrivate?: Uint8Array
}

/**
 * Builds the initiator for `POST /api/e2ee/open`.
 *
 * **The device key is loaded here and never handed back.** There is deliberately
 * no `getDeviceStaticKey()` — a getter that returns key bytes is exactly the
 * shape W1a's guard-class rules forbid, and it would put `D_priv` one careless
 * log line away from a breadcrumb. The key enters `createNoiseInitiator` and
 * leaves this function only as a `NoiseInitiator`.
 *
 * **Load-only, never create.** `beginPairHandshake` is load-or-create because
 * pairing is where a device key legitimately comes into existence; `/open` is
 * not. Minting one here would hand the server a static key it has no row for,
 * and the handshake would fail at the device lookup anyway — but as
 * `E2EE_DEVICE_REVOKED`, which the client is required to surface as a hard
 * failure. "Not paired" is the honest answer and a different one.
 */
export async function createOpenInitiator(args: OpenHandshakeArgs): Promise<OpenHandshakeStart> {
  const serverStaticPublic = decodeServerStaticKey(args.serverPublicKey)
  const clientStaticPrivate = decodeStoredDeviceKey(
    await SecureStore.getItemAsync(deviceStaticKeyStoreKey(args.serverId)),
  )
  if (!clientStaticPrivate) return { ok: false, reason: 'not-paired' }

  return {
    ok: true,
    handshake: createNoiseInitiator({
      // Psk-less IK. Passing `psk` at all here is refused by `noise.ts`.
      pattern: 'IK',
      serverStaticPublic,
      clientStaticPrivate,
      prologue: naclUtil.decodeUTF8(OPEN_PROLOGUE),
      ...(args.ephemeralPrivate ? { ephemeralPrivate: args.ephemeralPrivate } : {}),
    }),
  }
}

/** msg1's payload: `{ v, kind }`. `kind` is required and authenticated inside the AEAD. */
export function openMessage1Payload(kind: OpenContextKind): string {
  return JSON.stringify({ v: E2EE_CLIENT_VERSION, kind })
}
