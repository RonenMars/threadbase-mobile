import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import { Animated, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import type { AgentPhase } from '@/types/api'
import { font, radius, spacing, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { parseQuestionBlock, type QuestionBlock } from '@/utils/parseQuestionBlock'
import type { QuestionPhase } from '@/hooks/useActiveQuestion'
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
  /** Answer a permission gate by the option's position in the broadcast options array. */
  onAnswerPermission?: (optionIndex: number) => void
  /** Provider-neutral prompt card: answers by the option's position, ids are on the block. */
  onAnswerPrompt?: (optionIndex: number) => void
  /** Lifecycle phase of `activeQuestion` — 'pending' renders it as an inert ghost. */
  answerPhase?: QuestionPhase | null
  /** An answer is in flight; locks the rows so a double-tap cannot send twice. */
  answerBusy?: boolean
  /** Drop the structured card locally — Esc closes the menu, but nothing on the
   *  server notices, so the card would otherwise linger and stay tappable. */
  onDismissQuestion?: () => void
  /** Server-derived agent phase, already gated on `presentation.live`. */
  subStatus?: AgentPhase | null
}

function getAgentPhaseLabel(phase: AgentPhase, t: TFunction<'sessions'>): string {
  switch (phase) {
    case 'thinking':
      return t('phase.thinking')
    case 'streaming':
      return t('phase.streaming')
    case 'hooks':
      return t('phase.hooks')
    case 'acting':
      return t('phase.acting')
    case 'working':
      return t('phase.working')
  }
}

export function ThinkingBubble({ lines, isStreaming, fadingOut = false, onFadeOutComplete, onSendKeys, activeQuestion, onAnswer, onAnswerPermission, onAnswerPrompt, answerPhase = null, answerBusy = false, onDismissQuestion, subStatus }: Props) {
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

  // A question puts the session in `waiting_input`, which is exactly what ends
  // the thinking bubble's life — so the fade would take the card down with it
  // ~350ms after it appeared, leaving nothing to tap. A card outlives the phase
  // it happened to arrive in.
  const hasCard = Boolean(activeQuestion ?? questionBlock)

  const handleOptionSelect = useCallback((_questionIndex: number, optionIndex: number) => {
    if (!onSendKeys || !questionBlock) return
    const start = questionBlock.selectedIndex ?? 0
    const delta = optionIndex - start
    const arrow = delta > 0 ? '\x1b[B' : '\x1b[A'
    onSendKeys(arrow.repeat(Math.abs(delta)) + '\r')
  }, [onSendKeys, questionBlock])

  // Answering hands the tap upward and stops. It does not dismiss the card and
  // it does not choose keystrokes: the answer route owns both the validated
  // POST and its keystroke fallback, and the card only moves once that has been
  // taken. Dismissing here — which is what this did — is what let a tap on a
  // gate that had already closed write stray bytes into the prompt with nothing
  // on screen to say so.
  const handleStructuredSelect = useCallback((questionIndex: number, optionIndex: number) => {
    if (!activeQuestion) return
    if (activeQuestion.source === 'permission') {
      onAnswerPermission?.(optionIndex)
      return
    }
    if (activeQuestion.source === 'prompt') {
      onAnswerPrompt?.(optionIndex)
      return
    }
    if (!activeQuestion.toolUseId || !onAnswer) return
    const q = activeQuestion.questions[questionIndex]
    onAnswer(activeQuestion.toolUseId, { [q.question]: q.options[optionIndex].label })
  }, [activeQuestion, onAnswer, onAnswerPermission, onAnswerPrompt])

  useEffect(() => {
    if (!fadingOut || hasCard) return
    Animated.timing(opacity, {
      toValue: 0,
      duration: 350,
      useNativeDriver: true,
    }).start(() => onFadeOutComplete?.())
  }, [fadingOut, hasCard, opacity, onFadeOutComplete])

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
        busy={answerBusy}
        ghost={answerPhase === 'pending'}
        onCancel={onSendKeys ? () => { onSendKeys('\x1b'); onDismissQuestion?.() } : undefined}
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

  // The server-derived phase is the whole reason to show a bubble: no phase, no
  // claim about what the agent is doing, so nothing renders. Gated on
  // `presentation.live` upstream, so this is never a phase on a dead session.
  if (!subStatus) return null

  // The PTY has gone quiet mid-turn (Claude only repaints when it has something
  // to draw, and 30s+ of silence is routine). The dots would stop meaning
  // anything, so swap them for the skeleton — the phase label carries the claim.
  const quiet = hasLines && !isStreaming

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
        <View style={styles.phaseRow} testID="thinking-phase">
          <Text style={styles.phase}>{getAgentPhaseLabel(subStatus, t)}</Text>
          {quiet ? null : <DotsAnimation color={theme.text.accent} />}
        </View>
        {quiet ? (
          <View style={styles.skeleton} testID="thinking-skeleton">
            <SkeletonBox height={11} width="72%" />
            <SkeletonBox height={11} width="54%" style={styles.skeletonLineGap} />
          </View>
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
    phaseRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    phase: {
      fontSize: font.xs,
      color: theme.text.secondary,
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
