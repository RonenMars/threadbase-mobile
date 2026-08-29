import React, { useEffect } from 'react'
import { StyleSheet, View, Text, useWindowDimensions } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
  interpolateColor,
} from 'react-native-reanimated'
import { useTranslation } from 'react-i18next'
import { type Theme, font, spacing } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { useServersStore } from '@/stores/servers'
import { useServerFetchStatusStore } from '@/stores/serverFetchStatus'
import { blockTextDirectionStyle, ltrContentStyle, textDirectionStyle, useAppDirection } from '@/lib/rtl'

const BEAM_WIDTH = 72
const TRACK_HEIGHT = 3
const DOT_SIZE = 6
const DOT_COUNT = 5
const DOT_SPACING = 14
const SCAN_DURATION_MS = 1800

// A single glowing dot that pulses opacity in sequence.
function PulseDot({ index }: { index: number }) {
  const theme = useTheme()
  const styles = makeStyles(theme)
  const opacity = useSharedValue(0.2)

  useEffect(() => {
    const stagger = (index / DOT_COUNT) * SCAN_DURATION_MS
    opacity.value = withDelay(
      stagger,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 320, easing: Easing.out(Easing.quad) }),
          withTiming(0.2, { duration: 480, easing: Easing.in(Easing.quad) }),
          withTiming(0.2, { duration: SCAN_DURATION_MS - 800 }),
        ),
        -1,
        false,
      ),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const dotStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }))

  return <Animated.View style={[styles.dot, dotStyle]} />
}

