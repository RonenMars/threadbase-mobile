import React, { useMemo, useState } from 'react'
import { ActivityIndicator, Text, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { CaretRight } from 'phosphor-react-native'
import { useNavLockStore } from '@/stores/navLock'
import { isPresentationLive, deriveSessionPresentation } from '@/lib/sessionPresentation'
import { colorForToken } from '@/components/sessions/SessionStatusBadge'
import { projectRailToken } from './projectTiers'
import { useThemedStyles } from '@/hooks/useThemedStyles'
import { isToday } from './hubUtils'
import { SessionRow } from './SessionRow'
import { ConvRow } from './ConvRow'
import { CollapsibleCard } from '@/components/sessions/base/CollapsibleCard'
import { useProjectConversations } from '@/hooks/useProjectConversations'
import { pathDisplay } from '@/components/sessions/shared/pathDisplay'
import { formatListTime } from '@/components/sessions/shared/formatListTime'
import { makeStyles } from '@/components/sessions/base/CollapsibleCard.styles'
import type { ProjectHubCardProps } from './types'
import type { MultiConversation } from '@/types/api'
import { QuickAccessActionSheet } from '@/components/quick-access/QuickAccessActionSheet'
import { useQuickAccessStore, buildFavoriteId } from '@/stores/quickAccess'
import { sessionActivityMs } from '@/lib/sessionActivity'

// Memoized: the hub re-renders on every fetch-progress tick, and a project
// card is a native glass surface — re-running every mounted one per tick is
// what made the accordions feel unresponsive on a host with many projects.
export const ProjectHubCard = React.memo(function ProjectHubCard({ group, isOpen, onToggle, forceServerChip = false }: ProjectHubCardProps) {
  const { t, i18n } = useTranslation('sessions')
  const { styles, theme } = useThemedStyles(makeStyles)
  const router = useRouter()
  const [activeConv, setActiveConv] = useState<MultiConversation | null>(null)
  const { favorites, pinItem, unpinItem } = useQuickAccessStore()
  // Expand-to-load: a closed card knows its conversation count from the
  // project summary and fetches nothing. Opening it issues the first page.
  // The card only ever shows a preview — the first page is enough for both the
  // 5-row list and the merged view, with "see all" routing to the full screen.
  const { conversations, isLoading } = useProjectConversations(
    group.projectPath,
    group.serverId,
    undefined,
    { enabled: isOpen && group.conversationCount > 0 },
  )

  const sessionCount = group.sessions.length
  const convCount = group.conversationCount
  const encodedPath = encodeURIComponent(group.projectPath)
  // Prefer projectId for navigation identity (Step 5). Falls back to the
  // path-encoded value during migration when backend hasn't filled it yet.
  const projectId = group.sessions.find((s) => s.projectId)?.projectId ?? encodedPath

  const todaySessionCount = group.sessions.filter((s) => isToday(s.startedAt)).length

  // Colour belongs to state alone: the rail is the most urgent live session's
  // colour, and a project with nothing live has no rail.
  const railToken = useMemo(() => projectRailToken(group), [group])

  // Header content — smart path display + activity summary.
  // `projectName` is just the trailing segment derived from the path, so the
  // path IS the identity. We show parent muted (left-truncated) + suffix bold.
  const pathRendered = useMemo(
    () => pathDisplay(group.projectPath, { mode: 'smart' }),
    [group.projectPath],
  )

  const activitySummary = useMemo(() => {
    const needsYouCount = group.sessions.filter((s) => deriveSessionPresentation(s).tier === 'needsYou').length
    const liveCount = group.sessions.filter(isPresentationLive).length
    const lastActivity = group.latestActivityMs > 0
      ? formatListTime(group.latestActivityMs, {
          locale: i18n.language,
          labels: {
            now: t('hub.timeNow'),
            yesterday: t('hub.timeYesterday'),
          },
        })
      : null
    const pieces: string[] = []
    if (needsYouCount > 0) pieces.push(t('hub.activityNeedsYou', { count: needsYouCount }))
    else if (liveCount > 0) pieces.push(t('hub.activityLive', { count: liveCount }))
    if (todaySessionCount > 0) pieces.push(t('hub.activityToday', { total: todaySessionCount }))
    if (lastActivity) pieces.push(t('hub.activityLast', { time: lastActivity }))
    return pieces.join(' · ')
  }, [group.sessions, group.latestActivityMs, todaySessionCount, i18n.language, t])

  const renderSheet = (activeConv: MultiConversation) => {
        const favId = buildFavoriteId(activeConv.serverId, 'conversation', activeConv.id)
        const isFav = favorites.some((f) => f.id === favId)
        return (
          <QuickAccessActionSheet
            item={{
              type: 'conversation',
              id: favId,
              label: activeConv.title || activeConv.projectPath || activeConv.id,
              serverId: activeConv.serverId,
            }}
            isFavorite={isFav}
            onClose={() => setActiveConv(null)}
            onNewSession={() => setActiveConv(null)}
            onBrowse={() => setActiveConv(null)}
            onOpenSession={() => {
              setActiveConv(null)
              useNavLockStore.getState().lock()
              router.push(`/conversation/${activeConv.id}?server=${activeConv.serverId}`)
            }}
            onTogglePin={() => {
              if (isFav) {
                unpinItem(favId)
              } else {
                pinItem({
                  type: 'conversation',
                  id: favId,
                  label: activeConv.title || activeConv.projectPath || activeConv.id,
                  serverId: activeConv.serverId,
                  conversationId: activeConv.id,
                })
              }
              setActiveConv(null)
            }}
          />
        )
      }

  return (
    <CollapsibleCard
      id={group.projectId}
      parentLabel={pathRendered.parent || undefined}
      title={pathRendered.suffix || group.projectName}
      activityLine={activitySummary || undefined}
      count={sessionCount + convCount}
      railColor={railToken ? colorForToken(theme, railToken) : null}
      isOpen={isOpen}
      onToggle={onToggle}
      accessibilityLabel={group.projectName}
      headerTestID={`hub-project-${group.projectName}`}
      after={activeConv ? renderSheet(activeConv) : null}
    >
            {(() => {
              const previewLimit = 3
              const merged = [
                ...group.sessions.map((s) => ({
                  key: `s-${s.serverId}::${s.id}`,
                  ms: sessionActivityMs(s),
                  node: <SessionRow key={`s-${s.serverId}::${s.id}`} session={s} forceServerChip={forceServerChip} />,
                })),
                ...conversations.map((c) => ({
                  key: `c-${c.serverId}::${c.id}`,
                  ms: Date.parse(c.lastActivity) || 0,
                  node: <ConvRow key={`c-${c.serverId}::${c.id}`} conv={c} forceServerChip={forceServerChip} />,
                })),
              ].sort((a, b) => b.ms - a.ms)
              const hasMore = merged.length > previewLimit || convCount > conversations.length
              return (
                <>
                  {merged.slice(0, previewLimit).map((item) => item.node)}
                  {isLoading ? (
                    <ActivityIndicator
                      style={styles.bodySpinner}
                      size="small"
                      color={theme.text.secondary}
                      testID={`hub-conversations-loading-${group.projectPath}`}
                    />
                  ) : null}
                  {hasMore && convCount > 0 ? (
                    <TouchableOpacity
                      onPress={() => router.push(`/project/${projectId}?path=${encodedPath}&server=${encodeURIComponent(group.serverId)}`)}
                      activeOpacity={0.6}
                      style={styles.seeAllRow}
                      testID={`hub-see-all-${group.projectPath}`}
                    >
                      <Text style={styles.seeAllText}>{t('hub.seeAll', { count: convCount })}</Text>
                      <CaretRight size={16} color={theme.text.accent} />
                    </TouchableOpacity>
                  ) : null}
                </>
              )
            })()}
    </CollapsibleCard>
  )
})
