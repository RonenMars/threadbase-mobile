import React, { useCallback, useMemo } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { font, radius, spacing, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { useReduceMotion } from '@/hooks/useAccessibilitySettings'
import { useArbitratedAlerts } from '@/hooks/useArbitratedAlerts'
import { getStatusSummary } from '@/lib/alertLabels'
import { useErrorSheetStore } from '@/stores/errorSheet'
import { StatusRow } from '@/components/alerts/StatusRow'
import type { AlertEntry } from '@/types/alerts'

const SNAP_POINTS = ['50%', '85%']
const TARGET = 44

function statusRows(entries: readonly AlertEntry[]): AlertEntry[] {
  return entries.filter((entry) => entry.level === 'error' || entry.level === 'warning')
}

export function StatusSheet() {
  const { t } = useTranslation('common')
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const reduceMotion = useReduceMotion()
  const styles = useMemo(() => makeStyles(theme), [theme])
  const arb = useArbitratedAlerts()
  const rows = statusRows(arb.all)
  const sheetOpen = useErrorSheetStore((s) => s.open)
  const closeSheet = useErrorSheetStore((s) => s.closeSheet)
  const visible = sheetOpen && rows.length > 0 && arb.critical == null
  const summary = getStatusSummary(arb.errors.length, arb.warnings.length, t)
  const title = t('alert.status.title')
  const retryable = rows.filter((row) => row.retryable && row.buttonAction)
  const retryAllLabel = retryable.length > 1 ? t('alert.status.retryEverything') : undefined

  const handleRetryAll = retryable.length > 1
    ? () => {
        for (const row of retryable) row.buttonAction?.()
      }
    : undefined

  const renderBackdrop = useCallback(
    (props: React.ComponentProps<typeof BottomSheetBackdrop>) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} pressBehavior="close" />
    ),
    [],
  )

  if (!visible) return null

  return (
    <BottomSheet
      snapPoints={SNAP_POINTS}
      index={0}
      bottomInset={insets.bottom}
      enablePanDownToClose
      onClose={closeSheet}
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.sheetBg}
      handleIndicatorStyle={styles.handle}
      animateOnMount={!reduceMotion}
      accessible={false}
    >
      <BottomSheetScrollView contentContainerStyle={styles.content}>
        <View testID="status-sheet" accessibilityLiveRegion="assertive">
          <Text style={styles.title} accessibilityRole="header">{title}</Text>
          <Text style={styles.summary}>{summary}</Text>
          {rows.map((entry) => <StatusRow key={entry.id} entry={entry} />)}
          {retryAllLabel && handleRetryAll ? (
            <TouchableOpacity
              style={styles.retryAll}
              onPress={handleRetryAll}
              testID="error-sheet-retry-all"
              accessibilityRole="button"
              accessibilityLabel={retryAllLabel}
            >
              <Text style={styles.retryAllText}>{retryAllLabel}</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={closeSheet}
            testID="error-sheet-close"
            accessibilityRole="button"
            accessibilityLabel={t('button.close')}
          >
            <Text style={styles.closeText}>{t('button.close')}</Text>
          </TouchableOpacity>
        </View>
      </BottomSheetScrollView>
    </BottomSheet>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    sheetBg: {
      backgroundColor: theme.bg.card,
      borderTopLeftRadius: radius.lg,
      borderTopRightRadius: radius.lg,
    },
    handle: {
      backgroundColor: theme.border,
    },
    content: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xl,
      gap: spacing.sm,
    },
    title: {
      color: theme.text.primary,
      fontSize: font.lg,
      fontWeight: '600',
    },
    summary: {
      color: theme.text.secondary,
      fontSize: font.sm,
      marginBottom: spacing.sm,
    },
    retryAll: {
      minHeight: TARGET,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: spacing.sm,
    },
    retryAllText: {
      color: theme.text.accent,
      fontSize: font.sm,
      fontWeight: '600',
    },
    closeBtn: {
      minHeight: TARGET,
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeText: {
      color: theme.text.secondary,
      fontSize: font.sm,
    },
  })
}
