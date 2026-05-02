import React from 'react'
import { ActivityIndicator } from 'react-native'
import { Banner } from '@/components/ui/Banner'
import { dark } from '@/constants/theme'

interface Props {
  onAbort: () => void
}

export function SessionDetailSlowBanner({ onAbort }: Props) {
  return (
    <Banner
      title="Boop boop beep…"
      message="Working really hard fetching the session details. Hang tight!"
      accent={dark.text.warning}
      icon={<ActivityIndicator color={dark.text.warning} />}
      action={{ label: 'Abort', onPress: onAbort }}
    />
  )
}
