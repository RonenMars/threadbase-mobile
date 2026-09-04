import type {
  Session,
  NotificationEvent,
  QuestionWsMessage,
  QuestionCancelledWsMessage,
  PermissionWsMessage,
  PermissionCancelledWsMessage,
  PromptEventWsMessage,
  PromptSnapshotWsMessage,
  CacheAlertSeverity,
  CacheAlertResolveAction,
  HostPressureLevel,
  HostPressureReason,
} from '@/types/api'
import { getDeviceClientId } from './device-id'
import { isCleartextAllowed } from './cleartext-policy'
import { clientLog } from '@/lib/clientLog'
import { OpenError, openContextOnce, type TransportContext } from '@/services/e2ee/context'

export type WSMessage =
  | { type: 'session_update'; session: Session }
  // `seq` is a per-session monotonically increasing chunk counter from the
  // streamer (starts at 1). Additive; old streamers omit it. Lets the client
  // detect a stale chunk delivered after a reconnect race instead of
  // trusting raw WS arrival order.
  | { type: 'terminal_output'; sessionId: string; data: string; seq?: number }
  | { type: 'session_list'; sessions: Session[] }
  // Liveness only. Carries nothing to render; its job is to reset the silence
  // watchdog in useTerminalStream on an otherwise idle socket (#946).
  | { type: 'ping'; ts: number }
  | { type: 'notification'; event: NotificationEvent }
  | { type: 'plan_ready'; sessionId: string; plan: string }
  // Ground-truth user message: the streamer wrote this text to the PTY, so the
  // client can positively identify user-owned output instead of parsing the
  // `❯ <text>` transcript line heuristically. Additive; old streamers omit it.
  | { type: 'user_message'; sessionId: string; text: string; ts: number }
  // `seq` is the streamer's last-emitted terminal_output seq at replay time,
  // letting the client baseline before trusting subsequent chunks. Additive;
  // old streamers omit it.
  | {
      type: 'terminal_replay'
      sessionId: string
      lines: string[]
      userMessages?: { text: string; ts: number }[]
      seq?: number
    }
  | { type: 'session_ready'; session: Session }
  | { type: 'cache_ready' }
  | { type: 'scan_progress'; scanned: number; total: number }
  | {
      type: 'cache_alert'
      fingerprint: string
      severity: CacheAlertSeverity
      missingCount: number
      totalRows: number
      detectedAt: string
      sample: { id: string; title?: string }[]
    }
  | { type: 'cache_alert_resolved'; fingerprint: string; action: CacheAlertResolveAction }
  | {
      type: 'host_pressure'
      level: HostPressureLevel
      reasons: HostPressureReason[]
      liveAgents: number
      updatedAt: string
      os?: string
    }
  | { type: 'host_pressure_cleared'; updatedAt: string }
  | { type: 'conversation_event'; sessionId: string; line: string }
  // Additive batched variant (streamer #202): one frame carries all lines from
  // a single watcher read. `seqs`, when present, is parallel to `lines` —
  // seqs[i] is the message_index of lines[i], or null for a non-message line.
  // Absent for non-claude providers. Old clients ignore this and rely on the
  // singular conversation_event.
  | { type: 'conversation_events'; sessionId: string; lines: string[]; seqs?: (number | null)[] }
  // External-session liveness ping: the conversation's JSONL grew (or its owner
  // changed) without a PTY the streamer owns. Additive; no subscriber wired yet.
  | { type: 'conversation_updated'; conversationId: string; messageCount: number; lastActivity: string; ownership: 'external' | 'managed' }
  | QuestionWsMessage
  | QuestionCancelledWsMessage
  | PermissionWsMessage
  | PermissionCancelledWsMessage
  | PromptEventWsMessage
  | PromptSnapshotWsMessage
  // Unicast reply to this client's own `hold_session` frame. `ok` fires on
  // request-accepted (immediate hold, or a latch armed for the next
  // running -> waiting_input edge), not on the PTY actually exiting — the
  // real exit may be arbitrarily far off for `applied: 'armed'`. Old
  // streamers never send this frame; callers must not block on it forever.
  | {
      type: 'hold_session_result'
      sessionId: string
      ok: boolean
      applied?: 'held' | 'armed' | 'grace'
      reason?: 'permission_denied' | 'unknown_when' | 'no_session'
    }

type MessageHandler = (msg: WSMessage) => void

export interface WsEncryptionConfig {
  serverPublicKey?: string
  requireEncryption?: boolean
}

