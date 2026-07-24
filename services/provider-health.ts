import { createApiForServer } from '@/services/api-client'
import {
  parseProvidersResponse,
  type ProvidersResponse,
} from '@/types/provider-health'

export class ProviderHealthParseError extends Error {
  constructor() {
    super('Server returned an unrecognized providers payload')
    this.name = 'ProviderHealthParseError'
  }
}

export async function fetchProviderHealth(
  serverId: string,
  signal?: AbortSignal,
): Promise<ProvidersResponse> {
  const api = createApiForServer(serverId)
  const body = await api.get<object>('/api/providers', { signal })
  const parsed = parseProvidersResponse(body)
  if (!parsed) throw new ProviderHealthParseError()
  return parsed
}
