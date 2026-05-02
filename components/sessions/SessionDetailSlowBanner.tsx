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
      title="Session details are taking their time…"
      message="Fetching the details — shouldn't be long."
      accent={dark.text.warning}
      icon={<ActivityIndicator color={dark.text.warning} />}
      action={{ label: 'Cancel', onPress: onAbort, variant: 'destructive' }}
    />
  )
}