type HeaderWebSocketConstructor = {
  new (
    uri: string,
    protocols?: string | string[] | null,
    options?: { headers: Record<string, string> } | null,
  ): WebSocket
}

const BACKOFF_MS = [1000, 2000, 4000, 8000, 16000, 30000]
// A TCP/TLS handshake that is black-holed (packets dropped, no RST) can hang
// for 60s+ before the platform fires onerror. Abandon the attempt sooner so
// the backoff machinery keeps redialing instead of sitting in 'connecting'.
const CONNECT_TIMEOUT_MS = 15_000

// ── Connection log ───────────────────────────────────────────────────────────
// In-memory ring buffer of connection lifecycle events so the next dead-socket
// incident is diagnosable from a running app. No persistence by design.
export interface ConnectionLogEntry {
  ts: number
  serverId: string
  event:
    | 'connect'
    | 'open'
    | 'error'
    | 'close'
    | 'connect_timeout'
    | 'schedule_reconnect'
    | 'force_reconnect'
    | 'disconnect'
    | 'cleartext_blocked'
  attempt?: number
}

const CONNECTION_LOG_MAX = 200
const connectionLog: ConnectionLogEntry[] = []

function logConnection(serverId: string, event: ConnectionLogEntry['event'], attempt?: number) {
  connectionLog.push(attempt === undefined ? { ts: Date.now(), serverId, event } : { ts: Date.now(), serverId, event, attempt })
  if (connectionLog.length > CONNECTION_LOG_MAX) connectionLog.shift()
  if (__DEV__) {
    console.log(`[ws:${serverId}] ${event}${attempt === undefined ? '' : ` attempt=${attempt}`}`)
  }
}

export function getConnectionLog(): readonly ConnectionLogEntry[] {
  return connectionLog
}

class WSClient {
  private socket: WebSocket | null = null
  private url = ''
  private handlers: Map<string, Set<MessageHandler>> = new Map()
  private reconnectAttempt = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private connectTimer: ReturnType<typeof setTimeout> | null = null
  private _status: 'connecting' | 'connected' | 'disconnected' = 'disconnected'
  private statusListeners: Set<(s: WSClient['_status']) => void> = new Set()
  private encryption: WsEncryptionConfig = {}
  private context: TransportContext | null = null
  private generation = 0
  private ticketUpgradeRetryAvailable = true

  // Label for the connection log only — the manager passes its serverId.
  constructor(private serverId = 'default') {}

  connect(url: string, apiKey: string, encryption: WsEncryptionConfig = {}) {
    this.encryption = encryption
    const wsUrl = url.replace(/^http/, 'ws').replace(/\/$/, '') + '/ws?key=' + encodeURIComponent(apiKey)
    // The socket carries the whole live session — terminal output, replay and
    // every prompt typed — so it is the traffic the cleartext policy exists for.
    // Refusing here rather than throwing keeps a server the user can still fix
    // from taking down the screen: the same URL is refused at authedFetch, which
    // has a render site and will say why.
    if (!isCleartextAllowed(wsUrl)) {
      // Clearing `url` is what makes the refusal safe, and it is not tidiness.
      // `disconnect()` leaves `url` set, so a refused connect that returned
      // early would strand the *previous* server's URL here — with its
      // credential, which travels in the query string — and `forceReconnect()`
      // (every foreground resume) would silently redial that old server.
      // Empty is also what stops `forceReconnect` from retrying a destination
      // this policy can never permit.
      this.url = ''
      this.disconnect()
      logConnection(this.serverId, 'cleartext_blocked')
      return
    }
    this.url = wsUrl
    this.reconnectAttempt = 0
    this.ticketUpgradeRetryAvailable = true
    void this._doConnect()
  }

