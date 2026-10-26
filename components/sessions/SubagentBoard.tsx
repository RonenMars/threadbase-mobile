import React, { useCallback, useMemo, useState } from 'react'
import { View, Text, Pressable, ScrollView, RefreshControl, StyleSheet, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { CaretRight } from 'phosphor-react-native'
import { useTheme } from '@/contexts/ThemeContext'
import { font, spacing, type Theme } from '@/constants/theme'
import { useAllSubagents, type BoardSubagent } from '@/hooks/useAllSubagents'
import { conversationHref } from '@/lib/conversationHref'
import { groupSubagentsByParent, resolveSubagentLabel, resolveSubagentType } from '@/lib/subagents'
import { getProviderLabel } from '@/components/sessions/providerLabel'
import { formatListTime } from '@/components/sessions/shared/formatListTime'

interface Props {
  serverIds: readonly string[]
  /** Parent conversation titles the list already holds, keyed by conversation id. */
  parentTitles: ReadonlyMap<string, string>
  topInset?: number
}

/**
 * Every sub-agent across the active servers, grouped under its parent.
 * Read-only: a row opens the transcript, a group header opens the parent.
 */
export function SubagentBoard({ serverIds, parentTitles, topInset = 0 }: Props) {
  const { t } = useTranslation('sessions')
  const theme = useTheme()
  const styles = useMemo(() => makeStyles(theme), [theme])
  const router = useRouter()
  const [onlyActive, setOnlyActive] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const { items, unsupportedServerIds, isLoading, isError, refetch } = useAllSubagents(serverIds)

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await refetch()
    } finally {
      setRefreshing(false)
    }
  }, [refetch])

  const serverByRowId = useMemo(() => {
    const m = new Map<string, string>()
    for (const i of items) m.set(i.conversation.id, i.serverId)
    return m
  }, [items])

  const groups = useMemo(() => {
    const rows = items.map((i: BoardSubagent) => i.conversation)
    const visible = onlyActive ? rows.filter((c) => c.subagentActive === true) : rows
    return groupSubagentsByParent(visible)
  }, [items, onlyActive])

  const totalActive = items.filter((i) => i.conversation.subagentActive === true).length
  const parentCount = new Set(items.map((i) => i.conversation.parentConversationId)).size
  const allUnsupported = serverIds.length > 0 && unsupportedServerIds.length === serverIds.length

  let body: React.ReactNode
  if (isLoading) body = <ActivityIndicator color={theme.text.secondary} style={styles.pad} />
  else if (allUnsupported) body = <Text style={[styles.note, styles.pad]}>{t('subagents.board.unsupported')}</Text>
  else if (isError) body = <Text style={[styles.note, styles.pad]}>{t('subagents.loadFailed')}</Text>
  else if (groups.length === 0)
    body = (
      <Text style={[styles.note, styles.pad]}>
        {onlyActive ? t('subagents.board.emptyActive') : t('subagents.board.empty')}
      </Text>
    )
  else
    body = groups.map((g) => {
      const serverId = serverByRowId.get(g.items[0].id) ?? serverIds[0]
      const title =
        parentTitles.get(g.parentId) ?? t('subagents.board.parentFallback', { id: g.parentId.slice(0, 8) })
      return (
        <View key={g.parentId} style={styles.group} testID={`subagent-group-${g.parentId}`}>
          <Pressable
            style={styles.groupHeader}
            onPress={() => router.push(conversationHref(g.parentId, serverId))}
            accessibilityRole="button"
            accessibilityLabel={`${t('subagents.board.openParent')}: ${title}`}
            testID={`subagent-parent-${g.parentId}`}
          >
            <View style={styles.groupTitleCol}>
              <Text style={styles.groupTitle} numberOfLines={1}>{title}</Text>
              {g.activeCount > 0 ? (
                <Text style={styles.meta}>{t('subagents.board.parentActive', { n: g.activeCount })}</Text>
              ) : null}
            </View>
            <CaretRight size={16} color={theme.text.accent} />
          </Pressable>
          {g.items.map((c) => {
            const type = resolveSubagentType(c)
            return (
              <Pressable
                key={c.id}
                style={styles.row}
                onPress={() => router.push(conversationHref(c.id, serverByRowId.get(c.id) ?? serverId))}
                testID={`subagent-board-row-${c.id}`}
              >
                <View style={styles.rowTop}>
                  {c.subagentActive === true ? (
                    <View style={styles.activeDot} accessibilityLabel={t('subagents.active')} testID={`subagent-board-active-${c.id}`} />
                  ) : null}
                  <Text style={styles.label} numberOfLines={1}>{resolveSubagentLabel(c)}</Text>
                  {type ? <Text style={styles.tag}>{type}</Text> : null}
                </View>
                <Text style={styles.meta} numberOfLines={1}>
                  {[getProviderLabel(c.provider, t), t('subagents.messages', { n: c.messageCount }), formatListTime(c.lastActivity)]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </Pressable>
            )
          })}
        </View>
      )
    })

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={{ paddingTop: topInset, paddingBottom: spacing.lg * 3 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.text.secondary} progressViewOffset={topInset} />}
      testID="subagent-board"
    >
      <View style={styles.summary}>
        <Stat styles={styles} label={t('subagents.board.summaryActive')} value={totalActive} accent />
        <Stat styles={styles} label={t('subagents.board.summaryParents')} value={parentCount} />
        <Stat styles={styles} label={t('subagents.board.summaryTotal')} value={items.length} />
      </View>
      <View style={styles.chips}>
        <Chip styles={styles} selected={onlyActive} label={t('subagents.board.active')} onPress={() => setOnlyActive(true)} testID="subagent-filter-active" />
        <Chip styles={styles} selected={!onlyActive} label={t('subagents.board.all')} onPress={() => setOnlyActive(false)} testID="subagent-filter-all" />
      </View>
      {body}
    </ScrollView>
  )
}

