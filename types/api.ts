import type { ProviderName } from '@/constants/providers'
import type { DeviceCapability } from '@/types/devices'

export type SessionStatus = 'running' | 'waiting_input' | 'idle'

/**
 * Process-lifetime axis from the streamer, orthogonal to `status`.
 * Additive; older servers omit it. Prefer this over inferring end/hold from
 * `ptyAttached` + `status` or from `completedAt` (which is stamped on both a
 * real exit and a hold).
 */
export type SessionLifecycle =
  | 'attached'
  | 'detached'
  | 'orphaned'
  | 'resumable'
  | 'completed'
  | 'failed'

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
  /** Git remote origin URL for the project, when discoverable. Additive; older servers omit it. */
  repoUrl?: string
  machineName?: string
  /**
   * JSONL-derived conversation name (the scanner's slug, or the first user
   * message when there is no slug). Set on resumed/historical sessions; absent
   * on a freshly-started session with no history yet. Additive; older servers omit it.
   */
  sessionName?: string
  /**
   * Model powering the live session, scraped from Claude's status line
   * (e.g. 'Opus 4.8 (1M context)'). Additive; older servers omit it.
   */
  model?: string
  /**
   * Reasoning-effort tier from the status line (e.g. 'high'). Live sessions
   * only — absent for historical shapes. Additive; older servers omit it.
   */
  effort?: string
  /**
   * Active permission mode from the status line (e.g. 'accept edits on').
   * Live sessions only. Additive; older servers omit it.
   */
  permissionMode?: string
  lastOutput: string
  elapsedMs: number
  promptCount: number
  startedAt: string
  /**
   * ISO timestamp when the streamer recorded an end-or-hold. Not a reliable
   * "session ended" signal on its own — `putOnHold` stamps it too. Prefer
   * `lifecycle`. Additive; older servers omit it.
   */
  completedAt?: string
  /**
   * Process-lifetime axis from the streamer. Additive; older servers omit it.
   * When present, prefer this over `idle && !ptyAttached` for ended/hold/live.
   */
  lifecycle?: SessionLifecycle
  /** How `lifecycle` was determined. Additive; older servers omit it. */
  lifecycleSource?: 'spawn' | 'exit' | 'probe' | 'reconcile'
  /** ISO timestamp when `lifecycle` last changed. Additive; older servers omit it. */
  lifecycleUpdatedAt?: string
  failureReason?: string
  /** Set when this session was started via `/api/sessions/resume`. */
  resumedFromConversationId?: string | null
  /** Conversation ID for the live JSONL log backing this session. */
  conversationId?: string | null
  /**
   * Codex only: the rollout UUID discovered after the CLI creates its JSONL.
   * Distinct from `conversationId` (stable live-session / deep-link alias ===
   * session.id). Prefer this for REST conversation history when present.
   */
  boundConversationId?: string | null
  /**
   * OS process id of the underlying CLI. The server sends this for discovered
   * external processes; absent for managed PTY sessions and historical shapes.
   */
  pid?: number
  /**
   * Who owns this session's process. `managed` = streamer-owned PTY;
   * `external` = a CLI the streamer discovered but does not own; `historical` =
   * a resumable shape reconstructed from disk. Additive; older servers omit it.
   */
  ownership?: 'managed' | 'external' | 'historical'
  /**
   * Liveness of the underlying process when the streamer does not own the PTY.
   * `unknown` when it can't be determined. Additive; older servers omit it.
   */
  processLiveness?: 'alive' | 'gone' | 'unknown'
  /**
   * Inferred activity from JSONL tailing (not authoritative process status).
   * Additive; older servers omit it.
   */
  activity?: { state: 'active_writing' | 'quiet'; lastEventAt: string; source: 'jsonl' }
  /**
   * What a rehydrated session was doing when the streamer stopped it. Its
   * `status` has to flatten to `idle` (no PTY), which erases that bit; this
   * carries it alongside. Set only on a stub the streamer's own shutdown ended
   * — never on a live session or a crashed row. Presentation only: the session
   * is still idle and still needs a resume. Additive; older servers omit it.
   */
  interruptedStatus?: 'running' | 'waiting_input'
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
  /** Git remote origin URL for the project, when discoverable. Additive; older servers omit it. */
  repoUrl?: string
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
  /**
   * Source provider. Resumability is not implied by it — `resumable` above is
   * authoritative for both providers. A resumable 'codex-cli' conversation can
   * still collide with the client that holds its writer lock, which the server
   * reports as a 409 carrying `reasonCode: 'CODEX_SESSION_ACTIVE'`.
   */
  provider?: ProviderName
}

export interface Message {
  id: string
  uuid?: string | null
  /**
   * Absolute chronological index from the server (`message_index`). Absent on
   * locally-constructed messages (live stream, optimistic sends).
   */
  messageIndex?: number
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
  /** Additive: true when the server serves /api/config/claude-flags. Absent on older servers. */
  claudeFlags?: boolean
  /** Additive: true when the server serves /api/projects/summary. Absent on older
   *  servers, which the grouped views cannot render — see useProjectSummaries. */
  projectSummary?: boolean
  /**
   * Additive: true when the server keeps its paired-device registry in
   * runtime.db, so it survives `tb-streamer cache clear`.
   *
   * Gates whether we may present the scoped device token instead of the shared
   * API key — see `authToken` below. Absent means an older server that stores
   * devices in the deletable cache, where a documented troubleshooting step
   * would take every device token with it.
   */
  devicesDurable?: boolean
}

