import nacl from 'tweetnacl'
import naclUtil from 'tweetnacl-util'
import {
  classifyPairCredential,
  exchangeToken,
  parsePairUri,
  PairExchangeError,
  PairUriError,
} from '@/services/pair-exchange'

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
