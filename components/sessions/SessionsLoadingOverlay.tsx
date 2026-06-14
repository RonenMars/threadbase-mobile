import React, { useEffect, useState } from 'react'
import { Animated, Easing, StyleSheet, View, Text } from 'react-native'
import { CircleNotch } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { font, spacing, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'

interface Props {
  visible: boolean
  loaded: number
  total: number
  serverLabel: string | null
}

const SPIN_DURATION_MS = 900

export function SessionsLoadingOverlay({ visible, loaded, total, serverLabel }: Props) {
  const theme = useTheme()
  const styles = makeStyles(theme)
  const { t } = useTranslation('sessions')
  const [spin] = useState(() => new Animated.Value(0))

  useEffect(() => {
    if (!visible) return
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: SPIN_DURATION_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    )
    loop.start()
    return () => loop.stop()
  }, [visible, spin])

  if (!visible) return null

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] })

  // Total is 0 until the first page of the current server returns. Show an
  // indeterminate bar in that brief window to avoid a 0/0 reading.
  const ratio = total > 0 ? Math.min(1, loaded / total) : 0
  const showRatio = total > 0

  return (
    <View
      pointerEvents="auto"
      style={styles.scrim}
      accessibilityRole="progressbar"
      accessibilityLabel={t('loading.title')}
    >
      <View style={styles.card}>
        <Animated.View style={[styles.iconWrap, { transform: [{ rotate }] }]}>
          <CircleNotch size={28} color={theme.text.accent} weight="bold" />
        </Animated.View>

        <Text style={styles.title} numberOfLines={1}>
          {showRatio
            ? t('loading.progress', { loaded, total })
            : t('loading.title')}
        </Text>

        <Text style={styles.subtitle} numberOfLines={1}>
          {serverLabel
            ? t('loading.fetchingServer', { server: serverLabel })
            : t('loading.fetchingNoLabel')}
        </Text>

        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${ratio * 100}%` }]} />
        </View>
      </View>
    </View>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
  scrim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(13, 17, 23, 0.55)',
    zIndex: 50,
  },
  card: {
    backgroundColor: theme.bg.card,
    borderRadius: 16,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    minWidth: 240,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  iconWrap: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    marginTop: spacing.sm,
    color: theme.text.primary,
    fontSize: font.base,
    fontWeight: '600',
  },
  subtitle: {
    marginTop: 4,
    color: theme.text.secondary,
    fontSize: font.xs,
  },
  barTrack: {
    marginTop: spacing.sm,
    height: 6,
    width: 192,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: theme.border,
  },
  barFill: {
    height: '100%',
    backgroundColor: theme.text.accent,
    borderRadius: 999,
  },
  })
}
