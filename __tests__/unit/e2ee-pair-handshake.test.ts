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

import * as SecureStore from 'expo-secure-store'
import naclUtil from 'tweetnacl-util'
import {
  PAIR_MESSAGE1_PAYLOAD,
  beginPairHandshake,
  clearDeviceStaticKey,
} from '@/services/e2ee/pair-handshake'
import vectors from '@/__tests__/fixtures/noise-ikpsk1-vectors.json'

const setItemAsync = SecureStore.setItemAsync as jest.MockedFunction<typeof SecureStore.setItemAsync>
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

  it('sends the payload the vector pins, not the one the prose sketches', () => {
    // design.md §2.4 describes `{ deviceName, capabilitiesRequested,
    // clientIdentityPub }`. The two implementations actually agree on `{"v":1}`
    // — the server ignores the payload and takes the static key out of the
    // transcript — so the vector is the contract and this is where that is said.
    expect(PAIR_MESSAGE1_PAYLOAD).toBe(vectors.payload1Utf8)
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
    expect(SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY).not.toBe(SecureStore.WHEN_UNLOCKED)
    expect(JSON.stringify(started)).not.toContain(vectors.keys.clientStaticPrivate)
  })

  it('is cleared under the same key', async () => {
    await clearDeviceStaticKey(SERVER_ID)
    expect(deleteItemAsync).toHaveBeenCalledWith(`threadbase_e2ee_device_key_${SERVER_ID}`)
  })
})
