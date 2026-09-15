import React, { useCallback, useMemo, useState } from 'react'
import { ActivityIndicator, View, Text, TouchableOpacity, Platform, UIManager, LayoutAnimation } from 'react-native'
import Animated, { useSharedValue, withTiming, useAnimatedStyle, interpolate } from 'react-native-reanimated'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { CaretRight } from 'phosphor-react-native'
import { useNavLockStore } from '@/stores/navLock'
import { isPresentationLive, deriveSessionPresentation } from '@/lib/sessionPresentation'
import { colorForToken } from '@/components/sessions/SessionStatusBadge'
import { projectRailToken } from './projectTiers'
import { useThemedStyles } from '@/hooks/useThemedStyles'
import { useReduceMotion } from '@/hooks/useAccessibilitySettings'
import { isToday } from './hubUtils'
import { SessionRow } from './SessionRow'
import { ConvRow } from './ConvRow'
import { Card } from '@/components/ui/Card'
import { useProjectConversations } from '@/hooks/useProjectConversations'
import { pathDisplay } from '@/components/sessions/shared/pathDisplay'
import { formatListTime } from '@/components/sessions/shared/formatListTime'
import { makeStyles } from './ProjectHubCard.styles'
import type { ProjectHubCardProps } from './types'
import type { MultiConversation } from '@/types/api'
import { QuickAccessActionSheet } from '@/components/quick-access/QuickAccessActionSheet'
import { useQuickAccessStore, buildFavoriteId } from '@/stores/quickAccess'

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true)
}

// Memoized: the hub re-renders on every fetch-progress tick, and a project
// card is a native glass surface — re-running every mounted one per tick is
// what made the accordions feel unresponsive on a host with many projects.
export const ProjectHubCard = React.memo(function ProjectHubCard({ group, isOpen, onToggle, forceServerChip = false, onBrowsePath }: ProjectHubCardProps) {
  const { t, i18n } = useTranslation('sessions')
  const { styles, theme } = useThemedStyles(makeStyles)
  const router = useRouter()
  const [activeConv, setActiveConv] = useState<MultiConversation | null>(null)
  const { favorites, pinItem, unpinItem } = useQuickAccessStore()
  const chevronProgress = useSharedValue(isOpen ? 1 : 0)
  const reduceMotion = useReduceMotion()

  const handleToggle = useCallback(() => {
    // Reduce Motion: the body appears in place and the chevron snaps.
    if (!reduceMotion) LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    const next = isOpen ? 0 : 1
    chevronProgress.value = withTiming(next, { duration: reduceMotion ? 0 : 200 })
    onToggle(group.projectId)
    // chevronProgress is a Reanimated shared value (stable across renders);
    // omitting it avoids the react-hooks/immutability flag.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, onToggle, group.projectId, reduceMotion])

  const chevronStyle = useAnimatedStyle(() => ({
    // CaretRight: 90° points down for "open"; 180° pointed left.
    transform: [{ rotate: `${interpolate(chevronProgress.value, [0, 1], [0, 90])}deg` }],
  }))

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

  return (
    <Card style={{ overflow: 'hidden', gap: 0, padding: 0 }}>
      <View style={styles.spineRow}>
        {railToken ? (
          <View style={[styles.spine, { backgroundColor: colorForToken(theme, railToken) }]} />
        ) : (
          <View style={styles.spinePlaceholder} />
        )}

        <View style={styles.spineRowBody}>
          <TouchableOpacity
            onPress={handleToggle}
            activeOpacity={0.75}
            style={styles.header}
            accessibilityLabel={group.projectName}
            testID={`hub-project-${group.projectName}`}
          >
            <View style={styles.headerBody}>
              {pathRendered.parent ? (
                <Text style={styles.headerParent} numberOfLines={1}>{pathRendered.parent}</Text>
              ) : null}
              <Text style={styles.headerSuffix} numberOfLines={1}>
                {pathRendered.suffix || group.projectName}
              </Text>
              {activitySummary ? (
                <Text style={styles.headerActivity} numberOfLines={1}>{activitySummary}</Text>
              ) : null}
            </View>
            <Text style={styles.countBadge}>
              {sessionCount + convCount}
            </Text>
            <Animated.View style={chevronStyle}>
              <CaretRight size={16} color={theme.text.secondary} />
            </Animated.View>
          </TouchableOpacity>

          {isOpen && (
            <View style={styles.body}>
          <View style={styles.section}>
            {(() => {
              const previewLimit = 3
              const merged = [
                ...group.sessions.map((s) => ({
                  key: `s-${s.serverId}::${s.id}`,
                  ms: s.completedAt ? Date.parse(s.completedAt) : Date.parse(s.startedAt) + (s.elapsedMs ?? 0),
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
                      onPress={() => router.push(`/project/${projectId}?path=${encodedPath}`)}
                      activeOpacity={0.75}
                      style={styles.seeAllRow}
                    >
                      <Text style={styles.seeAllText}>{t('hub.seeAll', { count: convCount })}</Text>
                      <CaretRight size={14} color={theme.text.accent} />
                    </TouchableOpacity>
                  ) : null}
                </>
              )
            })()}
          </View>
              {onBrowsePath ? (
                <TouchableOpacity
                  onPress={() => onBrowsePath(group)}
                  activeOpacity={0.75}
                  style={styles.seeAllRow}
                  testID={`hub-browse-path-${group.projectPath}`}
                >
                  <Text style={styles.seeAllText}>{t('hub.browsePath')}</Text>
                  <CaretRight size={14} color={theme.text.accent} />
                </TouchableOpacity>
              ) : null}
            </View>
          )}
        </View>
      </View>
      {activeConv ? (() => {
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
      })() : null}
    </Card>
  )
})
