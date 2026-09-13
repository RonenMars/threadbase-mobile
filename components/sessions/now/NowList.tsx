import React, { useCallback, useMemo, useState } from 'react'
import { View, TextInput, FlatList, RefreshControl } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { EmptyState } from '@/components/ui/EmptyState'
import { FAB_CLEARANCE } from '@/components/ui/FAB'
import { QuickAccessActionSheet } from '@/components/quick-access/QuickAccessActionSheet'
import { ServerHeaderRow } from '@/components/sessions/tree/ServerHeaderRow'
import { LIST_WINDOW } from '@/components/sessions/shared/listWindow'
import { makeStyles as makeSearchStyles } from '@/components/sessions/SearchStyles'
import { isToday } from '@/components/sessions/hub/hubUtils'
import {
  resolveConversationRowTitle,
  resolveSessionRowTitle,
  type RowTitle,
} from '@/components/sessions/shared/rowTitle'
import { spacing } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { conversationHref } from '@/lib/conversationHref'
import { useAppDirection } from '@/lib/rtl'
import { deriveSessionPresentation, type SessionTier } from '@/lib/sessionPresentation'
import { useNavLockStore } from '@/stores/navLock'
import { useQuickAccessStore, buildFavoriteId } from '@/stores/quickAccess'
import { useServersStore } from '@/stores/servers'
import { useSessionNamesStore } from '@/stores/sessionNames'
import { useViewPrefsStore } from '@/stores/viewPrefs'
import type { MultiConversation, MultiSession } from '@/types/api'
import type { SortBy, SortOrder } from '@/types/ui'
import { EarlierRow } from './EarlierRow'
import { GroupedNoiseRow } from './GroupedNoiseRow'
import { NeedsYouCard } from './NeedsYouCard'
import { SectionEyebrow, type SectionTone } from './SectionEyebrow'
import { WorkingCard } from './WorkingCard'
import { mergedItemMatchesQuery, type MergedItem } from './mergedItems'

interface Props {
  items: MergedItem[]
  refreshing: boolean
  onRefresh: () => void
  onEndReached?: () => void
  searchOpen?: boolean
  searchQuery: string
  conversationsFromServer: boolean
  onSearchChange: (q: string) => void
  isBackgroundRefreshing?: boolean
  /** `state` sections the list; the other two flatten it into one ordered run. */
  order?: SortBy
  direction?: SortOrder
}

interface Entry {
  item: MergedItem
  title: RowTitle
  tier: SessionTier | null
}

type FlatItem =
  | { kind: 'eyebrow'; key: string; label: string; tone: SectionTone; count?: number }
  | { kind: 'serverHeader'; key: string; serverId: string; serverLabel: string; totalCount: number }
  | { kind: 'row'; key: string; entry: Entry; isFirst: boolean }
  | { kind: 'grouped'; key: string; members: Entry[] }

const NOISE_GROUP_MIN = 3

function entryKey(e: Entry): string {
  return `${e.item.kind}:${e.item.item.serverId}::${e.item.item.id}`
}

/**
 * Fold ≥3 rejected-title rows in one bucket into a single grouped row at the
 * position of the first; expanding lists them back inline. Display-layer only.
 */