  private async _doConnect() {
    const generation = ++this.generation
    this._retireCurrentConnection()
    this._clearConnectTimer()

    this._setStatus('connecting')
    logConnection(this.serverId, 'connect', this.reconnectAttempt)

    const pinned = this.encryption.requireEncryption === true && !!this.encryption.serverPublicKey
    let socket: WebSocket
    let context: TransportContext | null = null
    let clientId: string | null = null
    try {
      if (pinned && this.encryption.serverPublicKey) {
        // Obtain the client id before the ticketed upgrade. The server requires
        // the first sealed frame within ten seconds of the 101 response, so
        // awaiting storage from onopen is too late.
        ;[context, clientId] = await Promise.all([
          openContextOnce({
            serverId: this.serverId,
            baseUrl: this.url.replace(/^ws/, 'http').replace(/\/ws\?key=.*$/, ''),
            serverPublicKey: this.encryption.serverPublicKey,
            kind: 'ws',
          }),
          getDeviceClientId(),
        ])
        if (generation !== this.generation) {
          context.destroy()
          return
        }
        if (!context.ticket) {
          context.destroy()
          throw new Error('E2EE: WebSocket context was issued without a ticket')
        }
        this.context = context
        const HeaderWebSocket = WebSocket as HeaderWebSocketConstructor
        socket = new HeaderWebSocket(this.url.replace(/\?key=.*$/, ''), null, {
          headers: { 'X-TB-Ticket': context.ticket },
        })
      } else {
        socket = new WebSocket(this.url)
      }
      this.socket = socket
    } catch (error) {
      context?.destroy()
      if (generation !== this.generation) return
      this._setStatus('disconnected')
      // A bad pin, revoked device, or malformed handshake cannot heal through
      // retries. In particular, it must never fall back to the URL credential.
      if (error instanceof OpenError && !error.retryable) return
      this._scheduleReconnect()
      return
    }
    // Guard every callback below against firing after this socket has been
    // superseded (e.g. by forceReconnect()). The platform WebSocket may hold
    // its own reference to a callback and can still invoke it even after
    // `.onX = null` is set — closing a socket doesn't synchronously cancel
    // events already queued for dispatch. Comparing against `this.socket`
    // (updated synchronously whenever a new connect attempt starts) closes
    // that gap regardless of platform close() timing.
    const isCurrent = () =>
      generation === this.generation &&
      this.socket === socket &&
      (context === null || this.context === context)

    // Abandon the attempt if the handshake neither opens nor errors in time.
    this.connectTimer = setTimeout(() => {
      if (!isCurrent()) return
      logConnection(this.serverId, 'connect_timeout', this.reconnectAttempt)
      this._failCurrentConnection(socket, context, false)
    }, CONNECT_TIMEOUT_MS)

    socket.onopen = () => {
      if (!isCurrent()) return
      this._clearConnectTimer()
      logConnection(this.serverId, 'open')
      this.reconnectAttempt = 0
      this.ticketUpgradeRetryAvailable = true
      this._setStatus('connected')
      // Register this device so the server can unicast session_list back only
      // to the initiating client.
      //
      // There used to be a `{ type: 'auth', token }` frame here, sent first on
      // every connection. No streamer has ever had a handler for it — the WS
      // message handler only knows `register`, `subscribe_session`,
      // `unsubscribe_session` and `hold_session`, and unknown types are swallowed
      // — so it re-transmitted the long-term credential over the wire for nothing.
      // The socket is authenticated by its one-time ticket. On an encrypted
      // socket this is synchronous because clientId was acquired pre-upgrade.
      if (clientId) {
        this.sendWithContext(socket, context, { type: 'register', clientId })
      } else {
        getDeviceClientId().then((legacyClientId) => {
          if (isCurrent()) this.sendWithContext(socket, null, { type: 'register', clientId: legacyClientId })
        })
      }
    }

    socket.onmessage = (event) => {
      if (!isCurrent()) return
      let msg: WSMessage
      try {
        if (context) {
          const frame =
            event.data instanceof Uint8Array
              ? event.data
              : event.data instanceof ArrayBuffer
                ? new Uint8Array(event.data)
                : null
          if (!frame) {
            throw new Error('E2EE: sealed socket received a non-binary frame')
          }
          msg = JSON.parse(new TextDecoder().decode(context.recv.unseal(frame))) as WSMessage
        } else {
          msg = JSON.parse(event.data as string) as WSMessage
        }
      } catch {
        if (context) this._failCurrentConnection(socket, context, false)
        return
      }
      if (msg.type === 'session_ready') {
        clientLog.info('ws', 'session_ready received', {
          serverId: this.serverId,
          sessionId: msg.session.id,
          projectId: msg.session.projectId,
          projectPath: msg.session.projectPath,
          handlerCount: this.handlers.get(msg.type)?.size ?? 0,
        })
      }
      const handlers = this.handlers.get(msg.type)
      if (__DEV__ && msg.type === 'session_update') {
        console.log(`[ws:${this.serverId}] frame session_update boundHandlers=${handlers?.size ?? 0}`)
      }
      if (handlers) {
        handlers.forEach((h) => h(msg))
      }
      // Also fire wildcard handlers
      const wildcard = this.handlers.get('*')
      if (wildcard) {
        wildcard.forEach((h) => h(msg))
      }
    }

    socket.onerror = () => {
      if (!isCurrent()) return
      this._clearConnectTimer()
      logConnection(this.serverId, 'error', this.reconnectAttempt)
      this._failCurrentConnection(socket, context, true)
    }

    socket.onclose = () => {
      if (!isCurrent()) return
      this._clearConnectTimer()
      logConnection(this.serverId, 'close')
      this._failCurrentConnection(socket, context, true)
    }
  }

