import React, { useCallback, useMemo, useState } from 'react'
import { View, Text, ScrollView, RefreshControl, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { CaretRight } from 'phosphor-react-native'
import { useTheme } from '@/contexts/ThemeContext'
import { SubagentRow } from '@/components/sessions/hub/SubagentRow'
import { useOpenIds } from '@/components/sessions/base/useOpenIds'
import { CollapsibleCard } from '@/components/sessions/base/CollapsibleCard'
import { SectionEyebrow } from '@/components/sessions/now/SectionEyebrow'
import { DAY_BUCKET_ORDER, dayBucketLabel } from '@/components/sessions/shared/dayBuckets'
import { formatListTime } from '@/components/sessions/shared/formatListTime'
import { earlierBucketFor, type EarlierBucket } from '@/components/sessions/hub/hubUtils'
import { FAB_CLEARANCE } from '@/components/ui/FAB'
import { useThemedStyles } from '@/hooks/useThemedStyles'
import { makeStyles as makeCardStyles } from '@/components/sessions/base/CollapsibleCard.styles'
import { font, spacing, type Theme } from '@/constants/theme'
import { useViewPrefsStore } from '@/stores/viewPrefs'
import { useAllSubagents } from '@/hooks/useAllSubagents'
import { conversationHref } from '@/lib/conversationHref'
import { isLiveAttachedPty } from '@/lib/sessionLeavePolicy'
import type { MultiSession } from '@/types/api'
import { groupSubagentsByParent, type SubagentGroup, resolveSubagentLabel, resolveSubagentType } from '@/lib/subagents'

interface Props {
  serverIds: readonly string[]
  /** Parent conversation titles the list already holds, keyed by conversation id. */
  parentTitles: ReadonlyMap<string, string>
  /** Sessions the list already holds: a parent with a live one opens that screen, not its history. */
  liveSessions?: readonly MultiSession[]
  topInset?: number
}

/** Children shown before "Show all": a 13-child group would otherwise push every other card off screen. */
const COLLAPSED_ROWS = 3

// Default param keeps this clear of react-hooks/purity, same idiom as NowList.
function bucketGroups(groups: SubagentGroup[], now: number = Date.now()): Record<EarlierBucket, SubagentGroup[]> {
  const buckets: Record<EarlierBucket, SubagentGroup[]> = { last7Days: [], last14Days: [], lastMonth: [], earlier: [] }
  for (const g of groups) buckets[earlierBucketFor(Date.parse(g.items[0].lastActivity) || 0, now)].push(g)
  return buckets
}

/**
 * Every sub-agent across the active servers, grouped under its parent and
 * sectioned like the Now tab: RUNNING first, then idle parents by recency.
 * Read-only: a row opens the transcript, a group's footer opens the parent.
 */
export function SubagentBoard({ serverIds, parentTitles, liveSessions = [], topInset = 0 }: Props) {
  const { t } = useTranslation('sessions')
  const theme = useTheme()
  const styles = useMemo(() => makeStyles(theme), [theme])
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { openIds, toggleOpen } = useOpenIds()
  const collapsedDayBuckets = useViewPrefsStore((s) => s.collapsedDayBuckets)
  const toggleDayBucket = useViewPrefsStore((s) => s.toggleDayBucketCollapsed)
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

  const groups = useMemo(() => groupSubagentsByParent(items.map((i) => i.conversation)), [items])
  const running = useMemo(() => groups.filter((g) => g.activeCount > 0), [groups])
  const buckets = useMemo(() => bucketGroups(groups.filter((g) => g.activeCount === 0)), [groups])
  const allUnsupported = serverIds.length > 0 && unsupportedServerIds.length === serverIds.length

  const renderGroup = (g: SubagentGroup) => {
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
        onOpenParent={() => {
          const live = liveSessions.find(
            (x) => x.serverId === serverId && isLiveAttachedPty(x) && (x.boundConversationId ?? x.conversationId) === g.parentId,
          )
          router.push(live ? `/session/${live.id}?server=${serverId}` : conversationHref(g.parentId, serverId))
        }}
        serverIdFor={(id) => serverByRowId.get(id) ?? serverId}
      />
    )
  }

  let body: React.ReactNode
  if (isLoading) body = <ActivityIndicator color={theme.text.secondary} style={styles.pad} />
  else if (allUnsupported) body = <Text style={[styles.note, styles.pad]}>{t('subagents.board.unsupported')}</Text>
  else if (isError) body = <Text style={[styles.note, styles.pad]}>{t('subagents.loadFailed')}</Text>
  else if (groups.length === 0) body = <Text style={[styles.note, styles.pad]}>{t('subagents.board.empty')}</Text>
  else
    body = (
      <>
        {running.length > 0 ? (
          <>
            <View style={styles.eyebrow}>
              <SectionEyebrow label={t('subagents.board.headerRunning', { n: running.length })} tone="working" />
            </View>
            {running.map(renderGroup)}
          </>
        ) : null}
        {DAY_BUCKET_ORDER.map((key) => {
          const bucket = buckets[key]
          if (bucket.length === 0) return null
          const expanded = !collapsedDayBuckets.includes(key)
          return (
            <React.Fragment key={key}>
              <View style={styles.eyebrow}>
                <SectionEyebrow
                  label={dayBucketLabel(key, t)}
                  tone="muted"
                  count={bucket.length}
                  collapsible
                  isExpanded={expanded}
                  onToggle={() => toggleDayBucket(key)}
                  testID={`subagent-day-bucket-${key}`}
                />
              </View>
              {expanded ? bucket.map(renderGroup) : null}
            </React.Fragment>
          )
        })}
      </>
    )

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={{ paddingTop: topInset, paddingBottom: FAB_CLEARANCE + insets.bottom }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.text.secondary} progressViewOffset={topInset} />}
      testID="subagent-board"
    >
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

