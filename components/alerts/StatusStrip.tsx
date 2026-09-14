import React, { useEffect, useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text } from 'react-native'
import { useTranslation } from 'react-i18next'
import { font, spacing, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { globalSurface } from '@/lib/alertArbitration'
import { getAlertLevelLabel } from '@/lib/alertLabels'
import { alertAppearance } from '@/lib/alertAppearance'
import { useArbitratedAlerts } from '@/hooks/useArbitratedAlerts'
import { useErrorSheetStore } from '@/stores/errorSheet'
import type { AlertEntry } from '@/types/alerts'

export const STATUS_STRIP_DURATION_MS = 6000

type Props = {
  title: string
  onPress: () => void
}

export function StatusStrip({ title, onPress }: Props) {
  const { t } = useTranslation('common')
  const theme = useTheme()
  const styles = useMemo(() => makeStyles(theme), [theme])
  const appearance = alertAppearance('error', theme)
  const Icon = appearance.Icon
  const accessibilityLabel = `${getAlertLevelLabel('error', t)}. ${title}`

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityLiveRegion="assertive"
      testID="status-strip"
      style={({ pressed }) => [styles.strip, { opacity: pressed ? 0.7 : 1 }]}
    >
      <Icon size={16} color={appearance.accent} weight={appearance.iconWeight} />
      <Text style={styles.title} numberOfLines={1}>{title}</Text>
    </Pressable>
  )
}

export function HomeStatusStrip({ onPress }: { onPress: () => void }) {
  const entry = useExpandingError()
  if (!entry) return null
  return <StatusStrip title={entry.title} onPress={onPress} />
}

function useExpandingError(): AlertEntry | null {
  const arb = useArbitratedAlerts()
  const sheetOpen = useErrorSheetStore((s) => s.open)
  const surface = globalSurface(arb)
  const newest = useMemo(() => {
    if (surface !== 'error' || arb.global.length === 0) return null
    return arb.global.reduce((best, alert) => (
      alert.raisedAt > best.raisedAt ? alert : best
    ))
  }, [arb.global, surface])

  const [expiredId, setExpiredId] = useState<string | null>(null)
  useEffect(() => {
    if (!newest) return
    const remaining = STATUS_STRIP_DURATION_MS - (Date.now() - newest.raisedAt)
    const timer = setTimeout(
      () => setExpiredId(newest.id),
      Math.max(0, remaining),
    )
    return () => clearTimeout(timer)
  }, [newest])

  if (sheetOpen || !newest || expiredId === newest.id) return null
  return newest
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    strip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      minHeight: 44,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      backgroundColor: theme.bg.secondary,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.status.failed,
    },
    title: {
      flex: 1,
      color: theme.text.primary,
      fontSize: font.base,
      fontWeight: '500',
    },
  })
}
