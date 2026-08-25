import type { HostPressureReason } from '@/types/api'

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

/** First resource reason (worst-first). Agents only if nothing else fired. */
export function primaryHostConstraint(
  reasons: HostPressureReason[],
): HostPressureReason | undefined {
  return reasons.find((reason) => reason !== 'agents') ?? reasons.find((reason) => reason === 'agents')
}

export function hostPressureDetectedReasons(
  reasons: HostPressureReason[],
): HostPressureReason[] {
  return reasons.filter((reason) => RESOURCE_REASONS.includes(reason))
}

export function hostPressureWhyFineReasons(
  reasons: HostPressureReason[],
): HostPressureReason[] {
  return RESOURCE_REASONS.filter((reason) => reasons.includes(reason))
}
