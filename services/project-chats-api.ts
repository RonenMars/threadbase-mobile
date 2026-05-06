// Unified ProjectChat API client + legacy fallback adapter.
//
// Migration strategy:
// 1. Try GET /project-chats (with optional ?refreshConversations=1).
// 2. On 404 (endpoint not yet deployed), fall back to merging the legacy
//    /api/sessions and /api/conversations endpoints client-side.
// 3. Normalize snake_case → camelCase at this boundary so UI components see
//    only camelCase ProjectChat fields.
//
// UI components must NOT use this fallback shape directly — always consume
// via this adapter.

import { createApiForServer, NotFoundError } from '@/services/api-client'
import type { ConversationPage, Session, SessionListPage, ServerConfig } from '@/types/api'
import type {
  ListProjectChatsResponse,
  ProjectChat,
  ProjectChatConversation,
  ProjectChatSession,
} from '@/types/projectChat'

interface ListProjectChatsArgs {
  serverId: string
  refreshConversations?: boolean
  serverLabel?: string
  signal?: AbortSignal
}

// ── Wire-format normalisers ─────────────────────────────────────────────

/**
 * Snake_case shape the backend may temporarily return during migration.
 * Camel_case fields take precedence when both are present (post-migration).
 */
interface RawProjectChatItem {
  type?: 'session' | 'conversation'
  id?: string
  project_id?: string
  projectId?: string
  project_path?: string | null
  projectPath?: string | null
  title?: string
  latest_message_at?: string | null
  latestMessageAt?: string | null
  updated_at?: string | null
  updatedAt?: string | null
  created_at?: string | null
  createdAt?: string | null
  status?: ProjectChat['status']
  source?: ProjectChat['source']
  resumed_from_conversation_id?: string | null
  resumedFromConversationId?: string | null
  indexed_at?: string | null
  indexedAt?: string | null
  file_mtime?: string | null
  fileMtime?: string | null
  file_path?: string | null
  filePath?: string | null
  source_hash?: string | null
  sourceHash?: string | null
}

interface RawListProjectChatsResponse {
  items?: RawProjectChatItem[]
  last_conversation_id?: string | null
  lastConversationId?: string | null
  refreshed?: boolean
}

function normalizeItem(raw: RawProjectChatItem, serverId: string, serverLabel?: string): ProjectChat | null {
  const id = raw.id
  const projectId = raw.projectId ?? raw.project_id ?? ''
  const projectPath = raw.projectPath ?? raw.project_path ?? null
  const type = raw.type

  if (!id || !type) return null

  // Items missing both projectId AND projectPath are unusable identity-wise.
  // Don't crash — log and drop, per Step 16.
  if (!projectId && !projectPath) {
    // eslint-disable-next-line no-console
    console.warn('[ProjectChat] item missing projectId AND projectPath', { type, id })
    return null
  }

  const base = {
    id,
    projectId,
    projectPath,
    title: raw.title ?? '',
    latestMessageAt: raw.latestMessageAt ?? raw.latest_message_at ?? null,
    updatedAt: raw.updatedAt ?? raw.updated_at ?? null,
    createdAt: raw.createdAt ?? raw.created_at ?? null,
    serverId,
    serverLabel,
  }

  if (type === 'session') {
    const session: ProjectChatSession = {
      ...base,
      type: 'session',
      status: 'active',
      source: 'session-store',
      resumedFromConversationId:
        raw.resumedFromConversationId ?? raw.resumed_from_conversation_id ?? null,
    }
    return session
  }

  // conversation: backend should send 'archived' or 'resumable'.
  const status: ProjectChatConversation['status'] =
    raw.status === 'archived' || raw.status === 'resumable' ? raw.status : 'resumable'

  const conversation: ProjectChatConversation = {
    ...base,
    type: 'conversation',
    status,
    source: 'hdd-cache',
    indexedAt: raw.indexedAt ?? raw.indexed_at ?? null,
    fileMtime: raw.fileMtime ?? raw.file_mtime ?? null,
    filePath: raw.filePath ?? raw.file_path ?? null,
    sourceHash: raw.sourceHash ?? raw.source_hash ?? null,
  }

  if (!projectId) {
    // eslint-disable-next-line no-console
    console.warn('[ProjectChat] missing projectId; using projectPath as fallback identity', {
      type,
      id,
      projectPath,
    })
  }

  return conversation
}

