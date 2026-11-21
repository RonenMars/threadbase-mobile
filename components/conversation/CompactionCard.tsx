import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useRecyclingState } from '@shopify/flash-list'
import { font, radius, spacing, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { parseMarkdownFor } from '@/lib/markdown'
import { ChatMarkdown } from '@/components/conversation/ChatMarkdown'
import type { Message } from '@/types/api'

interface Props {
  message: Message
  /** Stable per-cell key — reset recycled `expanded` state when the cell is reassigned. */
  recycleKey?: string
}

const kTokens = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(n))

/**
 * Claude Code's compaction summary. The transcript stores it as a `type: user`
 * row, but the human never typed it, so it renders as a collapsed system card
 * (as Claude Code's own UI does) rather than a user bubble.
 */
export function CompactionCard({ message, recycleKey }: Props) {
  const { t } = useTranslation('conversation')
  const styles = makeStyles(useTheme())
  const [expanded, setExpanded] = useRecyclingState(false, [recycleKey])
  const { trigger, preTokens, postTokens } = message.compaction ?? {}
  const parts = [
    trigger === 'auto' ? t('compaction.auto') : trigger === 'manual' ? t('compaction.manual') : null,
    preTokens != null && postTokens != null
      ? t('compaction.tokens', { pre: kTokens(preTokens), post: kTokens(postTokens) })
      : null,
  ].filter(Boolean)

  return (
    <View style={styles.container} testID="compaction-card">
      <TouchableOpacity
        testID="compaction-card-toggle"
        style={styles.header}
        onPress={() => setExpanded((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={expanded ? t('compaction.collapse') : t('compaction.expand')}
      >
        <View style={styles.titleCol}>
          <Text style={styles.label}>{t('compaction.label')}</Text>
          {parts.length ? <Text style={styles.stats}>{parts.join(' · ')}</Text> : null}
        </View>
        <Text style={styles.chevron}>{expanded ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {expanded ? (
        <View style={styles.body}>
          {message.content.map((block, i) =>
            block.type === 'text' ? <ChatMarkdown key={i} blocks={parseMarkdownFor(block, block.text)} /> : null,
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
      borderStyle: 'dashed',
      borderColor: theme.border,
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
    titleCol: { flexShrink: 1, gap: 2 },
    label: { color: theme.text.secondary, fontSize: font.sm, fontWeight: '600' },
    stats: { color: theme.text.secondary, fontSize: font.xs },
    chevron: { color: theme.text.secondary, fontSize: font.xs },
    body: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  })
}
