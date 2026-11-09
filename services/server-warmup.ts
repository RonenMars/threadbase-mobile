import type { ServerWarmupState } from '@/types/api'

export const SERVER_WARMING_UP_CODE = 'SERVER_WARMING_UP'

const WARMUP_STATES: ReadonlySet<string> = new Set([
  'startup',
  'cache_reset',
  'conversation_refresh',
])

export function getServerWarmupState(value: unknown): ServerWarmupState | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as { code?: unknown; warmupState?: unknown }
  if (
    candidate.code !== SERVER_WARMING_UP_CODE ||
    typeof candidate.warmupState !== 'string' ||
    !WARMUP_STATES.has(candidate.warmupState)
  ) {
    return null
  }
  return candidate.warmupState as ServerWarmupState
}

export const WARMING_HEADER = 'X-Threadbase-Warming'

function toWarmupState(value: string | null | undefined): ServerWarmupState | null {
  return value && WARMUP_STATES.has(value) ? (value as ServerWarmupState) : null
}

// A 200 the streamer served from cached rows mid-scan. The header can be dropped
// by an e2ee relay and a bare array has no room for a field, so read both.
export function getWarmingMarker(
  headerValue: string | null,
  body: { warming?: string } | null,
): ServerWarmupState | null {
  return toWarmupState(headerValue) ?? toWarmupState(body?.warming)
}
