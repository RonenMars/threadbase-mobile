import type { TFunction } from 'i18next'
import { providerLabelKey } from '@/constants/providers'

export function getProviderLabel(provider: string | null | undefined, t: TFunction<'sessions'>): string {
  switch (providerLabelKey(provider)) {
    case 'claude':
      return t('provider.claude')
    case 'codex':
      return t('provider.codex')
    case 'cursor':
      return t('provider.cursor')
  }
}