// Sweeping beam that bounces left ↔ right along the track.
function ScanBeam({ trackWidth, isRTL }: { trackWidth: number; isRTL: boolean }) {
  const theme = useTheme()
  const styles = makeStyles(theme)
  const position = useSharedValue(0)
  const colorProgress = useSharedValue(0)

  useEffect(() => {
    if (trackWidth <= 0) return
    const travel = trackWidth - BEAM_WIDTH

    position.value = withRepeat(
      withSequence(
        withTiming(travel, { duration: SCAN_DURATION_MS, easing: Easing.inOut(Easing.cubic) }),
        withTiming(0, { duration: SCAN_DURATION_MS, easing: Easing.inOut(Easing.cubic) }),
      ),
      -1,
      false,
    )

    colorProgress.value = withRepeat(
      withSequence(
        withTiming(1, { duration: SCAN_DURATION_MS, easing: Easing.linear }),
        withTiming(0, { duration: SCAN_DURATION_MS, easing: Easing.linear }),
      ),
      -1,
      false,
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackWidth])

  const beamStyle = useAnimatedStyle(() => {
    const backgroundColor = interpolateColor(
      colorProgress.value,
      [0, 0.5, 1],
      ['#58a6ff', '#79c0ff', '#58a6ff'],
    )
    return {
      transform: [{ translateX: isRTL ? -position.value : position.value }],
      backgroundColor,
      shadowColor: backgroundColor,
    }
  })

  return <Animated.View style={[styles.beam, beamStyle]} />
}

export function ServerIndexingBanner() {
  const theme = useTheme()
  const styles = makeStyles(theme)
  const { t, i18n } = useTranslation('servers')
  const { direction, isRTL } = useAppDirection()
  const titleStyle = blockTextDirectionStyle(direction)
  const { width: screenWidth } = useWindowDimensions()
  const servers = useServersStore((s) => s.servers)
  const displayedServerIds = useServersStore((s) => s.displayedServerIds)
  const scanProgress = useServersStore((s) => s.scanProgress)
  const fetchStatuses = useServerFetchStatusStore((s) => s.statuses)

  const warmingServerIds = displayedServerIds.filter(
    (id) => fetchStatuses[id]?.status === 'warming_up',
  )

  if (warmingServerIds.length === 0) return null

  // Track fills the banner minus horizontal padding.
  const trackWidth = screenWidth - spacing.lg * 2
  const hasProgress = warmingServerIds.some((id) => {
    const progress = scanProgress[id]
    return progress && progress.total > 0
  })

  return (
    <View
      style={styles.banner}
      accessibilityRole="progressbar"
      accessibilityLabel={t('indexing.label')}
    >
      {/* Text */}
      <View style={styles.textBlock}>
        <Text style={[styles.title, titleStyle]}>{t('indexing.label')}</Text>
        {!hasProgress && <Text style={[styles.subtitle, titleStyle]}>{t('indexing.subtitle')}</Text>}
      </View>

      {/* Pulse dots */}
      <View style={styles.dotsRow}>
        {Array.from({ length: DOT_COUNT }, (_, i) => (
          <PulseDot key={i} index={i} />
        ))}
      </View>

      <View style={styles.serverList}>
        {warmingServerIds.map((serverId) => {
          const progress = scanProgress[serverId]
          const validProgress = progress && progress.total > 0 ? progress : null
          const fillWidth = validProgress
            ? trackWidth * (validProgress.scanned / validProgress.total)
            : 0
          const serverLabel = servers[serverId]?.label || servers[serverId]?.url || serverId

          return (
            <View key={serverId} style={styles.serverProgress}>
              <View style={styles.serverHeader}>
                <Text style={[styles.serverLabel, ltrContentStyle]} numberOfLines={1}>
                  {serverLabel}
                </Text>
                {validProgress && (
                  <Text style={[styles.subtitle, textDirectionStyle(direction)]}>
                    {t('indexing.progress', {
                      scanned: validProgress.scanned.toLocaleString(i18n.language),
                      total: validProgress.total.toLocaleString(i18n.language),
                    })}
                  </Text>
                )}
              </View>

              {/* Determinate fill when progress is known, indeterminate beam otherwise. */}
              <View style={[styles.track, { width: trackWidth }]}>
                {validProgress ? (
                  <View testID="indexing-progress-fill" style={[styles.fill, { width: fillWidth }]} />
                ) : (
                  <ScanBeam trackWidth={trackWidth} isRTL={isRTL} />
                )}
              </View>
            </View>
          )
        })}
      </View>
    </View>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    banner: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm + 2,
      paddingBottom: spacing.md,
      backgroundColor: theme.bg.secondary,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
      gap: spacing.xs,
    },
    textBlock: {
      gap: 2,
    },
    title: {
      color: theme.text.primary,
      fontSize: font.base,
      fontWeight: '600',
    },
    subtitle: {
      color: theme.text.secondary,
      fontSize: font.xs,
      lineHeight: 16,
    },
    serverList: {
      gap: spacing.sm,
    },
    serverProgress: {
      gap: 2,
    },
    serverHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    serverLabel: {
      flex: 1,
      color: theme.text.primary,
      fontSize: font.sm,
      fontWeight: '600',
    },
    dotsRow: {
      flexDirection: 'row',
      gap: DOT_SPACING - DOT_SIZE,
      marginTop: 2,
    },
    dot: {
      width: DOT_SIZE,
      height: DOT_SIZE,
      borderRadius: DOT_SIZE / 2,
      backgroundColor: theme.text.accent,
    },
    track: {
      height: TRACK_HEIGHT,
      borderRadius: TRACK_HEIGHT,
      backgroundColor: theme.border,
      overflow: 'hidden',
      marginTop: 2,
    },
    fill: {
      position: 'absolute',
      top: 0,
      start: 0,
      height: TRACK_HEIGHT,
      borderRadius: TRACK_HEIGHT,
      backgroundColor: theme.text.accent,
    },
    beam: {
      position: 'absolute',
      top: 0,
      start: 0,
      width: BEAM_WIDTH,
      height: TRACK_HEIGHT,
      borderRadius: TRACK_HEIGHT,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.9,
      shadowRadius: 6,
      elevation: 4,
    },
  })
}
