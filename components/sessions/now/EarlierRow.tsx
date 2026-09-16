import { useCallback } from 'react'
import { useRouter } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { ConversationListItem } from '@/components/sessions/shared/ConversationListItem'
import type { MessagePreviewMode } from '@/components/sessions/shared/MessagePreview'
import { basename } from '@/components/sessions/shared/rowTitle'
import { conversationHref } from '@/lib/conversationHref'
import { deriveSessionPresentation } from '@/lib/sessionPresentation'
import { useSessionRowActions } from '@/hooks/useSessionRowActions'
import { useNavLockStore } from '@/stores/navLock'
import { useServersStore } from '@/stores/servers'
import { useSettingsStore } from '@/stores/settings'
import type { ProviderName } from '@/constants/providers'
import type { MultiConversation, MultiSession } from '@/types/api'
import type { MergedItem } from './mergedItems'
import { QuietRow } from './QuietRow'

interface Props {
  item: MergedItem
  title: string
  /** The title came from a quiet rung of the ladder: one light line instead of two. */
  quiet?: boolean
  /** Quiet rows dim in the Now list; the pushed list shows them at full strength. */
  dimmed?: boolean
  isFirst?: boolean
  highlight?: string
  dominantProvider?: ProviderName
  onLongPressConversation?: (conv: MultiConversation) => void
}

/** `repo · branch` for the quiet line, or nothing when the title already is that identity. */
function quietMeta(projectName: string | undefined, branch: string | undefined, title: string): string | undefined {
  const identity = [projectName, branch].filter(Boolean).join(' · ')
  return identity && identity !== title ? identity : undefined
}

function SessionEarlierRow({ session, ms, title, quiet, dimmed, isFirst, highlight, previewMode, dominantProvider }: {
  session: MultiSession
  ms: number
  title: string
  quiet?: boolean
  dimmed?: boolean
  isFirst?: boolean
  highlight?: string
  previewMode: MessagePreviewMode
  dominantProvider?: ProviderName
}) {
  const { handlePress, handleLongPress } = useSessionRowActions(session)
  const activeServerCount = useServersStore((s) => s.activeServerIds.length)
  const serverColor = useServersStore((s) => s.servers[session.serverId]?.color)
  const { tier } = deriveSessionPresentation(session)
  if (quiet) {
    return (
      <QuietRow
        testID={isFirst ? 'first-session-card' : `session-row-${session.id}`}
        label={title}
        meta={quietMeta(session.projectName, session.branch, title)}
        timestamp={ms}
        dimmed={dimmed}
        onPress={handlePress}
        onLongPress={handleLongPress}
      />
    )
  }
  return (
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
  )
}

function ConversationEarlierRow({ conv, ms, title, quiet, dimmed, highlight, previewMode, dominantProvider, onLongPress }: {
  conv: MultiConversation
  ms: number
  title: string
  quiet?: boolean
  dimmed?: boolean
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

  if (quiet) {
    return (
      <QuietRow
        testID={`conversation-row-${conv.id}`}
        label={title}
        meta={quietMeta(basename(conv.projectPath), conv.branch, title)}
        timestamp={ms}
        dimmed={dimmed}
        onPress={handlePress}
        onLongPress={onLongPress ? () => onLongPress(conv) : undefined}
      />
    )
  }

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
 * EARLIER TODAY while showing last week's date.
 */
export function EarlierRow({ item, title, quiet, dimmed, isFirst, highlight, dominantProvider, onLongPressConversation }: Props) {
  const rowPreviewMode = useSettingsStore((s) => s.rowPreviewMode)
  const previewMode: MessagePreviewMode = rowPreviewMode === 'off' ? 'none' : rowPreviewMode
  if (item.kind === 'session') {
    return (
      <SessionEarlierRow
        session={item.item}
        ms={item.ms}
        title={title}
        quiet={quiet}
        dimmed={dimmed}
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
      quiet={quiet}
      dimmed={dimmed}
      highlight={highlight}
      previewMode={previewMode}
      dominantProvider={dominantProvider}
      onLongPress={onLongPressConversation}
    />
  )
}
