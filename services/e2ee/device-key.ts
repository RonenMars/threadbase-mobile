/**
 * This device's static X25519 key on native: 32 raw bytes in SecureStore.
 *
 * Metro resolves `device-key.web.ts` for the web bundle instead, which keeps a
 * non-extractable WebCrypto key in IndexedDB. The two export the same shape so
 * `pair-handshake.ts` needs no platform branch.
 */
import { randomBytes } from 'tweetnacl'
import naclUtil from 'tweetnacl-util'
import * as SecureStore from '@/services/secure-store'
import { staticKeyFromPrivate, type StaticKey } from '@/services/e2ee/noise'

/** X25519 private keys are 32 bytes, and `@stablelib` treats them as a seed. */
const DEVICE_STATIC_KEY_BYTES = 32

/**
 * Per-server, alongside `threadbase_api_key_<id>` and
 * `threadbase_device_token_<id>` in `stores/servers.ts`.
 */
function deviceStaticKeyStoreKey(serverId: string): string {
  return `threadbase_e2ee_device_key_${serverId}`
}

/** The Keychain / Keystore is always there on native. */
export async function canHoldDeviceStaticKey(): Promise<boolean> {
  return true
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

export async function loadDeviceStaticKey(serverId: string): Promise<StaticKey | null> {
  const stored = decodeStoredDeviceKey(
    await SecureStore.getItemAsync(deviceStaticKeyStoreKey(serverId)),
  )
  return stored ? staticKeyFromPrivate(stored) : null
}

/**
 * Load-or-create. A key this server does not already hold for us is written
 * before this returns — see `beginPairHandshake` for why the ordering and the
 * reuse both matter.
 */
export async function loadOrCreateDeviceStaticKey(
  serverId: string,
  /** Test-only injection. A real pairing mints a fresh key from the system CSPRNG. */
  injectedPrivate?: Uint8Array,
): Promise<StaticKey> {
  const storeKey = deviceStaticKeyStoreKey(serverId)
  const storedKey = await SecureStore.getItemAsync(storeKey)
  const clientStaticPrivate =
    injectedPrivate ?? decodeStoredDeviceKey(storedKey) ?? randomBytes(DEVICE_STATIC_KEY_BYTES)
  const encodedKey = naclUtil.encodeBase64(clientStaticPrivate)

  if (encodedKey !== storedKey) {
    await SecureStore.setItemAsync(
      storeKey,
      encodedKey,
      // The default Keychain class syncs to iCloud and restores onto a new
      // device, which would make "revoke this lost phone" incomplete.
      { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY },
    )
  }
  return staticKeyFromPrivate(clientStaticPrivate)
}
