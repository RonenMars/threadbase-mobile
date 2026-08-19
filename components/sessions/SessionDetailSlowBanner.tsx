import React, { useMemo } from 'react'
import { ActivityIndicator } from 'react-native'
import { useTheme } from '@/contexts/ThemeContext'
import { useBannerSync } from '@/hooks/useBannerSync'
import type { AlertSpec } from '@/types/alerts'

interface Props {
  onAbort: () => void
}

export function SessionDetailSlowBanner({ onAbort }: Props) {
  const theme = useTheme()

  const spec = useMemo((): AlertSpec => ({
    level: 'warning',
    title: 'Session details are taking their time…',
    message: "Fetching the details — shouldn't be long.",
    hideCloseButton: true,
    buttonText: 'Cancel',
    buttonAction: onAbort,
    buttonVariant: 'destructive',
    icon: <ActivityIndicator color={theme.text.warning} />,
    timeout: null,
  }), [onAbort, theme.text.warning])

  useBannerSync('slow-session-detail', spec)
  return null
}
