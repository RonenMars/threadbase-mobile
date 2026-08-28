import * as SecureStore from '@/services/secure-store'
import nacl from 'tweetnacl'
import naclUtil from 'tweetnacl-util'
import {
  classifyPairCredential,
  exchangeToken,
  parsePairUri,
  PairExchangeError,
  PairUriError,
} from '@/services/pair-exchange'
import { serverIdFromUrl } from '@/types/api'
import { PAIR_PROLOGUE, beginPairHandshake, derivePairPsk } from '@/services/e2ee/pair-handshake'
import { createNoiseResponder } from '@/test-utils/noise-responder'
import vectors from '@/__tests__/fixtures/noise-ikpsk1-vectors.json'

// Through `services/secure-store`, never `expo-secure-store` directly: the web
// build swaps that module for a localStorage shim by Metro platform extension,
// so a test that reaches past it is testing a file the app does not always use.
// `HAS_SECURE_KEYCHAIN` is a getter so a single test can answer it as web does.
let mockHasSecureKeychain = true
const mockKeychain = new Map<string, string>()
jest.mock('@/services/secure-store', () => ({
  get HAS_SECURE_KEYCHAIN() {
    return mockHasSecureKeychain
  },
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 6,
  getItemAsync: jest.fn(async (key: string) => mockKeychain.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockKeychain.set(key, value)
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    mockKeychain.delete(key)
  }),
}))

describe('classifyPairCredential', () => {
  it('detects threadbase:// pair URIs', () => {
    expect(
      classifyPairCredential(
        'threadbase://pair?url=https%3A%2F%2Fa.test&token=pt_abc',
      ),
    ).toBe('pair-uri')
  })

  it('detects short-lived pt_ pair tokens', () => {
    expect(classifyPairCredential('pt_abcdef0123456789')).toBe('pair-token')
    expect(classifyPairCredential('  pt_x  ')).toBe('pair-token')
  })

  it('treats long-lived API keys as api-key', () => {
    expect(classifyPairCredential('tb_df11da2b8b037fd61d82349d182a87b6')).toBe(
      'api-key',
    )
    expect(classifyPairCredential('some-other-secret')).toBe('api-key')
  })
})

