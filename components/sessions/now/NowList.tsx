import React, { useCallback, useMemo, useState } from 'react'
import { View, FlatList, RefreshControl } from 'react-native'
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { EmptyState } from '@/components/ui/EmptyState'
import { FAB_CLEARANCE } from '@/components/ui/FAB'
import { QuickAccessActionSheet } from '@/components/quick-access/QuickAccessActionSheet'
import { ServerHeaderRow } from '@/components/sessions/tree/ServerHeaderRow'
import { LIST_WINDOW } from '@/components/sessions/shared/listWindow'
import { listTopInset } from '@/components/sessions/shared/listTopInset'
import { isToday } from '@/components/sessions/hub/hubUtils'
import {
  basename,
  resolveConversationRowTitle,
  resolveSessionRowTitle,
  type RowTitle,
  storedNameFor,
} from '@/components/sessions/shared/rowTitle'
import { spacing } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { conversationHref } from '@/lib/conversationHref'
import {
  deriveConversationPresentation,
  deriveSessionPresentation,
  type SessionStatusLabel,
  type SessionTier,
} from '@/lib/sessionPresentation'
import { useNavLockStore } from '@/stores/navLock'
import { useQuickAccessStore, buildFavoriteId } from '@/stores/quickAccess'
import { useQuietTailStore } from '@/stores/quietTail'
import { useServersStore } from '@/stores/servers'
import { useSessionNamesStore } from '@/stores/sessionNames'
import { useViewPrefsStore } from '@/stores/viewPrefs'
import { useSessionRowActions } from '@/hooks/useSessionRowActions'
import type { MultiConversation, MultiSession } from '@/types/api'
import type { SortBy, SortOrder } from '@/types/ui'
import { CantResumeRow } from './CantResumeRow'
import { EarlierRow } from './EarlierRow'
import { HistorySkeletonRow } from './HistorySkeletonRow'
import { dominantProvider as findDominantProvider } from '@/lib/providerDominance'
import { NeedsYouCard } from './NeedsYouCard'
import { QuietTailRow } from './QuietTailRow'
import { SectionEyebrow, type SectionTone } from './SectionEyebrow'
import { WorkingCard } from './WorkingCard'
import { mergedItemMatchesQuery, type MergedItem } from './mergedItems'

interface Props {
  items: MergedItem[]
  refreshing: boolean
  onRefresh: () => void
  onEndReached?: () => void
  searchQuery: string
  conversationsFromServer: boolean
  isBackgroundRefreshing?: boolean
  /** Height of the floating chrome; the rows scroll under it. */
  topInset?: number
  /** Scrolls with the rows: the quick-access strip, banners and presets. */
  ListHeaderComponent?: React.ReactElement | null
  /** `state` sections the list; the other two flatten it into one ordered run. */
  order?: SortBy
  direction?: SortOrder
  /** Servers still indexing history — live cards stay, conversation rows become skeletons. */
  warmingServerIds?: string[]
  onNewSession?: () => void
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void
}

interface Entry {
  item: MergedItem
  title: RowTitle
  tier: SessionTier | null
  statusLabel: SessionStatusLabel | null
}

type FlatItem =
  | { kind: 'eyebrow'; key: string; label: string; tone: SectionTone; count?: number }
  | { kind: 'serverHeader'; key: string; serverId: string; serverLabel: string; totalCount: number }
  | { kind: 'row'; key: string; entry: Entry; isFirst: boolean }
  | { kind: 'quietTail'; key: string; entries: Entry[] }
  | { kind: 'skeleton'; key: string }

const HISTORY_SKELETONS = 2

/** More than ~5 quiet rows in one time group gather into a tail row. */
const QUIET_TAIL_MIN = 6

function entryKey(e: Entry): string {
  return `${e.item.kind}:${e.item.item.serverId}::${e.item.item.id}`
}

function toRow(entry: Entry): FlatItem {
  return { kind: 'row', key: entryKey(entry), entry, isFirst: false }
}

function appendSkeletons(out: FlatItem[], key: string) {
  for (let i = 0; i < HISTORY_SKELETONS; i += 1) {
    out.push({ kind: 'skeleton', key: `${key}-skel-${i}` })
  }
}

function isWarmingConversation(entry: Entry, warming: Set<string>): boolean {
  return entry.item.kind === 'conversation' && warming.has(entry.item.item.serverId)
}

/**
 * Quiet rows (a command or only an identity for a title) stay inline in time
 * order as light one-line rows. Once a group holds QUIET_TAIL_MIN of them they
 * leave the group and one tail row sits at its end: never mid-list, never
 * above real work. Display-layer only. Can't-resume rows stay first-class.
 */
