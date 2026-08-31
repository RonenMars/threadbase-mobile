import React, { useMemo } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import type { ViewStyle } from 'react-native'
import { Terminal } from 'phosphor-react-native'
import { useTheme, useIsGlass } from '@/contexts/ThemeContext'
import { GlassFill } from '@/components/ui/GlassFill'
import { font, spacing, radius, type Theme } from '@/constants/theme'

interface EmptyStateProps {
  title: string
  subtitle?: string
  style?: ViewStyle
  action?: { label: string; onPress: () => void }
  secondaryAction?: { label: string; onPress: () => void }
}

export function EmptyState({ title, subtitle, style, action, secondaryAction }: EmptyStateProps) {
  const theme = useTheme()
  const isGlass = useIsGlass()
  const s = useMemo(() => styles(theme), [theme])

  return (
    <View style={[s.container, style]}>
      <View style={[s.iconWrap, isGlass && s.iconWrapGlass]}>
        <GlassFill />
        <Terminal size={32} color={theme.text.accent} weight="light" />
      </View>
      <Text style={s.title}>{title}</Text>
      {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
      {action || secondaryAction ? (
        <View style={s.actions}>
          {action ? (
            <TouchableOpacity style={s.action} onPress={action.onPress}>
              <Text style={s.actionText}>{action.label}</Text>
            </TouchableOpacity>
          ) : null}
          {secondaryAction ? (
            <TouchableOpacity style={s.secondaryAction} onPress={secondaryAction.onPress}>
              <Text style={s.secondaryActionText}>{secondaryAction.label}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

function styles(theme: Theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xl,
      gap: spacing.sm,
      backgroundColor: theme.bg.primary,
    },
    iconWrap: {
      width: 56,
      height: 56,
      borderRadius: radius.md,
      backgroundColor: theme.bg.card,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
    },
    iconWrapGlass: {
      backgroundColor: 'transparent',
    },
    title: {
      color: theme.text.primary,
      fontSize: font.lg,
      fontWeight: '600',
      textAlign: 'center',
      letterSpacing: -0.2,
    },
    subtitle: {
      color: theme.text.secondary,
      fontSize: font.base,
      fontWeight: '400',
      textAlign: 'center',
      lineHeight: 20,
    },
    actions: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    action: {
      minHeight: 44,
      justifyContent: 'center',
      paddingHorizontal: spacing.md,
      borderRadius: radius.sm,
      backgroundColor: theme.text.accent,
    },
    actionText: {
      color: theme.bg.primary,
      fontSize: font.sm,
      fontWeight: '600',
    },
    secondaryAction: {
      minHeight: 44,
      justifyContent: 'center',
      paddingHorizontal: spacing.md,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: theme.border,
    },
    secondaryActionText: {
      color: theme.text.accent,
      fontSize: font.sm,
      fontWeight: '600',
    },
  })
}
