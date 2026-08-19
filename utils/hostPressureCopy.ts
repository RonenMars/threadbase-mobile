import type { HostPressureLevel, HostPressureOs, HostPressureReason } from '@/types/api'

const RESOURCE_REASONS: readonly HostPressureReason[] = ['memory', 'event_loop', 'load']

/** Label if the user set one, otherwise the typed URL. Never machineName. */
export function hostPressureServerName(server: {
  label?: string
  url: string
} | undefined): string | undefined {
  if (!server) return undefined
  const label = server.label?.trim()
  if (label) return label
  return server.url
}

export type HostPressureBannerKey =
  | 'hostPressure.banner.memoryElevated'
  | 'hostPressure.banner.memoryCritical'
  | 'hostPressure.banner.loadElevated'
  | 'hostPressure.banner.loadCritical'
  | 'hostPressure.banner.eventLoopElevated'
  | 'hostPressure.banner.eventLoopCritical'
  | 'hostPressure.banner.agents'
  | 'hostPressure.banner.fallbackElevated'
  | 'hostPressure.banner.fallbackCritical'

export type HostPressureDetectedKey =
  | 'hostPressure.detected.memory'
  | 'hostPressure.detected.event_loop'
  | 'hostPressure.detected.load'

export type HostPressureWhyFineKey =
  | 'hostPressure.whyFine.memory'
  | 'hostPressure.whyFine.event_loop'
  | 'hostPressure.whyFine.load'

export type HostPressureWhatToDoKey =
  | 'hostPressure.whatToDo.darwin'
  | 'hostPressure.whatToDo.linux'
  | 'hostPressure.whatToDo.win32'
  | 'hostPressure.whatToDo.generic'

/** First resource reason (worst-first). Agents only if nothing else fired. */
export function primaryHostConstraint(
  reasons: HostPressureReason[],
): HostPressureReason | undefined {
  return reasons.find((reason) => reason !== 'agents') ?? reasons.find((reason) => reason === 'agents')
}

export function hostPressureBannerKey(
  level: HostPressureLevel,
  reasons: HostPressureReason[],
): HostPressureBannerKey {
  const primary = primaryHostConstraint(reasons)
  const critical = level === 'critical'
  switch (primary) {
    case 'memory':
      return critical ? 'hostPressure.banner.memoryCritical' : 'hostPressure.banner.memoryElevated'
    case 'load':
      return critical ? 'hostPressure.banner.loadCritical' : 'hostPressure.banner.loadElevated'
    case 'event_loop':
      return critical
        ? 'hostPressure.banner.eventLoopCritical'
        : 'hostPressure.banner.eventLoopElevated'
    case 'agents':
      return 'hostPressure.banner.agents'
    default:
      return critical ? 'hostPressure.banner.fallbackCritical' : 'hostPressure.banner.fallbackElevated'
  }
}

export function hostPressureDetectedKeys(
  reasons: HostPressureReason[],
): HostPressureDetectedKey[] {
  const keys: HostPressureDetectedKey[] = []
  for (const reason of reasons) {
    if (reason === 'memory') keys.push('hostPressure.detected.memory')
    else if (reason === 'event_loop') keys.push('hostPressure.detected.event_loop')
    else if (reason === 'load') keys.push('hostPressure.detected.load')
  }
  return keys
}

export function hostPressureWhyFineKeys(
  reasons: HostPressureReason[],
): HostPressureWhyFineKey[] {
  const keys: HostPressureWhyFineKey[] = []
  for (const reason of RESOURCE_REASONS) {
    if (!reasons.includes(reason)) continue
    if (reason === 'memory') keys.push('hostPressure.whyFine.memory')
    else if (reason === 'event_loop') keys.push('hostPressure.whyFine.event_loop')
    else keys.push('hostPressure.whyFine.load')
  }
  return keys
}

export function hostPressureWhatToDoKey(
  os: HostPressureOs | undefined,
): HostPressureWhatToDoKey {
  if (os === 'darwin') return 'hostPressure.whatToDo.darwin'
  if (os === 'linux') return 'hostPressure.whatToDo.linux'
  if (os === 'win32') return 'hostPressure.whatToDo.win32'
  return 'hostPressure.whatToDo.generic'
}