function withQuietTail(bucket: Entry[], bucketKey: string): FlatItem[] {
  const quiet = bucket.filter((e) => e.title.rung !== 'intent' && e.tier !== 'cantResume')
  if (quiet.length < QUIET_TAIL_MIN) return bucket.map(toRow)
  const loud = bucket.filter((e) => e.title.rung === 'intent' || e.tier === 'cantResume')
  return [...loud.map(toRow), { kind: 'quietTail', key: `quiet-${bucketKey}`, entries: quiet }]
}

function CantResumeSessionRow({
  session,
  title,
  statusLabel,
  timestamp,
}: {
  session: MultiSession
  title: string
  statusLabel: SessionStatusLabel | null
  timestamp: number
}) {
  const { handlePress, handleLongPress } = useSessionRowActions(session)
  return (
    <CantResumeRow
      title={title}
      statusLabel={statusLabel}
      timestamp={timestamp}
      onPress={handlePress}
      onLongPress={handleLongPress}
      testID={`session-row-${session.id}`}
    />
  )
}

function CantResumeConversationRow({
  conv,
  title,
  statusLabel,
  timestamp,
  highlight,
  onLongPress,
}: {
  conv: MultiConversation
  title: string
  statusLabel: SessionStatusLabel | null
  timestamp: number
  highlight?: string
  onLongPress?: (conv: MultiConversation) => void
}) {
  const router = useRouter()
  const handlePress = useCallback(() => {
    Haptics.selectionAsync()
    useNavLockStore.getState().lock()
    router.push(conversationHref(conv.id, conv.serverId, highlight))
  }, [conv, highlight, router])
  return (
    <CantResumeRow
      title={title}
      statusLabel={statusLabel}
      timestamp={timestamp}
      onPress={handlePress}
      onLongPress={onLongPress ? () => onLongPress(conv) : undefined}
      testID={`conversation-row-${conv.id}`}
    />
  )
}

/**
 * The default view: a flat list ordered by state, not by clock.
 * Needs you → Working → Earlier (today, then older). With more than one server
 * the history is grouped per server instead, since the rows carry their own
 * times; the two live sections stay global because "needs you" outranks the
 * machine it is on.
 */
