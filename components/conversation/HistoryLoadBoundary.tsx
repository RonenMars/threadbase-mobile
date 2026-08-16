import React from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { CaretUp } from 'phosphor-react-native'
import { useTheme } from '@/contexts/ThemeContext'
import { spacing, type Theme } from '@/constants/theme'

interface Props {
  /** message_pagination.has_more_older (as react-query's hasNextPage) for the top page. */
  hasOlder: boolean
  isFetching: boolean
}

/**
 * Top-of-scroll boundary for a backward-paginated message list: a quiet
 * affordance while older history remains, a spinner while a page is in
 * flight, nothing once the list has walked back to from_index 0.
 * Purely decorative (onStartReached already drives the actual fetch) —
 * carries no text, so it needs no translation.
 */
export function HistoryLoadBoundary({ hasOlder, isFetching }: Props) {
  const theme = useTheme()
  const styles = makeStyles(theme)
  if (isFetching) {
    return (
      <View style={styles.container} testID="history-load-boundary-spinner">
        <ActivityIndicator color={theme.text.secondary} />
      </View>
    )
  }
  if (!hasOlder) return null
  return (
    <View
      style={styles.container}
      testID="history-load-boundary-marker"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <CaretUp size={14} color={theme.text.secondary} weight="bold" />
    </View>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      paddingVertical: spacing.sm,
      alignItems: 'center',
      justifyContent: 'center',
      opacity: 0.5,
      backgroundColor: theme.bg.primary,
    },
  })
}
