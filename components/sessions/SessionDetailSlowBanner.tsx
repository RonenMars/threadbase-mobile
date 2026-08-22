import React from 'react'
import { ActivityIndicator } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Banner } from '@/components/ui/Banner'
import { useTheme } from '@/contexts/ThemeContext'

interface Props {
  onAbort: () => void
}

export function SessionDetailSlowBanner({ onAbort }: Props) {
  const { t } = useTranslation(['sessions', 'common'])
  const theme = useTheme()
  return (
    <Banner
      title={t('slowLoading.detailTitle')}
      message={t('slowLoading.detailMessage')}
      accent={theme.text.warning}
      icon={<ActivityIndicator color={theme.text.warning} />}
      action={{ label: t('common:button.cancel'), onPress: onAbort, variant: 'destructive' }}
    />
  )
}
