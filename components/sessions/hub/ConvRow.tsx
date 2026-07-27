import { useCallback } from 'react'
import { useRouter } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { useServersStore } from '@/stores/servers'
import { useSettingsStore } from '@/stores/settings'
import { useNavLockStore } from '@/stores/navLock'
import { ConversationListItem } from '@/components/sessions/shared/ConversationListItem'
import type { ConvRowProps } from './types'

export function ConvRow({ conv, onLongPress, forceServerChip = false }: ConvRowProps) {
  const router = useRouter()
  const activeServerCount = useServersStore((s) => s.activeServerIds.length)
  const serverColor = useServersStore((s) => s.servers[conv.serverId]?.color)
  const previewPref = useSettingsStore((s) => s.historyMessageDisplay)

  const handlePress = useCallback(() => {
    Haptics.selectionAsync()
    useNavLockStore.getState().lock()
    router.push(`/conversation/${conv.id}?server=${conv.serverId}`)
  }, [conv, router])

  const handleLongPress = useCallback(() => {
    onLongPress?.(conv)
  }, [conv, onLongPress])

  return (
    <ConversationListItem
      testID={`conversation-row-${conv.id}`}
      title={conv.title}
      timestamp={conv.lastMessage?.timestamp ?? conv.lastActivity}
      messageCount={conv.messageCount}
      branch={conv.branch}
      firstMessage={conv.firstMessage}
      lastMessage={conv.lastMessage}
      preview={conv.preview}
      serverLabel={conv.serverLabel}
      serverColor={serverColor}
      activeServerCount={activeServerCount}
      forceServerChip={forceServerChip}
      previewMode={previewPref === 'last' ? 'last' : 'first'}
      density="compact"
      leading="dot"
      provider={conv.provider}
      onPress={handlePress}
      onLongPress={onLongPress ? handleLongPress : undefined}
    />
  )
}
