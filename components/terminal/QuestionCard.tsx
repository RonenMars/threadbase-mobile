import React, { memo, useEffect, useRef, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, type GestureResponderEvent } from 'react-native'
import * as Haptics from 'expo-haptics'
import { CheckSquare, Square, X } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { font, spacing, type Theme } from '@/constants/theme'
import { useThemedStyles } from '@/hooks/useThemedStyles'
import type { RtlStyleKit } from '@/lib/rtl'
import type { QuestionBlock, QuestionOption } from '@/utils/parseQuestionBlock'

// A touch that travels further than this between press-in and lift is a scroll,
// not an answer. Deliberately tighter than UIKit's ~10pt tap slop: a cancelled
// tap costs one more tap, a committed drag costs an unintended permission grant.
const DRAG_CANCEL_PX = 8

// A screen-read card lists Claude's own "Type something" and "Chat about this"
// rows beside the model's options. A current streamer marks them `terminalRow`;
// an older one sent no marker, so the fixed English text (the terminal UI is
// not localised) still identifies them there. A structured card never shows
// them as plain options: the app draws its own pair when the host offers it.
const TERMINAL_ONLY_ROW_RE = /^(?:type something\.?|chat about this)$/i
const isTerminalRow = (option: QuestionOption) =>
  option.terminalRow !== undefined || TERMINAL_ONLY_ROW_RE.test(option.label.trim())

interface Props {
  block: QuestionBlock
  onSelect: (questionIndex: number, optionIndex: number) => void
  /** Multi-select form submit: indexes into the question's options, in on-screen order. */
  onSubmitMulti?: (questionIndex: number, optionIndexes: number[]) => void
  /** Dismiss this prompt without answering (sends Esc, same as the stop-response action). */
  onCancel?: () => void
  /** An answer is in flight. Locks the rows so a double-tap cannot send twice. */
  busy?: boolean
  /**
   * The answer was taken but the gate has not been seen closing yet. The card
   * stays on screen, dimmed and inert, showing what was chosen — it blocks
   * nothing, so an answer the server never confirms costs the user nothing.
   */
  ghost?: boolean
  /** Full-screen presentation: borderless, with larger question and option text. */
  large?: boolean
  /**
   * "Type something." answer. With onChatAbout, the host's sign that the server
   * answers both terminal rows; the card then draws them on a single-select,
   * single-question structured card.
   */
  onSubmitOther?: (questionIndex: number, text: string) => void
  /** "Chat about this": sent at once, like any other option. */
  onChatAbout?: (questionIndex: number) => void
}

