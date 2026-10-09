import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { font, radius, spacing, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import type { QuestionAnswerItem } from '@/types/api'

interface Props {
  items: QuestionAnswerItem[]
}

/** An answered AskUserQuestion: each question, muted, above the answer given. */
export function QuestionAnswerCard({ items }: Props) {
  const { t } = useTranslation('conversation')
  const theme = useTheme()
  const styles = makeStyles(theme)

  return (
    <View style={styles.card} testID="question-answer-card">
      {items.map((item, i) => (
        <View key={i} style={i > 0 ? styles.itemSpaced : undefined}>
          <Text style={styles.label}>{item.header || t('question.label')}</Text>
          <Text style={styles.question} selectable>{item.question}</Text>
          {item.answer ? <Text style={styles.answer} selectable>{item.answer}</Text> : null}
        </View>
      ))}
    </View>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    card: {
      marginHorizontal: spacing.md,
      marginVertical: spacing.xs,
      padding: spacing.lg,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      backgroundColor: theme.bg.secondary,
    },
    itemSpaced: {
      marginTop: spacing.lg,
      paddingTop: spacing.lg,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.border,
    },
    label: {
      fontSize: font.sm,
      fontWeight: '600',
      color: theme.text.secondary,
      marginBottom: spacing.sm,
    },
    question: {
      fontSize: font.base,
      lineHeight: font.base * 1.45,
      color: theme.text.secondary,
    },
    answer: {
      marginTop: spacing.sm,
      fontSize: font.base,
      lineHeight: font.base * 1.45,
      color: theme.text.primary,
    },
  })
}
