import { createApiForServer } from '@/services/api-client'
import { parsePushHealthResponse, type PushHealthResponse } from '@/types/push-health'

export class PushHealthParseError extends Error {
  constructor() {
    super('Server returned an unrecognized push health payload')
    this.name = 'PushHealthParseError'
  }
}

export async function fetchPushHealth(
  serverId: string,
  signal?: AbortSignal,
): Promise<PushHealthResponse> {
  const api = createApiForServer(serverId)
  const body = await api.get<object>('/api/push/health', { signal })
  const parsed = parsePushHealthResponse(body)
  if (!parsed) throw new PushHealthParseError()
  return parsed
}

export function formatEpoch(ms: number | null): string {
  if (ms == null) return '—'
  try {
    return new Date(ms).toISOString()
  } catch {
    return '—'
  }
}
