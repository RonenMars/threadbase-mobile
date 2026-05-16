import { useServersStore } from '@/stores/servers'
import { ConversationListItem } from '@/components/sessions/shared/ConversationListItem'
import type { DrillItem } from './types'

interface Props {
  item: DrillItem
}

export function DrillRow({ item }: Props) {
  const isLive = item.status === 'running' || item.status === 'waiting_input'
  const activeServerCount = useServersStore((s) => s.activeServerIds.length)
  const serverColor = useServersStore((s) => (item.serverId ? s.servers[item.serverId]?.color : undefined))

  return (
    <ConversationListItem
      title={item.label}
      timestamp={item.timestamp ?? undefined}
      live={isLive}
      serverLabel={item.serverLabel}
      serverColor={serverColor}
      activeServerCount={activeServerCount}
      density="compact"
      leading="dot"
      previewMode="none"
      showCount={false}
      showBranch={false}
      onPress={item.onPress}
    />
  )
}
