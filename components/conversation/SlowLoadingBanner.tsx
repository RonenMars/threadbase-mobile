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
      title="Oh no!"
      message={"This is taking longer than expected we're doing our best"}
      accent={dark.text.warning}
      icon={<ActivityIndicator color={dark.text.warning} />}
      action={{ label: 'Abort', onPress: onAbort }}
    />
  )
}
