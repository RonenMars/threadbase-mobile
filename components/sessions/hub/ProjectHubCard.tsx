import React, { useCallback, useMemo, useState } from 'react'
import { ActivityIndicator, View, Text, TouchableOpacity, Platform, UIManager, LayoutAnimation } from 'react-native'
import Animated, { useSharedValue, withTiming, useAnimatedStyle, interpolate } from 'react-native-reanimated'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { CaretRight } from 'phosphor-react-native'
import { useSettingsStore } from '@/stores/settings'
import { useNavLockStore } from '@/stores/navLock'
import { useTheme } from '@/contexts/ThemeContext'
import { isToday } from './hubUtils'
import { SessionRow } from './SessionRow'
import { ConvRow } from './ConvRow'
import { Card } from '@/components/ui/Card'
import { useProjectConversations } from '@/hooks/useProjectConversations'
import { pathDisplay } from '@/components/sessions/shared/pathDisplay'
import { formatListTime } from '@/components/sessions/shared/formatListTime'
import { makeStyles } from './ProjectHubCard.styles'
import type { ProjectHubCardProps } from './types'
import type { MultiSession, MultiConversation } from '@/types/api'
import { QuickAccessActionSheet } from '@/components/quick-access/QuickAccessActionSheet'
import { useQuickAccessStore, buildFavoriteId } from '@/stores/quickAccess'
import { ltrContentStyle, useAppDirection } from '@/lib/rtl'

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true)
}

