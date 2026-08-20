// The capability gate in front of the pairing handshake, and where this
// device's static key goes (#698).
//
// **The gate is the QR's `spk`, and there is deliberately no `/api/info` probe
// here.** This file used to assert the opposite — that `beginPairHandshake`
// consults `serverSpeaksE2ee(serverInfo)`. That gate cannot be satisfied at
// pairing: `/api/info` is authenticated and pairing is the request that mints
// the credential, so there is nothing to present at that moment and the only
// available answer is `null`, which declines every time. A gate that can never
// pass is the same defect shape as an assertion that can never fail.
// design.md §6.2 names the QR as discovery surface #1 for exactly this moment.
//
// `serverSpeaksE2ee` keeps its own tests in `e2ee-capability.test.ts`; it
// belongs to the connection path, which does have a credential.

// Through `services/secure-store`, not `expo-secure-store`: Metro swaps that
// module for a localStorage shim on web, so a test that reaches past it asserts
// against a file the app does not always use.
import * as SecureStore from '@/services/secure-store'
import naclUtil from 'tweetnacl-util'
import {
  beginPairHandshake,
  clearDeviceStaticKey,
  pairMessage1Payload,
} from '@/services/e2ee/pair-handshake'
import vectors from '@/__tests__/fixtures/noise-ikpsk1-vectors.json'

const setItemAsync = SecureStore.setItemAsync as jest.MockedFunction<typeof SecureStore.setItemAsync>
const getItemAsync = SecureStore.getItemAsync as jest.MockedFunction<typeof SecureStore.getItemAsync>
const deleteItemAsync = SecureStore.deleteItemAsync as jest.MockedFunction<
  typeof SecureStore.deleteItemAsync
>

/** The QR carries base64url; the vectors are standard base64. */
const toBase64Url = (b64: string) => b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

const SERVER_PUBLIC_KEY = toBase64Url(vectors.keys.serverStaticPublic)
const SERVER_ID = 'srv_test'

const start = (serverPublicKey?: string) =>
  beginPairHandshake({
    serverId: SERVER_ID,
    serverPublicKey,
    pairToken: vectors.pairToken,
    clientStaticPrivate: naclUtil.decodeBase64(vectors.keys.clientStaticPrivate),
    ephemeralPrivate: naclUtil.decodeBase64(vectors.keys.clientEphemeralPrivate),
  })

beforeEach(() => {
  setItemAsync.mockClear()
  deleteItemAsync.mockClear()
  getItemAsync.mockReset()
  getItemAsync.mockResolvedValue(null)
})

describe('beginPairHandshake', () => {
  it('starts a handshake that matches the vector when the QR carries a server key', async () => {
    // The positive control, and also the proof that the prologue and the PSK
    // derivation are really plumbed through rather than merely exported: get
    // either wrong and this message 1 stops matching the streamer's.
    const started = await start(SERVER_PUBLIC_KEY)
    expect(started.ok).toBe(true)
    if (!started.ok) return
    const message1 = started.handshake.writeMessage1(naclUtil.decodeUTF8(vectors.payload1Utf8))
    expect(naclUtil.encodeBase64(message1)).toBe(vectors.message1)
  })

  it('builds a payload carrying what the server registers the device from', () => {
    // The vector's `payload1Utf8` is `{"v":1}` and this deliberately no longer
    // equals it. The vector pins the PROTOCOL — the test above feeds it to
    // `writeMessage1` explicitly and still reproduces the committed message 1,
    // which is what proves the two Noise implementations agree on a transcript.
    // What the app puts IN that payload is a separate contract, and it moved:
    // msg1 now authenticates `{ v, deviceName?, readOnly }` so an intermediary
    // cannot rename a device or widen its capability preset in transit.
    //
    // The vectors themselves are untouched. Nothing here regenerates them.
    expect(JSON.parse(pairMessage1Payload({ readOnly: false }))).toEqual({
      v: 1,
      readOnly: false,
    })
    expect(JSON.parse(pairMessage1Payload({ deviceName: 'Pixel 8', readOnly: true }))).toEqual({
      v: 1,
      deviceName: 'Pixel 8',
      readOnly: true,
    })
  })

  it('declines when the QR carried no server key', async () => {
    // Every streamer in the field today, and the whole of the old-server story.
    await expect(start(undefined)).resolves.toEqual({
      ok: false,
      reason: 'server-offered-no-key',
    })
  })

  it('does not touch SecureStore when it declines', async () => {
    await start(undefined)
    expect(setItemAsync).not.toHaveBeenCalled()
  })

  // A downgrade must never be reachable by corrupting one QR parameter, so a
  // present-but-unusable key throws rather than quietly becoming "no key".
  it.each([
    ['too short', SERVER_PUBLIC_KEY.slice(0, 42)],
    ['too long', `${SERVER_PUBLIC_KEY}A`],
    ['not base64url', '!'.repeat(43)],
  ])('fails hard on a %s server key rather than falling back', async (_label, bad) => {
    expect.assertions(2)
    await expect(start(bad)).rejects.toThrow(/E2EE/)
    expect(setItemAsync).not.toHaveBeenCalled()
  })
})

