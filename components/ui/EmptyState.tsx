import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { dark, font, spacing } from '@/constants/theme'

interface EmptyStateProps {
  icon?: React.ReactNode | string
  title: string
  subtitle?: string
}

export function EmptyState({ icon, title, subtitle }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      {icon ? (
        <View style={styles.icon}>
          {typeof icon === 'string' ? (
            <Text style={styles.iconEmoji}>{icon}</Text>
          ) : (
            icon
          )}
        </View>
      ) : null}
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 200,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  icon: {
    opacity: 0.5,
    marginBottom: spacing.xs,
  },
  iconEmoji: {
    fontSize: 40,
  },
  title: {
    color: dark.text.primary,
    fontSize: font.lg,
    fontWeight: '600',
    textAlign: 'center',
  },
  subtitle: {
    color: dark.text.secondary,
    fontSize: font.base,
    textAlign: 'center',
    lineHeight: 22,
  },
})
