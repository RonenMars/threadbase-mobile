import { useCallback } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActionSheetIOS, Platform, Alert } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { useRouter } from 'expo-router'
import { SessionStatusBadge } from './SessionStatusBadge'
import { MachineBadge } from './MachineBadge'
import { ServerChip } from '@/components/sessions/shared/ServerChip'
import { formatListTime } from '@/components/sessions/shared/formatListTime'
import { SERVER_COLOR_DEFAULT } from '@/components/sessions/shared/serverPalette'
import { Badge } from '@/components/ui/Badge'
import { font, radius, spacing, type Theme } from '@/constants/theme'
import { useTheme, useIsGlass } from '@/contexts/ThemeContext'
import { GlassFill } from '@/components/ui/GlassFill'
import { FolderSimple } from 'phosphor-react-native'
import type { MultiSession } from '@/types/api'
import { useSessionActions } from '@/hooks/useSessionActions'
import { useServersStore } from '@/stores/servers'
import { useSessionNamesStore } from '@/stores/sessionNames'
import { useTranslation } from 'react-i18next'
import i18n from '@/lib/i18n'

// Track which session IDs have already played their enter animation so
// polling-driven remounts don't re-trigger FadeInDown.
const _animatedIds = new Set<string>()

interface Props {
  session: MultiSession
  isFirstSession?: boolean
}

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${s % 60}s`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}

export function SessionCard({ session, isFirstSession = false }: Props) {
  const { t } = useTranslation('sessions')
  const theme = useTheme()
  const isGlass = useIsGlass()
  const styles = makeStyles(theme)
  const router = useRouter()
  const { cancelSession } = useSessionActions(session.serverId, session.id)
  const multipleServers = useServersStore((s) => s.activeServerIds.length > 1)
  const serverColor = useServersStore((s) => s.servers[session.serverId]?.color) ?? SERVER_COLOR_DEFAULT
  const customName = useSessionNamesStore((s) => s.getName(session.serverId, session.id))
  const displayName = customName ?? session.projectName
  const compoundId = `${session.serverId}::${session.id}`
  const isNew = !_animatedIds.has(compoundId)
  if (isNew) _animatedIds.add(compoundId)

  const isLive = session.status === 'running' || session.status === 'waiting_input'
  // Brand thread spine: amber for live (running / waiting_input), then the
  // server's assigned identity color when multi-server (so you can see at a
  // glance which server the card came from), then brand blue for idle.
  // Echoes the brand mark; not a decorative side-stripe border.
  const spineColor = isLive
    ? theme.status.waiting
    : multipleServers
      ? serverColor
      : theme.text.accent

  const handlePress = useCallback(() => {
    Haptics.selectionAsync()
    router.push(`/session/${session.id}?server=${session.serverId}`)
  }, [session.id, session.serverId, router])

  const handleLongPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    const options = [
      i18n.t('sessions:card.copyId'),
      i18n.t('sessions:card.sendInput'),
      i18n.t('sessions:card.cancel'),
      i18n.t('common:button.cancel'),
    ]

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, destructiveButtonIndex: 2, cancelButtonIndex: 3 },
        (index) => {
          if (index === 2) {
            Alert.alert(i18n.t('terminal:dialog.cancelTitle'), i18n.t('terminal:dialog.cancelMessage'), [
              { text: i18n.t('common:button.cancel'), style: 'cancel' },
              {
                text: i18n.t('terminal:dialog.cancelConfirm'), style: 'destructive',
                onPress: () => {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
                  cancelSession.mutate()
                },
              },
            ])
          } else if (index === 1) {
            router.push(`/session/${session.id}?server=${session.serverId}`)
          }
        }
      )
    } else {
      Alert.alert('Session Actions', session.projectName, [
        { text: i18n.t('sessions:card.copyId'), onPress: () => {} },
        { text: i18n.t('sessions:card.sendInput'), onPress: () => router.push(`/session/${session.id}?server=${session.serverId}`) },
        { text: i18n.t('sessions:card.cancel'), style: 'destructive', onPress: () => cancelSession.mutate() },
        { text: 'Dismiss', style: 'cancel' },
      ])
    }
  }, [session, cancelSession, router])

  const elapsedLabel = formatElapsed(session.elapsedMs)
  const promptsLabel = t('card.prompts', { count: session.promptCount })
  const lastActivityTs = session.completedAt ?? session.startedAt
  const timeLabel = lastActivityTs ? formatListTime(lastActivityTs) : null

  return (
    <Animated.View entering={isNew ? FadeInDown : undefined} style={[styles.cardWrap, isGlass && styles.cardWrapGlass]}>
      <GlassFill />
      <TouchableOpacity
        testID={isFirstSession ? "first-session-card" : undefined}
        onPress={handlePress}
        onLongPress={handleLongPress}
        activeOpacity={0.75}
        accessibilityLabel={`Session ${displayName}, status ${session.status}, ${elapsedLabel}`}
        accessibilityRole="button"
        style={styles.touchable}
      >
        <View style={styles.row}>
          {/* Thread spine — structural column, brand-mark echo. */}
          <View style={[styles.spine, { backgroundColor: spineColor, opacity: isLive ? 1 : 0.55 }]} />

          <View style={styles.body}>
            {/* Line 1: project name + trailing meta chips */}
            <View style={styles.titleRow}>
              <FolderSimple size={14} color={theme.text.secondary} weight="fill" />
              <Text style={styles.projectName} numberOfLines={1}>{displayName}</Text>
              <View style={styles.titleMeta}>
                {session.branch ? <Badge label={session.branch} /> : null}
                {session.machineName ? <MachineBadge machineName={session.machineName} /> : null}
                {multipleServers && session.serverLabel ? (
                  <ServerChip
                    label={session.serverLabel}
                    color={serverColor}
                    variant="label"
                  />
                ) : null}
                {timeLabel ? <Text style={styles.timeLabel}>{timeLabel}</Text> : null}
              </View>
            </View>

            {/* Line 2: status + runtime + prompts in mono. The bullets give
                the row a terminal-log rhythm without adding chrome. */}
            <View style={styles.statusRow}>
              <SessionStatusBadge status={session.status} />
              <Text style={styles.metaSeparator}>•</Text>
              <Text style={styles.metaMono}>{elapsedLabel}</Text>
              <Text style={styles.metaSeparator}>•</Text>
              <Text style={styles.metaMono}>{promptsLabel}</Text>
            </View>

            {/* Line 3: last terminal output, mono, single line. Drop entirely
                if there's no output (rather than reserving empty space). */}
            {session.lastOutput ? (
              <Text style={styles.output} numberOfLines={1}>{session.lastOutput}</Text>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
  cardWrap: {
    marginBottom: spacing.sm,
    backgroundColor: theme.bg.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: theme.border,
    overflow: 'hidden', // clip the spine to the card's rounded corners
  },
  cardWrapGlass: {
    backgroundColor: 'transparent',
  },
  touchable: {
    // Touchable is the press target; the row inside lays out spine + body.
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 64,
  },
  spine: {
    width: 3,
  },
  body: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: spacing.xs + 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  projectName: {
    color: theme.text.primary,
    fontSize: font.base,
    fontWeight: '600',
    flexShrink: 1,
  },
  titleMeta: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  timeLabel: {
    color: theme.text.secondary,
    fontSize: font.xs,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    flexWrap: 'wrap',
  },
  metaMono: {
    color: theme.text.secondary,
    fontSize: font.xs,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontVariant: ['tabular-nums'],
  },
  metaSeparator: {
    color: theme.text.secondary,
    fontSize: font.xs,
    opacity: 0.5,
  },
  output: {
    color: theme.text.secondary,
    fontSize: font.xs,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    opacity: 0.85,
  },
  })
}
