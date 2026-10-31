import { createApiForServer } from '@/services/api-client'
import {
  parseSavedItemsList,
  type KeyedWireItem,
  type RawSavedItemsList,
  type WireSavedItem,
} from '@/lib/savedItemsWire'
import { useServersStore } from '@/stores/servers'

const BASE = '/api/saved-items'

export function serverSupportsSavedItems(serverId: string): boolean {
  const server = useServersStore.getState().servers[serverId]
  return !!server?.isConnected && server.serverInfo?.savedItems === true
}

export async function listSavedItems(serverId: string): Promise<{ items: KeyedWireItem[]; revision: number }> {
  return parseSavedItemsList(await createApiForServer(serverId).get<RawSavedItemsList>(BASE))
}

export async function putSavedItem(serverId: string, key: string, item: WireSavedItem): Promise<void> {
  await createApiForServer(serverId).put(`${BASE}/${encodeURIComponent(key)}`, item)
}

export async function deleteSavedItem(serverId: string, key: string): Promise<void> {
  await createApiForServer(serverId).delete(`${BASE}/${encodeURIComponent(key)}`)
}

export async function reorderSavedItems(serverId: string, keys: string[]): Promise<void> {
  await createApiForServer(serverId).put(`${BASE}/order`, { keys })
}
