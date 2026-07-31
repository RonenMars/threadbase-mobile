/**
 * Streamer paired-device contract (C5 / U10).
 * Source: tb-streamer devices.routes.ts + devices.repository.ts
 */

export type DeviceCapability =
  | 'history:read'
  | 'session:control'
  | 'fs:browse'
  | 'fs:upload'
  | 'notifications'
  | 'admin'

export interface DeviceView {
  deviceId: string
  name: string | null
  capabilities: DeviceCapability[]
  createdAt: number
  lastSeenAt: number | null
  revokedAt: number | null
}

export interface DevicesResponse {
  available: boolean
  devices: DeviceView[]
}

export interface DeviceRevokeResponse {
  ok: true
  alreadyRevoked: boolean
}

const CAPS: ReadonlySet<string> = new Set([
  'history:read',
  'session:control',
  'fs:browse',
  'fs:upload',
  'notifications',
  'admin',
])

function isRecord(value: object): value is Record<string, string | number | boolean | null | object | object[]> {
  return !Array.isArray(value)
}

export function parseCapabilityList(raw: unknown): DeviceCapability[] {
  if (!Array.isArray(raw)) return []
  const out: DeviceCapability[] = []
  for (const item of raw) {
    if (typeof item === 'string' && CAPS.has(item)) out.push(item as DeviceCapability)
  }
  return out
}

function parseDevice(raw: object): DeviceView | null {
  if (!isRecord(raw)) return null
  if (typeof raw.deviceId !== 'string') return null
  if (!(raw.name === null || typeof raw.name === 'string')) return null
  if (!Array.isArray(raw.capabilities)) return null
  if (typeof raw.createdAt !== 'number') return null
  if (!(raw.lastSeenAt === null || typeof raw.lastSeenAt === 'number')) return null
  if (!(raw.revokedAt === null || typeof raw.revokedAt === 'number')) return null
  return {
    deviceId: raw.deviceId,
    name: raw.name,
    capabilities: parseCapabilityList(raw.capabilities),
    createdAt: raw.createdAt,
    lastSeenAt: raw.lastSeenAt,
    revokedAt: raw.revokedAt,
  }
}

export function parseDevicesResponse(body: object): DevicesResponse | null {
  if (!isRecord(body)) return null
  if (typeof body.available !== 'boolean') return null
  if (!Array.isArray(body.devices)) return null
  const devices: DeviceView[] = []
  for (const item of body.devices) {
    if (!item || typeof item !== 'object') continue
    const parsed = parseDevice(item)
    if (parsed) devices.push(parsed)
  }
  return { available: body.available, devices }
}

export function parseDeviceRevokeResponse(body: object): DeviceRevokeResponse | null {
  if (!isRecord(body)) return null
  if (body.ok !== true) return null
  if (typeof body.alreadyRevoked !== 'boolean') return null
  return { ok: true, alreadyRevoked: body.alreadyRevoked }
}

export function deviceHasCapability(
  capabilities: DeviceCapability[] | undefined,
  cap: DeviceCapability,
): boolean {
  if (!capabilities || capabilities.length === 0) return true // unknown/legacy = full owner key
  return capabilities.includes(cap) || capabilities.includes('admin')
}
