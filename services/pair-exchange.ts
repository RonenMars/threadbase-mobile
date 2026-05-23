import nacl from 'tweetnacl'
import naclUtil from 'tweetnacl-util'

export interface PairUri {
  url: string
  token: string
  exp?: number
}

export interface ExchangeResult {
  url: string
  apiKey: string
  publicUrl: string | null
  machineName: string | null
}

export type PairUriErrorCode = 'invalid' | 'expired' | 'bad-server-url'

export class PairUriError extends Error {
  readonly code: PairUriErrorCode
  constructor(code: PairUriErrorCode, message: string) {
    super(message)
    this.name = 'PairUriError'
    this.code = code
  }
}

export class PairExchangeError extends Error {
  readonly kind: 'network' | 'token' | 'rate-limited' | 'decrypt' | 'server'
  constructor(kind: PairExchangeError['kind'], message: string) {
    super(message)
    this.name = 'PairExchangeError'
    this.kind = kind
  }
}

const PAIR_EXCHANGE_TIMEOUT_MS = 15_000

export function parsePairUri(raw: string): PairUri {
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    throw new PairUriError('invalid', 'Not a URL')
  }
  if (parsed.protocol !== 'threadbase:') {
    throw new PairUriError('invalid', `Unexpected scheme: ${parsed.protocol}`)
  }
  if (parsed.host !== 'pair' && parsed.pathname.replace(/^\/+/, '') !== 'pair') {
    throw new PairUriError('invalid', 'Expected threadbase://pair?...')
  }
  const url = parsed.searchParams.get('url')
  const token = parsed.searchParams.get('token')
  if (!url || !token) {
    throw new PairUriError('invalid', 'Missing url or token in pair URI')
  }
  assertHttpServerUrl(url)
  const expRaw = parsed.searchParams.get('exp')
  const exp = expRaw ? Number.parseInt(expRaw, 10) : undefined
  const parsedExp = Number.isFinite(exp) ? (exp as number) : undefined
  assertNotExpired(parsedExp)
  return { url, token, exp: parsedExp }
}

function assertHttpServerUrl(raw: string): void {
  let server: URL
  try {
    server = new URL(raw)
  } catch {
    throw new PairUriError('bad-server-url', 'Invalid server URL in pair QR')
  }
  if (server.protocol !== 'http:' && server.protocol !== 'https:') {
    throw new PairUriError('bad-server-url', 'Server URL must use http or https')
  }
}

function assertNotExpired(exp?: number): void {
  if (exp != null && Date.now() / 1000 > exp) {
    throw new PairUriError('expired', 'Pair QR expired')
  }
}

export async function exchangeToken({
  url,
  token,
}: {
  url: string
  token: string
}): Promise<ExchangeResult> {
  assertHttpServerUrl(url)
  const trimmedUrl = url.replace(/\/$/, '')
  const recipient = nacl.box.keyPair()
  const clientPublicKey = naclUtil.encodeBase64(recipient.publicKey)

  const timeoutController = new AbortController()
  const timeoutId = setTimeout(() => timeoutController.abort(), PAIR_EXCHANGE_TIMEOUT_MS)

  let res: Response
  try {
    res = await fetch(`${trimmedUrl}/api/pair/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, clientPublicKey }),
      signal: timeoutController.signal,
    })
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new PairExchangeError('network', 'Request timed out')
    }
    const message = err instanceof Error ? err.message : 'Network error'
    throw new PairExchangeError('network', message)
  } finally {
    clearTimeout(timeoutId)
  }

  if (res.status === 429) {
    throw new PairExchangeError('rate-limited', 'Too many attempts; try again in a minute')
  }
  if (res.status === 401) {
    const body = (await safeJson(res)) as { error?: string } | null
    throw new PairExchangeError('token', body?.error ?? 'Pair token rejected')
  }
  if (!res.ok) {
    throw new PairExchangeError('server', `Server returned ${res.status}`)
  }

  const body = (await safeJson(res)) as {
    ciphertext?: string
    nonce?: string
    ephemeralPublicKey?: string
    publicUrl?: string | null
    machineName?: string | null
  } | null

  if (!body?.ciphertext || !body.nonce || !body.ephemeralPublicKey) {
    throw new PairExchangeError('server', 'Server response missing sealed payload')
  }

  let plain: Uint8Array | null
  try {
    plain = nacl.box.open(
      naclUtil.decodeBase64(body.ciphertext),
      naclUtil.decodeBase64(body.nonce),
      naclUtil.decodeBase64(body.ephemeralPublicKey),
      recipient.secretKey,
    )
  } catch {
    plain = null
  }
  if (!plain) {
    throw new PairExchangeError('decrypt', 'Could not decrypt sealed api key')
  }

  const resolvedUrl = body.publicUrl ?? trimmedUrl
  assertHttpServerUrl(resolvedUrl)

  return {
    url: resolvedUrl,
    apiKey: naclUtil.encodeUTF8(plain),
    publicUrl: body.publicUrl ?? null,
    machineName: body.machineName ?? null,
  }
}

async function safeJson(res: Response): Promise<unknown> {
  try {
    return await res.json()
  } catch {
    return null
  }
}
