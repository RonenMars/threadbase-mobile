import { createApiForServer } from '@/services/api-client'
import {
  parseDeviceRevokeResponse,
  parseDevicesResponse,
  type DeviceRevokeResponse,
  type DevicesResponse,
} from '@/types/devices'

export class DevicesParseError extends Error {
  constructor() {
    super('Server returned an unrecognized devices payload')
    this.name = 'DevicesParseError'
  }
}

export async function fetchDevices(
  serverId: string,
  signal?: AbortSignal,
): Promise<DevicesResponse> {
  const api = createApiForServer(serverId)
  const body = await api.get<object>('/api/devices', { signal })
  const parsed = parseDevicesResponse(body)
  if (!parsed) throw new DevicesParseError()
  return parsed
}

export async function revokeDevice(
  serverId: string,
  deviceId: string,
): Promise<DeviceRevokeResponse> {
  const api = createApiForServer(serverId)
  const body = await api.post<object>(`/api/devices/${encodeURIComponent(deviceId)}/revoke`)
  const parsed = parseDeviceRevokeResponse(body)
  if (!parsed) throw new DevicesParseError()
  return parsed
}

export function formatDeviceEpoch(ms: number | null): string {
  if (ms == null) return '—'
  try {
    return new Date(ms).toISOString()
  } catch {
    return '—'
  }
}
