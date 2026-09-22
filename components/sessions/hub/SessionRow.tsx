import { useCallback } from 'react'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import * as Haptics from 'expo-haptics'
import { useSessionRowActions } from '@/hooks/useSessionRowActions'
import { useServersStore } from '@/stores/servers'
import { useSessionNamesStore } from '@/stores/sessionNames'
import { useSettingsStore } from '@/stores/settings'
import { useNavLockStore } from '@/stores/navLock'
import { ConversationListItem } from '@/components/sessions/shared/ConversationListItem'
import { sessionRowTitle } from '@/components/sessions/shared/rowTitle'
import { conversationHref } from '@/lib/conversationHref'
import { isExternalSession } from '@/lib/externalSession'
import { deriveSessionPresentation } from '@/lib/sessionPresentation'
import type { MessagePreviewMode } from '@/components/sessions/shared/MessagePreview'
import type { SessionRowProps } from './types'

export function SessionRow({ session, forceServerChip = false }: SessionRowProps) {
  const router = useRouter()
  const { t } = useTranslation('sessions')
  const activeServerCount = useServersStore((s) => s.activeServerIds.length)
  const serverColor = useServersStore((s) => s.servers[session.serverId]?.color)
  const storedName = useSessionNamesStore((s) => s.getName(session.serverId, session.id))
  const storedOrigin = useSessionNamesStore((s) => s.getOrigin(session.serverId, session.id))
  const title = sessionRowTitle(session, { name: storedName, origin: storedOrigin })

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

  // Hub rows keep the old reach: the sheet opens only where ending was offered.
  const rowActions = useSessionRowActions(session, title)
  const handleLongPress = presentation.capabilities.canCancel ? rowActions.handleLongPress : undefined

  const rowPreviewModeSetting = useSettingsStore((s) => s.rowPreviewMode)
  const previewMode: MessagePreviewMode = rowPreviewModeSetting === 'off' ? 'none' : rowPreviewModeSetting

  const promptCountLabel = t('card.prompts', { count: session.promptCount })
  const activityTimestamp = presentation.activityAt ?? session.completedAt ?? session.startedAt

  return (
    <>
      <ConversationListItem
        title={title}
        timestamp={activityTimestamp}
        messageCount={session.promptCount}
        branch={session.branch}
        tier={presentation.tier}
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
      {rowActions.overlays}
    </>
  )
}
