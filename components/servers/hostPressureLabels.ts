import type { TFunction } from 'i18next'
import type { HostPressureLevel, HostPressureOs, HostPressureReason } from '@/types/api'

export function getHostPressureBannerLabel(
  level: HostPressureLevel,
  reason: HostPressureReason | undefined,
  server: string,
  t: TFunction<'servers'>,
): string {
  const options = { server }
  switch (reason) {
    case 'memory':
      return level === 'critical'
        ? t('hostPressure.banner.memoryCritical', options)
        : t('hostPressure.banner.memoryElevated', options)
    case 'load':
      return level === 'critical'
        ? t('hostPressure.banner.loadCritical', options)
        : t('hostPressure.banner.loadElevated', options)
    case 'event_loop':
      return level === 'critical'
        ? t('hostPressure.banner.eventLoopCritical', options)
        : t('hostPressure.banner.eventLoopElevated', options)
    case 'agents':
      return t('hostPressure.banner.agents', options)
    case undefined:
      return level === 'critical'
        ? t('hostPressure.banner.fallbackCritical', options)
        : t('hostPressure.banner.fallbackElevated', options)
  }
}

export function getHostPressureDetectedLabel(
  reason: HostPressureReason,
  t: TFunction<'servers'>,
): string {
  switch (reason) {
    case 'memory':
      return t('hostPressure.detected.memory')
    case 'event_loop':
      return t('hostPressure.detected.event_loop')
    case 'load':
      return t('hostPressure.detected.load')
    case 'agents':
      return ''
  }
}

export function getHostPressureWhyFineLabel(
  reason: HostPressureReason,
  t: TFunction<'servers'>,
): string {
  switch (reason) {
    case 'memory':
      return t('hostPressure.whyFine.memory')
    case 'event_loop':
      return t('hostPressure.whyFine.event_loop')
    case 'load':
      return t('hostPressure.whyFine.load')
    case 'agents':
      return ''
  }
}

export function getHostPressureWhatToDoLabel(
  os: HostPressureOs | undefined,
  t: TFunction<'servers'>,
): string {
  switch (os) {
    case 'darwin':
      return t('hostPressure.whatToDo.darwin')
    case 'linux':
      return t('hostPressure.whatToDo.linux')
    case 'win32':
      return t('hostPressure.whatToDo.win32')
    case undefined:
      return t('hostPressure.whatToDo.generic')
  }
}
