import React, { useCallback, useMemo } from 'react'
import { View, Text, TouchableOpacity, Platform, UIManager, LayoutAnimation } from 'react-native'
import Animated, { useSharedValue, withTiming, useAnimatedStyle, interpolate } from 'react-native-reanimated'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useSettingsStore } from '@/stores/settings'
import { dark } from '@/constants/theme'
import { isToday } from './hubUtils'
import { SessionRow } from './SessionRow'
import { ConvRow } from './ConvRow'
import { Card } from '@/components/ui/Card'
import { pathDisplay } from '@/components/sessions/shared/pathDisplay'
import { formatListTime } from '@/components/sessions/shared/formatListTime'
import { styles } from './ProjectHubCard.styles'
import type { ProjectHubCardProps } from './types'
import type { MultiSession } from '@/types/api'

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true)
}

export function ProjectHubCard({ group, isOpen, onToggle }: ProjectHubCardProps) {
  const { t } = useTranslation('sessions')
  const router = useRouter()
  const mergeChats = useSettingsStore((s) => s.mergeChats)
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

  const sessionCount = group.sessions.length
  const convCount = group.conversations.length
  const encodedPath = encodeURIComponent(group.projectPath)
  // Prefer projectId for navigation identity (Step 5). Falls back to the
  // path-encoded value during migration when backend hasn't filled it yet.
  const projectId =
    group.sessions.find((s) => s.projectId)?.projectId ??
    group.conversations.find((c) => c.projectId)?.projectId ??
    encodedPath

  const todaySessionCount = group.sessions.filter((s) => isToday(s.startedAt)).length
  const todayConvCount = group.conversations.filter((c) => isToday(c.lastActivity)).length

  // Derive the project's lifecycle colour the same way SessionCard does.
  // Amber spine when any session is live; blue spine when sessions exist
  // but are all idle (still a thread, just quiet); no spine when only
  // conversations are present (history-only project).
  const liveStatus = useMemo(() => {
    const hasLive = group.sessions.some(
      (s: MultiSession) => s.status === 'running' || s.status === 'waiting_input',
    )
    if (hasLive) return { color: dark.status.waiting, opacity: 1 }
    if (group.sessions.length > 0) return { color: dark.text.accent, opacity: 0.55 }
    return null
  }, [group.sessions])

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
      ? formatListTime(group.latestActivityMs)
      : null
    const pieces: string[] = []
    if (liveCount > 0) pieces.push(`${liveCount} live`)
    if (todayCount > 0) pieces.push(`${todayCount} today`)
    if (lastActivity) pieces.push(`last ${lastActivity}`)
    return pieces.join(' · ')
  }, [group.sessions, group.latestActivityMs, todaySessionCount, todayConvCount])

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
          <TouchableOpacity onPress={handleToggle} activeOpacity={0.75} style={styles.header}>
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
              {mergeChats ? sessionCount + convCount : `${sessionCount} · ${convCount}`}
            </Text>
            <Animated.Text style={[styles.chevron, chevronStyle]}>{'›'}</Animated.Text>
          </TouchableOpacity>

          {isOpen && (
            <View style={styles.body}>
          {mergeChats ? (
            <View style={styles.section}>
              {[
                ...group.sessions.map((s) => ({
                  key: `s-${s.serverId}::${s.id}`,
                  ms: s.completedAt ? Date.parse(s.completedAt) : Date.parse(s.startedAt) + (s.elapsedMs ?? 0),
                  node: <SessionRow key={`${s.serverId}::${s.id}`} session={s} />,
                })),
                ...group.conversations.map((c) => ({
                  key: `c-${c.serverId}::${c.id}`,
                  ms: Date.parse(c.lastActivity) || 0,
                  node: <ConvRow key={`${c.serverId}::${c.id}`} conv={c} />,
                })),
              ]
                .sort((a, b) => b.ms - a.ms)
                .map((item) => item.node)}
            </View>
          ) : (
            <>
              {sessionCount > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>SESSIONS</Text>
                  {group.sessions.map((session) => (
                    <SessionRow
                      key={`${session.serverId}::${session.id}`}
                      session={session}
                    />
                  ))}
                </View>
              )}

              {convCount > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>CONVERSATIONS</Text>
                  {group.conversations.slice(0, 5).map((conv) => (
                    <ConvRow
                      key={`${conv.serverId}::${conv.id}`}
                      conv={conv}
                    />
                  ))}
                  {convCount > 5 && (
                    <TouchableOpacity
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      onPress={() => router.push(`/project/${projectId}?path=${encodedPath}` as any)}
                      activeOpacity={0.75}
                      style={styles.seeAllRow}
                    >
                      <Text style={styles.seeAllText}>{t('hub.seeAll', { count: convCount })}</Text>
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
    </Card>
  )
}
