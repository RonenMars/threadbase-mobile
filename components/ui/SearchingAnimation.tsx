import React, { useEffect, useMemo, useState } from 'react'
import { Animated, Easing, StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { MagnifyingGlass, Sparkle } from 'phosphor-react-native'
import { useTheme } from '@/contexts/ThemeContext'
import { useReduceMotion } from '@/hooks/useAccessibilitySettings'
import { font, radius, spacing, type Theme } from '@/constants/theme'

const CYCLE_MS = 1800
const STEPS = Array.from({ length: 25 }, (_, i) => i / 24)
const LINE_WIDTHS = [56, 72, 40]
const DOT_DELAYS = [0, 0.15, 0.3]

/** A magnifying glass circling over a page, shown while the server is still searching. */
export function SearchingAnimation() {
  const theme = useTheme()
  const { t } = useTranslation('sessions')
  const reduceMotion = useReduceMotion()
  const styles = useMemo(() => makeStyles(theme), [theme])
  const [progress] = useState(() => new Animated.Value(0))

  useEffect(() => {
    if (reduceMotion) {
      progress.setValue(0)
      return
    }
    // Native driver: a JS-driven or Reanimated loop would commit on every frame.
    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: CYCLE_MS,
        easing: Easing.linear,
        useNativeDriver: true,
        isInteraction: false,
      }),
    )
    loop.start()
    return () => loop.stop()
  }, [progress, reduceMotion])

  // The native driver has no trigonometry, so the orbit is sampled.
  const motion = useMemo(() => {
    const sample = (at: (p: number) => number) =>
      progress.interpolate({ inputRange: STEPS, outputRange: STEPS.map(at) })
    const wave = (p: number) => Math.sin(p * Math.PI * 2)
    return {
      lensX: sample((p) => wave(p) * 18),
      lensY: sample((p) => -Math.cos(p * Math.PI * 2) * 10),
      sparkle: sample((p) => Math.max(0, wave(p * 2))),
      dots: DOT_DELAYS.map((delay) => sample((p) => 0.25 + 0.75 * Math.max(0, wave(p - delay)))),
    }
  }, [progress])

  return (
    <View
      style={styles.container}
      testID="searching-animation"
      accessibilityRole="progressbar"
      accessibilityLabel={t('search.searching')}
      accessibilityState={{ busy: true }}
    >
      <View style={styles.stage}>
        <View style={styles.page}>
          {LINE_WIDTHS.map((width) => (
            <View key={width} style={[styles.line, { width }]} />
          ))}
        </View>
        <Animated.View style={[styles.sparkle, { opacity: motion.sparkle, transform: [{ scale: motion.sparkle }] }]}>
          <Sparkle size={18} color={theme.status.waiting} weight="fill" />
        </Animated.View>
        <Animated.View
          style={[styles.lens, { transform: [{ translateX: motion.lensX }, { translateY: motion.lensY }] }]}
        >
          <MagnifyingGlass size={48} color={theme.text.accent} weight="bold" />
        </Animated.View>
      </View>
      <Text style={styles.label}>{t('search.searching')}</Text>
      <View style={styles.dots}>
        {motion.dots.map((opacity, i) => (
          <Animated.View key={DOT_DELAYS[i]} style={[styles.dot, { opacity }]} />
        ))}
      </View>
    </View>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      // Top-aligned: centred in the screen it would sit behind the search keyboard.
      alignItems: 'center',
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.xl,
      gap: spacing.md,
    },
    stage: { width: 128, height: 104, alignItems: 'center', justifyContent: 'center' },
    page: {
      width: 96,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md - 2,
      gap: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.bg.card,
    },
    line: { height: 6, borderRadius: radius.full, backgroundColor: theme.border },
    lens: { position: 'absolute' },
    sparkle: { position: 'absolute', top: 4, right: 4 },
    label: { color: theme.text.secondary, fontSize: font.base, textAlign: 'center' },
    dots: { flexDirection: 'row', gap: spacing.sm },
    dot: { width: 8, height: 8, borderRadius: radius.full, backgroundColor: theme.text.accent },
  })
}