// ── Per-server Claude CLI flags ──────────────────────────────────────────────
// The registry is served BY the streamer (only it knows which claude binary is
// installed locally), so the app renders the form generically from this metadata
// rather than hardcoding a flag list that would drift on a CLI upgrade.

export type ClaudeFlagValueType = 'boolean' | 'string' | 'enum' | 'list'

/** How risky enabling a flag is. `dangerous` requires an explicit confirmation. */
export type ClaudeFlagRisk = 'low' | 'elevated' | 'dangerous'

export interface ClaudeFlagDefinition {
  /** Stable key used in requests and for i18n lookup — not the CLI spelling. */
  id: string
  flag: string
  valueType: ClaudeFlagValueType
  enumValues?: string[]
  risk: ClaudeFlagRisk
}

export type ClaudeFlagValue = string | string[] | boolean
export type ClaudeFlagValues = Record<string, ClaudeFlagValue>

export interface ClaudeFlagsConfig {
  registry: ClaudeFlagDefinition[]
  values: ClaudeFlagValues
  extraArgs: string | null
  /** False when the server was started with --claude-flag: changes won't survive a restart. */
  persisted: boolean
  warning?: string
}

/**
 * Server feature flags — booleans gating streamer behaviour, resolved at the
 * streamer's boot and read-only from here (there is no PUT counterpart, so a
 * change means restarting that server). Distinct from ClaudeFlags above, which
 * are CLI arguments handed to a spawned `claude` process.
 */
export interface FeatureFlagDefinition {
  id: string
  description: string
  default: boolean
  env: string
}

export interface FeatureFlagsConfig {
  registry: FeatureFlagDefinition[]
  values: Record<string, boolean>
}

/**
 * Permission modes that disable the human-in-the-loop confirmation entirely.
 * Mirrors DANGEROUS_PERMISSION_MODES in the streamer's src/claude-flags.ts.
 */
export const DANGEROUS_PERMISSION_MODES = ['bypassPermissions', 'dontAsk']

/** Effective risk of a specific value — only permissionMode is value-dependent. */
export function claudeFlagValueRisk(
  def: ClaudeFlagDefinition,
  value: ClaudeFlagValue,
): ClaudeFlagRisk {
  if (def.id === 'permissionMode') {
    return typeof value === 'string' && DANGEROUS_PERMISSION_MODES.includes(value)
      ? 'dangerous'
      : 'low'
  }
  return def.risk
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
  deviceId?: string
}

// ── Browse types ────────────────────────────────────────────────────

export interface BrowseResponse {
  path: string
  directories: { name: string }[]
  // Optional so older servers (directories-only) still typecheck; the browse
  // UI renders these read-only, they are not selectable.
  files?: { name: string }[]
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
  /** Paired-device id from `/api/pair/exchange` (C5). Not a secret. */
  deviceId?: string
  /**
   * Scoped per-device credential from pair exchange (C5). A SECRET: it lives in
   * SecureStore and must never reach `PersistedServer`, a log, or the UI.
   * Absent when the streamer predates device identity.
   */
  deviceToken?: string
  /** Capability list from pair exchange; absent means legacy owner key (full access). */
  deviceCapabilities?: DeviceCapability[]
}

/**
 * The credential to present to a server.
 *
 * `apiKey` is the OWNER's shared key and carries `admin` on the streamer — it
 * can rotate itself and revoke other devices. `deviceToken` is the scoped,
 * individually revocable credential the pair exchange has been minting since
 * C5. The app stored it and then sent the shared key on every request anyway,
 * so a lost phone leaked admin rather than a revocable scope.
 *
 * The `devicesDurable` gate is what makes preferring it safe: on a streamer
 * that keeps its device registry inside the deletable conversation cache,
 * `tb-streamer cache clear` would invalidate the token and 401 the device.
 * Falling back to `apiKey` there is exactly today's behaviour, so an older
 * server is unaffected.
 *
 * Deliberately NOT a 401-retry fallback: silently re-presenting the shared key
 * after a device token is refused would let a revoked device keep working,
 * which is the one thing revocation has to prevent.
 */
export function authToken(
  server: Pick<ServerConfig, 'apiKey' | 'deviceToken' | 'serverInfo'>,
): string {
  return server.serverInfo?.devicesDurable && server.deviceToken
    ? server.deviceToken
    : server.apiKey
}

export type CacheAlertSeverity = 'high' | 'low'
export type CacheAlertResolveAction = 'prune_all' | 'prune_selected' | 'ignore' | 'reset_rescan'

/**
 * Pending cache-integrity alert. Same shape as the server's `GET /api/cache/alert`
 * response; the WS `cache_alert` broadcast carries a `sample` (first 20) instead
 * of the full `missing` list, so store the WS variant with `missing` unset until
 * `GET /api/cache/alert` fills it in.
 */
export interface CacheAlert {
  fingerprint: string
  severity: CacheAlertSeverity
  detectedAt: string
  missingCount: number
  totalRows: number
  backupPath?: string
  missing?: { id: string; filePath: string; title?: string; tailed: boolean }[]
}

export type ServerWarmupState = 'startup' | 'cache_reset' | 'conversation_refresh'

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