describe('the device static key', () => {
  it('is in SecureStore before a handshake exists to send anything with', async () => {
    // Ordering, not eventual presence. The server registers the public half
    // before it can tell the client anything, so a client that only kept its
    // own half once a reply arrived would leave the server holding a key nobody
    // can use. Asserting the write happened by the time the initiator is handed
    // back is what makes that state unreachable.
    let wroteKeyBeforeReturning = false
    setItemAsync.mockImplementationOnce(async () => {
      wroteKeyBeforeReturning = true
    })
    const started = await start(SERVER_PUBLIC_KEY)
    expect(started.ok).toBe(true)
    expect(wroteKeyBeforeReturning).toBe(true)
  })

  it('is stored per server, device-only, and never returned to the caller', async () => {
    const started = await start(SERVER_PUBLIC_KEY)
    expect(setItemAsync).toHaveBeenCalledWith(
      `threadbase_e2ee_device_key_${SERVER_ID}`,
      vectors.keys.clientStaticPrivate,
      // The default Keychain class syncs to iCloud and restores onto a new
      // device, which would make revoking a lost phone incomplete.
      { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY },
    )
    // The control that makes the assertion above mean anything: were the
    // constant absent, `keychainAccessible: undefined` would satisfy it exactly
    // as happily as the iCloud-syncing default would.
    expect(SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY).toBeDefined()
    expect(JSON.stringify(started)).not.toContain(vectors.keys.clientStaticPrivate)
  })

  it('is cleared under the same key', async () => {
    await clearDeviceStaticKey(SERVER_ID)
    expect(deleteItemAsync).toHaveBeenCalledWith(`threadbase_e2ee_device_key_${SERVER_ID}`)
  })

  it('is loaded rather than replaced when this server already has one', async () => {
    // Load-or-create, not generate-and-overwrite. The streamer deduplicates
    // device rows on this key, so replacing it per attempt grows a second row
    // for one phone. Asserted with no `clientStaticPrivate` injected, because an
    // injected key would supply the answer the store is supposed to.
    getItemAsync.mockResolvedValue(vectors.keys.clientStaticPrivate)

    const started = await beginPairHandshake({
      serverId: SERVER_ID,
      serverPublicKey: SERVER_PUBLIC_KEY,
      pairToken: vectors.pairToken,
      ephemeralPrivate: naclUtil.decodeBase64(vectors.keys.clientEphemeralPrivate),
    })

    expect(started.ok).toBe(true)
    if (!started.ok) return
    // The stored key really drove the handshake: message 1 reproduces the
    // committed vector, which it can only do with that exact static key.
    const message1 = started.handshake.writeMessage1(naclUtil.decodeUTF8(vectors.payload1Utf8))
    expect(naclUtil.encodeBase64(message1)).toBe(vectors.message1)
    // And nothing was rewritten — a write here is the overwrite being guarded.
    expect(setItemAsync).not.toHaveBeenCalled()
  })

  it('replaces a stored value that cannot be a key', async () => {
    // A corrupt entry must not brick pairing forever on a value nothing can
    // repair, so it is treated as absent and a usable key is minted over it.
    getItemAsync.mockResolvedValue('not-a-32-byte-key')

    const started = await beginPairHandshake({
      serverId: SERVER_ID,
      serverPublicKey: SERVER_PUBLIC_KEY,
      pairToken: vectors.pairToken,
    })

    expect(started.ok).toBe(true)
    expect(setItemAsync).toHaveBeenCalledWith(
      `threadbase_e2ee_device_key_${SERVER_ID}`,
      expect.any(String),
      { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY },
    )
  })
})