export const NowList = React.memo(function NowList({
  items,
  refreshing,
  onRefresh,
  onEndReached,
  searchQuery,
  conversationsFromServer,
  isBackgroundRefreshing,
  topInset = 0,
  ListHeaderComponent,
  order = 'state',
  direction: sortDirection = 'desc',
  warmingServerIds = [],
  onNewSession,
  onScroll,
}: Props) {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const inset = listTopInset(topInset)
  const { t } = useTranslation('sessions')
  const router = useRouter()
  const activeServerIds = useServersStore((s) => s.activeServerIds)
  const servers = useServersStore((s) => s.servers)
  const names = useSessionNamesStore((s) => s.names)
  const nameOrigins = useSessionNamesStore((s) => s.nameOrigin)
  const collapsedServers = useViewPrefsStore((s) => s.collapsedServers)
  const toggleServer = useViewPrefsStore((s) => s.toggleServerCollapsed)
  const { favorites, pinItem, unpinItem } = useQuickAccessStore()
  const setQuietTail = useQuietTailStore((s) => s.set)
  const [activeConv, setActiveConv] = useState<MultiConversation | null>(null)
  const multiServer = activeServerIds.length > 1
  const warming = useMemo(() => new Set(warmingServerIds), [warmingServerIds])

  const entries = useMemo((): Entry[] => {
    const q = searchQuery.trim().toLowerCase()
    const visible = q ? items.filter((it) => mergedItemMatchesQuery(it, q, conversationsFromServer)) : items
    return visible.map((item) => {
      const stored = storedNameFor(names, nameOrigins, item.item.serverId, item.item.id)
      if (item.kind === 'session') {
        const presentation = deriveSessionPresentation(item.item)
        return { item, title: resolveSessionRowTitle(item.item, stored), tier: presentation.tier, statusLabel: presentation.statusLabel }
      }
      const presentation = deriveConversationPresentation(item.item)
      return {
        item,
        title: resolveConversationRowTitle(item.item, stored),
        tier: presentation?.tier ?? null,
        statusLabel: presentation?.statusLabel ?? null,
      }
    })
  }, [items, searchQuery, conversationsFromServer, names, nameOrigins])

  const dominantProvider = useMemo(() => findDominantProvider(entries.map((e) => e.item.item.provider)), [entries])

  const flatData = useMemo((): FlatItem[] => {
    const sign = sortDirection === 'asc' ? -1 : 1
    const byTime = (a: Entry, b: Entry) => sign * (b.item.ms - a.item.ms)
    const withoutWarmingHistory = (list: Entry[]) => list.filter((e) => !isWarmingConversation(e, warming))
    if (order !== 'state') {
      const projectOf = (e: Entry) =>
        e.item.kind === 'session' ? e.item.item.projectName : (basename(e.item.item.projectPath) ?? '')
      const byProject = (a: Entry, b: Entry) => projectOf(a).localeCompare(projectOf(b)) || byTime(a, b)
      const flat = withQuietTail([...withoutWarmingHistory(entries)].sort(order === 'projectName' ? byProject : byTime), 'all')
      const first = flat.find((f) => f.kind === 'row' && f.entry.item.kind === 'session')
      if (first && first.kind === 'row') first.isFirst = true
      if (warming.size > 0) appendSkeletons(flat, 'all')
      return flat
    }
    const needsYou = entries.filter((e) => e.tier === 'needsYou').sort(byTime)
    const working = entries.filter((e) => e.tier === 'working').sort(byTime)
    const earlier = withoutWarmingHistory(entries.filter((e) => e.tier !== 'needsYou' && e.tier !== 'working')).sort(byTime)

    const out: FlatItem[] = []
    if (needsYou.length > 0) {
      out.push({ kind: 'eyebrow', key: 'eyebrow-needsYou', tone: 'needsYou', label: t('live.headerNeedsYou', { count: needsYou.length }) })
      out.push(...needsYou.map((entry) => ({ kind: 'row' as const, key: entryKey(entry), entry, isFirst: false })))
    }
    if (working.length > 0) {
      out.push({ kind: 'eyebrow', key: 'eyebrow-working', tone: 'working', label: t('live.headerWorking', { count: working.length }) })
      out.push(...working.map((entry) => ({ kind: 'row' as const, key: entryKey(entry), entry, isFirst: false })))
    }

    if (multiServer) {
      const withRows = activeServerIds.filter((id) => earlier.some((e) => e.item.item.serverId === id) || warming.has(id))
      const collapsible = withRows.length > 1
      for (const id of withRows) {
        const bucket = earlier.filter((e) => e.item.item.serverId === id)
        out.push({ kind: 'serverHeader', key: `server-${id}`, serverId: id, serverLabel: servers[id]?.label ?? id, totalCount: bucket.length })
        if (collapsible && collapsedServers.includes(id)) continue
        out.push(...withQuietTail(bucket, id))
        if (warming.has(id)) appendSkeletons(out, id)
      }
    } else {
      const today = earlier.filter((e) => isToday(new Date(e.item.ms).toISOString()))
      const older = earlier.filter((e) => !isToday(new Date(e.item.ms).toISOString()))
      const warmingHere = warming.size > 0
      if (today.length > 0) {
        out.push({ kind: 'eyebrow', key: 'eyebrow-today', tone: 'muted', label: t('live.headerEarlierToday'), count: today.length })
        out.push(...withQuietTail(today, 'today'))
      }
      if (older.length > 0) {
        out.push({ kind: 'eyebrow', key: 'eyebrow-older', tone: 'muted', label: t('live.headerEarlier'), count: older.length })
        out.push(...withQuietTail(older, 'older'))
      }
      if (warmingHere) {
        if (today.length === 0 && older.length === 0) {
          out.push({ kind: 'eyebrow', key: 'eyebrow-warming', tone: 'muted', label: t('live.headerEarlier') })
        }
        appendSkeletons(out, 'warming')
      }
    }

    const first = out.find((f) => f.kind === 'row' && f.entry.item.kind === 'session')
    if (first && first.kind === 'row') first.isFirst = true
    return out
  }, [entries, order, sortDirection, multiServer, activeServerIds, servers, collapsedServers, warming, t])

  const openQuietTail = useCallback((tail: Entry[]) => {
    setQuietTail(tail.map((e) => ({ item: e.item, title: e.title.title })))
    router.push('/quiet-sessions')
  }, [setQuietTail, router])

  const highlight = searchQuery.trim() || undefined

  const renderItem = useCallback(({ item }: { item: FlatItem }) => {
    switch (item.kind) {
      case 'eyebrow':
        return <SectionEyebrow label={item.label} tone={item.tone} count={item.count} />
      case 'serverHeader':
        return (
          <ServerHeaderRow
            serverId={item.serverId}
            serverLabel={item.serverLabel}
            totalCount={item.totalCount}
            collapsible
            isExpanded={!collapsedServers.includes(item.serverId)}
            onToggle={() => toggleServer(item.serverId)}
            isRefreshing={isBackgroundRefreshing}
          />
        )
      case 'quietTail':
        return <QuietTailRow count={item.entries.length} onPress={() => openQuietTail(item.entries)} />
      case 'skeleton':
        return <HistorySkeletonRow />
      case 'row': {
        if (item.entry.tier === 'cantResume') {
          if (item.entry.item.kind === 'session') {
            return (
              <CantResumeSessionRow
                session={item.entry.item.item}
                title={item.entry.title.title}
                statusLabel={item.entry.statusLabel}
                timestamp={item.entry.item.ms}
              />
            )
          }
          return (
            <CantResumeConversationRow
              conv={item.entry.item.item}
              title={item.entry.title.title}
              statusLabel={item.entry.statusLabel}
              timestamp={item.entry.item.ms}
              highlight={highlight}
              onLongPress={setActiveConv}
            />
          )
        }
        // A live tier is a card wherever it sits; everything else is a two-line row.
        if (item.entry.tier === 'needsYou' || item.entry.tier === 'working') {
          const session = item.entry.item.item as MultiSession
          const Card = item.entry.tier === 'needsYou' ? NeedsYouCard : WorkingCard
          return (
            <Card
              session={session}
              title={item.entry.title.title}
              serverLabel={multiServer ? session.serverLabel : undefined}
              serverColor={servers[session.serverId]?.color}
              dominantProvider={dominantProvider}
              isFirst={item.isFirst}
            />
          )
        }
        return (
          <EarlierRow
            item={item.entry.item}
            title={item.entry.title.title}
            quiet={item.entry.title.rung !== 'intent'}
            isFirst={item.isFirst}
            highlight={highlight}
            dominantProvider={dominantProvider}
            onLongPressConversation={setActiveConv}
          />
        )
      }
    }
  }, [collapsedServers, toggleServer, isBackgroundRefreshing, multiServer, servers, openQuietTail, highlight, dominantProvider])

  return (
    <View style={{ flex: 1 }} testID="now-list">
      <FlatList
        testID="now-list-scroll"
        data={flatData}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        keyboardShouldPersistTaps="handled"
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        onScroll={onScroll}
        scrollEventThrottle={16}
        {...LIST_WINDOW}
        {...inset.props}
        ListHeaderComponent={
          // The header is full-bleed; undo the row gutter around it.
          ListHeaderComponent ? <View style={{ marginHorizontal: -(spacing.sm + 2), paddingTop: spacing.xs }}>{ListHeaderComponent}</View> : null
        }
        contentContainerStyle={[
          {
            paddingHorizontal: spacing.sm + 2,
            paddingBottom: FAB_CLEARANCE + insets.bottom,
            flexGrow: 1,
          },
          inset.contentStyle,
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.text.secondary}
            progressViewOffset={inset.progressViewOffset}
          />
        }
        ListEmptyComponent={
          <View style={{ flex: 1 }}>
            {searchQuery ? (
              <EmptyState title={t('list.noResults')} subtitle={t('list.noResultsSubtitle', { query: searchQuery })} />
            ) : (
              <EmptyState
                title={t('list.empty')}
                subtitle={t('list.emptySubtitle')}
                action={onNewSession ? { label: t('fab.newSession'), onPress: onNewSession, plus: true } : undefined}
              />
            )}
          </View>
        }
      />
      {activeConv ? (() => {
        const favId = buildFavoriteId(activeConv.serverId, 'conversation', activeConv.id)
        const isFav = favorites.some((f) => f.id === favId)
        const label = activeConv.title || activeConv.projectPath || activeConv.id
        return (
          <QuickAccessActionSheet
            item={{ type: 'conversation', id: favId, label, serverId: activeConv.serverId }}
            isFavorite={isFav}
            onClose={() => setActiveConv(null)}
            onNewSession={() => setActiveConv(null)}
            onBrowse={() => setActiveConv(null)}
            onOpenSession={() => {
              setActiveConv(null)
              useNavLockStore.getState().lock()
              router.push(conversationHref(activeConv.id, activeConv.serverId, searchQuery))
            }}
            onTogglePin={() => {
              if (isFav) {
                unpinItem(favId)
              } else {
                pinItem({ type: 'conversation', id: favId, label, serverId: activeConv.serverId, conversationId: activeConv.id })
              }
              setActiveConv(null)
            }}
          />
        )
      })() : null}
    </View>
  )
})
