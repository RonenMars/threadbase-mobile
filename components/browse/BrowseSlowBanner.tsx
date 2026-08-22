import React from 'react'
import { ActivityIndicator } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Banner } from '@/components/ui/Banner'
import { useTheme } from '@/contexts/ThemeContext'

interface Props {
  onAbort: () => void
}

export function BrowseSlowBanner({ onAbort }: Props) {
  const theme = useTheme()
  const { t } = useTranslation(['browse', 'common'])
  return (
    <Banner
      title={t('slowBanner.title')}
      message={t('slowBanner.message')}
      accent={theme.text.warning}
      icon={<ActivityIndicator color={theme.text.warning} />}
      action={{ label: t('common:button.cancel'), onPress: onAbort, variant: 'destructive' }}
    />
  )
}
