import { useCallback } from 'react'
import { Platform, Alert, ActionSheetIOS } from 'react-native'
import { useRouter } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { useSessionActions } from '@/hooks/useSessionActions'
import { useServersStore } from '@/stores/servers'
import { useSessionNamesStore } from '@/stores/sessionNames'
import { useSettingsStore } from '@/stores/settings'
import { ConversationListItem } from '@/components/sessions/shared/ConversationListItem'
import { conversationHref } from '@/lib/conversationHref'
import { isExternalSession, isExternalAlive } from '@/lib/externalSession'
import { formatElapsed } from './hubUtils'
import type { MessagePreviewMode } from '@/components/sessions/shared/MessagePreview'
import type { SessionRowProps } from './types'

export function SessionRow({ session }: SessionRowProps) {
  const router = useRouter()
  const { cancelSession } = useSessionActions(session.serverId, session.id)
  const activeServerCount = useServersStore((s) => s.activeServerIds.length)
  const serverColor = useServersStore((s) => s.servers[session.serverId]?.color)
  const sessionName = useSessionNamesStore((s) => s.getName(session.serverId, session.id))

  // A discovered process the streamer only observes — read-only, not
  // interactive: route to the conversation view, never the PTY screen.
  const isExternal = isExternalSession(session)

  const handlePress = useCallback(() => {
    Haptics.selectionAsync()
    if (isExternal) {
      const convId = session.boundConversationId ?? session.conversationId ?? session.id
      router.push(conversationHref(convId, session.serverId))
      return
    }
    router.push(`/session/${session.id}?server=${session.serverId}`)
  }, [session, isExternal, router])

  const handleLongPress = useCallback(() => {
    // External sessions are read-only — suppress the Cancel action entirely.
    if (isExternal) return
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
  }, [session, isExternal, cancelSession])

  const rowPreviewModeSetting = useSettingsStore((s) => s.rowPreviewMode)
  const previewMode: MessagePreviewMode = rowPreviewModeSetting === 'off' ? 'none' : rowPreviewModeSetting

  // An alive external session is status 'idle' but its process is running — mark
  // the row live so it isn't indistinguishable from a dead one, in the distinct
  // "external" variant (blue) rather than the interactive amber treatment. Keys
  // on liveness fields with a pid fallback (no `ownership` required).
  const externalAlive = isExternalAlive(session)
  const isLive = externalAlive || session.status === 'running' || session.status === 'waiting_input'
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
      external={externalAlive}
      lastOutput={session.lastOutput || null}
      preview={promptCountLabel}
      serverLabel={session.serverLabel}
      serverColor={serverColor}
      activeServerCount={activeServerCount}
      density="compact"
      leading="dot"
      previewMode={previewMode}
      onPress={handlePress}
      onLongPress={handleLongPress}
      testID={`session-row-${session.id}`}
    />
  )
}
