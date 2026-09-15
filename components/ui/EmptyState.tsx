import React, { useMemo } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import type { ViewStyle } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { Plus } from 'phosphor-react-native'
import { useTheme } from '@/contexts/ThemeContext'
import { PROVIDER_MARK_PATHS } from '@/components/sessions/shared/ProviderMark'
import { font, spacing, radius, type Theme } from '@/constants/theme'

interface EmptyStateProps {
  title: string
  subtitle?: string
  style?: ViewStyle
  action?: { label: string; onPress: () => void; plus?: boolean }
  secondaryAction?: { label: string; onPress: () => void }
}

export function EmptyState({ title, subtitle, style, action, secondaryAction }: EmptyStateProps) {
  const theme = useTheme()
  const s = useMemo(() => styles(theme), [theme])

  return (
    <View style={[s.container, style]}>
      <View style={s.iconWrap}>
        <Svg width={20} height={20} viewBox="0 0 24 24">
          <Path d={PROVIDER_MARK_PATHS.claude} fill={theme.border} fillRule="evenodd" clipRule="evenodd" />
        </Svg>
      </View>
      <Text style={s.title}>{title}</Text>
      {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
      {action || secondaryAction ? (
        <View style={s.actions}>
          {action ? (
            <TouchableOpacity style={s.action} onPress={action.onPress} testID="empty-state-action">
              {action.plus ? <Plus size={14} color={theme.bg.primary} weight="bold" /> : null}
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
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: theme.bg.secondary,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
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
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: 18,
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
