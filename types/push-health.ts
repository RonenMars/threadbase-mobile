/** Streamer push health contract (C7) — GET /api/push/health */

export type PushTokenState =
  | 'never-delivered'
  | 'healthy'
  | 'failing'
  | 'dead'
  | 'revoked'

export interface PushTokenHealth {
  platform: string
  deviceId: string | null
  registeredAt: number
  lastSuccessAt: number | null
  lastFailureAt: number | null
  lastFailureCode: string | null
  failureStreak: number
  revokedAt: number | null
  state: PushTokenState
}

export interface PushHealthResponse {
  available: boolean
  tokens: PushTokenHealth[]
}

const STATES: ReadonlySet<string> = new Set([
  'never-delivered',
  'healthy',
  'failing',
  'dead',
  'revoked',
])

function isRecord(value: object): value is Record<string, string | number | boolean | null | object | object[]> {
  return !Array.isArray(value)
}

function parseToken(raw: object): PushTokenHealth | null {
  if (!isRecord(raw)) return null
  if (typeof raw.platform !== 'string') return null
  if (!(raw.deviceId === null || typeof raw.deviceId === 'string')) return null
  if (typeof raw.registeredAt !== 'number') return null
  if (!(raw.lastSuccessAt === null || typeof raw.lastSuccessAt === 'number')) return null
  if (!(raw.lastFailureAt === null || typeof raw.lastFailureAt === 'number')) return null
  if (!(raw.lastFailureCode === null || typeof raw.lastFailureCode === 'string')) return null
  if (typeof raw.failureStreak !== 'number') return null
  if (!(raw.revokedAt === null || typeof raw.revokedAt === 'number')) return null
  if (typeof raw.state !== 'string' || !STATES.has(raw.state)) return null
  return {
    platform: raw.platform,
    deviceId: raw.deviceId,
    registeredAt: raw.registeredAt,
    lastSuccessAt: raw.lastSuccessAt,
    lastFailureAt: raw.lastFailureAt,
    lastFailureCode: raw.lastFailureCode,
    failureStreak: raw.failureStreak,
    revokedAt: raw.revokedAt,
    state: raw.state as PushTokenState,
  }
}

export function parsePushHealthResponse(body: object): PushHealthResponse | null {
  if (!isRecord(body)) return null
  if (typeof body.available !== 'boolean') return null
  if (!Array.isArray(body.tokens)) return null
  const tokens: PushTokenHealth[] = []
  for (const item of body.tokens) {
    if (!item || typeof item !== 'object') continue
    const parsed = parseToken(item)
    if (parsed) tokens.push(parsed)
  }
  return { available: body.available, tokens }
}
