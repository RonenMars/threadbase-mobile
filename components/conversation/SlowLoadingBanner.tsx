import React, { useMemo } from 'react'
import { ActivityIndicator } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/contexts/ThemeContext'
import { useBannerSync } from '@/hooks/useBannerSync'
import type { AlertSpec } from '@/types/alerts'

interface Props {
  onAbort: () => void
}

const TITLE_KEYS = ['slowLoading.title1', 'slowLoading.title2', 'slowLoading.title3'] as const

export function SlowLoadingBanner({ onAbort }: Props) {
  const theme = useTheme()
  const { t } = useTranslation(['conversation', 'common'])
  const [titleKey] = React.useState(() => TITLE_KEYS[Math.floor(Math.random() * TITLE_KEYS.length)])
  const cancelLabel = t('common:button.cancel')

  const spec = useMemo((): AlertSpec => ({
    level: 'warning',
    title: t(titleKey),
    message: t('slowLoading.message'),
    hideCloseButton: true,
    buttonText: cancelLabel,
    buttonAction: onAbort,
    buttonVariant: 'destructive',
    icon: <ActivityIndicator color={theme.text.warning} />,
    timeout: null,
  }), [cancelLabel, onAbort, t, theme.text.warning, titleKey])

  useBannerSync('slow-conversation', spec)
  return null
}
