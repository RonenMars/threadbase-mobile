import React, { useCallback, useMemo, useState } from 'react'
import { View, Text, Pressable, ScrollView, RefreshControl, StyleSheet, ActivityIndicator, TouchableOpacity, LayoutAnimation } from 'react-native'
import Animated, { useSharedValue, withTiming, useAnimatedStyle, interpolate } from 'react-native-reanimated'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { CaretRight } from 'phosphor-react-native'
import { useTheme } from '@/contexts/ThemeContext'
import { ConvRow } from '@/components/sessions/hub/ConvRow'
import { Card } from '@/components/ui/Card'
import { useThemedStyles } from '@/hooks/useThemedStyles'
import { useReduceMotion } from '@/hooks/useAccessibilitySettings'
import { makeStyles as makeCardStyles } from '@/components/sessions/hub/ProjectHubCard.styles'
import { font, spacing, type Theme } from '@/constants/theme'
import { useAllSubagents, type BoardSubagent } from '@/hooks/useAllSubagents'
import { conversationHref } from '@/lib/conversationHref'
import { groupSubagentsByParent, type SubagentGroup, resolveSubagentLabel } from '@/lib/subagents'

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
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(new Set())
  const toggleOpen = useCallback((id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev)
      if (!next.delete(id)) next.add(id)
      return next
    })
  }, [])
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
        parentTitles.get(g.parentId) ??
        g.items.find((i) => i.parentTitle)?.parentTitle ??
        t('subagents.board.parentFallback', { id: g.parentId.slice(0, 8) })
      return (
        <SubagentGroupCard
          key={g.parentId}
          group={g}
          title={title}
          isOpen={openIds.has(g.parentId)}
          onToggle={toggleOpen}
          onOpenParent={() => router.push(conversationHref(g.parentId, serverId))}
          serverIdFor={(id) => serverByRowId.get(id) ?? serverId}
        />
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
        <Chip styles={styles} selected={!onlyActive} label={t('subagents.board.all')} onPress={() => setOnlyActive(false)} testID="subagent-filter-all" />
        <Chip styles={styles} selected={onlyActive} label={t('subagents.board.active')} onPress={() => setOnlyActive(true)} testID="subagent-filter-active" />
      </View>
      {body}
    </ScrollView>
  )
}

interface GroupCardProps {
  group: SubagentGroup
  title: string
  isOpen: boolean
  onToggle: (parentId: string) => void
  onOpenParent: () => void
  serverIdFor: (rowId: string) => string
}

/** One parent session as a collapsible card, laid out like a project card on the Projects tab. */
function SubagentGroupCard({ group: g, title, isOpen, onToggle, onOpenParent, serverIdFor }: GroupCardProps) {
  const { t } = useTranslation('sessions')
  const { styles: card, theme } = useThemedStyles(makeCardStyles)
  const styles = useMemo(() => makeStyles(theme), [theme])
  const reduceMotion = useReduceMotion()
  const chevronProgress = useSharedValue(isOpen ? 1 : 0)
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(chevronProgress.value, [0, 1], [0, 90])}deg` }],
  }))

  const handleToggle = useCallback(() => {
    if (!reduceMotion) LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    const next = isOpen ? 0 : 1
    // Reanimated shared value: assigning .value is its API.
    // eslint-disable-next-line react-hooks/immutability
    chevronProgress.value = withTiming(next, { duration: reduceMotion ? 0 : 200 })
    onToggle(g.parentId)
    // chevronProgress is a Reanimated shared value (stable across renders).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, onToggle, g.parentId, reduceMotion])

  return (
    <View style={styles.cardWrap} testID={`subagent-group-${g.parentId}`}>
      <Card style={{ overflow: 'hidden', gap: 0, padding: 0 }}>
        <View style={card.spineRow}>
          <View style={[card.spine, g.activeCount > 0 && { backgroundColor: theme.text.accent }]} />
          <View style={card.spineRowBody}>
            <TouchableOpacity
              onPress={handleToggle}
              activeOpacity={0.75}
              style={card.header}
              accessibilityRole="button"
              accessibilityState={{ expanded: isOpen }}
              accessibilityLabel={title}
              testID={`subagent-group-toggle-${g.parentId}`}
            >
              <View style={card.headerBody}>
                <Text style={card.headerSuffix} numberOfLines={1}>{title}</Text>
                {g.activeCount > 0 ? (
                  <Text style={card.headerActivity} numberOfLines={1}>{t('subagents.board.parentActive', { n: g.activeCount })}</Text>
                ) : null}
              </View>
              <Text style={card.countBadge}>{g.items.length}</Text>
              <Animated.View style={chevronStyle}>
                <CaretRight size={16} color={theme.text.secondary} />
              </Animated.View>
            </TouchableOpacity>
            {isOpen ? (
              <View style={card.body}>
                <View style={card.section}>
                  {g.items.map((c) => (
                    <ConvRow key={c.id} conv={{ ...c, title: resolveSubagentLabel(c), serverId: serverIdFor(c.id) }} />
                  ))}
                  <TouchableOpacity
                    onPress={onOpenParent}
                    activeOpacity={0.6}
                    style={card.seeAllRow}
                    accessibilityRole="button"
                    accessibilityLabel={`${t('subagents.board.openParent')}: ${title}`}
                    testID={`subagent-parent-${g.parentId}`}
                  >
                    <Text style={card.seeAllText}>{t('subagents.board.openParent')}</Text>
                    <CaretRight size={16} color={theme.text.accent} />
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}
          </View>
        </View>
      </Card>
    </View>
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
    cardWrap: { marginHorizontal: spacing.md, marginBottom: spacing.sm },
    row: { paddingVertical: spacing.sm, gap: 2 },
    rowTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 },
    label: { flexShrink: 1, color: theme.text.primary, fontSize: font.sm, fontWeight: '600' },
    tag: { color: theme.text.secondary, fontSize: font.xs - 1, backgroundColor: theme.bg.primary, borderRadius: 4, paddingHorizontal: 5, overflow: 'hidden' },
    meta: { color: theme.text.secondary, fontSize: font.xs },
    activeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: theme.text.accent },
  })
}
