import { useServersStore } from '@/stores/servers'
import { useSettingsStore } from '@/stores/settings'
import { ConversationListItem } from '@/components/sessions/shared/ConversationListItem'
import type { MessagePreviewMode } from '@/components/sessions/shared/MessagePreview'
import type { DrillItem } from './types'

interface Props {
  item: DrillItem
}

// DrillItem.key is `session:<serverId>::<id>` or `conversation:<serverId>::<id>`.
// Derive a testID that matches the rest of the app's row testID convention:
//   sessions      → session-row-<id>
//   conversations → conversation-row-<id>
// so e2e flows can target a drill row by the same id they'd use anywhere else.
function rowTestIDFromKey(key: string): string {
  const colonColon = key.indexOf('::')
  if (colonColon === -1) return `drill-row-${key}`
  const kind = key.slice(0, key.indexOf(':'))
  const id = key.slice(colonColon + 2)
  if (kind === 'session') return `session-row-${id}`
  if (kind === 'conversation') return `conversation-row-${id}`
  return `drill-row-${key}`
}

export function DrillRow({ item }: Props) {
  const isLive = item.status === 'running' || item.status === 'waiting_input'
  const activeServerCount = useServersStore((s) => s.activeServerIds.length)
  const serverColor = useServersStore((s) => (item.serverId ? s.servers[item.serverId]?.color : undefined))
  const rowPreviewModeSetting = useSettingsStore((s) => s.rowPreviewMode)
  const previewMode: MessagePreviewMode = rowPreviewModeSetting === 'off' ? 'none' : rowPreviewModeSetting

  return (
    <ConversationListItem
      testID={rowTestIDFromKey(item.key)}
      title={item.label}
      timestamp={item.timestamp ?? undefined}
      messageCount={item.messageCount}
      firstMessage={item.firstMessage}
      lastMessage={item.lastMessage}
      lastOutput={item.lastOutput}
      branch={item.branch}
      live={isLive}
      serverLabel={item.serverLabel}
      serverColor={serverColor}
      activeServerCount={activeServerCount}
      density="compact"
      leading="dot"
      previewMode={previewMode}
      provider={item.provider}
      onPress={item.onPress}
    />
  )
}