export function ProjectHubCard({ group, isOpen, onToggle, forceServerChip = false }: ProjectHubCardProps) {
  const { t, i18n } = useTranslation('sessions')
  const { isRTL } = useAppDirection()
  const theme = useTheme()
  const styles = makeStyles(theme)
  const router = useRouter()
  const mergeChats = useSettingsStore((s) => s.mergeChats)
  const [activeConv, setActiveConv] = useState<MultiConversation | null>(null)
  const { favorites, pinItem, unpinItem } = useQuickAccessStore()
  const chevronProgress = useSharedValue(isOpen ? 1 : 0)

  const handleToggle = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    const next = isOpen ? 0 : 1
    chevronProgress.value = withTiming(next, { duration: 200 })
    onToggle()
    // chevronProgress is a Reanimated shared value (stable across renders);
    // omitting it avoids the react-hooks/immutability flag.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, onToggle])

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(chevronProgress.value, [0, 1], [0, 180])}deg` }],
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
  // Only the loaded rows can be counted, so this is 0 while the card is closed
  // — the closed header shows "N live · last <time>" without a today count.
  const todayConvCount = conversations.filter((c) => isToday(c.lastActivity)).length

  // Derive the project's lifecycle colour the same way SessionCard does.
  // Amber spine when any session is live; blue spine when sessions exist
  // but are all idle (still a thread, just quiet); no spine when only
  // conversations are present (history-only project).
  const liveStatus = useMemo(() => {
    const hasLive = group.sessions.some(
      (s: MultiSession) => s.status === 'running' || s.status === 'waiting_input',
    )
    if (hasLive) return { color: theme.status.waiting, opacity: 1 }
    if (group.sessions.length > 0) return { color: theme.text.accent, opacity: 0.55 }
    return null
  }, [group.sessions, theme.status.waiting, theme.text.accent])

  // Header content — smart path display + activity summary.
  // `projectName` is just the trailing segment derived from the path, so the
  // path IS the identity. We show parent muted (left-truncated) + suffix bold.
  const pathRendered = useMemo(
    () => pathDisplay(group.projectPath, { mode: 'smart' }),
    [group.projectPath],
  )

  const activitySummary = useMemo(() => {
    const liveCount = group.sessions.filter(
      (s) => s.status === 'running' || s.status === 'waiting_input',
    ).length
    const todayCount = todaySessionCount + todayConvCount
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
    if (liveCount > 0) pieces.push(t('hub.activityLive', { count: liveCount }))
    if (todayCount > 0) pieces.push(t('hub.activityToday', { total: todayCount }))
    if (lastActivity) pieces.push(t('hub.activityLast', { time: lastActivity }))
    return pieces.join(' · ')
  }, [group.sessions, group.latestActivityMs, todaySessionCount, todayConvCount, i18n.language, t])

  return (
    <Card style={{ overflow: 'hidden', gap: 0, padding: 0 }}>
      <View style={styles.spineRow}>
        {liveStatus ? (
          <View
            style={[
              styles.spine,
              { backgroundColor: liveStatus.color, opacity: liveStatus.opacity },
            ]}
          />
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
                <Text style={[styles.headerParent, ltrContentStyle]} numberOfLines={1}>{pathRendered.parent}</Text>
              ) : null}
              <Text style={[styles.headerSuffix, ltrContentStyle]} numberOfLines={1}>
                {pathRendered.suffix || group.projectName}
              </Text>
              {activitySummary ? (
                <Text style={styles.headerActivity} numberOfLines={1}>{activitySummary}</Text>
              ) : null}
            </View>
            <Text style={styles.countBadge}>
              {mergeChats ? sessionCount + convCount : `${sessionCount} · ${convCount}`}
            </Text>
            <Animated.View style={chevronStyle}>
              <CaretRight size={16} color={theme.text.secondary} mirrored={isRTL} />
            </Animated.View>
          </TouchableOpacity>

          {isOpen && (
            <View style={styles.body}>
          {mergeChats ? (
            <View style={styles.section}>
              {[
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
              ]
                .sort((a, b) => b.ms - a.ms)
                .map((item) => item.node)}
              {isLoading ? (
                <ActivityIndicator
                  style={styles.bodySpinner}
                  size="small"
                  color={theme.text.secondary}
                  testID={`hub-conversations-loading-${group.projectPath}`}
                />
              ) : null}
              {convCount > conversations.length ? (
                <TouchableOpacity
                  onPress={() => router.push(`/project/${projectId}?path=${encodedPath}`)}
                  activeOpacity={0.75}
                  style={styles.seeAllRow}
                >
                  <Text style={styles.seeAllText}>{t('hub.seeAll', { count: convCount })}</Text>
                  <CaretRight size={14} color={theme.text.accent} mirrored={isRTL} />
                </TouchableOpacity>
              ) : null}
            </View>
          ) : (
            <>
              {sessionCount > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>
                    {t('loading.sessionsLabel').toLocaleUpperCase(i18n.language)}
                  </Text>
                  {group.sessions.map((session) => (
                    <SessionRow
                      key={`${session.serverId}::${session.id}`}
                      session={session}
                      forceServerChip={forceServerChip}
                    />
                  ))}
                </View>
              )}

              {convCount > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>
                    {t('loading.conversationsLabel').toLocaleUpperCase(i18n.language)}
                  </Text>
                  {isLoading ? (
                    <ActivityIndicator
                      style={styles.bodySpinner}
                      size="small"
                      color={theme.text.secondary}
                      testID={`hub-conversations-loading-${group.projectPath}`}
                    />
                  ) : null}
                  {conversations.slice(0, 5).map((conv) => (
                    <ConvRow
                      key={`${conv.serverId}::${conv.id}`}
                      conv={conv}
                      onLongPress={setActiveConv}
                      forceServerChip={forceServerChip}
                    />
                  ))}
                  {convCount > 5 && (
                    <TouchableOpacity
                      onPress={() => router.push(`/project/${projectId}?path=${encodedPath}`)}
                      activeOpacity={0.75}
                      style={styles.seeAllRow}
                    >
                      <Text style={styles.seeAllText}>{t('hub.seeAll', { count: convCount })}</Text>
                      <CaretRight size={14} color={theme.text.accent} mirrored={isRTL} />
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </>
          )}
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
}
