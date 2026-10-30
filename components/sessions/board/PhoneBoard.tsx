import React, { useCallback, useMemo, useState } from 'react'
import { View, Text, Pressable, FlatList, RefreshControl, StyleSheet } from 'react-native'
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { CollapsibleCard } from '@/components/sessions/base/CollapsibleCard'
import { ConvRow } from '@/components/sessions/hub/ConvRow'
import { EarlierRow } from '@/components/sessions/now/EarlierRow'
import { NeedsYouCard } from '@/components/sessions/now/NeedsYouCard'
import { WorkingCard } from '@/components/sessions/now/WorkingCard'
import { buildNowEntries, type NowEntry } from '@/components/sessions/now/nowEntries'
import type { MergedItem } from '@/components/sessions/now/mergedItems'
import { listTopInset } from '@/components/sessions/shared/listTopInset'
import { colorForToken } from '@/components/sessions/SessionStatusBadge'
import { FAB_CLEARANCE } from '@/components/ui/FAB'
import { font, spacing, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { useAllSubagents } from '@/hooks/useAllSubagents'
import {
  BOARD_COLUMNS,
  bucketBoard,
  firstNonEmptyColumn,
  subagentParentKeys,
  type BoardColumnId,
} from '@/lib/boardColumns'
import { dominantProvider as findDominantProvider } from '@/lib/providerDominance'
import type { SessionColorToken } from '@/lib/sessionPresentation'
import { groupSubagentsByParent, resolveSubagentLabel, type SubagentGroup } from '@/lib/subagents'
import { useServersStore } from '@/stores/servers'
import { useServerFetchStatusStore } from '@/stores/serverFetchStatus'
import { useSessionNamesStore } from '@/stores/sessionNames'
import type { MultiSession } from '@/types/api'

interface Props {
  items: MergedItem[]
  searchQuery: string
  conversationsFromServer: boolean
  refreshing: boolean
  onRefresh: () => void
  /** Pages more history; only the Earlier column asks for it. */
  onEndReached?: () => void
  topInset?: number
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void
}

function columnLabel(id: BoardColumnId, t: TFunction<'sessions'>): string {
  switch (id) {
    case 'needsYou':
      return t('status.needsYou')
    case 'working':
      return t('status.working')
    case 'observed':
      return t('status.observed')
    case 'earlier':
      return t('boardTab.earlier')
  }
}

function columnToken(id: BoardColumnId): SessionColorToken {
  switch (id) {
    case 'needsYou':
      return 'waiting'
    case 'working':
      return 'running'
    case 'observed':
      return 'completed'
    case 'earlier':
      return 'idle'
  }
}

/**
 * The kanban board for a phone: one state column at a time, picked from a
 * chip strip, with each session's sub-agents folded underneath it.
 */
export function PhoneBoard({
  items,
  searchQuery,
  conversationsFromServer,
  refreshing,
  onRefresh,
  onEndReached,
  topInset = 0,
  onScroll,
}: Props) {
  const { t } = useTranslation('sessions')
  const theme = useTheme()
  const styles = useMemo(() => makeStyles(theme), [theme])
  const insets = useSafeAreaInsets()
  const inset = listTopInset(topInset)
  const activeServerIds = useServersStore((s) => s.activeServerIds)
  const servers = useServersStore((s) => s.servers)
  const fetchStatuses = useServerFetchStatusStore((s) => s.statuses)
  const names = useSessionNamesStore((s) => s.names)
  const nameOrigins = useSessionNamesStore((s) => s.nameOrigin)
  const multiServer = activeServerIds.length > 1

  const entries = useMemo(
    () => buildNowEntries(items, searchQuery, conversationsFromServer, names, nameOrigins),
    [items, searchQuery, conversationsFromServer, names, nameOrigins],
  )
  const board = useMemo(() => bucketBoard(entries), [entries])
  const dominantProvider = useMemo(() => findDominantProvider(entries.map((e) => e.item.item.provider)), [entries])
  const [picked, setPicked] = useState<BoardColumnId | null>(null)
  const column = picked ?? firstNonEmptyColumn(board)

  const subagents = useAllSubagents(activeServerIds)
  const { groupByParent, serverByRowId } = useMemo(() => {
    const serverOf = new Map(subagents.items.map((i) => [i.conversation.id, i.serverId]))
    const groups = groupSubagentsByParent(subagents.items.map((i) => i.conversation))
    return { groupByParent: new Map(groups.map((g) => [g.parentId, g])), serverByRowId: serverOf }
  }, [subagents.items])

  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(new Set())
  const toggleOpen = useCallback((id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev)
      if (!next.delete(id)) next.add(id)
      return next
    })
  }, [])

  const highlight = searchQuery.trim() || undefined

  const renderItem = useCallback(
    ({ item: entry }: { item: NowEntry }) => {
      const stale = fetchStatuses[entry.item.item.serverId]?.status === 'error'
      let row: React.ReactNode
      if (entry.tier === 'needsYou' || entry.tier === 'working') {
        const session = entry.item.item as MultiSession
        const Card = entry.tier === 'needsYou' ? NeedsYouCard : WorkingCard
        row = (
          <Card
            session={session}
            title={entry.title.title}
            serverLabel={multiServer ? session.serverLabel : undefined}
            serverColor={servers[session.serverId]?.color}
            dominantProvider={dominantProvider}
            isFirst={false}
          />
        )
      } else {
        row = <EarlierRow item={entry.item} title={entry.title.title} highlight={highlight} dominantProvider={dominantProvider} />
      }
      const group = subagentParentKeys(entry.item).map((k) => groupByParent.get(k)).find((g) => g != null)
      return (
        <View style={stale ? styles.stale : undefined}>
          {row}
          {group ? (
            <SubagentFold
              group={group}
              isOpen={openIds.has(group.parentId)}
              onToggle={toggleOpen}
              serverIdFor={(id) => serverByRowId.get(id) ?? entry.item.item.serverId}
            />
          ) : null}
        </View>
      )
    },
    [fetchStatuses, multiServer, servers, dominantProvider, highlight, groupByParent, openIds, toggleOpen, serverByRowId, styles],
  )

  const chips = (
    <View style={styles.chips} accessibilityRole="tablist" accessibilityLabel={t('boardTab.columns')}>
      {BOARD_COLUMNS.map((id) => {
        const selected = id === column
        return (
          <Pressable
            key={id}
            onPress={() => setPicked(id)}
            style={[styles.chip, selected && styles.chipSelected]}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            testID={`board-column-${id}`}
          >
            <View style={[styles.dot, { backgroundColor: colorForToken(theme, columnToken(id)) }]} />
            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{columnLabel(id, t)}</Text>
            <Text style={styles.chipCount}>{board[id].length}</Text>
          </Pressable>
        )
      })}
    </View>
  )

  return (
    <FlatList
      testID="phone-board"
      data={board[column]}
      keyExtractor={(e) => `${e.item.kind}:${e.item.item.serverId}::${e.item.item.id}`}
      renderItem={renderItem}
      extraData={column}
      ListHeaderComponent={chips}
      ListEmptyComponent={<Text style={styles.empty}>{t('boardTab.emptyColumn')}</Text>}
      onEndReached={column === 'earlier' ? onEndReached : undefined}
      onEndReachedThreshold={0.5}
      onScroll={onScroll}
      scrollEventThrottle={16}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      {...inset.props}
      contentContainerStyle={[
        { paddingHorizontal: spacing.sm + 2, paddingBottom: FAB_CLEARANCE + insets.bottom },
        inset.contentStyle,
      ]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={theme.text.secondary}
          progressViewOffset={inset.progressViewOffset}
        />
      }
    />
  )
}

