import React, { useCallback, useMemo } from 'react'
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native'
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Tray } from 'phosphor-react-native'
import { SubagentGroupCard } from '@/components/sessions/SubagentBoard'
import type { NowEntry } from '@/components/sessions/now/nowEntries'
import { FAB_CLEARANCE } from '@/components/ui/FAB'
import { font, spacing, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import type { BoardColumnId } from '@/lib/boardColumns'
import { conversationHref } from '@/lib/conversationHref'
import type { SubagentGroup } from '@/lib/subagents'
import { useServerFetchStatusStore } from '@/stores/serverFetchStatus'
import type { MultiSession } from '@/types/api'
import { BoardSessionCard } from './BoardSessionCard'

export type BoardCardModel =
  | { kind: 'entry'; key: string; entry: NowEntry; group: SubagentGroup | undefined }
  | { kind: 'orphan'; key: string; group: SubagentGroup; title: string; serverId: string }

type Row = BoardCardModel | { kind: 'heading'; key: string }

function emptyHint(id: BoardColumnId, t: TFunction<'sessions'>): string {
  switch (id) {
    case 'needsYou':
      return t('boardTab.emptyNeedsYou')
    case 'working':
      return t('boardTab.emptyWorking')
    case 'observed':
      return t('boardTab.emptyObserved')
    case 'earlier':
      return t('boardTab.emptyEarlier')
  }
}

export interface BoardColumnListProps {
  column: BoardColumnId
  cards: BoardCardModel[]
  openIds: ReadonlySet<string>
  onToggle: (id: string) => void
  onShowQuestion: (session: MultiSession, title: string) => void
  searchQuery: string
  serverIdFor: (rowId: string, fallback: string) => string
  /** Sub-agents could not load: one line where their cards would be. */
  subagentsFailed: boolean
  refreshing: boolean
  onRefresh: () => void
  onEndReached?: () => void
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void
}

/** One column's cards, then the sub-agents whose parent session is not on the board. */
export function BoardColumnList({
  column,
  cards,
  openIds,
  onToggle,
  onShowQuestion,
  searchQuery,
  serverIdFor,
  subagentsFailed,
  refreshing,
  onRefresh,
  onEndReached,
  onScroll,
}: BoardColumnListProps) {
  const { t } = useTranslation('sessions')
  const theme = useTheme()
  const styles = useMemo(() => makeStyles(theme), [theme])
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const fetchStatuses = useServerFetchStatusStore((s) => s.statuses)

  const rows = useMemo<Row[]>(() => {
    const firstOrphan = cards.findIndex((c) => c.kind === 'orphan')
    if (firstOrphan < 0) return cards
    return [...cards.slice(0, firstOrphan), { kind: 'heading', key: 'orphan-heading' }, ...cards.slice(firstOrphan)]
  }, [cards])

  const renderItem = useCallback(
    ({ item: row }: { item: Row }) => {
      if (row.kind === 'heading') return <Text style={styles.heading}>{t('boardTab.orphanHeading')}</Text>
      if (row.kind === 'orphan') {
        return (
          <SubagentGroupCard
            group={row.group}
            title={row.title}
            isOpen={openIds.has(row.group.parentId)}
            onToggle={onToggle}
            onOpenParent={() => router.push(conversationHref(row.group.parentId, row.serverId))}
            serverIdFor={(id) => serverIdFor(id, row.serverId)}
          />
        )
      }
      const serverId = row.entry.item.item.serverId
      const stale = fetchStatuses[serverId]?.status === 'error'
      return (
        <View style={[styles.cardWrap, stale && styles.stale]}>
          <BoardSessionCard
            id={row.key}
            entry={row.entry}
            group={row.group}
            isOpen={openIds.has(row.key)}
            onToggle={onToggle}
            onShowQuestion={onShowQuestion}
            searchQuery={searchQuery}
            serverIdFor={(id) => serverIdFor(id, serverId)}
          />
        </View>
      )
    },
    [fetchStatuses, onShowQuestion, onToggle, openIds, router, searchQuery, serverIdFor, styles, t],
  )

  const showFailure = subagentsFailed && (column === 'working' || column === 'earlier')
  const empty = (
    <View style={styles.empty}>
      <Tray size={28} color={theme.text.secondary} />
      <Text style={styles.emptyTitle}>{t('boardTab.emptyColumn')}</Text>
      <Text style={styles.emptyHint}>{emptyHint(column, t)}</Text>
    </View>
  )

  return (
    <FlatList
      testID={`board-list-${column}`}
      data={rows}
      keyExtractor={(r) => r.key}
      renderItem={renderItem}
      ListEmptyComponent={showFailure ? null : empty}
      ListFooterComponent={showFailure ? <Text style={styles.failure}>{t('boardTab.subagentsFailed')}</Text> : null}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      onScroll={onScroll}
      scrollEventThrottle={16}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: FAB_CLEARANCE + insets.bottom }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.text.secondary} />}
    />
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    // Same frame as SubagentGroupCard's, so session and orphan cards line up.
    cardWrap: { marginHorizontal: spacing.md, marginBottom: spacing.sm },
    stale: { opacity: 0.6 },
    heading: { color: theme.text.secondary, fontSize: font.xs, fontWeight: '600', marginHorizontal: spacing.md, marginTop: spacing.sm, marginBottom: spacing.sm },
    empty: { alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.lg, paddingVertical: spacing.xl },
    emptyTitle: { color: theme.text.primary, fontSize: font.sm, fontWeight: '600' },
    emptyHint: { color: theme.text.secondary, fontSize: font.xs, textAlign: 'center' },
    failure: { color: theme.text.secondary, fontSize: font.xs, marginHorizontal: spacing.md, marginTop: spacing.sm },
  })
}
