export type SessionStatus = 'running' | 'waiting_input' | 'completed' | 'failed' | 'idle'

export interface Session {
  id: string
  status: SessionStatus
  projectPath: string
  projectName: string
  branch?: string
  machineName?: string
  lastOutput: string
  elapsedMs: number
  promptCount: number
  startedAt: string
  completedAt?: string
  source?: 'managed' | 'discovered'
  conversationId?: string
}

export interface MessageSnapshot {
  text: string
  timestamp: string
}

export interface Conversation {
  id: string
  title: string
  sessionName?: string
  filePath?: string
  projectPath: string
  branch?: string
  account?: string
  preview?: string
  messageCount: number
  lastActivity: string
  firstMessage?: MessageSnapshot
  lastMessage?: MessageSnapshot
  model?: string
  totalTokens?: number
}

export interface ConversationFilter {
  projectPath?: string
  dateFrom?: string
  dateTo?: string
  profileId?: string
}

export interface ConversationPage {
  conversations: Conversation[]
  hasMore: boolean
  offset: number
  total: number
}

export interface ConversationDetail extends Conversation {
  messages: Message[]
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: MessageContent[]
  timestamp: string
  tokens?: number
}

export type MessageContent =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; toolName: string; content: string; isError?: boolean }
  | { type: 'diff'; filename: string; hunks: DiffHunk[] }

export interface DiffHunk {
  oldStart: number
  oldLines: number
  newStart: number
  newLines: number
  lines: DiffLine[]
}

export interface DiffLine {
  type: 'context' | 'addition' | 'deletion'
  content: string
}

export interface Profile {
  id: string
  name: string
  claudeConfigDir: string
  conversationCount: number
}

export interface ServerInfo {
  version: string
  machineName: string
  platform: string
  activeSessions: number
}

export interface QueuedPrompt {
  id: string
  text: string
  addedAt: string
  status: 'pending' | 'running' | 'completed' | 'cancelled'
}

export interface NotificationEvent {
  type: 'waiting_input' | 'session_complete' | 'session_failed' | 'diff_ready'
  sessionId: string
  projectName: string
  message?: string
}

export interface NotificationPreferences {
  waitingInput: boolean
  sessionComplete: boolean
  sessionFailed: boolean
  diffReady: boolean
  quietHoursEnabled: boolean
  quietHoursFrom: string
  quietHoursTo: string
  showBadge: boolean
}

export interface PushRegisterPayload {
  token: string
  platform: 'ios' | 'android'
}

// ── Browse types ────────────────────────────────────────────────────

export interface BrowseResponse {
  path: string
  directories: { name: string }[]
}

export interface MkdirResponse {
  created: string
}

// ── Multi-server types ──────────────────────────────────────────────────

export interface ServerConfig {
  id: string
  url: string
  apiKey: string
  label?: string
  isConnected: boolean
  serverInfo: ServerInfo | null
  connectionError: string | null
}

export interface MultiSession extends Session {
  serverId: string
  serverLabel?: string
}

export interface MultiConversation extends Conversation {
  serverId: string
  serverLabel?: string
}

/**
 * Deterministic server ID derived from the URL.
 * Normalises the URL (lowercase host, strip trailing slash) then produces a
 * short alphanumeric hash so the same server always maps to the same key.
 */
export function serverIdFromUrl(raw: string): string {
  const normalised = raw.replace(/\/+$/, '').toLowerCase()
  let hash = 0
  for (let i = 0; i < normalised.length; i++) {
    hash = ((hash << 5) - hash + normalised.charCodeAt(i)) | 0
  }
  return 'srv_' + Math.abs(hash).toString(36)
}
