import React, { useCallback, useMemo, useState } from 'react'
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { CaretDown, CaretRight } from 'phosphor-react-native'
import { useTheme } from '@/contexts/ThemeContext'
import { font, spacing, type Theme } from '@/constants/theme'
import { useSubagents } from '@/hooks/useSubagents'
import { conversationHref } from '@/lib/conversationHref'
import { resolveSubagentLabel, resolveSubagentType } from '@/lib/subagents'
import { getProviderLabel } from '@/components/sessions/providerLabel'
import { formatListTime } from '@/components/sessions/shared/formatListTime'
import type { Conversation } from '@/types/api'

interface Props {
  serverId: string
  parentId: string
}

/**
 * Collapsed by default; children are requested only after the first expand.
 * Rows are read-only transcripts: no status badge, no resume, no input.
 */
export function SubagentSection({ serverId, parentId }: Props) {
  const { t } = useTranslation('sessions')
  const theme = useTheme()
  const styles = useMemo(() => makeStyles(theme), [theme])
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)
  const { items, isLoading, unsupported, isError, hasNextPage, fetchNextPage, isFetchingNextPage, refetch } =
    useSubagents(serverId, parentId, { enabled: expanded })

  const toggle = useCallback(() => {
    if (expanded) setExpanded(false)
    else {
      setExpanded(true)
      if (items.length > 0) void refetch()
    }
  }, [expanded, items.length, refetch])

  const open = useCallback(
    (child: Conversation) => router.push(conversationHref(child.id, serverId)),
    [router, serverId],
  )

  const Caret = expanded ? CaretDown : CaretRight
  const header = expanded && !isLoading && !unsupported && !isError
    ? t('subagents.titleCount', { n: items.length })
    : t('subagents.title')

  let body: React.ReactNode = null
  if (expanded) {
    if (isLoading) body = <ActivityIndicator color={theme.text.secondary} style={styles.pad} />
    else if (unsupported) body = <Text style={[styles.note, styles.pad]}>{t('subagents.unsupported')}</Text>
    else if (isError) body = <Text style={[styles.note, styles.pad]}>{t('subagents.loadFailed')}</Text>
    else if (items.length === 0) body = <Text style={[styles.note, styles.pad]}>{t('subagents.empty')}</Text>
    else {
      body = (
        <>
          {items.map((c) => {
            const type = resolveSubagentType(c)
            return (
              <Pressable
                key={c.id}
                style={styles.row}
                onPress={() => open(c)}
                testID={`subagent-row-${c.id}`}
              >
                <View style={styles.rowTop}>
                  {c.subagentActive === true ? (
                    <View style={styles.activeDot} testID={`subagent-active-${c.id}`} accessibilityLabel={t('subagents.active')} />
                  ) : null}
                  <Text style={styles.label} numberOfLines={1}>
                    {resolveSubagentLabel(c)}
                  </Text>
                  {type ? <Text style={styles.tag}>{type}</Text> : null}
                </View>
                <Text style={styles.meta} numberOfLines={1}>
                  {[
                    getProviderLabel(c.provider, t),
                    t('card.messages', { count: c.messageCount }),
                    formatListTime(c.lastActivity),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </Pressable>
            )
          })}
          {hasNextPage ? (
            <Pressable onPress={() => void fetchNextPage()} disabled={isFetchingNextPage} style={styles.pad}>
              <Text style={styles.more}>{t('subagents.loadMore')}</Text>
            </Pressable>
          ) : null}
        </>
      )
    }
  }

  return (
    <View style={styles.wrap} testID="subagent-section">
      <Pressable
        onPress={toggle}
        style={styles.header}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        testID="subagent-toggle"
      >
        <Caret size={14} weight="bold" color={theme.text.secondary} />
        <Text style={styles.headerText}>{header}</Text>
      </Pressable>
      {body}
    </View>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    wrap: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.bg.card },
    header: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
    headerText: { color: theme.text.secondary, fontSize: font.xs, fontWeight: '600' },
    pad: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
    note: { color: theme.text.secondary, fontSize: font.xs },
    row: { paddingVertical: spacing.xs + 2, paddingStart: spacing.lg + spacing.md, paddingEnd: spacing.md, gap: 2 },
    rowTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 },
    label: { flexShrink: 1, color: theme.text.primary, fontSize: font.sm, fontWeight: '600' },
    tag: {
      color: theme.text.secondary,
      fontSize: font.xs - 1,
      backgroundColor: theme.bg.card,
      borderRadius: 4,
      paddingHorizontal: 5,
      overflow: 'hidden',
    },
    meta: { color: theme.text.secondary, fontSize: font.xs },
    more: { color: theme.text.accent, fontSize: font.xs, fontWeight: '600' },
    activeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: theme.text.accent },
  })
}
