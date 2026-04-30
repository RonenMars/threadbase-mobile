import React, { useCallback } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActionSheetIOS,
  Platform,
  Alert,
  UIManager,
  LayoutAnimation,
} from 'react-native'
import Animated, {
  useSharedValue,
  withTiming,
  useAnimatedStyle,
  interpolate,
} from 'react-native-reanimated'
import { useRouter } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { dark, font, radius, spacing } from '@/constants/theme'
import type { MultiSession, MultiConversation } from '@/types/api'
import { useSessionActions } from '@/hooks/useSessionActions'
import { useSettingsStore } from '@/stores/settings'
import type { ProjectGroup } from './useProjectGroups'

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true)
}

// ── Date helpers ────────────────────────────────────────────────────────────

function isToday(iso: string): boolean {
  const d = new Date(iso)
  const now = new Date()
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  )
}

function formatHour(iso: string): string {
  const d = new Date(iso)
  const h = d.getHours().toString().padStart(2, '0')
  const m = d.getMinutes().toString().padStart(2, '0')
  return `${h}:${m}`
}

function formatDate(iso: string): string {
  if (isToday(iso)) return 'Today'
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 30) return `${diffDays}d ago`
  return d.toLocaleDateString()
}

function dateLabel(iso: string, multipleToday: boolean): string {
  if (isToday(iso) && multipleToday) return formatHour(iso)
  return formatDate(iso)
}

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${s % 60}s`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}

// ── SessionRow ───────────────────────────────────────────────────────────────

interface SessionRowProps {
  session: MultiSession
  multipleToday: boolean
}

function SessionRow({ session, multipleToday }: SessionRowProps) {
  const router = useRouter()
  const { cancelSession } = useSessionActions(session.serverId, session.id)

  const handlePress = useCallback(() => {
    Haptics.selectionAsync()
    if (session.source === 'discovered' && session.conversationId) {
      router.push(`/conversation/${session.conversationId}?server=${session.serverId}`)
    } else {
      router.push(`/session/${session.id}?server=${session.serverId}`)
    }
  }, [session, router])

  const handleLongPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancel Session', 'Cancel'], destructiveButtonIndex: 0, cancelButtonIndex: 1 },
        (index) => {
          if (index === 0) {
            Alert.alert('Cancel Session', 'Are you sure?', [
              { text: 'No', style: 'cancel' },
              {
                text: 'Yes',
                style: 'destructive',
                onPress: () => {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
                  cancelSession.mutate()
                },
              },
            ])
          }
        },
      )
    } else {
      Alert.alert('Session Actions', session.projectName, [
        {
          text: 'Cancel Session',
          style: 'destructive',
          onPress: () => cancelSession.mutate(),
        },
        { text: 'Dismiss', style: 'cancel' },
      ])
    }
  }, [session, cancelSession])

  const label = dateLabel(session.startedAt, multipleToday)
  const branch = session.branch || 'no git'
  const elapsed = formatElapsed(session.elapsedMs)
  const prompts = session.promptCount

  return (
    <TouchableOpacity
      onPress={handlePress}
      onLongPress={handleLongPress}
      activeOpacity={0.75}
      style={styles.row}
    >
      <Text style={styles.rowPrimary} numberOfLines={1}>
        {branch} · {elapsed} · {prompts} prompt{prompts !== 1 ? 's' : ''}
      </Text>
      <Text style={styles.rowDate}>{label}</Text>
    </TouchableOpacity>
  )
}

// ── ConvRow ──────────────────────────────────────────────────────────────────

interface ConvRowProps {
  conv: MultiConversation
  multipleToday: boolean
}

function ConvRow({ conv, multipleToday }: ConvRowProps) {
  const router = useRouter()

  const handlePress = useCallback(() => {
    Haptics.selectionAsync()
    router.push(`/conversation/${conv.id}?server=${conv.serverId}`)
  }, [conv, router])

  const label = dateLabel(conv.lastActivity, multipleToday)
  const branch = conv.branch ?? '—'
  const msgs = conv.messageCount

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.75} style={styles.row}>
      <View style={styles.convRowInner}>
        <Text style={styles.convTitle} numberOfLines={1}>
          {conv.title}
        </Text>
        <Text style={styles.rowSecondary} numberOfLines={1}>
          {branch} · {msgs} msg{msgs !== 1 ? 's' : ''}
        </Text>
      </View>
      <Text style={styles.rowDate}>{label}</Text>
    </TouchableOpacity>
  )
}

// ── ProjectHubCard ───────────────────────────────────────────────────────────

interface Props {
  group: ProjectGroup
  isOpen: boolean
  onToggle: () => void
}

export function ProjectHubCard({ group, isOpen, onToggle }: Props) {
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
    transform: [
      {
        rotate: `${interpolate(chevronProgress.value, [0, 1], [0, 180])}deg`,
      },
    ],
  }))

  const sessionCount = group.sessions.length
  const convCount = group.conversations.length
  const encodedPath = encodeURIComponent(group.projectPath)

  const todaySessionCount = group.sessions.filter((s) => isToday(s.startedAt)).length
  const multipleTodaySessions = todaySessionCount > 1
  const todayConvCount = group.conversations.filter((c) => isToday(c.lastActivity)).length
  const multipleTodayConvs = todayConvCount > 1

  return (
    <View style={styles.card}>
      {/* Header */}
      <TouchableOpacity
        onPress={handleToggle}
        activeOpacity={0.75}
        style={styles.header}
      >
        <Text style={styles.folderIcon}>📁</Text>
        <Text style={styles.projectName} numberOfLines={1}>
          {group.projectName}
        </Text>
        <Text style={styles.countBadge}>
          {mergeChats ? sessionCount + convCount : `${sessionCount} · ${convCount}`}
        </Text>
        <Animated.Text style={[styles.chevron, chevronStyle]}>{'›'}</Animated.Text>
      </TouchableOpacity>

      {/* Expanded body */}
      {isOpen && (
        <View style={styles.body}>
          {mergeChats ? (
            // Merged: single chronological list
            <View style={styles.section}>
              {[
                ...group.sessions.map((s) => ({
                  key: `s-${s.serverId}::${s.id}`,
                  ms: s.completedAt ? Date.parse(s.completedAt) : Date.parse(s.startedAt) + (s.elapsedMs ?? 0),
                  node: (
                    <SessionRow
                      key={`${s.serverId}::${s.id}`}
                      session={s}
                      multipleToday={multipleTodaySessions}
                    />
                  ),
                })),
                ...group.conversations.map((c) => ({
                  key: `c-${c.serverId}::${c.id}`,
                  ms: Date.parse(c.lastActivity) || 0,
                  node: (
                    <ConvRow
                      key={`${c.serverId}::${c.id}`}
                      conv={c}
                      multipleToday={multipleTodayConvs}
                    />
                  ),
                })),
              ]
                .sort((a, b) => b.ms - a.ms)
                .map((item) => item.node)}
            </View>
          ) : (
            <>
              {/* Sessions strip */}
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

              {/* Conversations section */}
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
                      <Text style={styles.seeAllText}>
                        See all {convCount} conversations →
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </>
          )}
        </View>
      )}
    </View>
  )
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: dark.bg.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: dark.border,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.sm,
  },
  folderIcon: {
    fontSize: font.base,
  },
  projectName: {
    flex: 1,
    color: dark.text.primary,
    fontSize: font.base,
    fontWeight: '600',
  },
  countBadge: {
    color: dark.text.secondary,
    fontSize: font.xs,
  },
  chevron: {
    color: dark.text.secondary,
    fontSize: font.lg,
    fontWeight: '300',
    lineHeight: font.lg,
    width: 16,
    textAlign: 'center',
  },
  body: {
    borderTopWidth: 1,
    borderTopColor: dark.border,
    paddingBottom: spacing.sm,
  },
  section: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  sectionLabel: {
    color: dark.text.secondary,
    fontSize: font.xs,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    gap: spacing.sm,
    minHeight: 36,
  },
  rowPrimary: {
    flex: 1,
    color: dark.text.primary,
    fontSize: font.sm,
  },
  rowSecondary: {
    color: dark.text.secondary,
    fontSize: font.xs,
  },
  rowDate: {
    color: dark.text.secondary,
    fontSize: font.xs,
    flexShrink: 0,
  },
  convRowInner: {
    flex: 1,
    gap: 2,
  },
  convTitle: {
    color: dark.text.primary,
    fontSize: font.sm,
  },
  seeAllRow: {
    paddingVertical: spacing.xs,
  },
  seeAllText: {
    color: dark.text.accent,
    fontSize: font.sm,
  },
})