export const QuestionCard = memo(function QuestionCard({ block, onSelect, onSubmitMulti, onCancel, busy = false, ghost = false, large = false, onSubmitOther, onChatAbout }: Props) {
  const { t } = useTranslation('common')
  const { styles, theme } = useThemedStyles(makeStyles)
  const q = block.questions[0]
  // Structured questions arrive unselected; PTY scrape and permission gates carry the cursor row.
  const cursorRow = block.source === 'pty' || block.source === 'permission' ? block.selectedIndex ?? null : null
  const initialSelected = cursorRow
  const [selected, setSelected] = useState<number | null>(initialSelected)
  const [checked, setChecked] = useState<number[]>([])
  // Which of the app's terminal rows is chosen: 'other' also means its input is open.
  const [terminalChoice, setTerminalChoice] = useState<'other' | 'chat' | null>(null)
  const [draft, setDraft] = useState('')

  // PTY blocks update in place as the terminal cursor moves, so they resync
  // instead of resetting. Every other source arrives unselected, and the next
  // prompt re-renders this same mounted card rather than a fresh one, so the
  // previous answer's highlight has to be dropped by hand. Keyed on the prompt's
  // content, not on the block object: a repaint is a new object carrying the same
  // prompt, and must not wipe a selection the user just made. A permission gate's
  // cursor only seeds a new prompt; unlike the PTY cursor it is not re-applied when
  // it moves, because the gate re-broadcasts after the user's own tap.
  const promptKey = `${q.question} ${q.options.map(o => o.label).join(' ')}`
  const ptyCursor = block.source === 'pty' ? cursorRow : null
  useEffect(() => {
    setSelected(cursorRow)
    setChecked([])
    setTerminalChoice(null)
    setDraft('')
  // eslint-disable-next-line react-hooks/exhaustive-deps -- cursorRow reseeds on a new prompt only (see above)
  }, [promptKey, ptyCursor])

  const locked = busy || ghost
  const structuredMulti = block.source === 'structured' && q.multiSelect
  // An unreadable checkbox marker is refused by the streamer
  // (400 unsupported_prompt_shape), so a form would only fail.
  const readOnly = structuredMulti && Boolean(q.multiSelectUnverified)
  const multiForm = structuredMulti && !readOnly
  const listedOptions = q.options
    .map((option, index) => ({ option, index }))
    .filter(({ option }) => block.source !== 'structured' || !isTerminalRow(option))
  const offerTerminalRows = block.source === 'structured' && !q.multiSelect && block.questions.length === 1 &&
    !block.unsupportedShape && onSubmitOther !== undefined && onChatAbout !== undefined

  const pressStartY = useRef<number | null>(null)

  const draggedAway = (e?: GestureResponderEvent) => {
    // TouchableOpacity's cancel-on-movement is conditional, not guaranteed:
    // `onResponderMove` early-returns while Pressability's `_responderRegion`
    // is still null (Pressability.js), and that region comes from an
    // async measure that is never retried after a zero-sized result.
    // Until it lands, a touch that travels the length of the card still commits
    // on lift — an accidental approval on a permission prompt. Re-check the
    // distance here, where nothing can be pending.
    //
    // An accessibility activation arrives through `onClick` with no press-in and
    // no `pageY`; it must still answer, so an unknown
    // start or end position allows the press through.
    const startY = pressStartY.current
    pressStartY.current = null
    const endY = e?.nativeEvent?.pageY
    return startY != null && typeof endY === 'number' && Math.abs(endY - startY) > DRAG_CANCEL_PX
  }

  const handlePress = (index: number, e?: GestureResponderEvent) => {
    // The rows disable themselves too; this is the guard that survives a row
    // being rendered without that. See ChatComposer's second send button for
    // why that is worth the line.
    if (locked || draggedAway(e)) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setSelected(index)
    setTerminalChoice(null)
    setDraft('')
    onSelect(0, index)
  }

  // Opening the input sends nothing: on the terminal, the cursor on this row
  // is already the text field, and Enter on it empty declines the question.
  const handleToggleOther = (e?: GestureResponderEvent) => {
    if (locked || draggedAway(e)) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setSelected(null)
    setTerminalChoice(prev => (prev === 'other' ? null : 'other'))
  }

  const handleChatAbout = (e?: GestureResponderEvent) => {
    if (locked || draggedAway(e)) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setSelected(null)
    setTerminalChoice('chat')
    onChatAbout?.(0)
  }

  const canSendOther = !locked && draft.trim().length > 0

  const handleSendOther = () => {
    if (!canSendOther) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onSubmitOther?.(0, draft)
  }

  const radioRow = (
    key: string | number,
    label: string,
    isSelected: boolean,
    onPress: (e: GestureResponderEvent) => void,
    option?: QuestionOption,
  ) => (
    <TouchableOpacity
      key={key}
      style={[styles.option, isSelected && styles.optionSelected]}
      onPressIn={(e) => { pressStartY.current = e.nativeEvent.pageY }}
      onPress={onPress}
      disabled={locked}
      accessibilityRole="button"
      accessibilityState={{ disabled: locked, selected: isSelected }}
      accessibilityLabel={label}
    >
      <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
        {isSelected && <View style={styles.radioInner} />}
      </View>
      <View style={styles.optionBody}>
        <Text style={[styles.optionText, large && styles.optionTextLarge, isSelected && styles.optionTextSelected]}>
          {label}
        </Text>
        {option?.description ? (
          <Text style={styles.optionDescription}>{option.description}</Text>
        ) : null}
        {option?.preview ? <Text style={styles.preview}>{option.preview}</Text> : null}
      </View>
    </TouchableOpacity>
  )

  const handleToggle = (index: number) => {
    if (locked) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setChecked(prev => (prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]))
  }

  const canSubmit = !locked && checked.length > 0

  const handleSubmit = () => {
    if (!canSubmit) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onSubmitMulti?.(0, [...checked].sort((a, b) => a - b))
  }

  return (
    <View style={[styles.container, large && styles.containerLarge, ghost && styles.ghost]} testID={ghost ? 'question-card-ghost' : 'question-card'}>
      {onCancel && !ghost ? (
        <TouchableOpacity
          style={styles.closeButton}
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel={t('button.cancel')}
        >
          <X size={16} color={theme.text.secondary} />
        </TouchableOpacity>
      ) : null}
      {/* An unsupported form has no tappable rows, so showing all its questions costs nothing and says what the terminal is asking. */}
      {(block.unsupportedShape ? block.questions : [q]).map((item, index) => (
        <React.Fragment key={index}>
          {item.header ? <Text style={styles.header}>{item.header}</Text> : null}
          {item.detail ? <Text style={styles.detail}>{item.detail}</Text> : null}
          <Text style={[styles.question, large && styles.questionLarge]}>{item.question}</Text>
        </React.Fragment>
      ))}
      {multiForm ? listedOptions.map(({ option, index }) => {
        const isChecked = checked.includes(index)
        const BoxIcon = isChecked ? CheckSquare : Square
        return (
          <TouchableOpacity
            key={index}
            style={[styles.option, isChecked && styles.optionSelected]}
            onPress={() => handleToggle(index)}
            disabled={locked}
            accessibilityRole="checkbox"
            accessibilityState={{ disabled: locked, checked: isChecked }}
            accessibilityLabel={option.label}
          >
            <BoxIcon size={18} color={isChecked ? '#58a6ff' : '#484f58'} weight={isChecked ? 'fill' : 'regular'} />
            <View style={styles.optionBody}>
              <Text style={[styles.optionText, large && styles.optionTextLarge, isChecked && styles.optionTextSelected]}>
                {option.label}
              </Text>
              {option.description ? (
                <Text style={styles.optionDescription}>{option.description}</Text>
              ) : null}
              {option.preview ? <Text style={styles.preview}>{option.preview}</Text> : null}
            </View>
          </TouchableOpacity>
        )
      }) : listedOptions.map(({ option, index }) => readOnly ? (
        <View key={index} style={styles.option}>
          <View style={styles.optionBody}>
            <Text style={[styles.optionText, large && styles.optionTextLarge]}>{option.label}</Text>
            {option.description ? (
              <Text style={styles.optionDescription}>{option.description}</Text>
            ) : null}
            {option.preview ? <Text style={styles.preview}>{option.preview}</Text> : null}
          </View>
        </View>
      ) : radioRow(index, option.label, index === selected, (e) => handlePress(index, e), option))}
      {offerTerminalRows ? (
        <>
          {radioRow('other', t('question.typeSomething'), terminalChoice === 'other', handleToggleOther)}
          {terminalChoice === 'other' ? (
            <View style={styles.otherArea}>
              <TextInput
                testID="question-other-input"
                style={[styles.otherInput, locked && styles.otherInputLocked]}
                value={draft}
                onChangeText={setDraft}
                editable={!locked}
                multiline
                autoFocus
                placeholder={t('question.otherPlaceholder')}
                placeholderTextColor={theme.text.secondary}
                accessibilityLabel={t('question.otherPlaceholder')}
              />
              <View style={styles.otherActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => { if (!locked) setTerminalChoice(null) }}
                  disabled={locked}
                  accessibilityRole="button"
                  accessibilityLabel={t('button.back')}
                >
                  <Text style={styles.cancelText}>{t('button.back')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.submitButton, styles.otherSend, !canSendOther && styles.submitButtonDisabled]}
                  onPress={handleSendOther}
                  disabled={!canSendOther}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !canSendOther }}
                  accessibilityLabel={t('question.send')}
                >
                  <Text style={styles.submitText}>{t('question.send')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
          {radioRow('chat', t('question.chatAboutThis'), terminalChoice === 'chat', handleChatAbout)}
        </>
      ) : null}
      {multiForm ? (
        <TouchableOpacity
          style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSubmit }}
          accessibilityLabel={t('question.submit')}
        >
          <Text style={styles.submitText}>{t('question.submit')}</Text>
        </TouchableOpacity>
      ) : null}
      {block.unsupportedShape || readOnly ? (
        <Text style={styles.unsupported} testID="question-card-unsupported">{t('question.unsupportedShape')}</Text>
      ) : null}
      {ghost ? <Text style={styles.ghostNote}>{t('question.answerSent')}</Text> : null}
      {onCancel && !ghost ? (
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel={t('button.cancel')}
        >
          <Text style={styles.cancelText}>{t('button.cancel')}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  )
})

