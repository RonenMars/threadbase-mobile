import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet, useWindowDimensions, View } from 'react-native'
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native'
import { useTranslation } from 'react-i18next'
import { buildNowEntries, type NowEntry } from '@/components/sessions/now/nowEntries'
import type { MergedItem } from '@/components/sessions/now/mergedItems'
import { TABLET_BREAKPOINT } from '@/constants/theme'
import { useAllSubagents } from '@/hooks/useAllSubagents'
import { bucketBoard, firstNonEmptyColumn, startingColumn, subagentParentKeys, type BoardColumnId } from '@/lib/boardColumns'
import { promptRefetchKey } from '@/lib/boardPrompts'
import { groupSubagentsByParent, resolveSubagentLabel } from '@/lib/subagents'
import { useServersStore } from '@/stores/servers'
import { useSessionNamesStore } from '@/stores/sessionNames'
import { useSettingsStore } from '@/stores/settings'
import type { MultiSession } from '@/types/api'
import type { SortBy, SortOrder } from '@/types/ui'
import { BoardColumnList, type BoardCardModel } from './BoardColumnList'
import { SessionQuestionModal } from '@/components/sessions/shared/SessionQuestionModal'
import { DesktopBoard } from './DesktopBoard'
import { PhoneBoard } from './PhoneBoard'

interface Props {
  items: MergedItem[]
  searchQuery: string
  conversationsFromServer: boolean
  order: SortBy
  direction: SortOrder
  refreshing: boolean
  onRefresh: () => void
  /** Refetch the list without the pull spinner: `pendingPrompts` only arrive on list rows. */
  onPromptsChanged: () => void
  /** Pages more history; only the Earlier column asks for it. */
  onEndReached?: () => void
  topInset?: number
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void
  /** Hides the session cards, so every sub-agent group stands as its own card. */
  subagentsOnly?: boolean
}

/**
 * The session board: four state columns of session cards with their sub-agents
 * folded in. Sub-agents whose parent is not on the board get a card of their
 * own, in Working while any of them runs and in Earlier otherwise.
 */
