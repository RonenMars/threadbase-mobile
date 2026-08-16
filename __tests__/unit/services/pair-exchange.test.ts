import * as SecureStore from 'expo-secure-store'
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
import { PAIR_PROLOGUE, derivePairPsk } from '@/services/e2ee/pair-handshake'
import { createNoiseResponder } from '@/test-utils/noise-responder'
import vectors from '@/__tests__/fixtures/noise-ikpsk1-vectors.json'

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

  // Dropped, not carried and not thrown: refusing the pairing would fail it over
  // a field nothing consumes, and passing the value through would let a later
  // consumer treat 42 characters of junk as a key.
  it.each([['A'.repeat(42)], ['A'.repeat(44)], ['not+base64url/at=all'], ['']])(
    'drops a wrong-shaped spk (%p) without failing the pairing',
    (bad) => {
      const out = parsePairUri(
        `threadbase://pair?url=https%3A%2F%2Fa.test&token=pt_x&spk=${bad}`,
      )
      expect(out.spk).toBeUndefined()
      expect(out.token).toBe('pt_x')
    },
  )

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

interface StreamerOptions {
  /** The token the SERVER derives its PSK from. Differs from the client's in the binding test. */
  pskToken?: string
  payload2?: Record<string, unknown>
  tamperMessage2?: boolean
  /** The streamer logs and continues when it cannot write message 2, so the reply loses the field. */
  dropE2eeFromReply?: boolean
  replyVersion?: number
}

/**
 * A streamer that answers `POST /api/pair/exchange` for real: it runs the
 * responder half against whatever message 1 the client actually built.
 */
function fakeStreamer(options: StreamerOptions = {}) {
  const seen: { body?: ExchangeRequestBody; handshakeRejected: boolean } = {
    handshakeRejected: false,
  }

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
      try {
        responder.readMessage1(b64(body.e2ee.noise))
      } catch {
        // What the streamer really returns: one code for every handshake
        // failure, and the pair token is deliberately not spent.
        seen.handshakeRejected = true
        return new Response(
          JSON.stringify({ error: 'E2EE handshake failed.', code: 'E2EE_HANDSHAKE_FAILED' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        )
      }
      const message2 = responder.writeMessage2(
        utf8(
          JSON.stringify(
            options.payload2 ?? {
              v: 1,
              deviceId: 'uuid-1',
              serverVersion: '1.55.3',
              e2eeRequired: true,
            },
          ),
        ),
      )
      if (options.tamperMessage2) message2[40] ^= 0x01
      e2ee = { v: options.replyVersion ?? 1, noise: naclUtil.encodeBase64(message2) }
    }

    return new Response(
      JSON.stringify({
        ...sealApiKey('tb_handshake_key', body.clientPublicKey),
        machineName: 'ronen-mac.local',
        deviceId: 'uuid-1',
        deviceToken: 'dt_secret',
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

describe('exchangeToken — the pairing handshake', () => {
  const realFetch = global.fetch
  afterEach(() => {
    global.fetch = realFetch
    // Reset, not clear: the ordering tests install a real backing map and it
    // must not survive into a test that counts calls.
    setItemAsync.mockReset()
  })

  it('sends no e2ee field at all when the QR carried no server key', async () => {
    // An older streamer must see byte-for-byte today's request. This is the
    // whole of the backward-compatibility story and it is one assertion.
    const streamer = fakeStreamer()
    global.fetch = streamer.fetch

    const result = await exchangeToken({ url: SERVER_URL, token: PAIR_TOKEN })

    expect(streamer.seen.body).not.toHaveProperty('e2ee')
    expect(result.serverPublicKey).toBeNull()
    expect(result.e2eeRequired).toBe(false)
    expect(result.apiKey).toBe('tb_handshake_key')
  })

  it('completes the handshake and reports the pin when the QR carried one', async () => {
    const streamer = fakeStreamer()
    global.fetch = streamer.fetch

    const result = await exchangeToken({
      url: SERVER_URL,
      token: PAIR_TOKEN,
      serverPublicKey: SERVER_SPK,
    })

    expect(streamer.seen.body?.e2ee?.v).toBe(1)
    expect(streamer.seen.handshakeRejected).toBe(false)
    // Recorded exactly as scanned: this is the key the handshake proved, and
    // the value Phase 3 has to re-derive the same static key from.
    expect(result.serverPublicKey).toBe(SERVER_SPK)
    expect(result.e2eeRequired).toBe(true)
    expect(result.apiKey).toBe('tb_handshake_key')
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
    const store = new Map<string, string>()
    setItemAsync.mockImplementation(async (key: string, value: string) => {
      store.set(key, value)
    })
    const streamer = fakeStreamer()
    let keyAtRequestTime: string | undefined
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      keyAtRequestTime = store.get(`${DEVICE_KEY_PREFIX}${serverIdFromUrl(SERVER_URL)}`)
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
    const store = new Map<string, string>()
    setItemAsync.mockImplementation(async (key: string, value: string) => {
      store.set(key, value)
    })
    const streamer = fakeStreamer()
    let keyAtRequestTime: string | undefined
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      keyAtRequestTime = store.get(`${DEVICE_KEY_PREFIX}${serverIdFromUrl(SERVER_URL)}`)
      return streamer.fetch(input, init)
    }) as typeof fetch

    await exchangeToken({ url: SERVER_URL, token: PAIR_TOKEN })

    expect(keyAtRequestTime).toBeUndefined()
  })

  it('pairs plaintext, and does not pin, when the reply carries no e2ee field', async () => {
    // The streamer logs and continues if it cannot write message 2 — the
    // pairing must survive that, unpinned rather than broken.
    const streamer = fakeStreamer({ dropE2eeFromReply: true })
    global.fetch = streamer.fetch

    const result = await exchangeToken({
      url: SERVER_URL,
      token: PAIR_TOKEN,
      serverPublicKey: SERVER_SPK,
    })

    expect(streamer.seen.body?.e2ee).toBeDefined()
    expect(result.apiKey).toBe('tb_handshake_key')
    expect(result.serverPublicKey).toBeNull()
    expect(result.e2eeRequired).toBe(false)
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

  it('refuses a server key that is present but unusable rather than falling back', async () => {
    // mobile-design §3.2: a downgrade must never be reachable by corrupting one
    // QR parameter. `parsePairUri` already drops a wrong-shaped `spk`, so this
    // is the guard for every other way one can arrive.
    expect.assertions(2)
    const streamer = fakeStreamer()
    global.fetch = streamer.fetch

    await expect(
      exchangeToken({ url: SERVER_URL, token: PAIR_TOKEN, serverPublicKey: 'nope' }),
    ).rejects.toMatchObject({ kind: 'e2ee-malformed' })
    expect(streamer.seen.body).toBeUndefined()
  })
})
