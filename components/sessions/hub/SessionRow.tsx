import React, { useCallback } from 'react'
import { Text, TouchableOpacity, Platform, Alert, ActionSheetIOS } from 'react-native'
import { useRouter } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { useSessionActions } from '@/hooks/useSessionActions'
import { dateLabel, formatElapsed } from './hubUtils'
import { styles } from './SessionRow.styles'
import type { SessionRowProps } from './types'

export function SessionRow({ session, multipleToday }: SessionRowProps) {
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
        { text: 'Cancel Session', style: 'destructive', onPress: () => cancelSession.mutate() },
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
