import { useCallback } from 'react'
import { Platform, Alert, ActionSheetIOS } from 'react-native'
import { useRouter } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { useSessionActions } from '@/hooks/useSessionActions'
import { useServersStore } from '@/stores/servers'
import { useSessionNamesStore } from '@/stores/sessionNames'
import { ConversationListItem } from '@/components/sessions/shared/ConversationListItem'
import { formatElapsed } from './hubUtils'
import type { SessionRowProps } from './types'

export function SessionRow({ session }: SessionRowProps) {
  const router = useRouter()
  const { cancelSession } = useSessionActions(session.serverId, session.id)
  const activeServerCount = useServersStore((s) => s.activeServerIds.length)
  const serverColor = useServersStore((s) => s.servers[session.serverId]?.color)
  const sessionName = useSessionNamesStore((s) => s.getName(session.serverId, session.id))

  const handlePress = useCallback(() => {
    Haptics.selectionAsync()
    router.push(`/session/${session.id}?server=${session.serverId}`)
  }, [session.id, session.serverId, router])

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

  const isLive = session.status === 'running' || session.status === 'waiting_input'
  const branchAndElapsed = [session.branch || 'no git', formatElapsed(session.elapsedMs)].join(' · ')
  const titleSuffix = sessionName?.trim() || branchAndElapsed
  const promptCountLabel = `${session.promptCount} prompt${session.promptCount === 1 ? '' : 's'}`

  return (
    <ConversationListItem
      title={titleSuffix}
      timestamp={session.completedAt ?? session.startedAt}
      messageCount={session.promptCount}
      branch={session.branch}
      live={isLive}
      lastOutput={session.lastOutput || null}
      preview={promptCountLabel}
      serverLabel={session.serverLabel}
      serverColor={serverColor}
      activeServerCount={activeServerCount}
      density="compact"
      leading="dot"
      previewMode="none"
      onPress={handlePress}
      onLongPress={handleLongPress}
      testID={`session-row-${session.id}`}
    />
  )
}
