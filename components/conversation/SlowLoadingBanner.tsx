import React from 'react'
import { ActivityIndicator } from 'react-native'
import { Banner } from '@/components/ui/Banner'
import { useTheme } from '@/contexts/ThemeContext'

interface Props {
  onAbort: () => void
}

export function SlowLoadingBanner({ onAbort }: Props) {
  const theme = useTheme()
  return (
    <Banner
      title="Messages are being dramatic…"
      message="Wasn't expecting them to be this heavy. We're loading as fast as we can."
      accent={theme.text.warning}
      icon={<ActivityIndicator color={theme.text.warning} />}
      action={{ label: 'Cancel', onPress: onAbort, variant: 'destructive' }}
    />
  )
}
