import { useCallback } from 'react'
import { useRouter } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { ConversationListItem } from '@/components/sessions/shared/ConversationListItem'
import type { MessagePreviewMode } from '@/components/sessions/shared/MessagePreview'
import { conversationHref } from '@/lib/conversationHref'
import { deriveSessionPresentation } from '@/lib/sessionPresentation'
import { useSessionRowActions } from '@/hooks/useSessionRowActions'
import { useNavLockStore } from '@/stores/navLock'
import { useServersStore } from '@/stores/servers'
import { useSettingsStore } from '@/stores/settings'
import type { ProviderName } from '@/constants/providers'
import type { MultiConversation, MultiSession } from '@/types/api'
import type { MergedItem } from './mergedItems'

interface Props {
  item: MergedItem
  title: string
  isFirst?: boolean
  highlight?: string
  dominantProvider?: ProviderName
  onLongPressConversation?: (conv: MultiConversation) => void
}

function SessionEarlierRow({ session, ms, title, isFirst, highlight, previewMode, dominantProvider }: {
  session: MultiSession
  ms: number
  title: string
  isFirst?: boolean
  highlight?: string
  previewMode: MessagePreviewMode
  dominantProvider?: ProviderName
}) {
  const { handlePress, handleLongPress, overlays } = useSessionRowActions(session, title)
  const activeServerCount = useServersStore((s) => s.activeServerIds.length)
  const serverColor = useServersStore((s) => s.servers[session.serverId]?.color)
  const { tier } = deriveSessionPresentation(session)
  return (
    <>
      <ConversationListItem
        testID={isFirst ? 'first-session-card' : `session-row-${session.id}`}
        title={title}
        timestamp={ms}
        tier={tier}
        lastOutput={session.lastOutput || null}
        serverLabel={session.serverLabel}
        serverColor={serverColor}
        activeServerCount={activeServerCount}
        provider={session.provider}
        dominantProvider={dominantProvider}
        density="compact"
        leading="none"
        showBranch={false}
        showCount={false}
        previewMode={previewMode}
        highlight={highlight}
        onPress={handlePress}
        onLongPress={handleLongPress}
      />
      {overlays}
    </>
  )
}

function ConversationEarlierRow({ conv, ms, title, highlight, previewMode, dominantProvider, onLongPress }: {
  conv: MultiConversation
  ms: number
  title: string
  highlight?: string
  previewMode: MessagePreviewMode
  dominantProvider?: ProviderName
  onLongPress?: (conv: MultiConversation) => void
}) {
  const router = useRouter()
  const activeServerCount = useServersStore((s) => s.activeServerIds.length)
  const serverColor = useServersStore((s) => s.servers[conv.serverId]?.color)
  const handlePress = useCallback(() => {
    Haptics.selectionAsync()
    useNavLockStore.getState().lock()
    router.push(conversationHref(conv.id, conv.serverId, highlight))
  }, [conv, highlight, router])

  return (
    <ConversationListItem
      testID={`conversation-row-${conv.id}`}
      title={title}
      timestamp={ms}
      firstMessage={conv.firstMessage}
      lastMessage={conv.lastMessage}
      preview={conv.preview}
      matches={conv.matches}
      serverLabel={conv.serverLabel}
      serverColor={serverColor}
      activeServerCount={activeServerCount}
      provider={conv.provider}
      dominantProvider={dominantProvider}
      density="compact"
      leading="none"
      showBranch={false}
      showCount={false}
      previewMode={previewMode}
      highlight={highlight}
      onPress={handlePress}
      onLongPress={onLongPress ? () => onLongPress(conv) : undefined}
    />
  )
}

/**
 * A history row in the Now list: title, one subtitle line, clock stamp. Two lines, no card.
 * The stamp is `item.ms`, the same clock NowList buckets by, so a row can never sit under
 * LAST 7 DAYS while showing last week's date.
 */
export function EarlierRow({ item, title, isFirst, highlight, dominantProvider, onLongPressConversation }: Props) {
  const rowPreviewMode = useSettingsStore((s) => s.rowPreviewMode)
  const previewMode: MessagePreviewMode = rowPreviewMode === 'off' ? 'none' : rowPreviewMode
  if (item.kind === 'session') {
    return (
      <SessionEarlierRow
        session={item.item}
        ms={item.ms}
        title={title}
        isFirst={isFirst}
        highlight={highlight}
        previewMode={previewMode}
        dominantProvider={dominantProvider}
      />
    )
  }
  return (
    <ConversationEarlierRow
      conv={item.item}
      ms={item.ms}
      title={title}
      highlight={highlight}
      previewMode={previewMode}
      dominantProvider={dominantProvider}
      onLongPress={onLongPressConversation}
    />
  )
}
