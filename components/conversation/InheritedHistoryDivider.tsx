import React, { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { formatListTime } from '@/components/sessions/shared/formatListTime'
import { useTheme } from '@/contexts/ThemeContext'
import { spacing, type Theme } from '@/constants/theme'
import type { InheritedHistorySeam } from '@/utils/inheritedHistory'

interface Props {
  seam: InheritedHistorySeam
}

/**
 * A quiet hairline-and-caption row marking the seam between the history a
 * forked session inherited and its own turns — or, when the parent could no
 * longer be read, a single line saying so.
 */
export function InheritedHistoryDivider({ seam }: Props) {
  const { t } = useTranslation('conversation')
  const theme = useTheme()
  const styles = useMemo(() => makeStyles(theme), [theme])

  const forkedTime = seam.kind === 'divider' ? formatListTime(seam.forkedAt) : ''
  let label: string
  if (seam.kind === 'unavailable') label = t('inheritedHistory.unavailable')
  else if (forkedTime) label = t('inheritedHistory.forkedAt', { time: forkedTime })
  else label = t('inheritedHistory.forked')

  const testID = seam.kind === 'unavailable'
    ? 'inherited-history-unavailable'
    : 'inherited-history-divider'

  return (
    <View style={styles.row} testID={testID}>
      <View style={styles.rule} />
      <Text style={styles.label} numberOfLines={2}>
        {label}
      </Text>
      <View style={styles.rule} />
    </View>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
    },
    rule: {
      flex: 1,
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.border,
    },
    label: {
      flexShrink: 1,
      color: theme.text.secondary,
      fontSize: 12,
      textAlign: 'center',
    },
  })
}