function withNoiseGrouped(bucket: Entry[], groupKey: string, expanded: boolean): FlatItem[] {
  const noise = bucket.filter((e) => e.title.noise)
  if (noise.length < NOISE_GROUP_MIN) {
    return bucket.map((e) => ({ kind: 'row', key: entryKey(e), entry: e, isFirst: false }))
  }
  const out: FlatItem[] = []
  let inserted = false
  for (const e of bucket) {
    if (!e.title.noise) {
      out.push({ kind: 'row', key: entryKey(e), entry: e, isFirst: false })
      continue
    }
    if (!inserted) {
      out.push({ kind: 'grouped', key: groupKey, members: noise })
      if (expanded) out.push(...noise.map((n) => ({ kind: 'row' as const, key: entryKey(n), entry: n, isFirst: false })))
      inserted = true
    }
  }
  return out
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
  searchOpen,
  searchQuery,
  conversationsFromServer,
  onSearchChange,
  isBackgroundRefreshing,
  order = 'state',
  direction: sortDirection = 'desc',
}: Props) {
  const theme = useTheme()
  const { direction } = useAppDirection()
  const searchStyles = makeSearchStyles(theme, direction)
  const insets = useSafeAreaInsets()
  const { t } = useTranslation('sessions')
  const router = useRouter()
  const activeServerIds = useServersStore((s) => s.activeServerIds)
  const servers = useServersStore((s) => s.servers)
  const getName = useSessionNamesStore((s) => s.getName)
  const getNameOrigin = useSessionNamesStore((s) => s.getOrigin)
  const collapsedServers = useViewPrefsStore((s) => s.collapsedServers)
  const toggleServer = useViewPrefsStore((s) => s.toggleServerCollapsed)
  const { favorites, pinItem, unpinItem } = useQuickAccessStore()
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set())
  const [activeConv, setActiveConv] = useState<MultiConversation | null>(null)
  const multiServer = activeServerIds.length > 1

  const entries = useMemo((): Entry[] => {
    const q = searchQuery.trim().toLowerCase()
    const visible = q ? items.filter((it) => mergedItemMatchesQuery(it, q, conversationsFromServer)) : items
    return visible.map((item) => {
      const stored = { name: getName(item.item.serverId, item.item.id), origin: getNameOrigin(item.item.serverId, item.item.id) }
      if (item.kind === 'session') {
        return { item, title: resolveSessionRowTitle(item.item, stored), tier: deriveSessionPresentation(item.item).tier }
      }
      return { item, title: resolveConversationRowTitle(item.item, stored), tier: null }
    })
  }, [items, searchQuery, conversationsFromServer, getName, getNameOrigin])

  const flatData = useMemo((): FlatItem[] => {
    const sign = sortDirection === 'asc' ? -1 : 1
    const byTime = (a: Entry, b: Entry) => sign * (b.item.ms - a.item.ms)
    if (order !== 'state') {
      const projectOf = (e: Entry) =>
        e.item.kind === 'session' ? e.item.item.projectName : (e.item.item.projectPath.split('/').filter(Boolean).pop() ?? '')
      const byProject = (a: Entry, b: Entry) => projectOf(a).localeCompare(projectOf(b)) || byTime(a, b)
      const flat = withNoiseGrouped([...entries].sort(order === 'projectName' ? byProject : byTime), 'grouped-all', expandedGroups.has('grouped-all'))
      const first = flat.find((f) => f.kind === 'row' && f.entry.item.kind === 'session')
      if (first && first.kind === 'row') first.isFirst = true
      return flat
    }
    const needsYou = entries.filter((e) => e.tier === 'needsYou').sort(byTime)
    const working = entries.filter((e) => e.tier === 'working').sort(byTime)
    const earlier = entries.filter((e) => e.tier !== 'needsYou' && e.tier !== 'working').sort(byTime)

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
      const withRows = activeServerIds.filter((id) => earlier.some((e) => e.item.item.serverId === id))
      const collapsible = withRows.length > 1
      for (const id of withRows) {
        const bucket = earlier.filter((e) => e.item.item.serverId === id)
        out.push({ kind: 'serverHeader', key: `server-${id}`, serverId: id, serverLabel: servers[id]?.label ?? id, totalCount: bucket.length })
        if (collapsible && collapsedServers.includes(id)) continue
        out.push(...withNoiseGrouped(bucket, `grouped-${id}`, expandedGroups.has(`grouped-${id}`)))
      }
    } else {
      const today = earlier.filter((e) => isToday(new Date(e.item.ms).toISOString()))
      const older = earlier.filter((e) => !isToday(new Date(e.item.ms).toISOString()))
      if (today.length > 0) {
        out.push({ kind: 'eyebrow', key: 'eyebrow-today', tone: 'muted', label: t('live.headerEarlierToday'), count: today.length })
        out.push(...withNoiseGrouped(today, 'grouped-today', expandedGroups.has('grouped-today')))
      }
      if (older.length > 0) {
        out.push({ kind: 'eyebrow', key: 'eyebrow-older', tone: 'muted', label: t('live.headerEarlier'), count: older.length })
        out.push(...withNoiseGrouped(older, 'grouped-older', expandedGroups.has('grouped-older')))
      }
    }

    const first = out.find((f) => f.kind === 'row' && f.entry.item.kind === 'session')
    if (first && first.kind === 'row') first.isFirst = true
    return out
  }, [entries, order, sortDirection, multiServer, activeServerIds, servers, collapsedServers, expandedGroups, t])

  const toggleGroup = useCallback((key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

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
      case 'grouped':
        return (
          <GroupedNoiseRow
            titles={item.members.map((m) => m.title.title)}
            expanded={expandedGroups.has(item.key)}
            onToggle={() => toggleGroup(item.key)}
          />
        )
      case 'row': {
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
              isFirst={item.isFirst}
            />
          )
        }
        return (
          <EarlierRow
            item={item.entry.item}
            title={item.entry.title.title}
            isFirst={item.isFirst}
            highlight={highlight}
            onLongPressConversation={setActiveConv}
          />
        )
      }
    }
  }, [collapsedServers, toggleServer, isBackgroundRefreshing, multiServer, servers, expandedGroups, toggleGroup, highlight])

  return (
    <View style={{ flex: 1 }} testID="now-list">
      {searchOpen ? (
        <View style={searchStyles.searchBar}>
          <TextInput
            testID="hub-search-input"
            style={searchStyles.searchInput}
            value={searchQuery}
            onChangeText={onSearchChange}
            placeholder={t('search.placeholder')}
            placeholderTextColor={theme.text.secondary}
            autoFocus
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>
      ) : null}
      <FlatList
        data={flatData}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        keyboardShouldPersistTaps="handled"
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        {...LIST_WINDOW}
        contentContainerStyle={{
          paddingHorizontal: spacing.sm + 2,
          paddingBottom: FAB_CLEARANCE + insets.bottom,
          flexGrow: 1,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.text.secondary} />
        }
        ListEmptyComponent={
          <View style={{ flex: 1 }}>
            {searchQuery ? (
              <EmptyState title={t('list.noResults')} subtitle={t('list.noResultsSubtitle', { query: searchQuery })} />
            ) : (
              <EmptyState title={t('list.empty')} subtitle={t('list.emptySubtitle')} />
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
