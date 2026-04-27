import nacl from 'tweetnacl'
import naclUtil from 'tweetnacl-util'
import {
  exchangeToken,
  parsePairUri,
  PairExchangeError,
  PairUriError,
} from '@/services/pair-exchange'

describe('parsePairUri', () => {
  it('parses a well-formed pair URI', () => {
    const out = parsePairUri(
      'threadbase://pair?url=https%3A%2F%2Fexample.test&token=pt_abc&exp=1700000000',
    )
    expect(out.url).toBe('https://example.test')
    expect(out.token).toBe('pt_abc')
    expect(out.exp).toBe(1700000000)
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
})

describe('exchangeToken', () => {
  const realFetch = global.fetch
  afterEach(() => {
    global.fetch = realFetch
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
})
