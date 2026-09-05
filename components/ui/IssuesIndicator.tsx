import React, { useMemo } from 'react'
import { Text, TouchableOpacity, StyleSheet } from 'react-native'
import { BellRinging } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { spacing, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'

interface Props {
  count: number
  onPress: () => void
}

/** Compact persistent reminder shown after the user minimizes the recovery
 * sheet while unresolved errors remain — reopens the same sheet on tap. */
export function IssuesIndicator({ count, onPress }: Props) {
  const { t } = useTranslation('common')
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const s = useMemo(() => styles(theme), [theme])

  if (count === 0) return null

  return (
    <TouchableOpacity
      style={[s.button, { bottom: insets.bottom + spacing.lg, backgroundColor: theme.bg.card, borderColor: theme.text.danger }]}
      onPress={onPress}
      testID="issues-indicator"
      accessibilityRole="button"
      accessibilityLabel={t('errorBanner.issuesIndicator', { count })}
    >
      <BellRinging size={22} color={theme.text.danger} />
      <Text style={[s.badge, { backgroundColor: theme.text.danger }]}>{count}</Text>
    </TouchableOpacity>
  )
}

function styles(theme: Theme) {
  return StyleSheet.create({
    button: {
      position: 'absolute',
      left: spacing.lg,
      width: 48,
      height: 48,
      borderWidth: 1,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 8,
      shadowColor: theme.bg.primary,
      shadowOpacity: 0.35,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
    },
    badge: {
      position: 'absolute',
      top: -5,
      right: -5,
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      paddingHorizontal: 4,
      color: '#fff',
      fontSize: 11,
      fontWeight: '700',
      textAlign: 'center',
      textAlignVertical: 'center',
    },
  })
}
