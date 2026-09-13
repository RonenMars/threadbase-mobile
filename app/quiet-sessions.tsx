import React from 'react'
import { FlatList, Platform, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { EarlierRow } from '@/components/sessions/now/EarlierRow'
import { spacing, type Theme } from '@/constants/theme'
import { useTheme, useIsGlass } from '@/contexts/ThemeContext'
import { useQuietTailStore, type QuietEntry } from '@/stores/quietTail'

function keyOf(entry: QuietEntry): string {
  return `${entry.item.kind}:${entry.item.item.serverId}::${entry.item.item.id}`
}

/** The plain list behind a quiet-tail row: the same rows, in the same order, at full strength. */
export default function QuietSessionsScreen() {
  const theme = useTheme()
  const isGlass = useIsGlass()
  const insets = useSafeAreaInsets()
  const styles = makeStyles(theme)
  const entries = useQuietTailStore((s) => s.entries)
  // Transparent header (glass themes) doesn't reserve layout space, so content
  // starts under it; push it down by the header's own height. Same as project/[id].
  const headerHeight = Platform.OS === 'ios' ? 44 : 56
  const glassTopStyle = isGlass && Platform.OS !== 'android' ? { paddingTop: insets.top + headerHeight } : null

  return (
    <View style={[styles.container, glassTopStyle]} testID="quiet-sessions-screen">
      <FlatList
        data={entries}
        keyExtractor={keyOf}
        renderItem={({ item }) => <EarlierRow item={item.item} title={item.title} quiet dimmed={false} />}
        contentContainerStyle={{ paddingHorizontal: spacing.sm + 2, paddingBottom: insets.bottom + spacing.lg }}
      />
    </View>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.bg.primary,
    },
  })
}
