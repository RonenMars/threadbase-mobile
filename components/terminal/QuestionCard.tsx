import React, { memo, useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import * as Haptics from 'expo-haptics'
import { spacing } from '@/constants/theme'
import type { QuestionBlock } from '@/utils/parseQuestionBlock'

interface Props {
  block: QuestionBlock
  onSelect: (questionIndex: number, optionIndex: number) => void
}

export const QuestionCard = memo(function QuestionCard({ block, onSelect }: Props) {
  const q = block.questions[0]
  // Structured questions arrive unselected; PTY scrape carries the ❯ cursor row.
  const initialSelected = block.source === 'pty' ? block.selectedIndex ?? null : null
  const [selected, setSelected] = useState<number | null>(initialSelected)

  // PTY blocks update in place as the terminal cursor moves — resync the highlight.
  useEffect(() => {
    if (block.source === 'pty') setSelected(block.selectedIndex ?? null)
  }, [block.source, block.selectedIndex])

  const handlePress = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setSelected(index)
    onSelect(0, index)
  }

  return (
    <View style={styles.container}>
      {q.header ? <Text style={styles.header}>{q.header}</Text> : null}
      {q.detail ? <Text style={styles.detail}>{q.detail}</Text> : null}
      <Text style={styles.question}>{q.question}</Text>
      {q.options.map((option, index) => (
        <TouchableOpacity
          key={index}
          style={[styles.option, index === selected && styles.optionSelected]}
          onPress={() => handlePress(index)}
          accessibilityRole="button"
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
    </View>
  )
})

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    borderTopColor: '#21262d',
    backgroundColor: '#0d1117',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
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
})
