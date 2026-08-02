// UI-facing types for the unified ProjectChat list.
//
// Backend models a chat as either a live "session" or a historical
// "conversation" scanned from disk. Both belong to a stable Project, identified
// by a `projectId`. The Expo app keys cache, navigation, and grouping by
// `projectId`/`type:id`, never `projectPath` — see migration spec.

export type ProjectChatType = 'session' | 'conversation'

export type ProjectChatSource = 'session-store' | 'hdd-cache'

export type ProjectChatStatus = 'active' | 'archived' | 'resumable'

export interface ProjectChatBase {
  id: string
  projectId: string
  projectPath?: string | null
  title: string
  latestMessageAt: string | null
  updatedAt?: string | null
  createdAt?: string | null
  /** Server scope for query keys and identity. Required for multi-server support. */
  serverId: string
  serverLabel?: string
}

export interface ProjectChatSession extends ProjectChatBase {
  type: 'session'
  status: 'active'
  source: 'session-store'
  resumedFromConversationId?: string | null
}

export interface ProjectChatConversation extends ProjectChatBase {
  type: 'conversation'
  status: 'archived' | 'resumable'
  source: 'hdd-cache'
  provider?: 'claude-code' | 'codex-cli'
  indexedAt?: string | null
  fileMtime?: string | null
  filePath?: string | null
  sourceHash?: string | null
}

export type ProjectChat = ProjectChatSession | ProjectChatConversation

// ── Response envelopes ──────────────────────────────────────────────────

/**
 * Response shape for `GET /project-chats[?refreshConversations=1]`.
 *
 * `lastConversationId` and `refreshed` are diagnostics only — UI must not
 * reimplement backend refresh logic on top of them.
 */
export interface ListProjectChatsResponse {
  items: ProjectChat[]
  lastConversationId?: string | null
  refreshed?: boolean
}

/**
 * Response shape for `POST /api/sessions/start` (and equivalents).
 *
 * The backend SHOULD return `projectId` once the conversation/project link is
 * complete. During migration the field may be absent — callers must handle
 * that by invalidating the project-chats list and reading the canonical
 * `projectId` from there.
 */
export interface CreateSessionResponse {
  id: string
  projectId?: string
  projectPath?: string | null
  conversationId?: string | null
}

/**
 * Response shape for `POST /api/sessions/resume`.
 *
 * The server answers with its `SessionResponse` — keyed `id` + `conversationId`.
 * It sends no `sessionId` key and no `status: 'resumed'`; both were declared
 * here and never existed server-side (confirmed against a live server on
 * 2026-08-02). Read the session id from `id`. Older servers answered with a
 * bare `{ id }`, so everything past `id` is optional.
 */
export interface ResumeConversationResponse {
  id: string
  conversationId?: string
  projectId?: string
  projectPath?: string | null
  /** Never sent. Tolerated so adding it server-side stays a no-op here. */
  sessionId?: string
}

// ── Identity helper ─────────────────────────────────────────────────────

/**
 * Temporary bridge for code that still needs to identify a project before the
 * backend reliably returns `projectId`. Prefer `projectId` everywhere and
 * remove call sites once the backend migration completes.
 */
export function getProjectIdentity(item: {
  projectId?: string | null
  projectPath?: string | null
}): string {
  return item.projectId ?? item.projectPath ?? ''
}
