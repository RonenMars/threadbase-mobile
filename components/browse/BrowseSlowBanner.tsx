import React, { useMemo } from 'react'
import { ActivityIndicator } from 'react-native'
import { useTheme } from '@/contexts/ThemeContext'
import { useBannerSync } from '@/hooks/useBannerSync'
import type { AlertSpec } from '@/types/alerts'

interface Props {
  onAbort: () => void
}

export function BrowseSlowBanner({ onAbort }: Props) {
  const theme = useTheme()

  const spec = useMemo((): AlertSpec => ({
    level: 'warning',
    title: "That's a heavy file tree…",
    message: "Didn't think it'd be this big. Give us just a moment.",
    hideCloseButton: true,
    buttonText: 'Cancel',
    buttonAction: onAbort,
    buttonVariant: 'destructive',
    icon: <ActivityIndicator color={theme.text.warning} />,
    timeout: null,
  }), [onAbort, theme.text.warning])

  useBannerSync('slow-browse', spec)
  return null
}