export function SessionBoard({
  items,
  searchQuery,
  conversationsFromServer,
  order,
  direction,
  refreshing,
  onRefresh,
  onPromptsChanged,
  onEndReached,
  topInset = 0,
  onScroll,
  subagentsOnly = false,
}: Props) {
  const { t } = useTranslation('sessions')
  const { width } = useWindowDimensions()
  const activeServerIds = useServersStore((s) => s.activeServerIds)
  const names = useSessionNamesStore((s) => s.names)
  const nameOrigins = useSessionNamesStore((s) => s.nameOrigin)
  const rememberedColumn = useSettingsStore((s) => s.boardColumn)
  const setBoardColumn = useSettingsStore((s) => s.setBoardColumn)

  const entries = useMemo(
    () => (subagentsOnly ? [] : buildNowEntries(items, searchQuery, conversationsFromServer, names, nameOrigins)),
    [items, searchQuery, conversationsFromServer, names, nameOrigins, subagentsOnly],
  )

  const subagents = useAllSubagents(activeServerIds)
  const { groups, serverByRowId } = useMemo(() => {
    const serverOf = new Map(subagents.items.map((i) => [i.conversation.id, i.serverId]))
    return { groups: groupSubagentsByParent(subagents.items.map((i) => i.conversation)), serverByRowId: serverOf }
  }, [subagents.items])

  const board = useMemo(() => {
    const byParent = new Map(groups.map((g) => [g.parentId, g]))
    const claimed = new Set<string>()
    const groupOf = (entry: NowEntry) => subagentParentKeys(entry.item).map((k) => byParent.get(k)).find((g) => g != null)
    const toCard = ({ entry }: { entry: NowEntry }): BoardCardModel => {
      const group = groupOf(entry)
      if (group) claimed.add(group.parentId)
      const key = `${entry.item.kind}:${entry.item.item.serverId}::${entry.item.item.id}`
      return { kind: 'entry', key, entry, group }
    }
    // Running sub-agents pull their parent into Working whatever its own tier, bar Needs you.
    // Only the column moves: the card keeps its own tier for its badge.
    const placed = entries.map((entry) => {
      const busy = entry.tier !== 'needsYou' && (groupOf(entry)?.activeCount ?? 0) > 0
      return { item: entry.item, tier: busy ? ('working' as const) : entry.tier, entry }
    })
    const buckets = bucketBoard(placed, order, direction)
    const out: Record<BoardColumnId, BoardCardModel[]> = {
      needsYou: buckets.needsYou.map(toCard),
      working: buckets.working.map(toCard),
      external: buckets.external.map(toCard),
      earlier: buckets.earlier.map(toCard),
    }
    const q = searchQuery.trim().toLowerCase()
    // Sub-agents only: one card per sub-agent instead of one per parent.
    const cardGroups = subagentsOnly
      ? groups.flatMap((g) => g.items.map((item) => ({ ...g, items: [item], activeCount: item.subagentActive === true ? 1 : 0 })))
      : groups
    for (const g of cardGroups) {
      if (claimed.has(g.parentId)) continue
      const parentTitle =
        g.items.find((i) => i.parentTitle)?.parentTitle ??
        t('subagents.board.parentFallback', { id: g.parentId.slice(0, 8) })
      const title = subagentsOnly ? resolveSubagentLabel(g.items[0]) : parentTitle
      const matches = !q || [parentTitle, ...g.items.map(resolveSubagentLabel)].some((s) => s.toLowerCase().includes(q))
      if (!matches) continue
      const serverId = serverByRowId.get(g.items[0].id) ?? activeServerIds[0] ?? ''
      const key = subagentsOnly ? `orphan:${g.parentId}:${g.items[0].id}` : `orphan:${g.parentId}`
      out[g.activeCount > 0 ? 'working' : 'earlier'].push({ kind: 'orphan', key, group: g, title, serverId, parentTitle: subagentsOnly ? parentTitle : undefined })
    }
    return out
  }, [entries, groups, serverByRowId, searchQuery, activeServerIds, order, direction, subagentsOnly, t])

  const counts = useMemo(
    () => ({ needsYou: board.needsYou.length, working: board.working.length, external: board.external.length, earlier: board.earlier.length }),
    [board],
  )

  // Unset until the user moves, so a Needs you card that arrives after the first paint still decides where the board starts.
  const [picked, setPicked] = useState<BoardColumnId | null>(null)
  const preferred = picked ?? startingColumn(board, rememberedColumn)
  // Sub-agents only hides the session cards, so the remembered column can be empty while another holds every card.
  const column = subagentsOnly && board[preferred].length === 0 ? firstNonEmptyColumn(board) : preferred
  const selectColumn = useCallback((id: BoardColumnId) => {
    setPicked(id)
    setBoardColumn(id)
  }, [setBoardColumn])

  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(new Set())
  const toggleOpen = useCallback((id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev)
      if (!next.delete(id)) next.add(id)
      return next
    })
  }, [])

  const [questionFor, setQuestionFor] = useState<{ serverId: string; id: string; title: string } | null>(null)
  const showQuestion = useCallback((session: MultiSession, title: string) => {
    setQuestionFor({ serverId: session.serverId, id: session.id, title })
  }, [])
  // Read from the live rows, so a revised question replaces the one on screen.
  const questionSession = useMemo(() => {
    if (!questionFor) return undefined
    const row = items.find((i) => i.kind === 'session' && i.item.serverId === questionFor.serverId && i.item.id === questionFor.id)
    return row?.kind === 'session' ? row.item : undefined
  }, [items, questionFor])

  const refetchKey = promptRefetchKey(items)
  const lastRefetchKey = useRef(refetchKey)
  useEffect(() => {
    if (lastRefetchKey.current === refetchKey) return
    lastRefetchKey.current = refetchKey
    onPromptsChanged()
  }, [refetchKey, onPromptsChanged])

  const serverIdFor = useCallback((rowId: string, fallback: string) => serverByRowId.get(rowId) ?? fallback, [serverByRowId])

  const renderColumn = (id: BoardColumnId) => (
    <BoardColumnList
      key={id}
      column={id}
      cards={board[id]}
      openIds={openIds}
      onToggle={toggleOpen}
      onShowQuestion={showQuestion}
      searchQuery={searchQuery}
      serverIdFor={serverIdFor}
      subagentsFailed={subagents.isError}
      hideOrphanHeading={subagentsOnly}
      refreshing={refreshing}
      onRefresh={onRefresh}
      onEndReached={id === 'earlier' ? onEndReached : undefined}
      onScroll={onScroll}
    />
  )

  const Layout = width >= TABLET_BREAKPOINT ? DesktopBoard : PhoneBoard
  return (
    <View style={[styles.fill, { paddingTop: topInset }]}>
      <Layout counts={counts} column={column} onSelect={selectColumn} renderColumn={renderColumn} />
      {questionFor && questionSession ? (
        <SessionQuestionModal
          session={questionSession}
          title={questionFor.title}
          onClose={() => setQuestionFor(null)}
          onPromptsChanged={onPromptsChanged}
        />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({ fill: { flex: 1 } })