function normalizeResponse(
  raw: RawListProjectChatsResponse | RawProjectChatItem[],
  serverId: string,
  serverLabel?: string,
): ListProjectChatsResponse {
  // Some backends may temporarily return a bare array; tolerate it.
  if (Array.isArray(raw)) {
    return {
      items: raw.map((it) => normalizeItem(it, serverId, serverLabel)).filter((x): x is ProjectChat => x !== null),
    }
  }
  return {
    items: (raw.items ?? [])
      .map((it) => normalizeItem(it, serverId, serverLabel))
      .filter((x): x is ProjectChat => x !== null),
    lastConversationId: raw.lastConversationId ?? raw.last_conversation_id ?? null,
    refreshed: raw.refreshed,
  }
}

// ── Legacy fallback (sessions + conversations merge) ────────────────────

interface RawLegacySessionMeta {
  id?: string
  project_id?: string
  projectId?: string
  project_name?: string
  projectName?: string
  project_path?: string
  projectPath?: string
  last_updated_at?: string
  lastActivity?: string
  message_count?: number
  preview?: string
  git_branch?: string
}

async function listLegacyProjectChats(
  serverId: string,
  serverLabel: string | undefined,
  signal?: AbortSignal,
): Promise<ListProjectChatsResponse> {
  const api = createApiForServer(serverId)

  // Single sweep — eager pagination is reserved for the live UI hooks. The
  // adapter here is a bootstrap path; consumers can refetch for more pages.
  const sessionsResp = await api.get<SessionListPage>('/api/sessions?limit=200', { signal })
  const conversationsRaw = await api.get<RawLegacySessionMeta[] | ConversationPage>(
    '/api/conversations?limit=200&offset=0',
    { signal },
  )

  const sessionItems: ProjectChat[] = sessionsResp.sessions.map((s: Session): ProjectChatSession => ({
    type: 'session',
    id: s.id,
    projectId: s.projectId ?? '',
    projectPath: s.projectPath ?? null,
    title: s.projectName ?? s.projectPath ?? s.id,
    latestMessageAt: s.completedAt ?? null,
    createdAt: s.startedAt ?? null,
    updatedAt: s.completedAt ?? s.startedAt ?? null,
    status: 'active',
    source: 'session-store',
    resumedFromConversationId: s.resumedFromConversationId ?? null,
    serverId,
    serverLabel,
  }))

  const rawConvList: RawLegacySessionMeta[] = Array.isArray(conversationsRaw)
    ? conversationsRaw
    : conversationsRaw.conversations.map((c) => ({
        id: c.id,
        projectId: c.projectId,
        projectName: c.title,
        projectPath: c.projectPath,
        last_updated_at: c.lastActivity,
        lastActivity: c.lastActivity,
        message_count: c.messageCount,
        preview: c.preview,
        git_branch: c.branch,
      }))

  const conversationItems: ProjectChat[] = rawConvList
    .filter((c): c is RawLegacySessionMeta => c != null && !!c.id)
    .map((c): ProjectChatConversation => ({
      type: 'conversation',
      id: c.id ?? '',
      projectId: c.projectId ?? c.project_id ?? '',
      projectPath: c.projectPath ?? c.project_path ?? null,
      title: c.projectName ?? c.project_name ?? c.projectPath ?? c.project_path ?? c.id ?? '',
      latestMessageAt: c.lastActivity ?? c.last_updated_at ?? null,
      updatedAt: c.lastActivity ?? c.last_updated_at ?? null,
      createdAt: null,
      status: 'resumable',
      source: 'hdd-cache',
      serverId,
      serverLabel,
    }))

  return { items: [...sessionItems, ...conversationItems] }
}

// ── Public client ───────────────────────────────────────────────────────

export async function listProjectChats({
  serverId,
  refreshConversations = false,
  serverLabel,
  signal,
}: ListProjectChatsArgs): Promise<ListProjectChatsResponse> {
  const api = createApiForServer(serverId)
  const path = refreshConversations
    ? '/project-chats?refreshConversations=1'
    : '/project-chats'

  try {
    const raw = await api.get<RawListProjectChatsResponse | RawProjectChatItem[]>(path, { signal })
    return normalizeResponse(raw, serverId, serverLabel)
  } catch (err) {
    if (err instanceof NotFoundError) {
      // Backend hasn't deployed /project-chats yet; merge legacy endpoints.
      return listLegacyProjectChats(serverId, serverLabel, signal)
    }
    throw err
  }
}

export async function listProjectChatsForServers(
  servers: Pick<ServerConfig, 'id' | 'label'>[],
  refreshConversations = false,
  signal?: AbortSignal,
): Promise<ProjectChat[]> {
  const merged: ProjectChat[] = []
  for (const s of servers) {
    if (signal?.aborted) throw new Error('aborted')
    const resp = await listProjectChats({
      serverId: s.id,
      serverLabel: s.label,
      refreshConversations,
      signal,
    })
    merged.push(...resp.items)
  }
  return merged
}
