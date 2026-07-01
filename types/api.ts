import type { ProviderName } from '@/constants/providers'

export type SessionStatus = 'running' | 'waiting_input' | 'idle'

export interface Session {
  id: string
  provider?: ProviderName
  status: SessionStatus
  ptyAttached: boolean
  /** Stable backend identity. Optional during migration; will be required. */
  projectId?: string
  projectPath: string
  projectName: string
  branch?: string
  machineName?: string
  lastOutput: string
  elapsedMs: number
  promptCount: number
  startedAt: string
  completedAt?: string
  failureReason?: string
  /** Set when this session was started via `/api/sessions/resume`. */
  resumedFromConversationId?: string | null
  /** Conversation ID for the live JSONL log backing this session. */
  conversationId?: string | null
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
  /** Stable backend identity. Optional during migration; will be required. */
  projectId?: string
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
  provider?: ProviderName
}

export interface ConversationFilter {
  projectPath?: string
  dateFrom?: string
  dateTo?: string
  profileId?: string
  provider?: ProviderName
}

export interface ConversationPage {
  conversations: Conversation[]
  hasMore: boolean
  offset: number
  total: number
}

// ── Session pagination ──────────────────────────────────────────────

// Wire-format sort keys, must match the streamer's SessionSortKey enum.
// The home-screen UI uses a slightly different naming ('lastActivity' vs
// 'lastActivityAt'); see toWireSortKey in hooks/useSession.ts for the mapping.
export type SessionSortKeyWire = 'startedAt' | 'lastActivityAt' | 'projectName' | 'status'

export interface SessionListPage {
  sessions: Session[]
  nextCursor: string | null
  total: number
}

export interface SessionFilter {
  status?: SessionStatus[]
}

export interface TurnDuration {
  duration_ms: number
  message_count: number
  uuid?: string
}

/** Why a conversation can't be resumed, when `resumable` is false. */
export type UnavailableReason = 'path_missing' | 'worktree_removed'

export interface ConversationDetail extends Conversation {
  messages: Message[]
  turn_durations?: TurnDuration[]
  lastPrompt?: string
  /**
   * Whether the conversation can be resumed. Absent on older servers — treat
   * `undefined` as resumable. False when the project dir the session ran in is
   * gone; history is still viewable but resume would fail.
   */
  resumable?: boolean
  /** Set only when `resumable` is false; explains why. */
  unavailableReason?: UnavailableReason
  /** Source provider. 'codex-cli' conversations are never resumable. */
  provider?: ProviderName
}

export interface Message {
  id: string
  uuid?: string | null
  role: 'user' | 'assistant'
  content: MessageContent[]
  timestamp: string
  tokens?: number
  has_images?: boolean
  parent_uuid?: string | null
  permission_mode?: string | null
  is_sidechain?: boolean
  is_tool_result?: boolean
  attachment?: Record<string, unknown> | null
}

export type MessageContent =
  | { type: 'text'; text: string }
  | { type: 'thinking'; thinking: string; signature?: string }
  | { type: 'tool_use'; id?: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; toolUseId?: string; toolName: string; content: string; isError?: boolean }
  | { type: 'diff'; filename: string; hunks: DiffHunk[] }

export interface AskOption {
  label: string
  description: string
  preview?: string
}

export interface AskQuestion {
  question: string
  header: string
  multiSelect: boolean
  options: AskOption[]
}

export interface QuestionWsMessage {
  type: 'question'
  sessionId: string
  toolUseId: string
  questions: AskQuestion[]
}

export interface QuestionCancelledWsMessage {
  type: 'question_cancelled'
  sessionId: string
  toolUseId: string
}

// A permission-gate option scraped from the rendered screen. `index` is the
// ACTUAL on-screen number (e.g. 2, 3), not a 1-based array index — gates can
// show "2. Yes / 3. No". Answered by sending `${index}\r` via /input { keys }.
export interface PermissionOption {
  index: number
  label: string
}

// Permission gate detected live by the streamer (OSC 777). Additive WS event.
export interface PermissionWsMessage {
  type: 'permission'
  sessionId: string
  prompt?: string
  /** Descriptive block above the prompt (tool title + command + action), newline-joined. */
  detail?: string
  options: PermissionOption[]
  cursor?: number
}

export interface PermissionCancelledWsMessage {
  type: 'permission_cancelled'
  sessionId: string
}

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
  /** Hex color assigned to this server for the multi-server identity strip + chip. */
  color?: string
  /** Optional Phosphor icon name used by the 'symbol' chip variant. */
  symbol?: string
}

export interface MultiSession extends Session {
  serverId: string
  serverLabel?: string
}

export interface MultiConversation extends Conversation {
  serverId: string
  serverLabel?: string
}

export interface PopularProject {
  path: string
  name: string
  sessionCount: number
}

/**
 * Popular project tagged with the server it came from. Mirrors `MultiSession`:
 * the multi-server aggregate in `usePopularProjects` needs each project to
 * remember its origin server so downstream taps (e.g. Popular → "New Session
 * here") route to the correct server's directory-list endpoint.
 */
export interface MultiPopularProject extends PopularProject {
  serverId: string
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
