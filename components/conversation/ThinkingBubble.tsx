import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import { Animated, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { AgentPhase } from '@/types/api'
import { font, radius, spacing, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { parseQuestionBlock, type QuestionBlock } from '@/utils/parseQuestionBlock'
import { stripAnsi } from '@/utils/stripAnsi'
import { stripBoxDrawing } from '@/utils/stripBoxDrawing'
import { QuestionCard } from '@/components/terminal/QuestionCard'
import { SkeletonBox } from '@/components/ui/Skeleton'

function DotsAnimation({ style, color }: { style?: object; color: string }) {
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
        <Animated.Text key={i} style={{ opacity: dot, fontSize: 18, color }}>•</Animated.Text>
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
  /** Server-derived agent phase, already gated on `presentation.live`. */
  subStatus?: AgentPhase | null
}

export function ThinkingBubble({ lines, isStreaming, fadingOut = false, onFadeOutComplete, onSendKeys, activeQuestion, onAnswer, subStatus }: Props) {
  const theme = useTheme()
  const { t } = useTranslation('sessions')
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

  // Which card (if any) will render — structured WS question / permission gate
  // takes precedence over the PTY-scraped block.
  const card = activeQuestion
    ? (
      <QuestionCard
        block={activeQuestion}
        onSelect={handleStructuredSelect}
        onCancel={onSendKeys ? () => onSendKeys('\x1b') : undefined}
      />
    )
    : questionBlock
      ? (
        <QuestionCard
          block={questionBlock}
          onSelect={handleOptionSelect}
          onCancel={onSendKeys ? () => onSendKeys('\x1b') : undefined}
        />
      )
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
        {subStatus ? (
          <Text style={styles.phase} testID="thinking-phase">{t(`phase.${subStatus}`)}</Text>
        ) : null}
        {(isStreaming || !hasLines) ? (
          <DotsAnimation style={hasLines ? styles.dotsWithLines : undefined} color={theme.text.accent} />
        ) : (
          // Agent is still working but the PTY has gone quiet. Claude only
          // repaints when it has something to draw, so a silent think (30s+ is
          // routine) leaves the lines above frozen and nothing moving — which
          // reads as a dead session. A skeleton keeps the turn visibly alive.
          <View style={styles.skeleton} testID="thinking-skeleton">
            <SkeletonBox height={11} width="72%" />
            <SkeletonBox height={11} width="54%" style={styles.skeletonLineGap} />
          </View>
        )}
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
    phase: {
      fontSize: font.xs,
      color: theme.text.secondary,
    },
    dotsWithLines: {
      marginTop: spacing.xs,
    },
    skeleton: {
      marginTop: spacing.xs,
      minWidth: 140,
    },
    skeletonLineGap: {
      marginTop: spacing.xs,
    },
  })
}
