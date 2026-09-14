/**
 * This device's static X25519 key on web: a WebCrypto `CryptoKeyPair` whose
 * private half is generated **non-extractable** and kept in IndexedDB.
 *
 * The raw private key never exists as bytes in JS. IndexedDB stores the
 * `CryptoKey` object itself through structured clone, which preserves
 * `extractable: false`, so a script running on this origin can *use* the key
 * while it is loaded but can never read it out — `exportKey` refuses. The
 * `localStorage` shim in `secure-store.web.ts` is never involved.
 *
 * Metro selects this file for the web bundle; native resolves `device-key.ts`.
 */
import type { StaticKey } from '@/services/e2ee/noise'

const DB_NAME = 'threadbase-e2ee'
const DB_VERSION = 1
const STORE_NAME = 'device-keys'
const X25519 = 'X25519'
const SHARED_SECRET_BITS = 256

/** The same logical key native uses in SecureStore, so both platforms describe one record. */
function deviceStaticKeyStoreKey(serverId: string): string {
  return `threadbase_e2ee_device_key_${serverId}`
}

function settle<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function openDatabase(): Promise<IDBDatabase> {
  const request = indexedDB.open(DB_NAME, DB_VERSION)
  request.onupgradeneeded = () => {
    request.result.createObjectStore(STORE_NAME)
  }
  return settle(request)
}

async function inStore<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDatabase()
  try {
    const transaction = db.transaction(STORE_NAME, mode)
    // Attached before the request settles: a write is durable only once the
    // transaction commits, and the key has to be durable before message 1 exists.
    const committed = new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error)
    })
    const result = await settle(operation(transaction.objectStore(STORE_NAME)))
    await committed
    return result
  } finally {
    db.close()
  }
}

function isUsableKeyPair(value: CryptoKeyPair | undefined): value is CryptoKeyPair {
  return (
    typeof value === 'object' &&
    value !== null &&
    value.privateKey instanceof CryptoKey &&
    value.publicKey instanceof CryptoKey &&
    value.privateKey.algorithm.name === X25519 &&
    value.privateKey.extractable === false
  )
}

/**
 * WebCrypto X25519 and IndexedDB, both present. Probed by generating a
 * throwaway key rather than by feature-sniffing `crypto.subtle`, because a
 * browser can expose SubtleCrypto without implementing X25519.
 */
export async function canHoldDeviceStaticKey(): Promise<boolean> {
  if (typeof indexedDB === 'undefined' || typeof crypto === 'undefined' || !crypto.subtle) {
    return false
  }
  try {
    await crypto.subtle.generateKey({ name: X25519 }, false, ['deriveBits'])
    return true
  } catch {
    return false
  }
}

/**
 * Wraps a WebCrypto X25519 key pair as a Noise static key.
 *
 * WebCrypto already refuses an all-zero X25519 output, but that is a browser
 * implementation detail this handshake must not rest on: a zero shared secret
 * is a low-order remote point, and mixing it would bind a constant. So it is
 * refused here explicitly, with the same message `@stablelib/x25519` uses.
 */
export async function webCryptoStaticKey(pair: CryptoKeyPair): Promise<StaticKey> {
  const publicKey = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))
  return {
    publicKey,
    async dh(remotePublic: Uint8Array): Promise<Uint8Array> {
      const remote = await crypto.subtle.importKey(
        'raw',
        Uint8Array.from(remotePublic),
        { name: X25519 },
        false,
        [],
      )
      const shared = new Uint8Array(
        await crypto.subtle.deriveBits(
          { name: X25519, public: remote },
          pair.privateKey,
          SHARED_SECRET_BITS,
        ),
      )
      // OR-accumulate rather than `every`, so the check does not exit early on
      // the first non-zero byte.
      if (shared.reduce((acc, byte) => acc | byte, 0) === 0) {
        throw new Error('X25519: invalid shared key')
      }
      return shared
    },
  }
}

async function readKeyPair(serverId: string): Promise<CryptoKeyPair | null> {
  const stored = await inStore<CryptoKeyPair | undefined>('readonly', (store) =>
    store.get(deviceStaticKeyStoreKey(serverId)),
  )
  return isUsableKeyPair(stored) ? stored : null
}

export async function clearDeviceStaticKey(serverId: string): Promise<void> {
  // Nothing can be stored where there is no IndexedDB, so there is nothing to clear.
  if (typeof indexedDB === 'undefined') return
  await inStore('readwrite', (store) => store.delete(deviceStaticKeyStoreKey(serverId)))
}

/** Load-only: `/open` must never mint a key the server has no device row for. */
export async function loadDeviceStaticKey(serverId: string): Promise<StaticKey | null> {
  if (typeof indexedDB === 'undefined') return null
  const pair = await readKeyPair(serverId)
  return pair ? webCryptoStaticKey(pair) : null
}

/**
 * Load-or-create, with a new key committed to IndexedDB before this returns —
 * the same ordering and reuse rules as native, for the same reasons
 * (`beginPairHandshake`). An unusable stored value is replaced rather than
 * failing pairing forever.
 *
 * There is deliberately no raw-private-key injection parameter here, unlike
 * native: a caller-supplied private key is exactly the bytes this platform
 * must never hold.
 */
export async function loadOrCreateDeviceStaticKey(serverId: string): Promise<StaticKey> {
  const existing = await readKeyPair(serverId)
  if (existing) return webCryptoStaticKey(existing)

  const created = (await crypto.subtle.generateKey({ name: X25519 }, false, [
    'deriveBits',
  ])) as CryptoKeyPair
  await inStore('readwrite', (store) => store.put(created, deviceStaticKeyStoreKey(serverId)))
  return webCryptoStaticKey(created)
}
