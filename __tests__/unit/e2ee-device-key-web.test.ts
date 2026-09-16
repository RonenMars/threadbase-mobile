// The web device static key (`device-key.web.ts`): a non-extractable WebCrypto
// X25519 key in IndexedDB, and proof that the WebCrypto DH path produces the
// same Noise handshake as the stablelib path native uses.
//
// Imported by explicit `.web` path: jest's haste platforms have no `web`, so the
// bare specifier resolves the native module (see secure-store-web-refusal.test.ts).
//
// jsdom-free jest has no IndexedDB, and adding a dependency for one was ruled
// out, so a minimal in-memory IndexedDB stands in below. It stores values
// through the structured clone algorithm, as a browser's IndexedDB does, and a
// CryptoKey keeps `extractable: false` across that clone — so the
// non-extractability assertions exercise the mechanism a browser relies on.
// Jest's global `structuredClone` is a v8 serialize polyfill that turns a
// CryptoKey into `{}`, so the clone goes through a MessageChannel, which uses
// Node's real structured clone.
import { MessageChannel } from 'node:worker_threads'
import { generateKeyPairFromSeed, sharedKey } from '@stablelib/x25519'
import naclUtil from 'tweetnacl-util'
import {
  canHoldDeviceStaticKey,
  clearDeviceStaticKey,
  loadDeviceStaticKey,
  loadOrCreateDeviceStaticKey,
  webCryptoStaticKey,
} from '@/services/e2ee/device-key.web'
import { createNoiseInitiator, staticKeyFromPrivate, type StaticKey } from '@/services/e2ee/noise'
import { OPEN_PROLOGUE } from '@/services/e2ee/pair-handshake'
import vectors from '@/__tests__/fixtures/noise-ikpsk1-vectors.json'
import recordVectors from '@/__tests__/fixtures/e2ee-record-vectors.json'

// ── Minimal IndexedDB ────────────────────────────────────────────────────────

type Handler = (() => void) | null

function hostClone(value: CryptoKeyPair): Promise<CryptoKeyPair> {
  const { port1, port2 } = new MessageChannel()
  return new Promise((resolve) => {
    port2.once('message', (cloned: CryptoKeyPair) => {
      port1.close()
      resolve(cloned)
    })
    port1.postMessage(value)
  })
}

class FakeRequest<T> {
  result: T | undefined
  error: DOMException | null = null
  onsuccess: Handler = null
  onerror: Handler = null
  onupgradeneeded: Handler = null
}

class FakeTransaction {
  oncomplete: Handler = null
  onerror: Handler = null
  onabort: Handler = null
  error: DOMException | null = null
  constructor(private readonly rows: Map<string, CryptoKeyPair>) {}

  objectStore() {
    const tx = this
    const run = <T>(work: () => Promise<T>): FakeRequest<T> => {
      const request = new FakeRequest<T>()
      void work().then((result) => {
        request.result = result
        request.onsuccess?.()
        tx.oncomplete?.()
      })
      return request
    }
    return {
      get: (key: string) => {
        const row = this.rows.get(key)
        return run(async () => (row ? hostClone(row) : undefined))
      },
      put: (value: CryptoKeyPair, key: string) =>
        run(async () => {
          this.rows.set(key, await hostClone(value))
          return key
        }),
      delete: (key: string) =>
        run(async () => {
          this.rows.delete(key)
          return undefined
        }),
    }
  }
}

const database = new Map<string, CryptoKeyPair>()
let databaseCreated = false

const fakeIndexedDB = {
  open() {
    const request = new FakeRequest<{
      createObjectStore: () => void
      transaction: () => FakeTransaction
      close: () => void
    }>()
    request.result = {
      createObjectStore: () => {
        databaseCreated = true
      },
      transaction: () => new FakeTransaction(database),
      close: () => undefined,
    }
    setTimeout(() => {
      if (!databaseCreated) request.onupgradeneeded?.()
      request.onsuccess?.()
    }, 0)
    return request
  },
}

function installIndexedDB(present: boolean) {
  Object.defineProperty(globalThis, 'indexedDB', {
    configurable: true,
    value: present ? fakeIndexedDB : undefined,
  })
}

beforeEach(() => {
  database.clear()
  databaseCreated = false
  installIndexedDB(true)
})

