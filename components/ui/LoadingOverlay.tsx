import React, { useEffect, useState } from 'react'
import { Animated, Easing, StyleSheet, View, Text } from 'react-native'
import { CircleNotch } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
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
  // One progress row, captioned by `progressLabel`. It used to be two — a sessions
  // row and a conversations row — but conversations load lazily now and a lazy
  // list has no total to report, so the Hub shows sessions and ConversationList
  // shows its own drain. Omit loaded/total to hide the row entirely.
  done?: boolean
  loaded?: number
  total?: number
  inFlightCount?: number
  /** Semantic owner of the progress being displayed. */
  progressLabel?: 'sessions' | 'conversations'
}

function getProgressLabel(label: 'sessions' | 'conversations', t: TFunction<'sessions'>): string {
  switch (label) {
    case 'sessions':
      return t('loading.sessionsLabel')
    case 'conversations':
      return t('loading.conversationsLabel')
  }
}

const SPIN_DURATION_MS = 900

export function LoadingOverlay({
  visible,
  done,
  loaded,
  total,
  inFlightCount,
  progressLabel = 'sessions',
}: Props) {
  const showProgress = loaded !== undefined && total !== undefined
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

        {showProgress ? (
          <View style={styles.row}>
            <View style={styles.rowLabels}>
              <Text style={styles.rowTitle}>{getProgressLabel(progressLabel, t)}</Text>
              {done
                ? <Text style={styles.rowCount}>{t('loading.done')}</Text>
                : sessShowRatio
                  ? <Text style={styles.rowCount}>{t('loading.progress', { loaded, total })}</Text>
                  : <DotsIndicator color={theme.text.accent} />}
            </View>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: done ? '100%' : `${sessRatio * 100}%` }]} />
            </View>
          </View>
        ) : null}
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
