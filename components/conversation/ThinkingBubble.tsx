import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import { Animated, ScrollView, StyleSheet, Text, View } from 'react-native'
import { font, radius, spacing, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { parseQuestionBlock, type QuestionBlock } from '@/utils/parseQuestionBlock'
import { stripAnsi } from '@/utils/stripAnsi'
import { stripBoxDrawing } from '@/utils/stripBoxDrawing'
import { QuestionCard } from '@/components/terminal/QuestionCard'
import { FEATURE_QUESTIONS } from '@/constants/flags'

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
    () => (FEATURE_QUESTIONS && onSendKeys ? parseQuestionBlock(lines.slice(-30)) : null),
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
    if (!activeQuestion) return
    // Permission gate: answer by sending the REAL on-screen option number + Enter
    // (e.g. "2\r") via the keystroke route — never a 1-based index, never a POST.
    if (activeQuestion.source === 'permission') {
      const realIndex = activeQuestion.permissionIndices?.[optionIndex]
      if (realIndex !== undefined) onSendKeys?.(`${realIndex}\r`)
      return
    }
    if (!activeQuestion.toolUseId) return
    const q = activeQuestion.questions[questionIndex]
    onAnswer?.(activeQuestion.toolUseId, { [q.question]: q.options[optionIndex].label })
  }, [activeQuestion, onAnswer, onSendKeys])

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

  const visibleLines = lines
    .slice(-60)
    .map(l => stripBoxDrawing(stripAnsi(l)))
    .filter(l => l.length > 0)

  // When FEATURE_QUESTIONS is off, render the structured question as plain text
  // inside the bubble so the user can still see what's being asked.
  const questionTextLines = !FEATURE_QUESTIONS && activeQuestion
    ? activeQuestion.questions.flatMap(q => [
        q.question,
        ...q.options.map((o, i) => `  ${i + 1}. ${o.label}`),
      ])
    : []

  // Which card (if any) will render — structured WS question / permission gate
  // takes precedence over the PTY-scraped block.
  const card = FEATURE_QUESTIONS && activeQuestion
    ? <QuestionCard block={activeQuestion} onSelect={handleStructuredSelect} />
    : FEATURE_QUESTIONS && questionBlock
      ? <QuestionCard block={questionBlock} onSelect={handleOptionSelect} />
      : null

  // Once a card is showing, hide the live-terminal text + dots entirely and
  // show only the card — the raw TUI frame is exactly what the card replaces.
  if (card) {
    return (
      <Animated.View style={[styles.cardWrapper, { opacity }]} testID="thinking-bubble">
        {card}
      </Animated.View>
    )
  }

  return (
    <Animated.View style={[styles.wrapper, { opacity }]} testID="thinking-bubble">
      <View style={styles.bubble}>
        {(hasLines || questionTextLines.length > 0) ? (
          <ScrollView
            ref={scrollRef}
            style={styles.terminalScroll}
            showsVerticalScrollIndicator={false}
            scrollEnabled={false}
          >
            {visibleLines.map((line, i) => (
              <Text key={i} style={styles.terminalLine} numberOfLines={1}>{line}</Text>
            ))}
            {questionTextLines.map((line, i) => (
              <Text key={`q${i}`} style={styles.terminalLine} numberOfLines={1}>{line}</Text>
            ))}
          </ScrollView>
        ) : null}
        {(isStreaming || (!hasLines && questionTextLines.length === 0)) ? (
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
      marginTop: spacing.md,
      marginBottom: spacing.xs,
      alignItems: 'flex-start',
    },
    // Card case: full-width (the QuestionCard owns its own padding + top border),
    // so long option labels wrap instead of overflowing the screen edge.
    cardWrapper: {
      marginTop: spacing.md,
      marginBottom: spacing.xs,
      alignSelf: 'stretch',
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
