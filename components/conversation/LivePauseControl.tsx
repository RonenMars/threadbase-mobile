import React from 'react'
import { Pressable, Text, StyleSheet } from 'react-native'
import { Pause, Play } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { LiveDot } from '@/components/sessions/LiveDot'
import { font, spacing, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'

interface Props {
  paused: boolean
  onToggle: () => void
}

/**
 * Header pill for a live conversation: a pulsing "Live" dot the user can tap to
 * pause transcript updates (freezing the messages on screen) and tap again to
 * resume. Rendered only while the session is actually live.
 */
export function LivePauseControl({ paused, onToggle }: Props) {
  const { t } = useTranslation('conversation')
  const theme = useTheme()
  const styles = makeStyles(theme)
  const color = paused ? theme.text.secondary : theme.status.running
  const Icon = paused ? Play : Pause

  return (
    <Pressable
      onPress={onToggle}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={paused ? t('live.resume') : t('live.pause')}
      accessibilityState={{ selected: !paused }}
      testID="live-pause-toggle"
      style={({ pressed }) => [styles.pill, { borderColor: color }, { opacity: pressed ? 0.6 : 1 }]}
    >
      <LiveDot live={!paused} color={color} size={7} />
      <Text style={[styles.label, { color }]}>
        {paused ? t('live.paused') : t('live.indicator')}
      </Text>
      <Icon size={13} color={color} weight="fill" />
    </Pressable>
  )
}

function makeStyles(_theme: Theme) {
  return StyleSheet.create({
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
    },
    label: {
      fontSize: font.xs,
      fontWeight: '600',
    },
  })
}
