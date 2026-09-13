import { useCallback } from 'react'
import { ActionSheetIOS, Alert, Platform } from 'react-native'
import * as Haptics from 'expo-haptics'
import { useRouter } from 'expo-router'
import i18n from '@/lib/i18n'
import { conversationHref } from '@/lib/conversationHref'
import { isExternalSession } from '@/lib/externalSession'
import { useSessionActions } from '@/hooks/useSessionActions'
import { useNavLockStore } from '@/stores/navLock'
import type { MultiSession } from '@/types/api'

/**
 * Tap and long-press behaviour shared by every session row and card: an
 * external (observed) session opens the read-only conversation, a managed one
 * opens the PTY screen; long-press offers Send Input / Cancel on managed only.
 */
export function useSessionRowActions(session: MultiSession) {
  const router = useRouter()
  const { cancelSession } = useSessionActions(session.serverId, session.id)
  const isExternal = isExternalSession(session)

  const handlePress = useCallback(() => {
    Haptics.selectionAsync()
    useNavLockStore.getState().lock()
    if (isExternal) {
      const convId = session.boundConversationId ?? session.conversationId ?? session.id
      router.push(conversationHref(convId, session.serverId))
      return
    }
    router.push(`/session/${session.id}?server=${session.serverId}`)
  }, [session, isExternal, router])

  const handleLongPress = useCallback(() => {
    // External sessions are read-only — the input-oriented actions never appear.
    if (isExternal) return
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
      Alert.alert(i18n.t('sessions:card.actionsTitle'), session.projectName, [
        { text: i18n.t('sessions:card.copyId'), onPress: () => {} },
        { text: i18n.t('sessions:card.sendInput'), onPress: () => router.push(`/session/${session.id}?server=${session.serverId}`) },
        { text: i18n.t('sessions:card.cancel'), style: 'destructive', onPress: () => cancelSession.mutate() },
        { text: i18n.t('sessions:card.dismiss'), style: 'cancel' },
      ])
    }
  }, [session, isExternal, cancelSession, router])

  return { handlePress, handleLongPress, isExternal }
}