afterAll(() => {
  installIndexedDB(false)
})

const STORE_KEY = 'threadbase_e2ee_device_key_srv_web'
const b64 = naclUtil.decodeBase64
const b64url = (bytes: Uint8Array) =>
  naclUtil.encodeBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

/** Test-only: an extractable import of a fixed key, so it can match the vectors. */
async function importFixedKeyPair(privateKey: Uint8Array): Promise<CryptoKeyPair> {
  const { publicKey } = generateKeyPairFromSeed(privateKey)
  const x = b64url(publicKey)
  return {
    privateKey: await crypto.subtle.importKey(
      'jwk',
      { kty: 'OKP', crv: 'X25519', d: b64url(privateKey), x },
      { name: 'X25519' },
      true,
      ['deriveBits'],
    ),
    publicKey: await crypto.subtle.importKey('raw', Uint8Array.from(publicKey), { name: 'X25519' }, true, []),
  }
}

// ── The key store ────────────────────────────────────────────────────────────

describe('web device key store', () => {
  it('reports the capability when WebCrypto X25519 and IndexedDB are both present', async () => {
    await expect(canHoldDeviceStaticKey()).resolves.toBe(true)
  })

  it('reports no capability without IndexedDB, and loads no key', async () => {
    installIndexedDB(false)
    await expect(canHoldDeviceStaticKey()).resolves.toBe(false)
    await expect(loadDeviceStaticKey('srv_web')).resolves.toBeNull()
  })

  it('reports no capability when WebCrypto has no X25519', async () => {
    const generateKey = jest
      .spyOn(crypto.subtle, 'generateKey')
      .mockRejectedValueOnce(new DOMException('Unrecognized name', 'NotSupportedError'))
    try {
      await expect(canHoldDeviceStaticKey()).resolves.toBe(false)
    } finally {
      generateKey.mockRestore()
    }
  })

  it('generates a key, persists it, and reloads the same key', async () => {
    await expect(loadDeviceStaticKey('srv_web')).resolves.toBeNull()

    const created = await loadOrCreateDeviceStaticKey('srv_web')
    expect(created.publicKey).toHaveLength(32)
    expect(database.has(STORE_KEY)).toBe(true)

    // A fresh read from the store, as after a page reload.
    const reloaded = await loadDeviceStaticKey('srv_web')
    expect(reloaded && b64url(reloaded.publicKey)).toBe(b64url(created.publicKey))
    // Load-or-create reuses rather than replacing: the streamer dedupes device rows on this key.
    const again = await loadOrCreateDeviceStaticKey('srv_web')
    expect(b64url(again.publicKey)).toBe(b64url(created.publicKey))
    // And the reloaded key still performs DH — it is usable, not just present.
    const peer = generateKeyPairFromSeed(new Uint8Array(32).fill(3))
    expect(b64url(await reloaded!.dh(peer.publicKey))).toBe(
      b64url(sharedKey(peer.secretKey, created.publicKey, true)),
    )
  })

  it('stores a non-extractable private key that exportKey refuses', async () => {
    await loadOrCreateDeviceStaticKey('srv_web')
    const stored = database.get(STORE_KEY)
    expect(stored?.privateKey.extractable).toBe(false)
    expect(stored?.privateKey.algorithm.name).toBe('X25519')
    await expect(crypto.subtle.exportKey('pkcs8', stored!.privateKey)).rejects.toThrow()
    await expect(crypto.subtle.exportKey('jwk', stored!.privateKey)).rejects.toThrow()
    // Positive control: an extractable key of the same kind DOES export, so the
    // refusal above is the extractable flag and not an unsupported format.
    const extractable = await importFixedKeyPair(new Uint8Array(32).fill(5))
    await expect(crypto.subtle.exportKey('pkcs8', extractable.privateKey)).resolves.toBeDefined()
  })

  it('replaces a stored key that is extractable rather than using it', async () => {
    const leaked = await importFixedKeyPair(new Uint8Array(32).fill(6))
    database.set(STORE_KEY, leaked)

    const key = await loadOrCreateDeviceStaticKey('srv_web')

    expect(b64url(key.publicKey)).not.toBe(
      b64url(generateKeyPairFromSeed(new Uint8Array(32).fill(6)).publicKey),
    )
    expect(database.get(STORE_KEY)?.privateKey.extractable).toBe(false)
  })

  it('clears the key under the same logical store key', async () => {
    await loadOrCreateDeviceStaticKey('srv_web')
    await clearDeviceStaticKey('srv_web')
    expect(database.has(STORE_KEY)).toBe(false)
    await expect(loadDeviceStaticKey('srv_web')).resolves.toBeNull()
  })
})

