import React, { useCallback } from 'react'
import { View, Text, TouchableOpacity, Platform, UIManager, LayoutAnimation } from 'react-native'
import Animated, { useSharedValue, withTiming, useAnimatedStyle, interpolate } from 'react-native-reanimated'
import { useRouter } from 'expo-router'
import { useSettingsStore } from '@/stores/settings'
import { FolderSimple } from 'phosphor-react-native'
import { dark } from '@/constants/theme'
import { isToday } from './hubUtils'
import { SessionRow } from './SessionRow'
import { ConvRow } from './ConvRow'
import { Card } from '@/components/ui/Card'
import { styles } from './ProjectHubCard.styles'
import type { ProjectHubCardProps } from './types'

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true)
}

export function ProjectHubCard({ group, isOpen, onToggle }: ProjectHubCardProps) {
  const router = useRouter()
  const mergeChats = useSettingsStore((s) => s.mergeChats)
  const chevronProgress = useSharedValue(isOpen ? 1 : 0)

  const handleToggle = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    const next = isOpen ? 0 : 1
    chevronProgress.value = withTiming(next, { duration: 200 })
    onToggle()
  }, [isOpen, onToggle, chevronProgress])

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(chevronProgress.value, [0, 1], [0, 180])}deg` }],
  }))

  const sessionCount = group.sessions.length
  const convCount = group.conversations.length
  const encodedPath = encodeURIComponent(group.projectPath)

  const todaySessionCount = group.sessions.filter((s) => isToday(s.startedAt)).length
  const multipleTodaySessions = todaySessionCount > 1
  const todayConvCount = group.conversations.filter((c) => isToday(c.lastActivity)).length
  const multipleTodayConvs = todayConvCount > 1

  return (
    <Card style={{ overflow: 'hidden' }}>
      <TouchableOpacity onPress={handleToggle} activeOpacity={0.75} style={styles.header}>
        <FolderSimple size={18} color={dark.text.secondary} weight="fill" />
        <Text style={styles.projectName} numberOfLines={1}>{group.projectName}</Text>
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
                  node: <SessionRow key={`${s.serverId}::${s.id}`} session={s} multipleToday={multipleTodaySessions} />,
                })),
                ...group.conversations.map((c) => ({
                  key: `c-${c.serverId}::${c.id}`,
                  ms: Date.parse(c.lastActivity) || 0,
                  node: <ConvRow key={`${c.serverId}::${c.id}`} conv={c} multipleToday={multipleTodayConvs} />,
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
                      multipleToday={multipleTodaySessions}
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
                      multipleToday={multipleTodayConvs}
                    />
                  ))}
                  {convCount > 5 && (
                    <TouchableOpacity
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      onPress={() => router.push(`/project/${encodedPath}` as any)}
                      activeOpacity={0.75}
                      style={styles.seeAllRow}
                    >
                      <Text style={styles.seeAllText}>See all {convCount} conversations →</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </>
          )}
        </View>
      )}
    </Card>
  )
}
