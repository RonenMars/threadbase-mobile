import type { ProviderName } from '@/constants/providers'
import type { InheritedHistorySeam } from '@/utils/inheritedHistory'
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
  | 'starting'
  | 'detached'
  | 'orphaned'
  | 'resumable'
  | 'completed'
  | 'failed'

/**
 * Sub-status the streamer derives from the agent's status line while a turn is
 * running. The streamer emits only `working` today (Codex sessions); the rest of
 * the union is reserved, and an unrecognised value must be treated as no phase.
 */
export type AgentPhase = 'thinking' | 'streaming' | 'hooks' | 'acting' | 'working'

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
  /**
   * Agent phase within a running turn. Always serialised — `null` when there is
   * no phase — so a merge of a partial frame can clear it. An absent key means a
   * server too old to have the feature, never "cleared".
   */
  subStatus: AgentPhase | null
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

/** Half-open `[start, end)` character range into a search snippet. */
export interface SearchHighlight {
  start: number
  end: number
}

/**
 * One matched field on an `/api/search` result. `field` is an open vocabulary —
 * `content` for any body hit, otherwise a camelCase meta field name — so a newer
 * server may name a field this build has never seen. `highlights` is absent (not
 * empty) on metadata hits, and its ranges follow FTS token boundaries rather than
 * the query string.
 */
