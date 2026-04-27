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

export class PairUriError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PairUriError'
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

export function parsePairUri(raw: string): PairUri {
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    throw new PairUriError('Not a URL')
  }
  if (parsed.protocol !== 'threadbase:') {
    throw new PairUriError(`Unexpected scheme: ${parsed.protocol}`)
  }
  if (parsed.host !== 'pair' && parsed.pathname.replace(/^\/+/, '') !== 'pair') {
    throw new PairUriError('Expected threadbase://pair?...')
  }
  const url = parsed.searchParams.get('url')
  const token = parsed.searchParams.get('token')
  if (!url || !token) {
    throw new PairUriError('Missing url or token in pair URI')
  }
  const expRaw = parsed.searchParams.get('exp')
  const exp = expRaw ? Number.parseInt(expRaw, 10) : undefined
  return { url, token, exp: Number.isFinite(exp) ? (exp as number) : undefined }
}

export async function exchangeToken({
  url,
  token,
}: {
  url: string
  token: string
}): Promise<ExchangeResult> {
  const trimmedUrl = url.replace(/\/$/, '')
  const recipient = nacl.box.keyPair()
  const clientPublicKey = naclUtil.encodeBase64(recipient.publicKey)

  let res: Response
  try {
    res = await fetch(`${trimmedUrl}/api/pair/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, clientPublicKey }),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network error'
    throw new PairExchangeError('network', message)
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

  return {
    url: body.publicUrl ?? trimmedUrl,
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
