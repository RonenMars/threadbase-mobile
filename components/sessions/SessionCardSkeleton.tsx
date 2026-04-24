import React from 'react'
import { View, StyleSheet } from 'react-native'
import { SkeletonBox } from '@/components/ui/Skeleton'
import { dark, radius, spacing } from '@/constants/theme'

export function SessionCardSkeleton() {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <SkeletonBox height={16} width="72%" borderRadius={radius.sm} />
        <SkeletonBox height={18} width={56} borderRadius={radius.full} />
      </View>
      <View style={styles.statusRow}>
        <SkeletonBox height={14} width={72} borderRadius={radius.sm} />
        <SkeletonBox height={14} width={48} borderRadius={radius.sm} />
      </View>
      <SkeletonBox height={12} width="100%" borderRadius={radius.sm} />
      <SkeletonBox height={12} width="88%" borderRadius={radius.sm} />
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: dark.bg.card,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: dark.border,
    gap: spacing.sm,
    marginBottom: spacing.sm,
    minHeight: 44,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
})
