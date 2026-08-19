import { Info, Warning, WarningCircle } from 'phosphor-react-native'
import type { IconWeight } from 'phosphor-react-native'
import type { Theme } from '@/constants/theme'
import type { AlertLevel } from '@/types/alerts'

type PhosphorIcon = typeof Info

export type AlertAppearance = {
  accent: string
  Icon: PhosphorIcon
  iconWeight: IconWeight
}

export function alertAppearance(
  level: AlertLevel,
  theme: Theme,
  accentOverride?: string,
): AlertAppearance {
  switch (level) {
    case 'debug':
      return { accent: theme.text.secondary, Icon: Info, iconWeight: 'regular' }
    case 'info':
      return { accent: theme.text.secondary, Icon: Info, iconWeight: 'regular' }
    case 'warning':
      return { accent: theme.status.waiting, Icon: Warning, iconWeight: 'regular' }
    case 'error':
      return { accent: theme.status.failed, Icon: WarningCircle, iconWeight: 'fill' }
    case 'critical':
      return { accent: theme.status.failed, Icon: WarningCircle, iconWeight: 'fill' }
    case 'custom':
      return {
        accent: accentOverride ?? theme.text.accent,
        Icon: WarningCircle,
        iconWeight: 'fill',
      }
  }
}
