import React, { useEffect, useMemo, useRef } from 'react'
import { Animated, ScrollView, StyleSheet, Text, View } from 'react-native'
import { font, radius, spacing, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'

// Strip ANSI escape codes from raw PTY output
function stripAnsi(s: string) {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').replace(/\x1b\][^\x07]*\x07/g, '')
}

function DotsAnimation({ style }: { style?: object }) {
  // useMemo so Animated.Value instances are stable across re-renders
  const dots = useMemo(() => [
    new Animated.Value(0.3),
    new Animated.Value(0.3),
    new Animated.Value(0.3),
  ], [])

  useEffect(() => {
    const animations = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 200),
          Animated.timing(dot, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.3, duration: 400, useNativeDriver: true }),
          Animated.delay(800 - i * 200),
        ]),
      )
    )
    animations.forEach(a => a.start())
    return () => animations.forEach(a => a.stop())
  }, [dots])

  return (
    <View style={[{ flexDirection: 'row', gap: 4 }, style]}>
      {dots.map((dot, i) => (
        <Animated.Text key={i} style={{ opacity: dot, fontSize: 18 }}>•</Animated.Text>
      ))}
    </View>
  )
}

interface Props {
  lines: string[]
  isStreaming: boolean
  fadingOut?: boolean
  onFadeOutComplete?: () => void
}

export function ThinkingBubble({ lines, isStreaming, fadingOut = false, onFadeOutComplete }: Props) {
  const theme = useTheme()
  const styles = makeStyles(theme)
  // useMemo so the Animated.Value is stable and not re-created on re-render
  const opacity = useMemo(() => new Animated.Value(1), [])
  const scrollRef = useRef<ScrollView>(null)
  const hasLines = lines.length > 0

  useEffect(() => {
    if (!fadingOut) return
    Animated.timing(opacity, {
      toValue: 0,
      duration: 350,
      useNativeDriver: true,
    }).start(() => onFadeOutComplete?.())
  }, [fadingOut, opacity, onFadeOutComplete])

  useEffect(() => {
    if (hasLines) scrollRef.current?.scrollToEnd({ animated: false })
  }, [lines.length, hasLines])

  const visibleLines = lines.slice(-60).map(stripAnsi).filter(l => l.trim().length > 0)

  return (
    <Animated.View style={[styles.wrapper, { opacity }]}>
      <View style={styles.bubble}>
        {hasLines ? (
          <ScrollView
            ref={scrollRef}
            style={styles.terminalScroll}
            showsVerticalScrollIndicator={false}
            scrollEnabled={false}
          >
            {visibleLines.map((line, i) => (
              <Text key={i} style={styles.terminalLine} numberOfLines={1}>{line}</Text>
            ))}
          </ScrollView>
        ) : null}
        {(isStreaming || !hasLines) ? (
          <DotsAnimation style={hasLines ? styles.dotsWithLines : undefined} />
        ) : null}
      </View>
    </Animated.View>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    wrapper: {
      paddingHorizontal: spacing.md,
      marginVertical: spacing.xs,
      alignItems: 'flex-start',
    },
    bubble: {
      backgroundColor: theme.bg.card,
      borderRadius: radius.lg,
      borderBottomLeftRadius: radius.sm,
      padding: spacing.md,
      maxWidth: '85%',
      gap: spacing.xs,
    },
    terminalScroll: {
      maxHeight: 180,
    },
    terminalLine: {
      fontFamily: 'monospace',
      fontSize: font.xs,
      color: theme.text.secondary,
      lineHeight: font.xs * 1.5,
    },
    dotsWithLines: {
      marginTop: spacing.xs,
    },
  })
}
