import React from 'react'
import { ActivityIndicator } from 'react-native'
import { Banner } from '@/components/ui/Banner'
import { dark } from '@/constants/theme'

interface Props {
  onAbort: () => void
}

export function BrowseSlowBanner({ onAbort }: Props) {
  return (
    <Banner
      title="That's a heavy file tree…"
      message="Didn't think it'd be this big. Give us just a moment."
      accent={dark.text.warning}
      icon={<ActivityIndicator color={dark.text.warning} />}
      action={{ label: 'Cancel', onPress: onAbort, variant: 'destructive' }}
    />
  )
}