describe('parsePairUri', () => {
  it('parses a well-formed pair URI', () => {
    const futureExp = Math.floor(Date.now() / 1000) + 180
    const out = parsePairUri(
      `threadbase://pair?url=https%3A%2F%2Fexample.test&token=pt_abc&exp=${futureExp}`,
    )
    expect(out.url).toBe('https://example.test')
    expect(out.token).toBe('pt_abc')
    expect(out.exp).toBe(futureExp)
  })

  it('returns undefined exp when missing', () => {
    const out = parsePairUri('threadbase://pair?url=https%3A%2F%2Fa.test&token=pt_x')
    expect(out.exp).toBeUndefined()
  })

  it('rejects non-URL input', () => {
    expect(() => parsePairUri('not a uri')).toThrow(PairUriError)
  })

  it('rejects wrong scheme', () => {
    expect(() => parsePairUri('https://pair?url=x&token=y')).toThrow(PairUriError)
  })

  it('rejects missing token', () => {
    expect(() => parsePairUri('threadbase://pair?url=https%3A%2F%2Fa.test')).toThrow(
      PairUriError,
    )
  })

  it('rejects expired pair QR', () => {
    let caught: unknown
    try {
      parsePairUri('threadbase://pair?url=https%3A%2F%2Fa.test&token=pt_x&exp=1')
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(PairUriError)
    expect((caught as PairUriError).code).toBe('expired')
  })

  it('rejects non-http(s) server URLs', () => {
    let caught: unknown
    try {
      parsePairUri('threadbase://pair?url=javascript%3Aalert(1)&token=pt_x')
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(PairUriError)
    expect((caught as PairUriError).code).toBe('bad-server-url')
  })

  // The QR is the only out-of-band channel in pairing, so it is the only place
  // the server's identity can arrive un-substitutable. Nothing reads it yet;
  // these pin that it survives the parse to where Phase 2 can.
  const SPK = 'A'.repeat(43)

  it('surfaces the server public key', () => {
    const out = parsePairUri(
      `threadbase://pair?url=https%3A%2F%2Fa.test&token=pt_x&spk=${SPK}&v=1`,
    )
    expect(out.spk).toBe(SPK)
    expect(out.v).toBe(1)
  })

  // An older streamer emits neither field, and that has to stay an ordinary
  // successful pairing rather than become a new failure.
  it('parses a URI carrying neither field', () => {
    const out = parsePairUri('threadbase://pair?url=https%3A%2F%2Fa.test&token=pt_x')
    expect(out.spk).toBeUndefined()
    expect(out.v).toBeUndefined()
    expect(out.url).toBe('https://a.test')
  })

  // Absent and present-but-invalid must not collapse into one answer. Dropping a
  // wrong-shaped key to `undefined` selects the legacy plaintext path, which
  // makes a downgrade reachable by corrupting one QR parameter — mobile-design
  // §3.2 calls that a hard error, and this is the parser every real entry path
  // goes through (camera, deep link, paste).
  it.each([['A'.repeat(42)], ['A'.repeat(44)], ['not+base64url/at=all'], ['']])(
    'rejects a present-but-wrong-shaped spk (%p) rather than falling back to plaintext',
    (bad) => {
      let caught: unknown
      try {
        parsePairUri(`threadbase://pair?url=https%3A%2F%2Fa.test&token=pt_x&spk=${bad}`)
      } catch (err) {
        caught = err
      }
      expect(caught).toBeInstanceOf(PairUriError)
      expect((caught as PairUriError).code).toBe('bad-server-key')
    },
  )

  // The negative control for the row above: without it, "it threw" cannot tell a
  // rejected key from a parser that rejects every QR carrying an `spk` at all.
  it('accepts a well-shaped spk on the same URI shape', () => {
    const out = parsePairUri(
      `threadbase://pair?url=https%3A%2F%2Fa.test&token=pt_x&spk=${SPK}`,
    )
    expect(out.spk).toBe(SPK)
  })

  it('drops a non-numeric v', () => {
    const out = parsePairUri('threadbase://pair?url=https%3A%2F%2Fa.test&token=pt_x&v=abc')
    expect(out.v).toBeUndefined()
  })
})

describe('exchangeToken', () => {
  const realFetch = global.fetch
  afterEach(() => {
    global.fetch = realFetch
    jest.useRealTimers()
  })

  it('round-trips a sealed api key', async () => {
    const apiKey = 'tb_round_trip_secret'

    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { token: string; clientPublicKey: string }
      const recipientPk = naclUtil.decodeBase64(body.clientPublicKey)
      const ephemeral = nacl.box.keyPair()
      const nonce = nacl.randomBytes(nacl.box.nonceLength)
      const cipher = nacl.box(
        naclUtil.decodeUTF8(apiKey),
        nonce,
        recipientPk,
        ephemeral.secretKey,
      )
      return new Response(
        JSON.stringify({
          ciphertext: naclUtil.encodeBase64(cipher),
          nonce: naclUtil.encodeBase64(nonce),
          ephemeralPublicKey: naclUtil.encodeBase64(ephemeral.publicKey),
          publicUrl: 'https://example.test',
          machineName: 'ronen-mac.local',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    }) as typeof fetch

    const result = await exchangeToken({ url: 'https://example.test', token: 'pt_abc' })
    expect(result.apiKey).toBe(apiKey)
    expect(result.publicUrl).toBe('https://example.test')
    expect(result.machineName).toBe('ronen-mac.local')
    expect(result.url).toBe('https://example.test')
    expect(result.deviceId).toBeNull()
    expect(result.deviceToken).toBeNull()
    expect(result.capabilities).toBeNull()
  })

  // The regression this exists to prevent (TB-S-13). `resolvedUrl` used to be
  // `body.publicUrl ?? trimmedUrl`, so a server that advertised a public
  // address silently replaced the one the user typed — pairing against a LAN IP
  // moved the app to the tunnel with no signal.
  //
  // The two URLs MUST differ. The test above uses the same value for both, so
  // it passes on the old behaviour and proves nothing about this one.
  it('keeps the typed address when the server advertises a different publicUrl', async () => {
    const apiKey = 'tb_typed_address_is_authoritative'
    const typed = 'http://192.168.68.125:8766'
    const advertised = 'https://tunnel.example.test'

    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      // The request itself must go to the typed address, not the advertised one.
      expect(String(input)).toBe(`${typed}/api/pair/exchange`)
      const body = JSON.parse(String(init?.body)) as { clientPublicKey: string }
      const recipientPk = naclUtil.decodeBase64(body.clientPublicKey)
      const ephemeral = nacl.box.keyPair()
      const nonce = nacl.randomBytes(nacl.box.nonceLength)
      const cipher = nacl.box(
        naclUtil.decodeUTF8(apiKey),
        nonce,
        recipientPk,
        ephemeral.secretKey,
      )
      return new Response(
        JSON.stringify({
          ciphertext: naclUtil.encodeBase64(cipher),
          nonce: naclUtil.encodeBase64(nonce),
          ephemeralPublicKey: naclUtil.encodeBase64(ephemeral.publicKey),
          publicUrl: advertised,
          machineName: 'ronen-mac.local',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    }) as typeof fetch

    const result = await exchangeToken({ url: typed, token: 'pt_abc' })

    expect(result.url).toBe(typed)
    expect(result.url).not.toBe(advertised)
    // Recorded rather than discarded — a later feature needs it, and losing it
    // here would mean a re-pair to recover a value the server already sent.
    expect(result.publicUrl).toBe(advertised)
  })

  it('forwards deviceName/readOnly and returns device fields', async () => {
    const apiKey = 'tb_device_fields'

    global.fetch = jest.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as {
        token: string
        clientPublicKey: string
        deviceName?: string
        readOnly?: boolean
      }
      expect(body.deviceName).toBe('Pixel 8')
      expect(body.readOnly).toBe(true)
      const recipientPk = naclUtil.decodeBase64(body.clientPublicKey)
      const ephemeral = nacl.box.keyPair()
      const nonce = nacl.randomBytes(nacl.box.nonceLength)
      const cipher = nacl.box(
        naclUtil.decodeUTF8(apiKey),
        nonce,
        recipientPk,
        ephemeral.secretKey,
      )
      return new Response(
        JSON.stringify({
          ciphertext: naclUtil.encodeBase64(cipher),
          nonce: naclUtil.encodeBase64(nonce),
          ephemeralPublicKey: naclUtil.encodeBase64(ephemeral.publicKey),
          deviceId: 'uuid-1',
          deviceToken: 'dt_secret',
          capabilities: ['history:read'],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    }) as typeof fetch

    const result = await exchangeToken({
      url: 'https://example.test',
      token: 'pt_abc',
      deviceName: 'Pixel 8',
      readOnly: true,
    })
    expect(result.apiKey).toBe(apiKey)
    expect(result.deviceId).toBe('uuid-1')
    expect(result.deviceToken).toBe('dt_secret')
    expect(result.capabilities).toEqual(['history:read'])
  })

  it('surfaces a 401 as a token error', async () => {
    global.fetch = jest.fn(async () =>
      new Response(JSON.stringify({ error: 'expired' }), { status: 401 }),
    ) as typeof fetch
    await expect(
      exchangeToken({ url: 'https://example.test', token: 'pt_x' }),
    ).rejects.toMatchObject({ kind: 'token' })
  })

  it('surfaces a 429 as rate-limited', async () => {
    global.fetch = jest.fn(async () => new Response('', { status: 429 })) as typeof fetch
    await expect(
      exchangeToken({ url: 'https://example.test', token: 'pt_x' }),
    ).rejects.toMatchObject({ kind: 'rate-limited' })
  })

  it('surfaces a fetch failure as a network error', async () => {
    global.fetch = jest.fn(async () => {
      throw new TypeError('Network request failed')
    }) as typeof fetch
    await expect(
      exchangeToken({ url: 'https://example.test', token: 'pt_x' }),
    ).rejects.toMatchObject({ kind: 'network' })
  })

  it('rejects a missing sealed payload', async () => {
    global.fetch = jest.fn(async () =>
      new Response(JSON.stringify({}), { status: 200 }),
    ) as typeof fetch
    await expect(
      exchangeToken({ url: 'https://example.test', token: 'pt_x' }),
    ).rejects.toBeInstanceOf(PairExchangeError)
  })

  it('times out hung requests', async () => {
    jest.useFakeTimers()
    global.fetch = jest.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const err = new Error('Aborted')
            err.name = 'AbortError'
            reject(err)
          })
        }),
    ) as typeof fetch

    const pending = exchangeToken({ url: 'https://example.test', token: 'pt_x' })
    const assertion = expect(pending).rejects.toMatchObject({
      kind: 'network',
      message: 'Request timed out',
    })
    await jest.advanceTimersByTimeAsync(15_001)
    await assertion
  })

  it('rejects non-http(s) server URLs', async () => {
    await expect(
      exchangeToken({ url: 'javascript:alert(1)', token: 'pt_x' }),
    ).rejects.toMatchObject({ code: 'bad-server-url' })
  })
})

