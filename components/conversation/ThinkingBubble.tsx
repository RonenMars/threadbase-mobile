import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import { Animated, ScrollView, StyleSheet, Text, View } from 'react-native'
import { font, radius, spacing, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { parseQuestionBlock, type QuestionBlock } from '@/utils/parseQuestionBlock'
import { stripAnsi } from '@/utils/stripAnsi'
import { QuestionCard } from '@/components/terminal/QuestionCard'

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
  onSendKeys?: (keys: string) => void
  activeQuestion?: QuestionBlock | null
  onAnswer?: (toolUseId: string, answers: Record<string, string | string[]>) => void
}

export function ThinkingBubble({ lines, isStreaming, fadingOut = false, onFadeOutComplete, onSendKeys, activeQuestion, onAnswer }: Props) {
  const theme = useTheme()
  const styles = makeStyles(theme)
  // useMemo so the Animated.Value is stable and not re-created on re-render
  const opacity = useMemo(() => new Animated.Value(1), [])
  const scrollRef = useRef<ScrollView>(null)
  const hasLines = lines.length > 0

  const questionBlock = useMemo(
    () => (onSendKeys ? parseQuestionBlock(lines.slice(-30)) : null),
    [lines, onSendKeys]
  )

  const handleOptionSelect = useCallback((_questionIndex: number, optionIndex: number) => {
    if (!onSendKeys || !questionBlock) return
    const start = questionBlock.selectedIndex ?? 0
    const delta = optionIndex - start
    const arrow = delta > 0 ? '\x1b[B' : '\x1b[A'
    onSendKeys(arrow.repeat(Math.abs(delta)) + '\r')
  }, [onSendKeys, questionBlock])

  const handleStructuredSelect = useCallback((questionIndex: number, optionIndex: number) => {
    if (!activeQuestion?.toolUseId) return
    const q = activeQuestion.questions[questionIndex]
    onAnswer?.(activeQuestion.toolUseId, { [q.question]: q.options[optionIndex].label })
  }, [activeQuestion, onAnswer])

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
    <Animated.View style={[styles.wrapper, { opacity }]} testID="thinking-bubble">
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
      {activeQuestion ? (
        <QuestionCard block={activeQuestion} onSelect={handleStructuredSelect} />
      ) : questionBlock ? (
        <QuestionCard block={questionBlock} onSelect={handleOptionSelect} />
      ) : null}
    </Animated.View>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    wrapper: {
      paddingHorizontal: spacing.md,
      marginTop: spacing.md,
      marginBottom: spacing.xs,
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
