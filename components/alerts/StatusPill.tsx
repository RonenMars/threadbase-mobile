import React, { useMemo } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { Bell, GlobeSimple } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { globalSurface } from '@/lib/alertArbitration'
import { getAlertLevelLabel, getStatusPillCaption } from '@/lib/alertLabels'
import { useArbitratedAlerts } from '@/hooks/useArbitratedAlerts'
import { useErrorSheetStore } from '@/stores/errorSheet'

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
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID="status-pill"
      style={({ pressed }) => [styles.button, { opacity: pressed ? 0.5 : 1 }]}
    >
      <Bell size={20} color={theme.text.secondary} />
      <View style={styles.badge} testID="status-pill-badge" />
    </Pressable>
  )
}

// Bell while something is wrong; otherwise a globe that opens Server Status.
export function HomeStatusPill({
  onPress,
  suppressAlerts = false,
}: {
  onPress: () => void
  suppressAlerts?: boolean
}) {
  const { t } = useTranslation('servers')
  const theme = useTheme()
  const styles = useMemo(() => makeStyles(theme, 'warning'), [theme])
  const arb = useArbitratedAlerts()
  const setServersStatusOpen = useErrorSheetStore((s) => s.setServersStatusOpen)
  const surface = globalSurface(arb)
  if (!suppressAlerts && (surface === 'error' || surface === 'warning')) {
    return (
      <StatusPill
        surface={surface}
        issueCount={arb.global.length}
        onPress={onPress}
      />
    )
  }
  return (
    <Pressable
      onPress={() => setServersStatusOpen(true)}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={t('statusModal.titleSingle')}
      testID="header-server-status-btn"
      style={({ pressed }) => [styles.button, { opacity: pressed ? 0.5 : 1 }]}
    >
      <GlobeSimple size={20} color={theme.text.secondary} />
    </Pressable>
  )
}

function makeStyles(theme: Theme, surface: StatusPillSurface) {
  return StyleSheet.create({
    button: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 8,
    },
    badge: {
      position: 'absolute',
      top: 4,
      end: 4,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: surface === 'error' ? theme.status.failed : theme.status.waiting,
    },
  })
}
