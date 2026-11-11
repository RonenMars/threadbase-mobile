import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Animated, Modal, Platform, ScrollView, type ScrollViewInstance, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaProvider, SafeAreaView, initialWindowMetrics } from 'react-native-safe-area-context'
import { ArrowsOut, CaretDown, Question } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { getAgentPhaseLabel } from '@/components/sessions/agentPhaseLabel'
import type { AgentPhase } from '@/types/api'
import { font, radius, spacing, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { isCodexTrustQuitOption, parseQuestionBlock, type QuestionBlock } from '@/utils/parseQuestionBlock'
import type { QuestionPhase } from '@/hooks/useActiveQuestion'
import { stripAnsi } from '@/utils/stripAnsi'
import { stripBoxDrawing } from '@/utils/stripBoxDrawing'
import { QuestionCard } from '@/components/terminal/QuestionCard'
import { KnightRiderScanner } from '@/components/sessions/KnightRiderScanner'

/** Releases a held present if iOS never reports the previous dismiss finished. */
export const MODAL_DISMISS_FALLBACK_MS = 1000

interface Props {
  lines: string[]
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
  /** Cancel on the structured card; the owning view decides what reaches the PTY. */
  onCancelQuestion?: () => void
  /**
   * Reports whether the card on screen is the PTY scrape rather than a server
   * prompt. The scrape has no phase, so the owning view cannot see it
   * through `answerPhase` and needs this to keep send off while it is up.
   */
  onScrapedCardChange?: (shown: boolean) => void
  /** Server-derived agent phase, already gated on `presentation.live`. */
  subStatus?: AgentPhase | null
  onSessionQuit?: () => void
}

export function ThinkingBubble({ lines, fadingOut = false, onFadeOutComplete, onSendKeys, activeQuestion, onAnswer, onAnswerPermission, onAnswerPrompt, answerPhase = null, answerBusy = false, onCancelQuestion, onScrapedCardChange, subStatus, onSessionQuit }: Props) {
  const theme = useTheme()
  const { t } = useTranslation('sessions')
  const { t: tc } = useTranslation('common')
  const styles = makeStyles(theme)
  // useMemo so the Animated.Value is stable and not re-created on re-render
  const opacity = useMemo(() => new Animated.Value(1), [])
  const scrollRef = useRef<ScrollViewInstance>(null)
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

  const scrapedCardShown = !activeQuestion && questionBlock !== null
  useEffect(() => {
    onScrapedCardChange?.(scrapedCardShown)
    return () => onScrapedCardChange?.(false)
  }, [scrapedCardShown, onScrapedCardChange])

  // The card opens full screen; minimizing drops it back into the transcript
  // until the next prompt arrives. Keyed on content, not identity: a PTY repaint
  // is a new block carrying the same prompt and must not re-open it.
  const shownBlock = activeQuestion ?? questionBlock
  const promptKey = shownBlock
    ? shownBlock.questions.map(q => `${q.question} ${q.options.map(o => o.label).join(' ')}`).join(' ')
    : ''
  const [minimizedKey, setMinimizedKey] = useState<string | null>(null)

  const handleOptionSelect = useCallback((_questionIndex: number, optionIndex: number) => {
    if (!onSendKeys || !questionBlock) return
    const start = questionBlock.selectedIndex ?? 0
    const delta = optionIndex - start
    const arrow = delta > 0 ? '\x1b[B' : '\x1b[A'
    onSendKeys(arrow.repeat(Math.abs(delta)) + '\r')
    if (isCodexTrustQuitOption(questionBlock, optionIndex)) onSessionQuit?.()
  }, [onSendKeys, onSessionQuit, questionBlock])

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

  const handleStructuredSubmitMulti = useCallback((questionIndex: number, optionIndexes: number[]) => {
    if (!activeQuestion?.toolUseId || !onAnswer) return
    const q = activeQuestion.questions[questionIndex]
    onAnswer(activeQuestion.toolUseId, { [q.question]: optionIndexes.map(i => q.options[i].label) })
  }, [activeQuestion, onAnswer])

  useEffect(() => {
    // setValue also stops a fade already running. The status flip and the card
    // are separate frames, so the fade can start a beat before the card lands,
    // and a card left inside it finishes laid out at opacity 0.
    if (hasCard) {
      opacity.setValue(1)
      return
    }
    if (!fadingOut) return
    Animated.timing(opacity, {
      toValue: 0,
      duration: 350,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) onFadeOutComplete?.()
    })
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
  const ghost = Boolean(activeQuestion) && answerPhase === 'pending'
  // A ghost blocks nothing, so it never takes over the screen.
  const fullScreen = hasCard && !ghost && minimizedKey !== promptKey

  // iOS presents a Modal as a view controller, and a present issued while the
  // previous dismiss is still animating left the whole app on a black window
  // that took no touches: an answer took the card down, and the next card
  // landed 67ms later. The Modal therefore stays mounted across every branch
  // below, and a new present waits for the dismiss to finish. onDismiss is
  // iOS-only (RN Modal.js); the timer covers a dismiss that never completes,
  // e.g. one whose present was never shown.
  const [dismissing, setDismissing] = useState(false)
  const [prevFullScreen, setPrevFullScreen] = useState(fullScreen)
  if (prevFullScreen !== fullScreen) {
    setPrevFullScreen(fullScreen)
    if (!fullScreen && Platform.OS === 'ios') setDismissing(true)
  }
  useEffect(() => {
    if (!dismissing) return
    const timer = setTimeout(() => setDismissing(false), MODAL_DISMISS_FALLBACK_MS)
    return () => clearTimeout(timer)
  }, [dismissing])
  const modalVisible = fullScreen && !dismissing

  const renderCard = (large: boolean) => activeQuestion
    ? (
      <QuestionCard
        block={activeQuestion}
        onSelect={handleStructuredSelect}
        onSubmitMulti={handleStructuredSubmitMulti}
        busy={answerBusy}
        ghost={ghost}
        onCancel={onCancelQuestion}
        large={large}
      />
    )
    : questionBlock
      ? (
        <QuestionCard
          block={questionBlock}
          onSelect={handleOptionSelect}
          onCancel={onSendKeys ? () => onSendKeys('\x1b') : undefined}
          large={large}
        />
      )
      : null

  const modal = (
    <Modal
      visible={modalVisible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={() => setMinimizedKey(promptKey)}
      onDismiss={() => setDismissing(false)}
    >
      {/* A Modal is its own native window: without a provider the insets read 0 and the header sits under the status bar. */}
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <SafeAreaView style={styles.fullScreen} edges={['top', 'bottom']} testID="question-fullscreen">
        <View style={styles.fullScreenHeader}>
          <Question size={18} color={theme.text.accent} weight="bold" />
          <Text style={styles.fullScreenTitle}>{tc('question.waiting')}</Text>
          <TouchableOpacity
            onPress={() => setMinimizedKey(promptKey)}
            style={styles.headerButton}
            accessibilityRole="button"
            accessibilityLabel={tc('question.minimize')}
            testID="question-fullscreen-minimize"
          >
            <CaretDown size={20} color={theme.text.secondary} weight="bold" />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.fullScreenBody}>
          {renderCard(true)}
        </ScrollView>
      </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  )

  // Once a card is showing, hide the live-terminal text + dots entirely and
  // show only the card — the raw TUI frame is exactly what the card replaces.
  if (hasCard) {
    return (
      <Animated.View style={[styles.cardWrapper, { opacity }]} testID="thinking-bubble">
        {modal}
        {modalVisible ? null : (
          <>
            {!ghost ? (
              <TouchableOpacity
                onPress={() => setMinimizedKey(null)}
                style={styles.expandRow}
                accessibilityRole="button"
                accessibilityLabel={tc('question.openFullScreen')}
                testID="question-open-fullscreen"
              >
                <ArrowsOut size={14} color={theme.text.secondary} />
                <Text style={styles.expandText}>{tc('question.openFullScreen')}</Text>
              </TouchableOpacity>
            ) : null}
            {renderCard(false)}
          </>
        )}
      </Animated.View>
    )
  }

  // The Knight Rider scanner is the working cue, not the server phase. Claude
  // never emits a `subStatus` (the streamer stubs it to null), so gating the
  // bubble on a phase hid the indicator for every Claude turn. The footer only
  // mounts while the turn is live (or fading out), so a mounted bubble without a
  // card already means "the agent is working" — render it regardless of phase.
  const workingLabel = subStatus ? getAgentPhaseLabel(subStatus, t) : t('phase.working')

  return (
    <Animated.View style={[styles.wrapper, { opacity }]} testID="thinking-bubble">
      {modal}
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
          {subStatus ? <Text style={styles.phase}>{workingLabel}</Text> : null}
          <KnightRiderScanner testID="thinking-scanner" accessibilityLabel={workingLabel} />
        </View>
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
    fullScreen: {
      flex: 1,
      backgroundColor: theme.bg.primary,
    },
    fullScreenHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingStart: spacing.md,
      paddingEnd: spacing.xs,
      paddingVertical: spacing.xs,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    fullScreenTitle: {
      flex: 1,
      fontSize: font.sm,
      fontWeight: '600',
      color: theme.text.primary,
    },
    headerButton: {
      padding: spacing.sm,
    },
    fullScreenBody: {
      flexGrow: 1,
      paddingBottom: spacing.xl,
    },
    expandRow: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-end',
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    expandText: {
      fontSize: font.xs,
      color: theme.text.secondary,
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
  })
}
