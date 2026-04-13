import React, { useCallback } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActionSheetIOS, Platform, Alert } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { useRouter } from 'expo-router'
import { SessionStatusBadge } from './SessionStatusBadge'
import { MachineBadge } from './MachineBadge'
import { Badge } from '@/components/ui/Badge'
import { dark, font, radius, spacing } from '@/constants/theme'
import type { Session } from '@/types/api'
import { useSessionActions } from '@/hooks/useSessionActions'

// Track which session IDs have already played their enter animation so
// polling-driven remounts don't re-trigger FadeInDown.
const _animatedIds = new Set<string>()

interface Props {
  session: Session
}

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${s % 60}s`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}

export function SessionCard({ session }: Props) {
  const router = useRouter()
  const { cancelSession } = useSessionActions(session.id)
  const isNew = !_animatedIds.has(session.id)
  if (isNew) _animatedIds.add(session.id)

  const handlePress = useCallback(() => {
    Haptics.selectionAsync()
    router.push(`/session/${session.id}`)
  }, [session.id, router])

  const handleLongPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    const options = ['Copy Session ID', 'Send Input', 'Cancel Session', 'Cancel']

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, destructiveButtonIndex: 2, cancelButtonIndex: 3 },
        (index) => {
          if (index === 2) {
            Alert.alert('Cancel Session', 'Are you sure?', [
              { text: 'No', style: 'cancel' },
              {
                text: 'Yes', style: 'destructive',
                onPress: () => {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
                  cancelSession.mutate()
                },
              },
            ])
          } else if (index === 1) {
            router.push(`/session/${session.id}`)
          }
        }
      )
    } else {
      Alert.alert('Session Actions', session.projectName, [
        { text: 'Copy Session ID', onPress: () => {} },
        { text: 'Send Input', onPress: () => router.push(`/session/${session.id}`) },
        { text: 'Cancel Session', style: 'destructive', onPress: () => cancelSession.mutate() },
        { text: 'Dismiss', style: 'cancel' },
      ])
    }
  }, [session, cancelSession, router])

  const isWaiting = session.status === 'waiting_input'

  return (
    <Animated.View entering={isNew ? FadeInDown : undefined}>
      <TouchableOpacity
        onPress={handlePress}
        onLongPress={handleLongPress}
        activeOpacity={0.75}
        accessibilityLabel={`Session ${session.projectName}, status ${session.status}, ${formatElapsed(session.elapsedMs)}`}
        accessibilityRole="button"
        style={[styles.card, isWaiting && styles.cardWaiting]}
      >
        <View style={styles.row}>
          <Text style={styles.projectName} numberOfLines={1}>{session.projectName}</Text>
          {session.branch ? (
            <Badge label={session.branch} />
          ) : null}
          {session.machineName ? (
            <MachineBadge machineName={session.machineName} />
          ) : null}
        </View>

        <View style={styles.statusRow}>
          <SessionStatusBadge status={session.status} />
          <Text style={styles.meta}>{formatElapsed(session.elapsedMs)}</Text>
          <Text style={styles.meta}>{session.promptCount} prompts</Text>
        </View>

        {session.lastOutput ? (
          <Text style={styles.output} numberOfLines={2}>{session.lastOutput}</Text>
        ) : null}
      </TouchableOpacity>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: dark.bg.card,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: dark.border,
    gap: spacing.xs,
    marginBottom: spacing.sm,
    minHeight: 44,
  },
  cardWaiting: {
    borderColor: dark.status.waiting,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  projectName: {
    color: dark.text.primary,
    fontSize: font.base,
    fontWeight: '600',
    flex: 1,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  meta: {
    color: dark.text.secondary,
    fontSize: font.xs,
  },
  output: {
    color: dark.text.secondary,
    fontSize: font.xs,
    fontFamily: 'monospace',
    marginTop: spacing.xs,
  },
})