function makeStyles(theme: Theme, rtl: RtlStyleKit) {
  return StyleSheet.create({
  ghost: {
    opacity: 0.55,
  },
  ghostNote: {
    color: theme.text.secondary,
    fontSize: 12,
    marginTop: spacing.sm,
    ...rtl.copy,
  },
  unsupported: {
    color: theme.text.warning,
    fontSize: 12,
    lineHeight: 16,
    marginBottom: spacing.sm,
    ...rtl.copy,
  },
  container: {
    borderTopWidth: 1,
    borderTopColor: theme.bg.card,
    backgroundColor: theme.bg.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  containerLarge: {
    borderTopWidth: 0,
    paddingVertical: spacing.md,
  },
  questionLarge: {
    fontSize: 17,
    lineHeight: 24,
    marginBottom: spacing.md,
  },
  optionTextLarge: {
    fontSize: 15,
    lineHeight: 21,
  },
  closeButton: {
    position: 'absolute',
    top: spacing.sm,
    end: spacing.md,
    zIndex: 1,
    padding: 4,
  },
  header: {
    color: theme.text.accent,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
    ...rtl.copy,
  },
  detail: {
    ...rtl.ltr,
    fontFamily: 'monospace',
    color: theme.text.secondary,
    fontSize: 12,
    lineHeight: 16,
    marginBottom: spacing.sm,
  },
  question: {
    color: theme.text.primary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: spacing.sm,
    lineHeight: 18,
    ...rtl.copy,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: spacing.sm,
    borderRadius: 8,
    marginBottom: 4,
    gap: 10,
  },
  optionSelected: {
    backgroundColor: `${theme.text.accent}1f`,
  },
  radioOuter: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: theme.text.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  radioOuterSelected: {
    borderColor: theme.text.accent,
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.text.accent,
  },
  optionBody: {
    flex: 1,
    // Allow the text to wrap instead of overflowing past the screen edge — a
    // flex child won't shrink below its content width without an explicit basis.
    flexShrink: 1,
    minWidth: 0,
  },
  optionText: {
    color: theme.text.secondary,
    fontSize: 13,
    lineHeight: 18,
    ...rtl.copy,
  },
  optionTextSelected: {
    color: theme.text.primary,
    fontWeight: '500',
  },
  optionDescription: {
    color: theme.status.idle,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  preview: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: theme.text.secondary,
    marginTop: 4,
  },
  submitButton: {
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 4,
    borderRadius: 8,
    backgroundColor: '#1f6feb',
  },
  submitButtonDisabled: {
    opacity: 0.4,
  },
  submitText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
    ...rtl.copy,
  },
  // Same field as the chat composer's input.
  otherInput: {
    backgroundColor: theme.bg.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
    color: theme.text.primary,
    fontSize: font.base,
    padding: spacing.sm,
    minHeight: 44,
    maxHeight: 160,
    ...rtl.copy,
  },
  otherInputLocked: {
    opacity: 0.6,
  },
  otherArea: {
    marginBottom: 4,
  },
  otherActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  otherSend: {
    paddingHorizontal: spacing.md,
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 8,
    marginTop: 4,
  },
  cancelText: {
    color: theme.text.secondary,
    fontSize: 13,
    ...rtl.copy,
  },
  })
}
