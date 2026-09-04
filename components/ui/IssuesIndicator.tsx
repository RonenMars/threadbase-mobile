import React, { useMemo } from 'react'
import { Text, TouchableOpacity, StyleSheet } from 'react-native'
import { WarningCircle } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { font, radius, spacing, type Theme } from '@/constants/theme'
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
  const s = useMemo(() => styles(theme), [theme])

  if (count === 0) return null

  return (
    <TouchableOpacity
      style={[s.bar, { borderColor: theme.text.danger }]}
      onPress={onPress}
      testID="issues-indicator"
      accessibilityRole="button"
      accessibilityLabel={t('errorBanner.issuesIndicator', { count })}
    >
      <WarningCircle size={14} color={theme.text.danger} />
      <Text style={[s.text, { color: theme.text.danger }]}>
        {t('errorBanner.issuesIndicator', { count })}
      </Text>
      <Text style={[s.link, { color: theme.text.accent }]}>{t('errorBanner.detailsLink')}</Text>
    </TouchableOpacity>
  )
}

function styles(theme: Theme) {
  return StyleSheet.create({
    bar: {
      position: 'absolute',
      bottom: spacing.lg,
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      backgroundColor: theme.bg.card,
      borderWidth: 1,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    text: {
      fontSize: font.sm,
      fontWeight: '600',
    },
    link: {
      fontSize: font.sm,
      fontWeight: '600',
      marginStart: spacing.xs,
    },
  })
}
