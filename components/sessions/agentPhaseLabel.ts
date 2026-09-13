import type { TFunction } from 'i18next'
import type { AgentPhase } from '@/types/api'

export function getAgentPhaseLabel(phase: AgentPhase, t: TFunction<'sessions'>): string {
  switch (phase) {
    case 'thinking':
      return t('phase.thinking')
    case 'streaming':
      return t('phase.streaming')
    case 'hooks':
      return t('phase.hooks')
    case 'acting':
      return t('phase.acting')
    case 'working':
      return t('phase.working')
  }
}
