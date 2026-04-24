import React from 'react'
import { View, StyleSheet } from 'react-native'
import { SkeletonBox } from '@/components/ui/Skeleton'
import { radius, spacing } from '@/constants/theme'

type Props = { index: number }

export function MessageSkeletonRow({ index }: Props) {
  const narrow = index % 3 === 0
  const lines = narrow ? 2 : 3
  return (
    <View style={styles.wrap}>
      {Array.from({ length: lines }, (_, i) => (
        <SkeletonBox
          key={i}
          height={13}
          width={i === lines - 1 ? `${55 + (index % 2) * 12}%` : `${88 - i * 6}%`}
          borderRadius={radius.sm}
          style={i > 0 ? styles.lineGap : undefined}
        />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  lineGap: {
    marginTop: spacing.sm,
  },
})
