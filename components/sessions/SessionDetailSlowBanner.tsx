import React from 'react'
import { ActivityIndicator } from 'react-native'
import { Banner } from '@/components/ui/Banner'
import { useTheme } from '@/contexts/ThemeContext'

interface Props {
  onAbort: () => void
}

export function SessionDetailSlowBanner({ onAbort }: Props) {
  const theme = useTheme()
  return (
    <Banner
      title="Session details are taking their time…"
      message="Fetching the details — shouldn't be long."
      accent={theme.text.warning}
      icon={<ActivityIndicator color={theme.text.warning} />}
      action={{ label: 'Cancel', onPress: onAbort, variant: 'destructive' }}
    />
  )
}