/**
 * One parent session as a collapsible card. The header carries the state (rail,
 * running count, last activity); the body lists the newest children and ends in
 * one footer row: Show all on the left, Open parent on the right.
 */
export function SubagentGroupCard({ group: g, title, isOpen, onToggle, onOpenParent, serverIdFor }: GroupCardProps) {
  const { t } = useTranslation('sessions')
  const { styles: card, theme } = useThemedStyles(makeCardStyles)
  const styles = useMemo(() => makeStyles(theme), [theme])
  const [showAll, setShowAll] = useState(false)

  const types = new Set(g.items.map((c) => resolveSubagentType(c)))
  const sharedType = types.size === 1 ? [...types][0] : undefined
  const lastActivity = formatListTime(g.items[0].lastActivity)
  const activityLine = [
    g.activeCount > 0 ? t('subagents.board.parentActive', { n: g.activeCount }) : null,
    sharedType ?? null,
    lastActivity ? t('hub.activityLast', { time: lastActivity }) : null,
  ]
    .filter(Boolean)
    .join(' · ')

  const capped = g.items.length > COLLAPSED_ROWS
  const rows = capped && !showAll ? g.items.slice(0, COLLAPSED_ROWS) : g.items

  return (
    <View style={styles.cardWrap} testID={`subagent-group-${g.parentId}`}>
      <CollapsibleCard
        id={g.parentId}
        title={title}
        titleLines={2}
        activityLine={activityLine || undefined}
        count={g.items.length}
        railColor={g.activeCount > 0 ? theme.status.running : theme.border}
        isOpen={isOpen}
        onToggle={onToggle}
        accessibilityLabel={title}
        headerTestID={`subagent-group-toggle-${g.parentId}`}
      >
        {rows.map((c) => (
          <SubagentRow
            key={c.id}
            conv={{ ...c, title: resolveSubagentLabel(c), serverId: serverIdFor(c.id) }}
            showType={sharedType === undefined}
          />
        ))}
        <View style={styles.footer}>
          {capped ? (
            <TouchableOpacity
              onPress={() => setShowAll((v) => !v)}
              activeOpacity={0.6}
              style={styles.footerLink}
              accessibilityRole="button"
              testID={`subagent-show-all-${g.parentId}`}
            >
              <Text style={card.seeAllText}>
                {showAll ? t('subagents.board.showLess') : t('subagents.board.showAll', { n: g.items.length })}
              </Text>
            </TouchableOpacity>
          ) : (
            <View />
          )}
          <TouchableOpacity
            onPress={onOpenParent}
            activeOpacity={0.6}
            style={styles.footerLink}
            accessibilityRole="button"
            accessibilityLabel={`${t('subagents.board.openParent')}: ${title}`}
            testID={`subagent-parent-${g.parentId}`}
          >
            <Text style={card.seeAllText}>{t('subagents.board.openParent')}</Text>
            <CaretRight size={16} color={theme.text.accent} />
          </TouchableOpacity>
        </View>
      </CollapsibleCard>
    </View>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    scroll: { flex: 1 },
    pad: { paddingVertical: spacing.md, paddingHorizontal: spacing.md },
    note: { color: theme.text.secondary, fontSize: font.sm },
    eyebrow: { marginHorizontal: spacing.md },
    cardWrap: { marginHorizontal: spacing.md, marginBottom: spacing.sm },
    footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.sm },
    footerLink: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 44 },
  })
}