  private _retireCurrentConnection() {
    if (this.socket) {
      this.socket.onclose = null
      this.socket.onerror = null
      this.socket.onmessage = null
      this.socket.close()
      this.socket = null
    }
    this.context?.destroy()
    this.context = null
  }

  private _failCurrentConnection(socket: WebSocket, context: TransportContext | null, beforeOpen: boolean) {
    this._retireCurrentConnection()
    this._setStatus('disconnected')
    if (context && beforeOpen && this.ticketUpgradeRetryAvailable) {
      this.ticketUpgradeRetryAvailable = false
      void this._doConnect()
      return
    }
    this._scheduleReconnect()
  }

  private _clearConnectTimer() {
    if (this.connectTimer) {
      clearTimeout(this.connectTimer)
      this.connectTimer = null
    }
  }

  private _scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    const delay = BACKOFF_MS[Math.min(this.reconnectAttempt, BACKOFF_MS.length - 1)]
    this.reconnectAttempt++
    logConnection(this.serverId, 'schedule_reconnect', this.reconnectAttempt)
    this.reconnectTimer = setTimeout(() => void this._doConnect(), delay)
  }

  private _setStatus(s: WSClient['_status']) {
    this._status = s
    this.statusListeners.forEach((l) => l(s))
  }

  disconnect() {
    logConnection(this.serverId, 'disconnect')
    this.generation++
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this._clearConnectTimer()
    this._retireCurrentConnection()
    this._setStatus('disconnected')
  }

  // Force a fresh connection, bypassing the exponential backoff used by
  // automatic reconnects. Use this when the app returns to foreground after
  // iOS suspended JS execution — the socket may look open from the JS side
  // but is in fact dead, and we can't wait 1–30s for the next backoff tick.
  forceReconnect() {
    if (!this.url) return
    logConnection(this.serverId, 'force_reconnect')
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.reconnectAttempt = 0
    void this._doConnect()
  }

  send(msg: unknown) {
    this.sendWithContext(this.socket, this.context, msg)
  }

  private sendWithContext(socket: WebSocket | null, context: TransportContext | null, msg: unknown) {
    if (socket?.readyState !== WebSocket.OPEN) return
    const plaintext = JSON.stringify(msg)
    socket.send(context ? context.send.seal(new TextEncoder().encode(plaintext)) : plaintext)
  }

  on(type: string, handler: MessageHandler): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set())
    }
    this.handlers.get(type)!.add(handler)
    return () => {
      this.handlers.get(type)?.delete(handler)
    }
  }

  status(): WSClient['_status'] {
    return this._status
  }

  onStatusChange(listener: (s: WSClient['_status']) => void): () => void {
    this.statusListeners.add(listener)
    return () => this.statusListeners.delete(listener)
  }
}

export type WSMessageWithServer = WSMessage & { serverId: string }

type ServerMessageHandler = (msg: WSMessageWithServer) => void

class WSClientManager {
  private clients: Map<string, WSClient> = new Map()
  // Manager-level status listeners that survive individual client replacement.
  private managerStatusListeners: Set<(serverId: string, s: 'connecting' | 'connected' | 'disconnected') => void> = new Set()
  // How many focused session/conversation views currently want each session's
  // PTY stream. One socket stays subscribed until the last view releases.
  private sessionRefCounts = new Map<string, Map<string, number>>()

  connect(serverId: string, url: string, apiKey: string, encryption: WsEncryptionConfig = {}) {
    // Disconnect existing client for this server if any
    this.disconnect(serverId)
    const client = new WSClient(serverId)
    this.clients.set(serverId, client)
    // Wire this client's status changes into the manager-level listeners.
    client.onStatusChange((s) => {
      if (s === 'connected') this.resubscribeHeldSessions(serverId)
      this.managerStatusListeners.forEach((l) => l(serverId, s))
    })
    client.connect(url, apiKey, encryption)
  }

  disconnect(serverId: string) {
    const client = this.clients.get(serverId)
    if (client) {
      client.disconnect()
      this.clients.delete(serverId)
    }
  }

