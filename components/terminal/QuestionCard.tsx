import React, { memo, useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import * as Haptics from 'expo-haptics'
import { X } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { spacing } from '@/constants/theme'
import type { QuestionBlock } from '@/utils/parseQuestionBlock'

interface Props {
  block: QuestionBlock
  onSelect: (questionIndex: number, optionIndex: number) => void
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
}

export const QuestionCard = memo(function QuestionCard({ block, onSelect, onCancel, busy = false, ghost = false }: Props) {
  const { t } = useTranslation('common')
  const q = block.questions[0]
  // Structured questions arrive unselected; PTY scrape carries the ❯ cursor row.
  const initialSelected = block.source === 'pty' ? block.selectedIndex ?? null : null
  const [selected, setSelected] = useState<number | null>(initialSelected)

  // PTY blocks update in place as the terminal cursor moves, so they resync
  // instead of resetting. Every other source arrives unselected, and the next
  // prompt re-renders this same mounted card rather than a fresh one, so the
  // previous answer's highlight has to be dropped by hand. Keyed on the prompt's
  // content, not on the block object: a repaint is a new object carrying the same
  // prompt, and must not wipe a selection the user just made.
  const promptKey = `${q.question} ${q.options.map(o => o.label).join(' ')}`
  const ptyCursor = block.source === 'pty' ? block.selectedIndex ?? null : null
  useEffect(() => {
    setSelected(ptyCursor)
  }, [promptKey, ptyCursor])

  const locked = busy || ghost

  const handlePress = (index: number) => {
    // The rows disable themselves too; this is the guard that survives a row
    // being rendered without that. See ChatComposer's second send button for
    // why that is worth the line.
    if (locked) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setSelected(index)
    onSelect(0, index)
  }

  return (
    <View style={[styles.container, ghost && styles.ghost]} testID={ghost ? 'question-card-ghost' : 'question-card'}>
      {onCancel && !ghost ? (
        <TouchableOpacity
          style={styles.closeButton}
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel={t('button.cancel')}
        >
          <X size={16} color="#8b949e" />
        </TouchableOpacity>
      ) : null}
      {q.header ? <Text style={styles.header}>{q.header}</Text> : null}
      {q.detail ? <Text style={styles.detail}>{q.detail}</Text> : null}
      <Text style={styles.question}>{q.question}</Text>
      {q.options.map((option, index) => (
        <TouchableOpacity
          key={index}
          style={[styles.option, index === selected && styles.optionSelected]}
          onPress={() => handlePress(index)}
          disabled={locked}
          accessibilityRole="button"
          accessibilityState={{ disabled: locked, selected: index === selected }}
          accessibilityLabel={option.label}
        >
          <View style={[styles.radioOuter, index === selected && styles.radioOuterSelected]}>
            {index === selected && <View style={styles.radioInner} />}
          </View>
          <View style={styles.optionBody}>
            <Text style={[styles.optionText, index === selected && styles.optionTextSelected]}>
              {option.label}
            </Text>
            {option.description ? (
              <Text style={styles.optionDescription}>{option.description}</Text>
            ) : null}
            {option.preview ? <Text style={styles.preview}>{option.preview}</Text> : null}
          </View>
        </TouchableOpacity>
      ))}
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

const styles = StyleSheet.create({
  ghost: {
    opacity: 0.55,
  },
  ghostNote: {
    color: '#8b949e',
    fontSize: 12,
    marginTop: spacing.sm,
  },
  container: {
    borderTopWidth: 1,
    borderTopColor: '#21262d',
    backgroundColor: '#0d1117',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  closeButton: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.md,
    zIndex: 1,
    padding: 4,
  },
  header: {
    color: '#58a6ff',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  detail: {
    fontFamily: 'monospace',
    color: '#8b949e',
    fontSize: 12,
    lineHeight: 16,
    marginBottom: spacing.sm,
  },
  question: {
    color: '#e6edf3',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: spacing.sm,
    lineHeight: 18,
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
    backgroundColor: 'rgba(31, 111, 235, 0.12)',
  },
  radioOuter: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#484f58',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  radioOuterSelected: {
    borderColor: '#58a6ff',
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#58a6ff',
  },
  optionBody: {
    flex: 1,
    // Allow the text to wrap instead of overflowing past the screen edge — a
    // flex child won't shrink below its content width without an explicit basis.
    flexShrink: 1,
    minWidth: 0,
  },
  optionText: {
    color: '#8b949e',
    fontSize: 13,
    lineHeight: 18,
  },
  optionTextSelected: {
    color: '#e6edf3',
    fontWeight: '500',
  },
  optionDescription: {
    color: '#6e7681',
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  preview: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#8b949e',
    marginTop: 4,
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 8,
    marginTop: 4,
  },
  cancelText: {
    color: '#8b949e',
    fontSize: 13,
  },
})
