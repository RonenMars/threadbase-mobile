import React, { memo } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import * as Haptics from 'expo-haptics'
import { spacing } from '@/constants/theme'
import type { QuestionBlock } from '@/utils/parseQuestionBlock'

interface Props {
  block: QuestionBlock
  onSelect: (optionText: string) => void
}

export const QuestionCard = memo(function QuestionCard({ block, onSelect }: Props) {
  const handlePress = (optionText: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onSelect(optionText)
  }

  return (
    <View style={styles.container}>
      <Text style={styles.question}>{block.questionText}</Text>
      {block.options.map((option, index) => (
        <TouchableOpacity
          key={index}
          style={[styles.option, index === block.selectedIndex && styles.optionSelected]}
          onPress={() => handlePress(option)}
          accessibilityRole="button"
          accessibilityLabel={option}
        >
          <View style={[styles.radioOuter, index === block.selectedIndex && styles.radioOuterSelected]}>
            {index === block.selectedIndex && <View style={styles.radioInner} />}
          </View>
          <Text style={[styles.optionText, index === block.selectedIndex && styles.optionTextSelected]}>
            {option}
          </Text>
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
  question: {
    color: '#e6edf3',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: spacing.sm,
    lineHeight: 18,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
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
  optionText: {
    color: '#8b949e',
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  optionTextSelected: {
    color: '#e6edf3',
    fontWeight: '500',
  },
})