  disconnectAll() {
    for (const [id] of this.clients) {
      this.disconnect(id)
    }
  }

  getClient(serverId: string): WSClient | undefined {
    return this.clients.get(serverId)
  }

  // Force-reconnect a single server's WS client. No-op if the server has no
  // client yet (e.g. user hasn't paired). Skips reconnect backoff.
  forceReconnect(serverId: string) {
    this.clients.get(serverId)?.forceReconnect()
  }

  /** Register a handler across ALL active (and future) clients for a given message type. */
  onAll(type: string, handler: ServerMessageHandler): () => void {
    const unsubs: (() => void)[] = []
    for (const [serverId, client] of this.clients) {
      const unsub = client.on(type, (msg) => handler({ ...msg, serverId }))
      unsubs.push(unsub)
    }
    return () => unsubs.forEach((u) => u())
  }

  /** Listen for status changes on a specific server's client. */
  onStatusChange(serverId: string, listener: (s: 'connecting' | 'connected' | 'disconnected') => void): () => void {
    const client = this.clients.get(serverId)
    if (!client) return () => {}
    return client.onStatusChange(listener)
  }

  /**
   * Listen for status changes on ALL clients, including clients created after
   * this call (i.e. when connect() creates a new WSClient instance). Prefer
   * this over onStatusChange() when the client may not exist yet.
   */
  onAnyStatusChange(listener: (serverId: string, s: 'connecting' | 'connected' | 'disconnected') => void): () => void {
    this.managerStatusListeners.add(listener)
    return () => this.managerStatusListeners.delete(listener)
  }

  status(serverId: string): 'connecting' | 'connected' | 'disconnected' {
    return this.clients.get(serverId)?.status() ?? 'disconnected'
  }

  send(serverId: string, msg: unknown) {
    this.clients.get(serverId)?.send(msg)
  }

  /**
   * Sends `hold_session` with `when: 'waiting_input'` and waits for the
   * matching `hold_session_result`. Resolves `null` (not `ok: false`) on a
   * closed socket or a timeout — an old streamer ignores the frame and never
   * replies, and per the server-contract rule that must degrade, not error.
   */
  holdSessionWaitingInput(
    serverId: string,
    sessionId: string,
    timeoutMs = 8000,
  ): Promise<{ ok: boolean; reason?: string } | null> {
    const client = this.clients.get(serverId)
    if (!client || client.status() !== 'connected') return Promise.resolve(null)
    return new Promise((resolve) => {
      let settled = false
      const unsub = client.on('hold_session_result', (msg) => {
        if (msg.type !== 'hold_session_result' || msg.sessionId !== sessionId || settled) return
        settled = true
        clearTimeout(timer)
        unsub()
        resolve({ ok: msg.ok, reason: msg.reason })
      })
      const timer = setTimeout(() => {
        if (settled) return
        settled = true
        unsub()
        resolve(null)
      }, timeoutMs)
      client.send({ type: 'hold_session', sessionId, when: 'waiting_input' })
    })
  }

  acquireSession(serverId: string, sessionId: string) {
    if (!serverId || !sessionId) return
    let bySession = this.sessionRefCounts.get(serverId)
    if (!bySession) {
      bySession = new Map()
      this.sessionRefCounts.set(serverId, bySession)
    }
    const next = (bySession.get(sessionId) ?? 0) + 1
    bySession.set(sessionId, next)
    if (next === 1) {
      this.clients.get(serverId)?.send({ type: 'subscribe_session', sessionId })
    }
  }

  releaseSession(serverId: string, sessionId: string) {
    if (!serverId || !sessionId) return
    const bySession = this.sessionRefCounts.get(serverId)
    if (!bySession) return
    const cur = bySession.get(sessionId) ?? 0
    if (cur <= 1) {
      bySession.delete(sessionId)
      if (bySession.size === 0) this.sessionRefCounts.delete(serverId)
      if (cur === 1) {
        this.clients.get(serverId)?.send({ type: 'unsubscribe_session', sessionId })
      }
      return
    }
    bySession.set(sessionId, cur - 1)
  }

  private resubscribeHeldSessions(serverId: string) {
    const bySession = this.sessionRefCounts.get(serverId)
    if (!bySession || bySession.size === 0) return
    const client = this.clients.get(serverId)
    if (!client) return
    for (const sessionId of bySession.keys()) {
      client.send({ type: 'subscribe_session', sessionId })
    }
  }
}

export const wsManager = new WSClientManager()

/** @deprecated Use wsManager instead. */
export const wsClient = new WSClient()