// ── DH and handshake parity with stablelib ───────────────────────────────────

describe('WebCrypto static key parity with the stablelib path', () => {
  const clientStaticPrivate = b64(vectors.keys.clientStaticPrivate)
  const serverStaticPublic = b64(vectors.keys.serverStaticPublic)

  it('yields the same public key and shared secret as stablelib', async () => {
    const web = await webCryptoStaticKey(await importFixedKeyPair(clientStaticPrivate))
    const native = staticKeyFromPrivate(clientStaticPrivate)

    expect(b64url(web.publicKey)).toBe(b64url(native.publicKey))
    expect(b64url(await web.dh(serverStaticPublic))).toBe(
      b64url(sharedKey(clientStaticPrivate, serverStaticPublic, true)),
    )
  })

  it('refuses an all-zero shared secret itself, not only through the browser', async () => {
    const web = await webCryptoStaticKey(await importFixedKeyPair(clientStaticPrivate))
    const deriveBits = jest
      .spyOn(crypto.subtle, 'deriveBits')
      .mockResolvedValueOnce(new ArrayBuffer(32))
    try {
      await expect(web.dh(serverStaticPublic)).rejects.toThrow(/invalid shared key/)
    } finally {
      deriveBits.mockRestore()
    }
    // Positive control: the same key and peer succeed once deriveBits is real.
    await expect(web.dh(serverStaticPublic)).resolves.toHaveLength(32)
  })

  async function pairingTranscript(clientStatic: StaticKey) {
    const initiator = createNoiseInitiator({
      pattern: 'IKpsk1',
      serverStaticPublic,
      clientStatic,
      psk: b64(vectors.psk),
      prologue: naclUtil.decodeUTF8(vectors.prologueUtf8),
      ephemeralPrivate: b64(vectors.keys.clientEphemeralPrivate),
    })
    const message1 = await initiator.writeMessage1(naclUtil.decodeUTF8(vectors.payload1Utf8))
    const result = await initiator.readMessage2(b64(vectors.message2))
    return { message1, result }
  }

  it('builds a byte-identical IKpsk1 handshake to the committed vector', async () => {
    const web = await pairingTranscript(
      await webCryptoStaticKey(await importFixedKeyPair(clientStaticPrivate)),
    )
    const native = await pairingTranscript(staticKeyFromPrivate(clientStaticPrivate))

    expect(naclUtil.encodeBase64(web.message1)).toBe(vectors.message1)
    expect(naclUtil.encodeBase64(web.message1)).toBe(naclUtil.encodeBase64(native.message1))
    expect(naclUtil.encodeBase64(web.result.handshakeHash)).toBe(vectors.handshakeHash)
    expect(naclUtil.encodeBase64(web.result.clientToServerKey)).toBe(vectors.clientToServerKey)
    expect(naclUtil.encodeBase64(web.result.serverToClientKey)).toBe(vectors.serverToClientKey)
  })

  it('builds a byte-identical /open IK handshake to the committed vector', async () => {
    const open = recordVectors.open
    const openPrivate = b64(open.keys.clientStaticPrivate)
    const initiator = createNoiseInitiator({
      pattern: 'IK',
      serverStaticPublic: b64(open.keys.serverStaticPublic),
      clientStatic: await webCryptoStaticKey(await importFixedKeyPair(openPrivate)),
      prologue: naclUtil.decodeUTF8(OPEN_PROLOGUE),
      ephemeralPrivate: b64(open.keys.clientEphemeralPrivate),
    })

    const message1 = await initiator.writeMessage1(naclUtil.decodeUTF8(open.payload1Utf8))
    expect(naclUtil.encodeBase64(message1)).toBe(open.message1)
    const result = await initiator.readMessage2(b64(open.message2))
    expect(naclUtil.encodeBase64(result.handshakeHash)).toBe(open.handshakeHash)
    expect(naclUtil.encodeBase64(result.clientToServerKey)).toBe(open.clientToServerKey)
  })
})
