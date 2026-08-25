import React from 'react'
import { ActivityIndicator } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Banner } from '@/components/ui/Banner'
import { useTheme } from '@/contexts/ThemeContext'
import {
  getSlowLoadingTitle,
  type SlowLoadingTitleVariant,
} from './slowLoadingTitle'

interface Props {
  onAbort: () => void
}

export function SlowLoadingBanner({ onAbort }: Props) {
  const theme = useTheme()
  const { t } = useTranslation(['conversation', 'common'])
  // Pick once per mount so the title doesn't change on re-renders
  const [titleVariant] = React.useState<SlowLoadingTitleVariant>(
    () => Math.floor(Math.random() * 3) as SlowLoadingTitleVariant,
  )
  return (
    <Banner
      title={getSlowLoadingTitle(titleVariant, t)}
      message={t('slowLoading.message')}
      accent={theme.text.warning}
      icon={<ActivityIndicator color={theme.text.warning} />}
      action={{ label: t('common:button.cancel'), onPress: onAbort, variant: 'destructive' }}
    />
  )
}
