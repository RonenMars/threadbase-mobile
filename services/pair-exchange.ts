import nacl from 'tweetnacl'
import naclUtil from 'tweetnacl-util'
import { parseCapabilityList, type DeviceCapability } from '@/types/devices'

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
  /** Per-device id minted at exchange (C5). Absent on older streamers. */
  deviceId: string | null
  /** Scoped credential — store only in SecureStore; never display. */
  deviceToken: string | null
  capabilities: DeviceCapability[] | null
}

export type PairUriErrorCode = 'invalid' | 'expired' | 'bad-server-url'

/** How a pasted manual-entry credential should be resolved. */
export type PairCredentialKind = 'pair-uri' | 'pair-token' | 'api-key'

export class PairUriError extends Error {
  readonly code: PairUriErrorCode
  constructor(code: PairUriErrorCode, message: string) {
    super(message)
    this.name = 'PairUriError'
    this.code = code
  }
}

/** Classify a pasted token / URI for the manual onboarding pair path. */
export function classifyPairCredential(raw: string): PairCredentialKind {
  const trimmed = raw.trim()
  if (trimmed.startsWith('threadbase:')) return 'pair-uri'
  // Short-lived tokens from `tb pair` / `/api/pair/start` (`pt_<hex>`).
  if (trimmed.startsWith('pt_')) return 'pair-token'
  return 'api-key'
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
  deviceName,
  readOnly = false,
}: {
  url: string
  token: string
  deviceName?: string
  readOnly?: boolean
}): Promise<ExchangeResult> {
  assertHttpServerUrl(url)
  const trimmedUrl = url.replace(/\/$/, '')
  const recipient = nacl.box.keyPair()
  const clientPublicKey = naclUtil.encodeBase64(recipient.publicKey)

  const timeoutController = new AbortController()
  const timeoutId = setTimeout(() => timeoutController.abort(), PAIR_EXCHANGE_TIMEOUT_MS)

  const bodyPayload: {
    token: string
    clientPublicKey: string
    deviceName?: string
    readOnly?: boolean
  } = { token, clientPublicKey }
  if (deviceName?.trim()) bodyPayload.deviceName = deviceName.trim().slice(0, 100)
  if (readOnly) bodyPayload.readOnly = true

  let res: Response
  try {
    res = await fetch(`${trimmedUrl}/api/pair/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyPayload),
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
    deviceId?: string
    deviceToken?: string
    capabilities?: unknown
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

  const deviceId = typeof body.deviceId === 'string' ? body.deviceId : null
  const deviceToken = typeof body.deviceToken === 'string' ? body.deviceToken : null
  const capabilities = Array.isArray(body.capabilities)
    ? parseCapabilityList(body.capabilities)
    : null

  return {
    url: resolvedUrl,
    apiKey: naclUtil.encodeUTF8(plain),
    publicUrl: body.publicUrl ?? null,
    machineName: body.machineName ?? null,
    deviceId,
    deviceToken,
    capabilities,
  }
}

async function safeJson(res: Response): Promise<unknown> {
  try {
    return await res.json()
  } catch {
    return null
  }
}
