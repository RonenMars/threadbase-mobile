import type { TFunction } from 'i18next'
import type { SessionStatusLabel } from '@/lib/sessionPresentation'

export function getSessionStatusLabel(
  status: SessionStatusLabel,
  t: TFunction<'sessions'>,
): string {
  switch (status) {
    case 'running':
      return t('status.running')
    case 'waiting':
      return t('status.waiting')
    case 'idle':
      return t('status.idle')
    case 'externalLive':
      return t('status.externalLive')
    case 'historical':
      return t('status.historical')
    case 'interrupted':
      return t('status.interrupted')
    case 'interruptedWaiting':
      return t('status.interruptedWaiting')
    case 'resumed':
      return t('status.resumed')
    case 'onHold':
      return t('status.onHold')
    case 'completed':
      return t('status.completed')
    case 'failed':
      return t('status.failed')
    case 'unavailablePath':
      return t('status.unavailablePath')
    case 'unavailableWorktree':
      return t('status.unavailableWorktree')
    case 'stale':
      return t('status.stale')
    case 'starting':
      return t('status.starting')
  }
}
