import { useCallback } from 'react'
import { Platform, Alert, ActionSheetIOS } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import * as Haptics from 'expo-haptics'
import { useSessionActions } from '@/hooks/useSessionActions'
import { useServersStore } from '@/stores/servers'
import { useSessionNamesStore } from '@/stores/sessionNames'
import { useSettingsStore } from '@/stores/settings'
import { useNavLockStore } from '@/stores/navLock'
import { ConversationListItem } from '@/components/sessions/shared/ConversationListItem'
import { conversationHref } from '@/lib/conversationHref'
import { isExternalSession } from '@/lib/externalSession'
import { deriveSessionPresentation } from '@/lib/sessionPresentation'
import { formatElapsed } from './hubUtils'
import type { MessagePreviewMode } from '@/components/sessions/shared/MessagePreview'
import type { SessionRowProps } from './types'

export function SessionRow({ session, forceServerChip = false }: SessionRowProps) {
  const router = useRouter()
  const { t } = useTranslation(['sessions', 'common'])
  const { cancelSession } = useSessionActions(session.serverId, session.id)
  const activeServerCount = useServersStore((s) => s.activeServerIds.length)
  const serverColor = useServersStore((s) => s.servers[session.serverId]?.color)
  // User rename wins; then the JSONL-derived conversation name off the session.
  const renamedName = useSessionNamesStore((s) => s.getName(session.serverId, session.id))
  const sessionName = renamedName ?? session.sessionName

  const presentation = deriveSessionPresentation(session)
  const isExternal = isExternalSession(session)

  const handlePress = useCallback(() => {
    Haptics.selectionAsync()
    useNavLockStore.getState().lock()
    if (presentation.capabilities.isObserveOnly || isExternal) {
      const convId = session.boundConversationId ?? session.conversationId ?? session.id
      router.push(conversationHref(convId, session.serverId))
      return
    }
    router.push(`/session/${session.id}?server=${session.serverId}`)
  }, [session, presentation.capabilities.isObserveOnly, isExternal, router])

  const handleLongPress = useCallback(() => {
    if (!presentation.capabilities.canCancel) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: [t('card.cancel'), t('common:button.cancel')], destructiveButtonIndex: 0, cancelButtonIndex: 1 },
        (index) => {
          if (index === 0) {
            Alert.alert(t('card.cancel'), t('card.cancelConfirm'), [
              { text: t('card.confirmNo'), style: 'cancel' },
              {
                text: t('card.confirmYes'),
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
      Alert.alert(t('card.actionsTitle'), session.projectName, [
        { text: t('card.cancel'), style: 'destructive', onPress: () => cancelSession.mutate() },
        { text: t('card.dismiss'), style: 'cancel' },
      ])
    }
  }, [session, presentation.capabilities.canCancel, cancelSession, t])

  const rowPreviewModeSetting = useSettingsStore((s) => s.rowPreviewMode)
  const previewMode: MessagePreviewMode = rowPreviewModeSetting === 'off' ? 'none' : rowPreviewModeSetting

  const branchAndElapsed = [session.branch || t('card.noBranch'), formatElapsed(session.elapsedMs)].join(' · ')
  const titleSuffix = sessionName?.trim() || branchAndElapsed
  const promptCountLabel = t('card.prompts', { count: session.promptCount })
  const activityTimestamp = presentation.activityAt ?? session.completedAt ?? session.startedAt

  return (
    <ConversationListItem
      title={titleSuffix}
      timestamp={activityTimestamp}
      messageCount={session.promptCount}
      branch={session.branch}
      live={presentation.live}
      external={presentation.externalLive}
      lastOutput={session.lastOutput || null}
      preview={promptCountLabel}
      serverLabel={session.serverLabel}
      serverColor={serverColor}
      activeServerCount={activeServerCount}
      forceServerChip={forceServerChip}
      provider={session.provider}
      density="compact"
      leading="dot"
      previewMode={previewMode}
      onPress={handlePress}
      onLongPress={handleLongPress}
      testID={`session-row-${session.id}`}
    />
  )
}
