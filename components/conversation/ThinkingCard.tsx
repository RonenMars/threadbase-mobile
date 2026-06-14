import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useRecyclingState } from '@shopify/flash-list'
import { font, radius, spacing, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import type { MessageContent } from '@/types/api'

type ThinkingBlock = Extract<MessageContent, { type: 'thinking' }>

interface Props {
  block: ThinkingBlock
  /** Stable per-cell key — reset recycled `expanded` state when the cell is reassigned. */
  recycleKey?: string
}

export function ThinkingCard({ block, recycleKey }: Props) {
  const { t } = useTranslation('conversation')
  const theme = useTheme()
  const styles = makeStyles(theme)
  const [expanded, setExpanded] = useRecyclingState(false, [recycleKey])
  const isRedacted = !block.thinking && !!block.signature

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setExpanded((v) => !v)}
        accessibilityLabel={expanded ? 'Collapse reasoning' : 'Expand reasoning'}
      >
        <Text style={styles.label}>{t('thinking.label')}</Text>
        <Text style={styles.chevron}>{expanded ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {expanded ? (
        <View style={styles.body}>
          {isRedacted ? (
            <Text style={styles.redacted}>{t('thinking.redacted')}</Text>
          ) : (
            <Text style={styles.content}>{block.thinking}</Text>
          )}
        </View>
      ) : null}
    </View>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.bg.card,
      overflow: 'hidden',
      marginVertical: spacing.xs,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    label: {
      color: theme.text.secondary,
      fontSize: font.sm,
      fontWeight: '600',
    },
    chevron: {
      color: theme.text.secondary,
      fontSize: font.xs,
    },
    body: {
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.sm,
    },
    content: {
      color: theme.text.secondary,
      fontSize: font.sm,
      lineHeight: font.sm * 1.5,
    },
    redacted: {
      color: theme.text.secondary,
      fontSize: font.sm,
      fontStyle: 'italic',
    },
  })
}