// ── The pairing handshake (#698) ─────────────────────────────────────────────
//
// The gate is the QR's `spk` and nothing else: `GET /api/info` is authenticated
// and this is the request that mints the credential, so there is no capability
// probe available at this moment.
//
// The streamer's responder is stood up here from the committed vector's keys so
// these exercise a real `Noise_IKpsk1` round trip rather than a shape. What they
// cannot prove is interoperability — `e2ee-noise.test.ts` reproducing the
// committed bytes is what proves that, and `e2ee-pair-handshake.test.ts` proves
// the real call path still produces them.

const b64 = naclUtil.decodeBase64
const utf8 = naclUtil.decodeUTF8

/** The QR carries base64url; the vectors are standard base64. */
const toBase64Url = (raw: string) => raw.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

const SERVER_SPK = toBase64Url(vectors.keys.serverStaticPublic)
const PAIR_TOKEN = vectors.pairToken
const SERVER_URL = 'https://example.test'
const DEVICE_KEY_PREFIX = 'threadbase_e2ee_device_key_'

interface ExchangeRequestBody {
  token: string
  clientPublicKey: string
  /** The compatibility copies. A released server reads these; a new one does not. */
  deviceName?: string
  readOnly?: boolean
  e2ee?: { v: number; noise: string }
}

function sealApiKey(apiKey: string, clientPublicKey: string) {
  const ephemeral = nacl.box.keyPair()
  const nonce = nacl.randomBytes(nacl.box.nonceLength)
  const cipher = nacl.box(utf8(apiKey), nonce, b64(clientPublicKey), ephemeral.secretKey)
  return {
    ciphertext: naclUtil.encodeBase64(cipher),
    nonce: naclUtil.encodeBase64(nonce),
    ephemeralPublicKey: naclUtil.encodeBase64(ephemeral.publicKey),
  }
}

/**
 * The authenticated message 2 payload, per the corrected Phase 2 contract.
 *
 * **Every value here differs from its outer twin below.** That is the whole
 * point: an assertion that the result carries `MSG2_*` is simultaneously the
 * assertion that the unauthenticated outer copy did not win. Make the two sets
 * equal and every one of those tests passes on code that reads the wrong one.
 */
const MSG2 = {
  v: 1,
  deviceId: 'device-from-msg2',
  deviceToken: 'dt_authenticated',
  capabilities: ['history:read'],
  publicUrl: 'https://advertised.example.test',
  machineName: 'authenticated-machine',
  serverVersion: '1.55.3',
  e2eeRequired: true,
}

/** The compatibility envelope, which a released client reads and a new one must not. */
const OUTER = {
  machineName: 'outer-machine',
  publicUrl: 'https://outer.example.test',
  deviceId: 'outer-device-id',
  deviceToken: 'dt_outer_unauthenticated',
  capabilities: ['admin'],
}

interface StreamerOptions {
  /** The token the SERVER derives its PSK from. Differs from the client's in the binding test. */
  pskToken?: string
  payload2?: Record<string, unknown>
  tamperMessage2?: boolean
  /** A reply with no message 2 at all — the refusal case, once message 1 is out. */
  dropE2eeFromReply?: boolean
  replyVersion?: number
}

/**
 * A streamer that answers `POST /api/pair/exchange` for real: it runs the
 * responder half against whatever message 1 the client actually built.
 */
