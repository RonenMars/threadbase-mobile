import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet, type ViewStyle } from 'react-native'
import { dark, font, spacing } from '@/constants/theme'

interface BannerAction {
  label: string
  onPress: () => void
}

interface Props {
  title: string
  message: string
  accent: string
  icon?: React.ReactNode
  action?: BannerAction
  style?: ViewStyle
}

export function Banner({ title, message, accent, icon, action, style }: Props) {
  return (
    <View style={styles.overlay}>
    <View style={[styles.banner, { borderColor: accent }, style]}>
      {icon}
      <Text style={styles.title}>{title}</Text>
      <Text style={[styles.text, { color: accent }]}>{message}</Text>
      {action ? (
        <TouchableOpacity style={styles.actionBtn} onPress={action.onPress}>
          <Text style={styles.actionBtnText}>{action.label}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
    </View>
  )
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: '55%',
  },
  banner: {
    width: 240,
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: dark.bg.card,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  text: {
    fontSize: font.sm,
    textAlign: 'center',
    lineHeight: 19,
  },
  title: {
    color: dark.text.primary,
    fontSize: font.base,
    textAlign: 'center',
    fontWeight: '600',
    marginTop: spacing.sm,
  },
  actionBtn: {
    marginTop: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.lg,
    backgroundColor: dark.bg.secondary,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: dark.border,
  },
  actionBtnText: {
    color: dark.text.primary,
    fontSize: font.sm,
    fontWeight: '600',
  },
})
