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
