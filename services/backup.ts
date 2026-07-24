import { createApiForServer, NetworkError } from '@/services/api-client'
import { useServersStore } from '@/stores/servers'
import { getDeviceClientId } from '@/services/device-id'
import {
  archiveToShareText,
  parseBackupArchive,
  parseRestoreConflictBody,
  parseRestoreResponse,
  type BackupArchive,
  type RestorePathMapRule,
  type RestorePlan,
  type RestoreResponse,
  type RestoreSummary,
} from '@/types/backup'

export class BackupParseError extends Error {
  constructor() {
    super('Server returned an unrecognized backup payload')
    this.name = 'BackupParseError'
  }
}

export class RestoreConflictError extends Error {
  summary: RestoreSummary
  plan: RestorePlan

  constructor(message: string, summary: RestoreSummary, plan: RestorePlan) {
    super(message)
    this.name = 'RestoreConflictError'
    this.summary = summary
    this.plan = plan
  }
}

export async function exportBackup(
  serverId: string,
  signal?: AbortSignal,
): Promise<BackupArchive> {
  const api = createApiForServer(serverId)
  const body = await api.get<object>('/api/backup/export', { signal })
  const parsed = parseBackupArchive(body)
  if (!parsed) throw new BackupParseError()
  return parsed
}

export async function restoreBackup(
  serverId: string,
  archive: BackupArchive,
  options: { apply?: boolean; pathMap?: RestorePathMapRule[] } = {},
): Promise<RestoreResponse> {
  const apply = options.apply === true
  if (!apply) {
    const api = createApiForServer(serverId)
    const body = await api.post<object>('/api/backup/restore', {
      archive,
      pathMap: options.pathMap,
      apply: false,
    })
    const parsed = parseRestoreResponse(body)
    if (!parsed || parsed.applied !== false) throw new BackupParseError()
    return parsed
  }

  // Apply path uses a direct fetch so a 409 RESTORE_CONFLICT can carry the plan.
  const server = useServersStore.getState().getServer(serverId)
  if (!server) throw new NetworkError(`Unknown server: ${serverId}`)

  const url = `${server.url.replace(/\/$/, '')}/api/backup/restore`
  const clientId = await getDeviceClientId()
  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${server.apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Client-Id': clientId,
      },
      body: JSON.stringify({
        archive,
        pathMap: options.pathMap,
        apply: true,
      }),
    })
  } catch (err) {
    throw new NetworkError(`Failed to reach ${url}: ${String(err)}`)
  }

  const raw = (await response.json().catch(() => null)) as object | null
  if (response.status === 409 && raw) {
    const conflict = parseRestoreConflictBody(raw)
    if (conflict) {
      throw new RestoreConflictError(conflict.message, conflict.summary, conflict.plan)
    }
  }
  if (!response.ok) {
    const detail =
      raw && typeof raw === 'object' && 'error' in raw && typeof (raw as { error?: unknown }).error === 'string'
        ? (raw as { error: string }).error
        : `Server returned ${response.status}`
    const code =
      raw && typeof raw === 'object' && 'code' in raw && typeof (raw as { code?: unknown }).code === 'string'
        ? (raw as { code: string }).code
        : undefined
    throw new NetworkError(detail, code)
  }
  if (!raw) throw new BackupParseError()
  const parsed = parseRestoreResponse(raw)
  if (!parsed || parsed.applied !== true) throw new BackupParseError()
  return parsed
}

export { archiveToShareText }
