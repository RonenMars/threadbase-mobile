import React from 'react'
import { ActivityIndicator } from 'react-native'
import { Banner } from '@/components/ui/Banner'
import { useTheme } from '@/contexts/ThemeContext'

interface Props {
  onAbort: () => void
}

export function BrowseSlowBanner({ onAbort }: Props) {
  const theme = useTheme()
  return (
    <Banner
      title="That's a heavy file tree…"
      message="Didn't think it'd be this big. Give us just a moment."
      accent={theme.text.warning}
      icon={<ActivityIndicator color={theme.text.warning} />}
      action={{ label: 'Cancel', onPress: onAbort, variant: 'destructive' }}
    />
  )
}
