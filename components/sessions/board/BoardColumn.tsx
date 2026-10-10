import type { ReactElement, ReactNode } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { FlashList } from '@shopify/flash-list'
import { font, radius, spacing, type Theme } from '@/constants/theme'
import { MONO_FONT } from '@/constants/mono'
import { useTheme } from '@/contexts/ThemeContext'
import { SkeletonBox } from '@/components/ui/Skeleton'

export const BOARD_COLUMN_MIN_WIDTH = 300

const SKELETON_TITLE_WIDTHS = ['80%', '60%', '70%'] as const

interface Props<T> {
  label: string
  color: string
  /** Cards shown. The list is virtualised, so only the ones near the viewport are mounted. */
  items: readonly T[]
  renderItem: (item: T) => ReactElement
  keyExtractor: (item: T) => string
  /** Cards before search and filters; the header reads "shown/total" when they differ. */
  total: number
  emptyLabel: string
  /** The first fetch is still out: an empty column shows placeholder cards instead of the empty line. */
  loading?: boolean
  testID?: string
  /** A compact control that applies to this column only, shown between its title and count. */
  headerAccessory?: ReactNode
  /** Shown under the cards, e.g. a control that loads more of them. */
  footer?: ReactNode
}

export function BoardColumn<T>({ label, color, items, renderItem, keyExtractor, total, emptyLabel, loading, testID, headerAccessory, footer }: Props<T>) {
  const theme = useTheme()
  const styles = makeStyles(theme)
  const countLabel = items.length === total ? `${total}` : `${items.length}/${total}`

  const skeleton = (
    <View testID={testID ? `${testID}-loading` : undefined} accessibilityElementsHidden>
      {SKELETON_TITLE_WIDTHS.map((width) => (
        <View key={width} style={styles.skeletonCard}>
          <SkeletonBox width={width} />
          <SkeletonBox width="35%" height={10} />
        </View>
      ))}
    </View>
  )

  return (
    <View style={styles.column} testID={testID} accessibilityLabel={label}>
      <View style={[styles.header, { borderBottomColor: `${color}66` }]} accessibilityRole="header">
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Text style={styles.label} numberOfLines={1}>{label}</Text>
        {headerAccessory}
        <Text style={styles.count} testID={testID ? `${testID}-count` : undefined}>{countLabel}</Text>
      </View>
      <FlashList
        data={items}
        renderItem={({ item }) => renderItem(item)}
        keyExtractor={keyExtractor}
        ListEmptyComponent={loading ? skeleton : <Text style={styles.empty}>{emptyLabel}</Text>}
        ListFooterComponent={footer ? <>{footer}</> : null}
        contentContainerStyle={styles.cards}
        showsVerticalScrollIndicator={false}
      />
    </View>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    column: {
      flex: 1,
      minWidth: BOARD_COLUMN_MIN_WIDTH,
      backgroundColor: theme.bg.primary,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: radius.lg,
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 2,
    },
    dot: { width: 8, height: 8, borderRadius: radius.full },
    label: {
      flexShrink: 1,
      color: theme.text.primary,
      fontSize: font.sm,
      fontWeight: '600',
    },
    count: {
      fontFamily: MONO_FONT,
      fontSize: font.xs,
      color: theme.text.secondary,
      fontVariant: ['tabular-nums'],
      marginStart: 'auto',
      backgroundColor: theme.bg.secondary,
      borderRadius: radius.full,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      overflow: 'hidden',
    },
    cards: { padding: spacing.md, paddingBottom: spacing.xl },
    skeletonCard: {
      gap: spacing.sm,
      padding: spacing.md,
      marginBottom: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.bg.secondary,
    },
    empty: {
      color: theme.text.secondary,
      fontSize: font.sm,
      textAlign: 'center',
      paddingVertical: spacing.xl,
      opacity: 0.7,
    },
  })
}