export interface SearchMatch {
  field: string
  snippet: string
  highlights?: SearchHighlight[]
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
  /** Only populated by `/api/search`; absent on list and detail responses. */
  matches?: SearchMatch[]
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
  /**
   * Where the messages this session inherited from a `codex fork` parent stop
   * and its own turns begin. Absent unless the server reports the seam.
   */
  inheritedHistory?: InheritedHistorySeam
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
// show "2. Yes / 3. No".
export interface PermissionOption {
  index: number
  label: string
  /**
   * Literal keystroke bytes that answer this option, when the detector knows
   * them — authoritative over `index`, which is only presentational for some
   * prompts. A Codex EXEC approval renders "1. yes / 2. no" but is answered by
   * `y` and Escape; a shell `[y/N]` renders no numbers at all.
   *
   * Absent for OSC-777 gates, where `${index}\r` is correct and remains the
   * fallback. The streamer has sent this since it added `detectShellPrompt`;
   * the client used to drop it.
   */
  answerKeys?: string
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
  /**
   * Server-computed content identity of this gate, cursor deliberately excluded.
   * Opaque: echo it back on POST /permission/answer verbatim, never construct,
   * parse or compare it — a second implementation of the hash is exactly what
   * the opaque token exists to prevent. Additive; a streamer that omits it is
   * too old to have the validated route at all.
   */
  contentKey?: string
  /**
   * Server-owned identity of this gate *instance*. The same contentKey recurs
   * when an identical gate reopens; gateId never does. Opaque, echoed back on
   * POST /permission/answer next to contentKey. Additive: absent on streamers
   * that predate it, which answer on contentKey alone.
   */
  gateId?: string
}

export interface PermissionCancelledWsMessage {
  type: 'permission_cancelled'
  sessionId: string
}

// ─── Provider-neutral prompt contract (streamer ≥ 1.70, schemaVersion 1) ───
//
// One shape for every prompt regardless of provider or producer. Ids are
// opaque and server-owned: answer by `optionId`, never by position or label.
// Additive beside the legacy `question` / `permission` events, which the
// streamer keeps sending; a streamer that predates the contract sends none of
// these frames and the client stays on the legacy path.

export type PromptInputMode = 'single' | 'multi' | 'text'

export interface PromptOption {
  optionId: string
  label: string
  description?: string
  preview?: string
}

export interface PromptQuestion {
  questionId: string
  text: string
  header?: string
  /** Narrowed on read: anything but `single` is a shape this build cannot answer. */
  inputMode: PromptInputMode | string
  options: PromptOption[]
  allowOther: boolean
  secret: boolean | 'unknown'
}

/** `open` and `updated` are actionable; every other value, known or not, is not. */
export type PromptState = 'open' | 'updated' | 'resolved' | 'cancelled' | 'expired' | 'unavailable'

export interface Prompt {
  schemaVersion: number
  sessionId: string
  promptId: string
  /** Bumped on a meaningful update; the answer echoes the revision it saw. */
  revision: number
  state: PromptState | string
  terminalReason?: string
  intent: 'approval' | 'question'
  title?: string
  message?: string
  detail?: string
  questions: PromptQuestion[]
  answerRequirement: 'blocking' | 'non_blocking' | 'unknown'
  expiresAt: string | null
  provenance: { source: string; confidence: string }
}

export interface PromptEventWsMessage {
  type: 'prompt_event'
  sessionId: string
  sequence: number
  prompt: Prompt
}

/**
 * Sent synchronously on subscribe_session, before terminal replay. Carries
 * every prompt the streamer still RETAINS for the session — terminal ones
 * included — so filter on `state`; presence is not "open".
 */
export interface PromptSnapshotWsMessage {
  type: 'prompt_snapshot'
  schemaVersion: number
  sessionId: string
  sequence: number
  prompts: Prompt[]
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
   * API key — see `authToken` in `services/authed-fetch.ts`. Absent means an
   * older server that stores devices in the deletable cache, where a documented
   * troubleshooting step would take every device token with it.
   */
  devicesDurable?: boolean
  /**
   * Additive: the server publishes the provider-neutral prompt contract
   * (`prompt_snapshot` / `prompt_event` frames, POST /prompt/answer). Absent on
   * older servers. Informational: the client negotiates by frame presence, not
   * by this field, because the subscribe snapshot precedes any legacy frame and
   * this probe has its own timing.
   */
  promptContract?: { schemaVersion: number; atomicAnswer: boolean }
  /**
   * Additive: whether this server speaks application-layer encryption, and
   * whether it is switched on right now.
   *
   * Absent means an older streamer, which must be read as **unknown** — the same
   * contract every other field here follows — and resolves to today's plaintext
   * path. Never read as "this server cannot encrypt": that conclusion belongs to
   * the pinned bit, not to a field an intermediary can strip.
   */
  e2ee?: E2eeCapability
  /**
   * Additive: true when this server can emit `host_pressure` WS frames.
   * Absent means an older server. Discovery only — the frames themselves
   * are authoritative for showing the Hub banner.
   */
  hostPressure?: true
  /** Additive: POST /api/sessions/:id/raw-key accepts constrained picker controls. */
  rawKeys?: true
}

/**
 * A streamer's encryption capability, as reported by `GET /api/info`.
 *
 * Mirrors `describeE2eeCapability()` in the streamer's `misc.routes.ts`.
 * `supported` says the build has the code path; `enabled` says it is on right
 * now. `required` is the streamer's stage-3 bit — it refuses plaintext from any
 * client — and is not the same thing as this device requiring encryption.
 */
export interface E2eeCapability {
  supported: boolean
  enabled: boolean
  version: number
  required: boolean
  /** Why `enabled` is false; absent when it is true. */
  reason?: string
}

/**
 * The envelope version this app implements. A server offering anything else is
 * one we cannot talk to, and must be treated as offering nothing.
 */
export const E2EE_CLIENT_VERSION = 1

/**
 * Whether to attempt an encrypted handshake with this server.
 *
 * This answers exactly one question — *may* we encrypt — and deliberately not
 * its inverse. Whether falling back to plaintext is acceptable is decided by
 * this device's own "require encryption" pin, because `/api/info` crosses the
 * network unauthenticated: an intermediary can strip `e2ee` and a client that
 * inferred "so plaintext is fine" would have been downgraded by one deleted
 * field. That is why a `false` here means "do not attempt", never "plaintext is
 * safe".
 *
 * The version has to match rather than merely be present. A future streamer
 * advertising `version: 2` speaks a transcript this build cannot produce, and
 * attempting it would fail after the handshake rather than before it.
 */
export function serverSpeaksE2ee(info: ServerInfo | null | undefined): boolean {
  const e2ee = info?.e2ee
  if (!e2ee) return false
  return e2ee.supported && e2ee.enabled && e2ee.version === E2EE_CLIENT_VERSION
}

/**
 * Whether this device's `requireEncryption` pin refuses this server.
 *
 * Deliberately silent until the server has actually answered `GET /api/info`:
 * a server we have never reached is unreachable, which is a different problem
 * with a different message, and naming it a downgrade would be a lie.
 *
 * Note the asymmetry that makes that safe today, because it is invisible from
 * here: `refreshServerInfo` overwrites `serverInfo` on success but sets it to
 * `null` on error, so forcing an error erases the record that this server ever
 * spoke encryption and quiets this predicate. That buys an attacker nothing
 * while a null `serverInfo` also means not connected — they already had denial
 * of service. It stops being free the moment this bit gates a live connection,
 * and "force an error to clear the evidence" is the test that has to land with
 * that change.
 */
export function encryptionPinRefuses(
  server: Pick<ServerConfig, 'requireEncryption' | 'serverInfo'>,
): boolean {
  if (!server.requireEncryption) return false
  if (!server.serverInfo) return false
  return !serverSpeaksE2ee(server.serverInfo)
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
  /**
   * What the server advertised as its public address at pairing. Recorded, not
   * applied: `url` above is always the address the user chose. Nothing reads
   * this yet — it exists so a future "reach this server from outside" feature
   * has the value without needing a re-pair. See threadbase-mobile#722.
   */
  publicUrl?: string
  /**
   * The server's long-term X25519 public key, unpadded base64url, as carried by
   * the QR and then proved by the pairing handshake. Absent on a plaintext
   * pairing and on every server paired before Phase 2.
   *
   * This is the half that binds the *identity*: `requireEncryption` below only
   * demands that a connection be encrypted, which any machine can satisfy with
   * its own key. The two together are what make either one meaningful.
   */
  serverPublicKey?: string
  /**
   * This device's pin: refuse to talk to this server unencrypted. Absent means
   * unpinned, which is not the same as "plaintext is fine" — it means the
   * question has not been answered yet.
   *
   * It is deliberately a device-side bit rather than something read off the
   * wire: `GET /api/info` crosses the network unauthenticated, so an
   * intermediary that strips `e2ee` would otherwise be able to downgrade the
   * connection by deleting one field. This bit is what it cannot reach.
   *
   * Set by the user today. The design also has it auto-set on the first
   * successful encrypted connection; that call site lands with the connection
   * wiring, which does not exist yet — see threadbase-mobile#698.
   */
  requireEncryption?: boolean
}

export type CacheAlertSeverity = 'high' | 'low'
export type CacheAlertResolveAction = 'prune_all' | 'prune_selected' | 'ignore' | 'reset_rescan'

export type HostPressureLevel = 'elevated' | 'critical'
export type HostPressureReason = 'memory' | 'event_loop' | 'load' | 'agents'
export type HostPressureOs = 'darwin' | 'linux' | 'win32'

export interface HostPressureAlert {
  level: HostPressureLevel
  reasons: HostPressureReason[]
  liveAgents: number
  updatedAt: string
  /** Additive: host OS from the WS frame or GET /api/info. Absent on older streamers. */
  os?: HostPressureOs
}

export function parseHostPressureReasons(reasons: string[]): HostPressureReason[] {
  const parsed: HostPressureReason[] = []
  for (const reason of reasons) {
    if (reason === 'memory' || reason === 'event_loop' || reason === 'load' || reason === 'agents') {
      parsed.push(reason)
    }
  }
  return parsed
}

export function parseHostPressureOs(value: string | undefined): HostPressureOs | undefined {
  if (!value) return undefined
  const normalized = value.toLowerCase()
  if (normalized === 'darwin' || normalized === 'macos' || normalized === 'osx') return 'darwin'
  if (normalized === 'linux') return 'linux'
  if (normalized === 'win32' || normalized === 'windows') return 'win32'
  return undefined
}

export function isHostPressureLevel(level: string): level is HostPressureLevel {
  return level === 'elevated' || level === 'critical'
}

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
