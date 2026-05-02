import React from 'react'
import { ActivityIndicator } from 'react-native'
import { Banner } from '@/components/ui/Banner'
import { dark } from '@/constants/theme'

interface Props {
  onAbort: () => void
}

export function SlowLoadingBanner({ onAbort }: Props) {
  return (
    <Banner
      title="Messages are being dramatic…"
      message="Wasn't expecting them to be this heavy. We're loading as fast as we can."
      accent={dark.text.warning}
      icon={<ActivityIndicator color={dark.text.warning} />}
      action={{ label: 'Cancel', onPress: onAbort, variant: 'destructive' }}
    />
  )
}
