import type {
  Session,
  NotificationEvent,
  QuestionWsMessage,
  QuestionCancelledWsMessage,
  PermissionWsMessage,
  PermissionCancelledWsMessage,
  CacheAlertSeverity,
  CacheAlertResolveAction,
  HostPressureLevel,
  HostPressureReason,
} from '@/types/api'
import { getDeviceClientId } from './device-id'
import { isCleartextAllowed } from './cleartext-policy'
import { clientLog } from '@/lib/clientLog'

export type WSMessage =
  | { type: 'session_update'; session: Session }
  // `seq` is a per-session monotonically increasing chunk counter from the
  // streamer (starts at 1). Additive; old streamers omit it. Lets the client
  // detect a stale chunk delivered after a reconnect race instead of
  // trusting raw WS arrival order.
  | { type: 'terminal_output'; sessionId: string; data: string; seq?: number }
  | { type: 'session_list'; sessions: Session[] }
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

type MessageHandler = (msg: WSMessage) => void

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

  // Label for the connection log only — the manager passes its serverId.
  constructor(private serverId = 'default') {}

  connect(url: string, apiKey: string) {
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
    this._doConnect()
  }

  private _doConnect() {
    if (this.socket) {
      this.socket.onclose = null
      this.socket.onerror = null
      this.socket.onmessage = null
      this.socket.close()
      this.socket = null
    }
    this._clearConnectTimer()

    this._setStatus('connecting')
    logConnection(this.serverId, 'connect', this.reconnectAttempt)

    let socket: WebSocket
    try {
      socket = new WebSocket(this.url)
      this.socket = socket
    } catch {
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
    const isCurrent = () => this.socket === socket

    // Abandon the attempt if the handshake neither opens nor errors in time.
    this.connectTimer = setTimeout(() => {
      logConnection(this.serverId, 'connect_timeout', this.reconnectAttempt)
      if (this.socket) {
        this.socket.onclose = null
        this.socket.onerror = null
        this.socket.onmessage = null
        this.socket.close()
        this.socket = null
      }
      this._scheduleReconnect()
    }, CONNECT_TIMEOUT_MS)

    socket.onopen = () => {
      if (!isCurrent()) return
      this._clearConnectTimer()
      logConnection(this.serverId, 'open')
      this.reconnectAttempt = 0
      this._setStatus('connected')
      // Register this device so the server can unicast session_list back only
      // to the initiating client.
      //
      // There used to be a `{ type: 'auth', token }` frame here, sent first on
      // every connection. No streamer has ever had a handler for it — the WS
      // message handler only knows `register`, `subscribe_session`,
      // `unsubscribe_session` and `hold_session`, and unknown types are swallowed
      // — so it re-transmitted the long-term credential over the wire for nothing.
      // The socket is already authenticated by `?key=` on the upgrade.
      getDeviceClientId().then((clientId) => {
        if (isCurrent()) this.send({ type: 'register', clientId })
      })
    }

    socket.onmessage = (event) => {
      if (!isCurrent()) return
      let msg: WSMessage
      try {
        msg = JSON.parse(event.data as string) as WSMessage
      } catch {
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
      this._scheduleReconnect()
    }

    socket.onclose = () => {
      if (!isCurrent()) return
      this._clearConnectTimer()
      logConnection(this.serverId, 'close')
      this._setStatus('disconnected')
      this._scheduleReconnect()
    }
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
    this.reconnectTimer = setTimeout(() => this._doConnect(), delay)
  }

  private _setStatus(s: WSClient['_status']) {
    this._status = s
    this.statusListeners.forEach((l) => l(s))
  }

  disconnect() {
    logConnection(this.serverId, 'disconnect')
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this._clearConnectTimer()
    if (this.socket) {
      this.socket.onclose = null
      this.socket.close()
      this.socket = null
    }
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
    this._doConnect()
  }

  send(msg: unknown) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(msg))
    }
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

  connect(serverId: string, url: string, apiKey: string) {
    // Disconnect existing client for this server if any
    this.disconnect(serverId)
    const client = new WSClient(serverId)
    this.clients.set(serverId, client)
    // Wire this client's status changes into the manager-level listeners.
    client.onStatusChange((s) => {
      if (s === 'connected') this.resubscribeHeldSessions(serverId)
      this.managerStatusListeners.forEach((l) => l(serverId, s))
    })
    client.connect(url, apiKey)
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
