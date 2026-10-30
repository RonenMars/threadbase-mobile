import React, { useMemo, useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { X } from 'phosphor-react-native'
import { pathDisplay } from '@/components/sessions/shared/pathDisplay'
import { font, spacing, TABLET_BREAKPOINT, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { useReduceMotion } from '@/hooks/useAccessibilitySettings'
import { useSessionActions } from '@/hooks/useSessionActions'
import { boardQuestions, isAnswerableOnBoard, openPrompts, promptResponses } from '@/lib/boardPrompts'
import { layoutDirectionStyle, ltrContentStyle, useAppDirection } from '@/lib/rtl'
import { isPromptClosedError, isPromptStaleError } from '@/services/api-client'
import { generateUUID } from '@/services/device-id'
import type { MultiSession, Prompt } from '@/types/api'

interface Props {
  session: MultiSession
  title: string
  onClose: () => void
  /** A reply landed or the prompt has moved on: the list's `pendingPrompts` are out of date. */
  onPromptsChanged: () => void
}

type Notice = 'closed' | 'stale' | 'failed'

/** Every open question of one session. Closing it answers nothing, so the session stays in Needs you. */
export function BoardQuestionModal({ session, title, onClose, onPromptsChanged }: Props) {
  const { t } = useTranslation('sessions')
  const { t: tTerminal } = useTranslation('terminal')
  const theme = useTheme()
  const styles = useMemo(() => makeStyles(theme), [theme])
  const { width } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const reduceMotion = useReduceMotion()
  const { direction } = useAppDirection()
  const { answerPrompt } = useSessionActions(session.serverId, session.id)
  const [sent, setSent] = useState<ReadonlySet<string>>(new Set())
  const [chosen, setChosen] = useState<Record<string, Record<string, string>>>({})
  const [notice, setNotice] = useState<Notice | null>(null)

  const prompts = openPrompts(session).filter((p) => !sent.has(p.promptId))
  const questions = boardQuestions(prompts)
  const wide = width >= TABLET_BREAKPOINT
  const project = pathDisplay(session.projectPath, { mode: 'smart' }).suffix

  const markSent = (promptId: string) => {
    const next = new Set(sent).add(promptId)
    setSent(next)
    if (prompts.every((p) => next.has(p.promptId))) onClose()
  }

  const reply = async (prompt: Prompt, questionId: string, optionId: string) => {
    const picks = { ...chosen[prompt.promptId], [questionId]: optionId }
    setChosen({ ...chosen, [prompt.promptId]: picks })
    const responses = promptResponses(prompt, picks)
    if (!responses) return
    setNotice(null)
    try {
      await answerPrompt.mutateAsync({ promptId: prompt.promptId, revision: prompt.revision, responses, idempotencyKey: generateUUID() })
      markSent(prompt.promptId)
      onPromptsChanged()
    } catch (err) {
      const error = err instanceof Error ? err : null
      if (isPromptClosedError(error)) {
        setNotice('closed')
        onPromptsChanged()
      } else if (isPromptStaleError(error)) {
        setNotice('stale')
        onPromptsChanged()
      } else {
        setNotice('failed')
      }
    }
  }

  const noticeText =
    notice === 'closed' ? tTerminal('answer.questionClosed')
    : notice === 'stale' ? tTerminal('answer.promptChanged')
    : notice === 'failed' ? tTerminal('answer.failed')
    : null

  return (
    <Modal transparent visible animationType={reduceMotion ? 'none' : 'fade'} onRequestClose={onClose} statusBarTranslucent>
      {/* An RN Modal is a new native root: it does not inherit the app root's Yoga direction. */}
      <View style={[styles.scrim, wide && styles.scrimWide, layoutDirectionStyle(direction)]}>
        <View style={[styles.sheet, wide ? styles.sheetWide : { paddingTop: insets.top }]} testID="board-question-modal">
          <View style={styles.header}>
            <View style={styles.headerText}>
              {project ? <Text style={[styles.project, ltrContentStyle]} numberOfLines={1}>{project}</Text> : null}
              <Text style={styles.title} numberOfLines={1}>{title}</Text>
            </View>
            <Pressable
              style={styles.close}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t('boardTab.closeQuestion')}
              testID="board-question-close"
            >
              <X size={20} color={theme.text.primary} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + spacing.md }]}>
            {noticeText ? <Text style={styles.notice} testID="board-question-notice">{noticeText}</Text> : null}
            {questions.map(({ prompt, question }, i) => {
              const answerable = isAnswerableOnBoard(prompt)
              return (
                <View key={`${prompt.promptId}:${question.questionId}`} style={styles.question}>
                  <Text style={styles.counter}>{t('boardTab.questionCount', { current: i + 1, total: questions.length })}</Text>
                  <Text style={styles.questionText}>{question.text}</Text>
                  {prompt.detail && prompt.questions[0] === question ? <Text style={[styles.detail, ltrContentStyle]}>{prompt.detail}</Text> : null}
                  {answerable ? question.options.map((option) => {
                    const picked = chosen[prompt.promptId]?.[question.questionId] === option.optionId
                    return (
                      <Pressable
                        key={option.optionId}
                        style={[styles.option, picked && styles.optionPicked]}
                        disabled={answerPrompt.isPending}
                        onPress={() => void reply(prompt, question.questionId, option.optionId)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: picked, disabled: answerPrompt.isPending }}
                        testID={`board-option-${question.questionId}-${option.optionId}`}
                      >
                        <Text style={styles.optionLabel}>{option.label}</Text>
                        {option.description ? <Text style={styles.optionDescription}>{option.description}</Text> : null}
                      </Pressable>
                    )
                  }) : <Text style={styles.unsupported} testID="board-question-unsupported">{t('boardTab.answerInSession')}</Text>}
                </View>
              )
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
    scrimWide: { alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
    sheet: { flex: 1, backgroundColor: theme.bg.primary },
    sheetWide: { flex: 0, width: 560, maxWidth: '100%', maxHeight: '100%', borderRadius: 14, borderWidth: 1, borderColor: theme.border, overflow: 'hidden' },
    header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 60, paddingStart: spacing.md, paddingEnd: spacing.sm, paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: theme.border },
    headerText: { flex: 1, minWidth: 0, gap: 2 },
    project: { color: theme.text.secondary, fontSize: 12 },
    title: { color: theme.text.primary, fontSize: font.base, fontWeight: '600' },
    close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    body: { padding: spacing.md, gap: spacing.lg },
    notice: { color: theme.status.waiting, fontSize: font.sm },
    question: { gap: spacing.sm },
    counter: { color: theme.text.secondary, fontSize: 12, fontWeight: '600' },
    questionText: { color: theme.text.primary, fontSize: 17, lineHeight: 24, fontWeight: '600' },
    detail: { color: theme.text.secondary, fontSize: font.xs },
    option: { minHeight: 48, justifyContent: 'center', gap: 2, paddingVertical: spacing.sm, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.bg.card },
    optionPicked: { borderColor: theme.text.accent },
    optionLabel: { color: theme.text.primary, fontSize: font.sm, fontWeight: '600' },
    optionDescription: { color: theme.text.secondary, fontSize: font.xs },
    unsupported: { color: theme.text.secondary, fontSize: font.sm },
  })
}