function SubagentFold({
  group,
  isOpen,
  onToggle,
  serverIdFor,
}: {
  group: SubagentGroup
  isOpen: boolean
  onToggle: (parentId: string) => void
  serverIdFor: (rowId: string) => string
}) {
  const { t } = useTranslation('sessions')
  const theme = useTheme()
  const styles = useMemo(() => makeStyles(theme), [theme])
  const title = t('subagents.titleCount', { n: group.items.length })
  return (
    <View style={styles.fold} testID={`board-subagents-${group.parentId}`}>
      <CollapsibleCard
        id={group.parentId}
        title={title}
        activityLine={group.activeCount > 0 ? t('subagents.board.parentActive', { n: group.activeCount }) : undefined}
        count={group.items.length}
        railColor={group.activeCount > 0 ? theme.text.accent : null}
        isOpen={isOpen}
        onToggle={onToggle}
        accessibilityLabel={title}
        headerTestID={`board-subagents-toggle-${group.parentId}`}
      >
        {group.items.map((c) => (
          <ConvRow key={c.id} conv={{ ...c, title: resolveSubagentLabel(c), serverId: serverIdFor(c.id) }} />
        ))}
      </CollapsibleCard>
    </View>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs + 2, paddingTop: spacing.sm, paddingBottom: spacing.sm },
    chip: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs + 2,
      paddingHorizontal: spacing.md,
      borderRadius: 999,
      backgroundColor: theme.bg.card,
    },
    chipSelected: { backgroundColor: `${theme.text.accent}24` },
    chipText: { color: theme.text.secondary, fontSize: font.xs, fontWeight: '600' },
    chipTextSelected: { color: theme.text.primary },
    chipCount: { color: theme.text.secondary, fontSize: font.xs, fontVariant: ['tabular-nums'] },
    dot: { width: 8, height: 8, borderRadius: 4 },
    empty: { color: theme.text.secondary, fontSize: font.sm, textAlign: 'center', paddingVertical: spacing.lg },
    stale: { opacity: 0.6 },
    fold: { marginStart: spacing.lg, marginTop: spacing.xs, marginBottom: spacing.sm },
  })
}
