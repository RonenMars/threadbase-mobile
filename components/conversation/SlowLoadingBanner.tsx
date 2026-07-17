import React from 'react'
import { ActivityIndicator } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Banner } from '@/components/ui/Banner'
import { useTheme } from '@/contexts/ThemeContext'

interface Props {
  onAbort: () => void
}

const TITLE_KEYS = ['slowLoading.title1', 'slowLoading.title2', 'slowLoading.title3'] as const

export function SlowLoadingBanner({ onAbort }: Props) {
  const theme = useTheme()
  const { t } = useTranslation(['conversation', 'common'])
  // Pick once per mount so the title doesn't change on re-renders
  const [titleKey] = React.useState(() => TITLE_KEYS[Math.floor(Math.random() * TITLE_KEYS.length)])
  return (
    <Banner
      title={t(titleKey)}
      message={t('slowLoading.message')}
      accent={theme.text.warning}
      icon={<ActivityIndicator color={theme.text.warning} />}
      action={{ label: t('common:button.cancel'), onPress: onAbort, variant: 'destructive' }}
    />
  )
}
