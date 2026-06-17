import React, { useEffect, useState } from 'react'
import { Animated, Easing, StyleSheet, View, Text } from 'react-native'
import { CircleNotch } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { font, spacing, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'

const DOTS = ['.', '..', '...']

function DotsIndicator({ color }: { color: string }) {
  const [frame, setFrame] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setFrame((f) => (f + 1) % DOTS.length), 400)
    return () => clearInterval(id)
  }, [])
  return <Text style={{ color, fontSize: font.sm, letterSpacing: 1 }}>{DOTS[frame]}</Text>
}

interface Props {
  visible: boolean
  // Sessions row — omit to hide it (conv-only mode)
  sessionsDone?: boolean
  loaded?: number
  total?: number
  inFlightCount?: number
  // Conversations row
  convLoaded: number
  convTotal: number
  convDone: boolean
  convCounting?: boolean
}

const SPIN_DURATION_MS = 900

export function LoadingOverlay({
  visible,
  sessionsDone,
  loaded,
  total,
  inFlightCount,
  convLoaded,
  convTotal,
  convDone,
  convCounting,
}: Props) {
  // Show sessions row whenever sessions props are provided (always visible).
  const showSessions = loaded !== undefined && total !== undefined
  const theme = useTheme()
  const styles = makeStyles(theme)
  const { t } = useTranslation('sessions')
  const [spin] = useState(() => new Animated.Value(0))

  useEffect(() => {
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
  }, [spin])

  if (!visible) return null

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] })

  const sessRatio = (total ?? 0) > 0 ? Math.min(1, (loaded ?? 0) / (total ?? 1)) : 0
  const sessShowRatio = (total ?? 0) > 0
  const convRatio = convTotal > 0 ? Math.min(1, convLoaded / convTotal) : 0
  const convShowRatio = convTotal > 0

  return (
    <View
      pointerEvents="auto"
      style={styles.scrim}
      accessibilityRole="progressbar"
      accessibilityLabel={t('loading.title')}
      testID="sessions-loading-overlay"
    >
      <View style={styles.card}>
        <Animated.View style={[styles.iconWrap, { transform: [{ rotate }] }]}>
          <CircleNotch size={28} color={theme.text.accent} weight="bold" />
        </Animated.View>

        <Text style={styles.fetchingLabel} numberOfLines={1}>
          {(inFlightCount ?? 0) > 1
            ? t('loading.fetchingN', { count: inFlightCount })
            : t('loading.fetchingOne')}
        </Text>

        {/* Sessions row — hidden in conv-only mode */}
        {showSessions ? (
          <View style={styles.row}>
            <View style={styles.rowLabels}>
              <Text style={styles.rowTitle}>{t('loading.sessionsLabel')}</Text>
              {sessionsDone
                ? <Text style={styles.rowCount}>{t('loading.done')}</Text>
                : sessShowRatio
                  ? <Text style={styles.rowCount}>{t('loading.progress', { loaded, total })}</Text>
                  : <DotsIndicator color={theme.text.accent} />}
            </View>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: sessionsDone ? '100%' : `${sessRatio * 100}%` }]} />
            </View>
          </View>
        ) : null}

        {/* Conversations row */}
        <View style={styles.row}>
          <View style={styles.rowLabels}>
            <Text style={styles.rowTitle}>{t('loading.conversationsLabel')}</Text>
            {convDone
              ? <Text style={styles.rowCount}>{t('loading.done')}</Text>
              : convCounting || !convShowRatio
                ? <DotsIndicator color={theme.text.accent} />
                : <Text style={styles.rowCount}>{t('loading.progress', { loaded: convLoaded, total: convTotal })}</Text>}
          </View>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: convDone ? '100%' : `${convRatio * 100}%` }]} />
          </View>
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
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
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
  fetchingLabel: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    color: theme.text.secondary,
    fontSize: font.xs,
  },
  row: {
    width: 192,
    marginTop: spacing.md,
  },
  rowLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  rowTitle: {
    color: theme.text.primary,
    fontSize: font.sm,
    fontWeight: '600',
  },
  rowCount: {
    color: theme.text.secondary,
    fontSize: font.xs,
  },
  barTrack: {
    height: 6,
    width: '100%',
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
