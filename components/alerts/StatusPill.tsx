import React, { useMemo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { font, radius, spacing, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { globalSurface } from '@/lib/alertArbitration'
import { getAlertLevelLabel, getStatusPillCaption } from '@/lib/alertLabels'
import { useArbitratedAlerts } from '@/hooks/useArbitratedAlerts'

const TARGET = 44

type StatusPillSurface = 'error' | 'warning'

type Props = {
  surface: StatusPillSurface
  issueCount: number
  onPress: () => void
}

export function StatusPill({ surface, issueCount, onPress }: Props) {
  const { t } = useTranslation('common')
  const theme = useTheme()
  const styles = useMemo(() => makeStyles(theme, surface), [theme, surface])
  const caption = getStatusPillCaption(surface, issueCount, t)
  const accessibilityLabel = `${getAlertLevelLabel(surface, t)}. ${caption}`

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID="status-pill"
      style={({ pressed }) => [styles.pill, { opacity: pressed ? 0.7 : 1 }]}
    >
      <View style={styles.dot} />
      <Text style={styles.label}>{caption}</Text>
    </Pressable>
  )
}

export function HomeStatusPill({ onPress }: { onPress: () => void }) {
  const arb = useArbitratedAlerts()
  const surface = globalSurface(arb)
  if (surface !== 'error' && surface !== 'warning') return null
  return (
    <StatusPill
      surface={surface}
      issueCount={arb.global.length}
      onPress={onPress}
    />
  )
}

function makeStyles(theme: Theme, surface: StatusPillSurface) {
  const accent = surface === 'error' ? theme.status.failed : theme.status.waiting
  return StyleSheet.create({
    pill: {
      minHeight: TARGET,
      paddingHorizontal: spacing.md,
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: accent,
      backgroundColor: `${accent}24`,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    dot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: accent,
    },
    label: {
      color: accent,
      fontSize: font.sm,
      fontWeight: '600',
    },
  })
}
