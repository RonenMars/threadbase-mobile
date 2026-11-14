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
const AES_GCM = 'AES-GCM'

/**
 * The WebKit fallback. WebKit (Safari, and every iOS browser) commits an X25519
 * `CryptoKey` to IndexedDB without error and reads it back as `null`, while an
 * AES-GCM `CryptoKey` survives. So there the private key is stored wrapped under
 * a non-extractable AES key. This is weaker than the direct record: a script on
 * this origin can `unwrapKey` it as extractable and read the bytes out. Used only
 * when the direct record fails its read-back — see docs/e2ee-client.md.
 */
interface WrappedKeyRecord {
  wrappingKey: CryptoKey
  wrappedPrivateKey: ArrayBuffer
  iv: Uint8Array<ArrayBuffer>
  publicKey: Uint8Array<ArrayBuffer>
}

type StoredKey = CryptoKeyPair | WrappedKeyRecord

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

function isUsableKeyPair(value: StoredKey | undefined): value is CryptoKeyPair {
  return (
    typeof value === 'object' &&
    value !== null &&
    'privateKey' in value &&
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

function isWrappedKeyRecord(value: StoredKey | undefined): value is WrappedKeyRecord {
  return (
    typeof value === 'object' &&
    value !== null &&
    'wrappingKey' in value &&
    value.wrappingKey instanceof CryptoKey &&
    value.wrappingKey.extractable === false &&
    value.wrappedPrivateKey instanceof ArrayBuffer &&
    value.iv instanceof Uint8Array &&
    value.publicKey instanceof Uint8Array
  )
}

async function unwrapKeyPair(record: WrappedKeyRecord): Promise<CryptoKeyPair | null> {
  try {
    return {
      privateKey: await crypto.subtle.unwrapKey(
        'pkcs8',
        record.wrappedPrivateKey,
        record.wrappingKey,
        { name: AES_GCM, iv: record.iv },
        { name: X25519 },
        false,
        ['deriveBits'],
      ),
      publicKey: await crypto.subtle.importKey('raw', record.publicKey, { name: X25519 }, true, []),
    }
  } catch {
    return null
  }
}

async function createWrappedKeyRecord(): Promise<WrappedKeyRecord> {
  const wrappingKey = await crypto.subtle.generateKey({ name: AES_GCM, length: 256 }, false, [
    'wrapKey',
    'unwrapKey',
  ])
  const pair = (await crypto.subtle.generateKey({ name: X25519 }, true, [
    'deriveBits',
  ])) as CryptoKeyPair
  const iv = crypto.getRandomValues(new Uint8Array(12))
  return {
    wrappingKey,
    wrappedPrivateKey: await crypto.subtle.wrapKey('pkcs8', pair.privateKey, wrappingKey, {
      name: AES_GCM,
      iv,
    }),
    iv,
    publicKey: new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey)),
  }
}

async function writeKey(serverId: string, value: StoredKey): Promise<void> {
  await inStore('readwrite', (store) => store.put(value, deviceStaticKeyStoreKey(serverId)))
}

async function readKeyPair(serverId: string): Promise<CryptoKeyPair | null> {
  const stored = await inStore<StoredKey | undefined>('readonly', (store) =>
    store.get(deviceStaticKeyStoreKey(serverId)),
  )
  if (isUsableKeyPair(stored)) return stored
  return isWrappedKeyRecord(stored) ? unwrapKeyPair(stored) : null
}

export async function clearDeviceStaticKey(serverId: string): Promise<void> {
  // Nothing can be stored where there is no IndexedDB, so there is nothing to clear.
  if (typeof indexedDB === 'undefined') return
  await inStore('readwrite', (store) => store.delete(deviceStaticKeyStoreKey(serverId)))
}

const PROBE_SERVER_ID = '__store_probe__'
let wrapProbe: Promise<boolean> | null = null

/**
 * Whether a pairing in this browser would get the weaker wrapped key: the same
 * store-and-read-back test `loadOrCreateDeviceStaticKey` runs, on a throwaway
 * key, so the warning can show before a pairing rather than after it.
 */
export function browserNeedsWrappedKey(): Promise<boolean> {
  wrapProbe ??= (async () => {
    if (!(await canHoldDeviceStaticKey())) return false
    const probe = (await crypto.subtle.generateKey({ name: X25519 }, false, [
      'deriveBits',
    ])) as CryptoKeyPair
    try {
      await writeKey(PROBE_SERVER_ID, probe)
      return (await readKeyPair(PROBE_SERVER_ID)) === null
    } finally {
      await clearDeviceStaticKey(PROBE_SERVER_ID)
    }
  })().catch(() => false)
  return wrapProbe
}

/** Test-only: forget the cached probe answer. */
export function _resetWrapProbeForTests(): void {
  wrapProbe = null
}

/** Whether this browser fell back to the weaker wrapped key for a server. */
export async function isDeviceStaticKeyWrapped(serverId: string): Promise<boolean> {
  if (typeof indexedDB === 'undefined') return false
  const stored = await inStore<StoredKey | undefined>('readonly', (store) =>
    store.get(deviceStaticKeyStoreKey(serverId)),
  )
  return isWrappedKeyRecord(stored)
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
  await writeKey(serverId, created)
  // Read back, never trust the commit: WebKit reports success and stores null.
  // Returning the unread key there would pair a device that cannot reopen.
  const stored = (await readKeyPair(serverId)) ?? (await storeWrappedKey(serverId))
  return webCryptoStaticKey(stored)
}

async function storeWrappedKey(serverId: string): Promise<CryptoKeyPair> {
  await writeKey(serverId, await createWrappedKeyRecord())
  const stored = await readKeyPair(serverId)
  if (!stored) throw new Error('This browser cannot keep an encryption key')
  return stored
}