type Styles = ReturnType<typeof makeStyles>

function Stat({ styles, label, value, accent }: { styles: Styles; label: string; value: number; accent?: boolean }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, accent && styles.statValueAccent]}>{value}</Text>
    </View>
  )
}

function Chip({ styles, selected, label, onPress, testID }: { styles: Styles; selected: boolean; label: string; onPress: () => void; testID: string }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      testID={testID}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    scroll: { flex: 1 },
    pad: { paddingVertical: spacing.md, paddingHorizontal: spacing.md },
    note: { color: theme.text.secondary, fontSize: font.sm },
    summary: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm },
    stat: { flex: 1, backgroundColor: theme.bg.card, borderRadius: 12, padding: spacing.sm + 2 },
    statLabel: { color: theme.text.secondary, fontSize: font.xs - 1, fontWeight: '600' },
    statValue: { color: theme.text.primary, fontSize: font.lg, fontWeight: '600', marginTop: 4 },
    statValueAccent: { color: theme.text.accent },
    chips: { flexDirection: 'row', gap: spacing.xs + 2, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
    chip: { minHeight: 44, paddingHorizontal: spacing.md, borderRadius: 999, justifyContent: 'center', backgroundColor: theme.bg.card },
    chipSelected: { backgroundColor: `${theme.text.accent}24` },
    chipText: { color: theme.text.secondary, fontSize: font.xs, fontWeight: '600' },
    chipTextSelected: { color: theme.text.accent },
    group: { marginHorizontal: spacing.md, marginBottom: spacing.sm, borderRadius: 12, backgroundColor: theme.bg.card, overflow: 'hidden' },
    groupHeader: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, paddingStart: spacing.md, paddingEnd: spacing.sm },
    groupTitleCol: { flex: 1 },
    groupTitle: { color: theme.text.primary, fontSize: font.sm, fontWeight: '600' },
    row: { paddingVertical: spacing.sm, paddingStart: spacing.md, paddingEnd: spacing.md, gap: 2 },
    rowTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 },
    label: { flexShrink: 1, color: theme.text.primary, fontSize: font.sm, fontWeight: '600' },
    tag: { color: theme.text.secondary, fontSize: font.xs - 1, backgroundColor: theme.bg.primary, borderRadius: 4, paddingHorizontal: 5, overflow: 'hidden' },
    meta: { color: theme.text.secondary, fontSize: font.xs },
    activeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: theme.text.accent },
  })
}