function fakeStreamer(options: StreamerOptions = {}) {
  const seen: {
    body?: ExchangeRequestBody
    handshakeRejected: boolean
    /** What the streamer would deduplicate the device row on. */
    clientStaticKeys: string[]
    /**
     * Message 1's payload **after decryption** — the only copy a new streamer
     * reads. Asserting on the builder's return value instead would test the
     * wrong side of the encryption and pass on a build that never sends it.
     */
    message1Payloads: Record<string, unknown>[]
  } = { handshakeRejected: false, clientStaticKeys: [], message1Payloads: [] }

  const impl = jest.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as ExchangeRequestBody
    seen.body = body

    let e2ee: { v: number; noise: string } | undefined
    if (body.e2ee && !options.dropE2eeFromReply) {
      const responder = createNoiseResponder({
        serverStaticPrivate: b64(vectors.keys.serverStaticPrivate),
        psk: derivePairPsk(options.pskToken ?? PAIR_TOKEN),
        prologue: utf8(PAIR_PROLOGUE),
        ephemeralPrivate: b64(vectors.keys.serverEphemeralPrivate),
      })
      let message1Payload: Uint8Array
      // Only the handshake read is guarded: folding the JSON parse in here too
      // would report a malformed payload as a handshake failure, which is a
      // different refusal with a different remedy.
      try {
        message1Payload = responder.readMessage1(b64(body.e2ee.noise))
      } catch {
        // What the streamer really returns: one code for every handshake
        // failure, and the pair token is deliberately not spent.
        seen.handshakeRejected = true
        return new Response(
          JSON.stringify({ error: 'E2EE handshake failed.', code: 'E2EE_HANDSHAKE_FAILED' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        )
      }
      seen.message1Payloads.push(
        JSON.parse(naclUtil.encodeUTF8(message1Payload)) as Record<string, unknown>,
      )
      seen.clientStaticKeys.push(naclUtil.encodeBase64(responder.remoteStaticPublic()))
      const message2 = responder.writeMessage2(utf8(JSON.stringify(options.payload2 ?? MSG2)))
      if (options.tamperMessage2) message2[40] ^= 0x01
      e2ee = { v: options.replyVersion ?? 1, noise: naclUtil.encodeBase64(message2) }
    }

    return new Response(
      JSON.stringify({
        ...sealApiKey('tb_handshake_key', body.clientPublicKey),
        ...OUTER,
        ...(e2ee ? { e2ee } : {}),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  })

  return { fetch: impl as unknown as typeof fetch, seen }
}

function refusingStreamer(code: string) {
  return jest.fn(async () =>
    new Response(JSON.stringify({ error: 'refused', code }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    }),
  ) as unknown as typeof fetch
}

const setItemAsync = SecureStore.setItemAsync as jest.MockedFunction<typeof SecureStore.setItemAsync>
const DEVICE_KEY = `${DEVICE_KEY_PREFIX}${serverIdFromUrl(SERVER_URL)}`

describe('exchangeToken — the pairing handshake', () => {
  const realFetch = global.fetch
  beforeEach(() => {
    mockKeychain.clear()
    mockHasSecureKeychain = true
    jest.clearAllMocks()
  })
  afterEach(() => {
    global.fetch = realFetch
  })

  it('sends no e2ee field at all when the QR carried no server key', async () => {
    // An older streamer must see byte-for-byte today's request, and the legacy
    // result must still come from the sealed box and the outer envelope. This
    // is the whole of the backward-compatibility story.
    const streamer = fakeStreamer()
    global.fetch = streamer.fetch

    const result = await exchangeToken({ url: SERVER_URL, token: PAIR_TOKEN })

    expect(streamer.seen.body).not.toHaveProperty('e2ee')
    expect(result.serverPublicKey).toBeNull()
    expect(result.e2eeRequired).toBe(false)
    expect(result.apiKey).toBe('tb_handshake_key')
    expect(result.deviceId).toBe(OUTER.deviceId)
    expect(result.deviceToken).toBe(OUTER.deviceToken)
    expect(result.machineName).toBe(OUTER.machineName)
    expect(setItemAsync).not.toHaveBeenCalled()
  })

  it('takes every recorded value from the authenticated message 2, never the outer copy', async () => {
    // GATE 4. The outer fields are unauthenticated — an active attacker rewrites
    // all of them for free — so each assertion below is really two: the
    // authenticated value was used, AND the outer twin was not. They can only
    // both hold while `MSG2` and `OUTER` disagree on every field.
    const streamer = fakeStreamer()
    global.fetch = streamer.fetch

    const result = await exchangeToken({
      url: SERVER_URL,
      token: PAIR_TOKEN,
      serverPublicKey: SERVER_SPK,
    })

    expect(streamer.seen.body?.e2ee?.v).toBe(1)
    expect(streamer.seen.handshakeRejected).toBe(false)

    expect(result.deviceId).toBe(MSG2.deviceId)
    expect(result.deviceToken).toBe(MSG2.deviceToken)
    expect(result.machineName).toBe(MSG2.machineName)
    expect(result.publicUrl).toBe(MSG2.publicUrl)
    expect(result.capabilities).toEqual(MSG2.capabilities)
    // The sealed api key is a compatibility field on this path. The credential
    // this device presents is the authenticated device token (§4.1).
    expect(result.apiKey).toBe(MSG2.deviceToken)
    expect(result.apiKey).not.toBe('tb_handshake_key')

    // Recorded exactly as scanned: this is the key the handshake proved, and
    // the value Phase 3 has to re-derive the same static key from.
    expect(result.serverPublicKey).toBe(SERVER_SPK)
    expect(result.e2eeRequired).toBe(true)
    // The typed address still wins over the authenticated `publicUrl`.
    expect(result.url).toBe(SERVER_URL)
  })

  it('has this device static key durably in SecureStore by the time the request goes out', async () => {
    // Ordering, and specifically *the key is readable from the store* at the
    // moment the request leaves — not "setItemAsync was called at some point",
    // which is a narrower claim wearing the same name. A recorded call sequence
    // proves the calls interleaved; reading the store back inside `fetch`
    // proves the value a later phase depends on was already durable.
    //
    // The server registers the public half before it can tell the client
    // anything, so a client that discarded its own half on a failed response
    // would leave a device row that looks provisioned and fails weeks later at
    // the connection, with nothing pointing back to here.
    const streamer = fakeStreamer()
    let keyAtRequestTime: string | undefined
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      keyAtRequestTime = mockKeychain.get(DEVICE_KEY)
      return streamer.fetch(input, init)
    }) as typeof fetch

    await exchangeToken({ url: SERVER_URL, token: PAIR_TOKEN, serverPublicKey: SERVER_SPK })

    expect(keyAtRequestTime).toBeDefined()
    // And a real X25519 private key rather than a placeholder that happens to
    // be present at the right moment.
    expect(b64(String(keyAtRequestTime))).toHaveLength(32)
  })

  it('holds no device key at request time when there is no handshake', async () => {
    // The negative control for the assertion above: without it, the ordering
    // test could pass on an implementation that writes indiscriminately, and a
    // "was it there?" check cannot tell a fresh write from a leftover one.
    const streamer = fakeStreamer()
    let keyAtRequestTime: string | undefined
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      keyAtRequestTime = mockKeychain.get(DEVICE_KEY)
      return streamer.fetch(input, init)
    }) as typeof fetch

    await exchangeToken({ url: SERVER_URL, token: PAIR_TOKEN })

    expect(keyAtRequestTime).toBeUndefined()
  })

  // ── GATE 4, outbound: what message 1 authenticates about this device ───────
  //
  // `deviceName` and `readOnly` used to travel only in the outer request body,
  // which nothing authenticates — so an intermediary could rename the device or
  // widen its capability preset in transit. Every assertion below reads the
  // payload the responder DECRYPTED, because that is the only copy a new
  // streamer reads; asserting on the builder's return value would pass just as
  // happily on a build that never puts it on the wire.

  it('authenticates readOnly even when false — omitting it makes the server refuse the pairing', async () => {
    // The case an `if (readOnly)` guard silently drops, leaving `{"v":1}`.
    // `readOnly` is a capability claim rather than a label, so the streamer
    // refuses a payload without it rather than defaulting: inventing `false`
    // would grant the wider preset off something this device never said. That
    // asymmetry with the optional `deviceName` is documented on the builder.
    const streamer = fakeStreamer()
    global.fetch = streamer.fetch

    await exchangeToken({ url: SERVER_URL, token: PAIR_TOKEN, serverPublicKey: SERVER_SPK })

    const payload = streamer.seen.message1Payloads[0]
    expect(payload).toHaveProperty('readOnly')
    expect(typeof payload.readOnly).toBe('boolean')
    expect(payload.readOnly).toBe(false)
    expect(payload.v).toBe(1)
  })

  it('authenticates a read-only pairing as read-only', async () => {
    const streamer = fakeStreamer()
    global.fetch = streamer.fetch

    await exchangeToken({
      url: SERVER_URL,
      token: PAIR_TOKEN,
      serverPublicKey: SERVER_SPK,
      readOnly: true,
    })

    expect(streamer.seen.message1Payloads[0].readOnly).toBe(true)
  })

  it('authenticates the device name, normalised exactly as the outer copy is', async () => {
    // Both copies come from one normalisation, so they can never describe the
    // device differently — which is the disagreement a server would have to
    // arbitrate, and the contract says it reads only the authenticated one.
    const streamer = fakeStreamer()
    global.fetch = streamer.fetch

    await exchangeToken({
      url: SERVER_URL,
      token: PAIR_TOKEN,
      serverPublicKey: SERVER_SPK,
      deviceName: '  Pixel 8  ',
    })

    expect(streamer.seen.message1Payloads[0].deviceName).toBe('Pixel 8')
    expect(streamer.seen.body?.deviceName).toBe('Pixel 8')
  })

  it('omits deviceName from message 1 when there is none', async () => {
    // The negative control for the row above: without it, an implementation
    // that always wrote some placeholder name would satisfy it.
    const streamer = fakeStreamer()
    global.fetch = streamer.fetch

    await exchangeToken({ url: SERVER_URL, token: PAIR_TOKEN, serverPublicKey: SERVER_SPK })

    expect(streamer.seen.message1Payloads[0]).not.toHaveProperty('deviceName')
  })

  // ── GATE 2: one device key per server, reused ──────────────────────────────

  it('presents the same device key on a second pairing to the same server', async () => {
    // The streamer deduplicates device rows on the client's static key, so a key
    // regenerated per attempt makes a response-loss retry or a re-pair grow a
    // SECOND row for one phone — a row that looks correctly provisioned and
    // fails in Phase 3, weeks from its cause.
    //
    // Asserted on the key the SERVER recovers from message 1, not on what the
    // client stored: that is the value the dedup actually keys on.
    const streamer = fakeStreamer()
    global.fetch = streamer.fetch

    await exchangeToken({ url: SERVER_URL, token: PAIR_TOKEN, serverPublicKey: SERVER_SPK })
    await exchangeToken({ url: SERVER_URL, token: PAIR_TOKEN, serverPublicKey: SERVER_SPK })

    expect(streamer.seen.clientStaticKeys).toHaveLength(2)
    expect(streamer.seen.clientStaticKeys[0]).toBe(streamer.seen.clientStaticKeys[1])
    // And the second attempt reused rather than rewrote: exactly one write.
    expect(setItemAsync).toHaveBeenCalledTimes(1)
  })

  it('mints a different device key once the stored one is gone', async () => {
    // The positive control for the reuse test. Without it, "the two keys match"
    // would pass just as well on an implementation that derived a constant, or
    // on a fake streamer that recorded the same value twice by accident.
    const streamer = fakeStreamer()
    global.fetch = streamer.fetch

    await exchangeToken({ url: SERVER_URL, token: PAIR_TOKEN, serverPublicKey: SERVER_SPK })
    mockKeychain.delete(DEVICE_KEY)
    await exchangeToken({ url: SERVER_URL, token: PAIR_TOKEN, serverPublicKey: SERVER_SPK })

    expect(streamer.seen.clientStaticKeys[0]).not.toBe(streamer.seen.clientStaticKeys[1])
  })

  it('keeps a separate device key per server', async () => {
    const streamer = fakeStreamer()
    global.fetch = streamer.fetch

    await exchangeToken({ url: SERVER_URL, token: PAIR_TOKEN, serverPublicKey: SERVER_SPK })
    await exchangeToken({ url: 'https://other.test', token: PAIR_TOKEN, serverPublicKey: SERVER_SPK })

    expect(streamer.seen.clientStaticKeys[0]).not.toBe(streamer.seen.clientStaticKeys[1])
    expect(mockKeychain.has(DEVICE_KEY)).toBe(true)
    expect(mockKeychain.has(`${DEVICE_KEY_PREFIX}${serverIdFromUrl('https://other.test')}`)).toBe(true)
  })

  // ── GATE 5: once message 1 is out, nothing degrades to plaintext ───────────

  it('fails hard when the reply carries no message 2 at all', async () => {
    // Message 1 went out, so this is a refusal and not an older server: a
    // streamer that will not encrypt omits `spk` from the QR and is never asked.
    // Answering as though it cannot encrypt is a man in the middle's cheapest
    // attack, which is why there is no plaintext result here to fall back to.
    expect.assertions(3)
    const streamer = fakeStreamer({ dropE2eeFromReply: true })
    global.fetch = streamer.fetch

    await expect(
      exchangeToken({ url: SERVER_URL, token: PAIR_TOKEN, serverPublicKey: SERVER_SPK }),
    ).rejects.toMatchObject({ kind: 'e2ee-refused' })
    expect(streamer.seen.body?.e2ee).toBeDefined()
    // The device key stays: the server registered its public half before it
    // answered, so discarding ours would strand a row nobody can use.
    expect(mockKeychain.has(DEVICE_KEY)).toBe(true)
  })

  it('rejects a tampered message 2 rather than pairing plaintext', async () => {
    expect.assertions(1)
    global.fetch = fakeStreamer({ tamperMessage2: true }).fetch

    await expect(
      exchangeToken({ url: SERVER_URL, token: PAIR_TOKEN, serverPublicKey: SERVER_SPK }),
    ).rejects.toMatchObject({ kind: 'e2ee-handshake' })
  })

  it('fails closed when the QR key is not the key the responder holds', async () => {
    // Message 1 is encrypted to the scanned key, so a responder holding a
    // different one cannot read it and refuses — and the client must surface
    // that rather than pair in plaintext. The impostor's other option, answering
    // with a message 2 it could not have derived, is the tamper case above.
    expect.assertions(2)
    const otherKey = toBase64Url(vectors.keys.clientStaticPublic)
    const streamer = fakeStreamer()
    global.fetch = streamer.fetch

    await expect(
      exchangeToken({ url: SERVER_URL, token: PAIR_TOKEN, serverPublicKey: otherKey }),
    ).rejects.toMatchObject({ kind: 'e2ee-handshake' })
    expect(streamer.seen.handshakeRejected).toBe(true)
  })

  it('binds the handshake to the scanned pair token', async () => {
    // The PSK is load-bearing rather than merely mixed in: a message 1 built
    // from this QR's token must not complete against a responder holding a
    // different one. Deletion-proof — remove the PSK mix from both halves and
    // this stops failing.
    const streamer = fakeStreamer({ pskToken: 'pt_ffffffffffffffffffffffffffffffff' })
    global.fetch = streamer.fetch

    await expect(
      exchangeToken({ url: SERVER_URL, token: PAIR_TOKEN, serverPublicKey: SERVER_SPK }),
    ).rejects.toMatchObject({ kind: 'e2ee-handshake' })
    expect(streamer.seen.handshakeRejected).toBe(true)
  })

  it('completes against a responder holding the same pair token', async () => {
    // The positive control for the binding test above, which would otherwise
    // pass against a handshake that never completes for any token at all.
    const streamer = fakeStreamer({ pskToken: PAIR_TOKEN })
    global.fetch = streamer.fetch

    const result = await exchangeToken({
      url: SERVER_URL,
      token: PAIR_TOKEN,
      serverPublicKey: SERVER_SPK,
    })

    expect(streamer.seen.handshakeRejected).toBe(false)
    expect(result.e2eeRequired).toBe(true)
  })

  // The three refusals are distinct because the remedies are: the first two are
  // worth retrying with the same QR (none of them spends the token), the third
  // never is. Collapsing them would make the version case look retryable.
  it.each([
    ['E2EE_HANDSHAKE_FAILED', 'e2ee-handshake'],
    ['E2EE_MALFORMED', 'e2ee-malformed'],
    ['E2EE_VERSION_UNSUPPORTED', 'e2ee-version'],
  ])('classifies %s as %s', async (code, kind) => {
    expect.assertions(1)
    global.fetch = refusingStreamer(code)

    await expect(
      exchangeToken({ url: SERVER_URL, token: PAIR_TOKEN, serverPublicKey: SERVER_SPK }),
    ).rejects.toMatchObject({ kind })
  })

  it('leaves a 400 that carries no e2ee code as a plain server error', async () => {
    expect.assertions(1)
    global.fetch = jest.fn(async () =>
      new Response(JSON.stringify({ error: 'Invalid clientPublicKey' }), { status: 400 }),
    ) as typeof fetch

    await expect(
      exchangeToken({ url: SERVER_URL, token: PAIR_TOKEN, serverPublicKey: SERVER_SPK }),
    ).rejects.toMatchObject({ kind: 'server' })
  })

  it('refuses a reply that answers in an envelope version this build cannot read', async () => {
    expect.assertions(1)
    global.fetch = fakeStreamer({ replyVersion: 2 }).fetch

    await expect(
      exchangeToken({ url: SERVER_URL, token: PAIR_TOKEN, serverPublicKey: SERVER_SPK }),
    ).rejects.toMatchObject({ kind: 'e2ee-version' })
  })

  it('refuses a well-shaped server key that is not a point on the curve', async () => {
    // The gap between the two neighbouring cases. `:778` uses a valid point
    // that is the wrong key, which the responder rejects — an exchange-level
    // failure. `:860` uses the wrong length, which decoding rejects. A key of
    // 43 valid base64url characters that is simply not a curve point is
    // neither: it passes the QR shape check and the base64 decode, and the
    // first operation that can see the problem is the Diffie-Hellman inside
    // `writeMessage1`.
    //
    // Found against a real streamer, not a fixture. The bare
    // `Error: X25519: invalid shared key` used to escape this function
    // untranslated, so both entry paths called it unknown and offered a retry
    // on a QR that can never work.
    //
    // Real `@stablelib/x25519` — mocking the curve here would remove the only
    // thing under test.
    expect.assertions(3)
    const streamer = fakeStreamer()
    global.fetch = streamer.fetch

    const caught = await exchangeToken({
      url: SERVER_URL,
      token: PAIR_TOKEN,
      serverPublicKey: 'A'.repeat(43),
    }).catch((err: unknown) => err)

    expect(caught).toBeInstanceOf(PairUriError)
    expect((caught as PairUriError).code).toBe('bad-server-key')
    // The same fact `parsePairUri` reports for a wrong-length key, so the user
    // sees one sentence for one problem — and never spends the pair token on it.
    expect(streamer.seen.body).toBeUndefined()
  })

  it('is the curve itself that rejects that key, not a shape check of ours', async () => {
    // Pins the dependency the narrowing above rests on. Only `writeMessage1` is
    // inside the `try` in `exchangeToken`, so this classification is correct
    // only while the curve is what rejects an unusable point — and while it
    // does so by throwing rather than by returning a zero shared secret.
    //
    // If @stablelib ever stops throwing here, this test fails and the guard
    // gets revisited. Without it, the same change would silently turn the
    // refusal back into a plaintext pairing with nothing pointing here.
    const started = await beginPairHandshake({
      serverId: 'srv_probe',
      serverPublicKey: 'A'.repeat(43),
      pairToken: PAIR_TOKEN,
    })
    expect(started.ok).toBe(true)
    if (!started.ok) return

    expect(() => started.handshake.writeMessage1(new Uint8Array([1]))).toThrow(/X25519/)
  })

  it('refuses a server key that is present but unusable rather than falling back', async () => {
    // mobile-design §3.2: a downgrade must never be reachable by corrupting one
    // QR parameter. `parsePairUri` now rejects a wrong-shaped `spk` outright, so
    // this is the guard for every other way one can arrive.
    expect.assertions(2)
    const streamer = fakeStreamer()
    global.fetch = streamer.fetch

    await expect(
      exchangeToken({ url: SERVER_URL, token: PAIR_TOKEN, serverPublicKey: 'nope' }),
    ).rejects.toMatchObject({ kind: 'e2ee-malformed' })
    expect(streamer.seen.body).toBeUndefined()
  })

  // ── GATE 4: the authenticated payload is validated, not cast ───────────────

  it('rejects an authenticated but empty message 2', async () => {
    // The defect this exists for: casting the decrypted JSON to its interface
    // makes `{}` a *successful* pairing carrying no device at all. Decryption
    // proves who wrote it; only the shape check makes it mean anything.
    expect.assertions(1)
    global.fetch = fakeStreamer({ payload2: {} }).fetch

    await expect(
      exchangeToken({ url: SERVER_URL, token: PAIR_TOKEN, serverPublicKey: SERVER_SPK }),
    ).rejects.toBeInstanceOf(PairExchangeError)
  })

  // `publicUrl` and `machineName` are in this list because the streamer builds a
  // typed object literal and `JSON.stringify` never drops a `null` — so both
  // keys are always on the wire, and an absent one is a malformed payload
  // rather than a server that happens to have no public address.
  it.each([
    'v',
    'deviceId',
    'deviceToken',
    'capabilities',
    'serverVersion',
    'e2eeRequired',
    'publicUrl',
    'machineName',
  ])('rejects a message 2 with no %s', async (missing) => {
      expect.assertions(1)
      const payload2: Record<string, unknown> = { ...MSG2 }
      delete payload2[missing]
      global.fetch = fakeStreamer({ payload2 }).fetch

      await expect(
        exchangeToken({ url: SERVER_URL, token: PAIR_TOKEN, serverPublicKey: SERVER_SPK }),
      ).rejects.toBeInstanceOf(PairExchangeError)
    },
  )

  it.each([
    ['deviceId', ''],
    ['deviceToken', ''],
    ['deviceId', 42],
    ['deviceToken', null],
    ['capabilities', 'history:read'],
  ])('rejects a message 2 whose %s is %p', async (field, value) => {
    expect.assertions(1)
    global.fetch = fakeStreamer({ payload2: { ...MSG2, [field]: value } }).fetch

    await expect(
      exchangeToken({ url: SERVER_URL, token: PAIR_TOKEN, serverPublicKey: SERVER_SPK }),
    ).rejects.toBeInstanceOf(PairExchangeError)
  })

  it('rejects a message 2 that does not require encryption', async () => {
    // The server pins at this same event. A reply declining to say so has not
    // pinned us, and pinning alone is the split state §6.1 exists to prevent —
    // so this is a failed pairing, not a pairing that quietly skips the pin.
    expect.assertions(1)
    global.fetch = fakeStreamer({ payload2: { ...MSG2, e2eeRequired: false } }).fetch

    await expect(
      exchangeToken({ url: SERVER_URL, token: PAIR_TOKEN, serverPublicKey: SERVER_SPK }),
    ).rejects.toMatchObject({ kind: 'e2ee-refused' })
  })

  it('rejects a message 2 whose authenticated version is not this build’s', async () => {
    // The outer `v` is attacker-editable; this one is inside the AEAD. Checking
    // only the outer copy would let a rewritten envelope choose the code path.
    expect.assertions(1)
    global.fetch = fakeStreamer({ payload2: { ...MSG2, v: 2 } }).fetch

    await expect(
      exchangeToken({ url: SERVER_URL, token: PAIR_TOKEN, serverPublicKey: SERVER_SPK }),
    ).rejects.toMatchObject({ kind: 'e2ee-version' })
  })

  it('accepts a null publicUrl — requiring a string here breaks every LAN pairing', async () => {
    // **The near miss this file exists to hold down.** The written contract
    // lists `publicUrl` as a required string; `src/server.ts:375` declares it
    // `string | null = null` and only fills it from `--public-url`,
    // `THREADBASE_PUBLIC_URL` or `public_url:`. A LAN streamer sets none of
    // those, so the ordinary local pairing — and specifically the Batch C
    // device run — authenticates `"publicUrl": null`.
    //
    // Tighten this to a strict string on the strength of the document and every
    // test here still passes while the first pairing on real hardware fails,
    // looking like a handshake bug rather than a validator that believed a
    // document the code had already outgrown. This is also the positive control
    // for the rejection rows above: without it they would all pass on a
    // validator that refused every message 2 ever sent.
    global.fetch = fakeStreamer({ payload2: { ...MSG2, publicUrl: null } }).fetch

    const result = await exchangeToken({
      url: SERVER_URL,
      token: PAIR_TOKEN,
      serverPublicKey: SERVER_SPK,
    })

    expect(result.e2eeRequired).toBe(true)
    expect(result.deviceToken).toBe(MSG2.deviceToken)
    expect(result.publicUrl).toBeNull()
    // Never null — the streamer passes `os.hostname()`.
    expect(result.machineName).toBe(MSG2.machineName)
  })

  it.each([
    ['publicUrl', 42],
    ['machineName', null],
    ['machineName', 42],
  ])('rejects a message 2 whose %s is %p', async (field, value) => {
    // `null` is legitimate for publicUrl and only for publicUrl. machineName is
    // `os.hostname()`, which is a string unconditionally, so a null there is a
    // server saying something it cannot truthfully say.
    expect.assertions(1)
    global.fetch = fakeStreamer({ payload2: { ...MSG2, [field]: value } }).fetch

    await expect(
      exchangeToken({ url: SERVER_URL, token: PAIR_TOKEN, serverPublicKey: SERVER_SPK }),
    ).rejects.toBeInstanceOf(PairExchangeError)
  })

  // ── GATE 6: web never stores a device key ─────────────────────────────────

  it('refuses an encrypted pairing where the store is not a keychain', async () => {
    // The web SecureStore shim is localStorage, readable by any script that
    // achieves XSS on the origin. Refusing is the whole remedy — there is
    // deliberately no plaintext retry of this same exchange.
    expect.assertions(3)
    mockHasSecureKeychain = false
    const streamer = fakeStreamer()
    global.fetch = streamer.fetch

    await expect(
      exchangeToken({ url: SERVER_URL, token: PAIR_TOKEN, serverPublicKey: SERVER_SPK }),
    ).rejects.toMatchObject({ kind: 'e2ee-web-unsupported' })
    // Nothing written anywhere, and nothing sent: the refusal is before both.
    expect(mockKeychain.size).toBe(0)
    expect(streamer.seen.body).toBeUndefined()
  })

  it('still pairs a legacy no-spk QR where the store is not a keychain', async () => {
    // The positive control, and the requirement: legacy pairing and the manual
    // API-key path stay available on web. Only E2EE is refused there.
    mockHasSecureKeychain = false
    const streamer = fakeStreamer()
    global.fetch = streamer.fetch

    const result = await exchangeToken({ url: SERVER_URL, token: PAIR_TOKEN })

    expect(result.apiKey).toBe('tb_handshake_key')
    expect(mockKeychain.size).toBe(0)
  })
})
