import { ScrollView, Pressable, Text, View, StyleSheet } from 'react-native'
import { font, radius, spacing, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'

export type TimeBucket = 'all' | 'today' | '7d' | '30d' | 'custom'

export interface TimeBucketPillsProps {
  active: TimeBucket
  /** Count per bucket. Undefined hides the count chip on that pill. */
  counts?: Partial<Record<TimeBucket, number>>
  onChange: (bucket: TimeBucket) => void
  /** Hide the Custom pill when range-pickers aren't wired up yet. */
  showCustom?: boolean
  testID?: string
}

const BUCKETS: { key: TimeBucket; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'today', label: 'Today' },
  { key: '7d', label: '7d' },
  { key: '30d', label: '30d' },
]

/**
 * Horizontal scroll row used in hub-drill and global search. Brand-blue tint
 * on the active pill (matches design/preview/components-pills.html). Counts
 * render in JetBrains Mono so the magnitude of each bucket is readable at a
 * glance.
 */
export function TimeBucketPills({
  active,
  counts,
  onChange,
  showCustom = true,
  testID,
}: TimeBucketPillsProps) {
  const theme = useTheme()
  const styles = makeStyles(theme)
  const buckets = showCustom ? [...BUCKETS, { key: 'custom' as const, label: 'Custom' }] : BUCKETS
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      testID={testID}
    >
      {buckets.map(({ key, label }) => {
        const isActive = key === active
        const count = counts?.[key]
        return (
          <Pressable
            key={key}
            onPress={() => onChange(key)}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={
              count != null ? `${label}, ${count} ${count === 1 ? 'item' : 'items'}` : label
            }
            style={[styles.pill, isActive && styles.pillActive]}
            hitSlop={6}
          >
            <Text style={[styles.label, isActive && styles.labelActive]}>{label}</Text>
            {count != null ? (
              <View style={[styles.countWrap, isActive && styles.countWrapActive]}>
                <Text style={[styles.count, isActive && styles.countActive]}>
                  {count >= 1000 ? `${Math.floor(count / 100) / 10}k` : count}
                </Text>
              </View>
            ) : null}
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    row: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      gap: 6,
      flexDirection: 'row',
    },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      borderRadius: radius.full,
      backgroundColor: theme.bg.secondary,
      borderWidth: 1,
      borderColor: theme.border,
    },
    pillActive: {
      backgroundColor: `${theme.text.accent}1f`,
      borderColor: theme.text.accent,
    },
    label: {
      color: theme.text.secondary,
      fontSize: font.xs,
      fontWeight: '600',
    },
    labelActive: {
      color: theme.text.accent,
    },
    countWrap: {
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: radius.full,
      backgroundColor: 'transparent',
    },
    countWrapActive: {
      backgroundColor: 'transparent',
    },
    count: {
      color: theme.text.secondary,
      fontSize: font.xs - 1,
      fontWeight: '600',
      opacity: 0.7,
    },
    countActive: {
      color: theme.text.accent,
      opacity: 1,
    },
  })
}

/** Pure helper: bucket a list of items by an ISO timestamp accessor. */
export function bucketTimestamps<T>(
  items: readonly T[],
  getTimestamp: (item: T) => string | number | Date | null | undefined,
  now: number = Date.now(),
): Record<Exclude<TimeBucket, 'custom'>, number> {
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const todayMs = today.getTime()
  const sevenAgo = todayMs - 6 * 86_400_000
  const thirtyAgo = todayMs - 29 * 86_400_000

  let today_ = 0
  let seven = 0
  let thirty = 0
  let total = 0

  for (const item of items) {
    const raw = getTimestamp(item)
    if (raw == null) continue
    const ts = raw instanceof Date ? raw.getTime() : typeof raw === 'number' ? raw : Date.parse(raw)
    if (!Number.isFinite(ts)) continue
    total++
    if (ts >= todayMs) today_++
    if (ts >= sevenAgo) seven++
    if (ts >= thirtyAgo) thirty++
  }

  return { all: total, today: today_, '7d': seven, '30d': thirty }
}

/** Filter items by a bucket. Pure so it's shared between hub-drill and search. */
export function filterByBucket<T>(
  items: readonly T[],
  bucket: TimeBucket,
  getTimestamp: (item: T) => string | number | Date | null | undefined,
  now: number = Date.now(),
): T[] {
  if (bucket === 'all' || bucket === 'custom') return items.slice()
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const todayMs = today.getTime()
  const sevenAgo = todayMs - 6 * 86_400_000
  const thirtyAgo = todayMs - 29 * 86_400_000

  const threshold = bucket === 'today' ? todayMs : bucket === '7d' ? sevenAgo : thirtyAgo
  return items.filter((item) => {
    const raw = getTimestamp(item)
    if (raw == null) return false
    const ts = raw instanceof Date ? raw.getTime() : typeof raw === 'number' ? raw : Date.parse(raw)
    if (!Number.isFinite(ts)) return false
    return ts >= threshold
  })
}
