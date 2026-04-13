import type { Session, NotificationEvent } from '@/types/api'

export type WSMessage =
  | { type: 'session_update'; session: Session }
  | { type: 'terminal_output'; sessionId: string; data: string }
  | { type: 'session_list'; sessions: Session[] }
  | { type: 'notification'; event: NotificationEvent }
  | { type: 'plan_ready'; sessionId: string; plan: string }

type MessageHandler = (msg: WSMessage) => void

const BACKOFF_MS = [1000, 2000, 4000, 8000, 16000, 30000]

class WSClient {
  private socket: WebSocket | null = null
  private url = ''
  private apiKey = ''
  private handlers: Map<string, Set<MessageHandler>> = new Map()
  private reconnectAttempt = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private _status: 'connecting' | 'connected' | 'disconnected' = 'disconnected'
  private statusListeners: Set<(s: WSClient['_status']) => void> = new Set()

  connect(url: string, apiKey: string) {
    this.url = url.replace(/^http/, 'ws').replace(/\/$/, '') + '/ws?key=' + encodeURIComponent(apiKey)
    this.apiKey = apiKey
    this.reconnectAttempt = 0
    this._doConnect()
  }

  private _doConnect() {
    if (this.socket) {
      this.socket.onclose = null
      this.socket.onerror = null
      this.socket.close()
      this.socket = null
    }

    this._setStatus('connecting')

    try {
      this.socket = new WebSocket(this.url)
    } catch {
      this._scheduleReconnect()
      return
    }

    this.socket.onopen = () => {
      this.reconnectAttempt = 0
      this._setStatus('connected')
      // Send auth as first message
      this.send({ type: 'auth', token: this.apiKey })
    }

    this.socket.onmessage = (event) => {
      let msg: WSMessage
      try {
        msg = JSON.parse(event.data as string) as WSMessage
      } catch {
        return
      }
      const handlers = this.handlers.get(msg.type)
      if (handlers) {
        handlers.forEach((h) => h(msg))
      }
      // Also fire wildcard handlers
      const wildcard = this.handlers.get('*')
      if (wildcard) {
        wildcard.forEach((h) => h(msg))
      }
    }

    this.socket.onerror = () => {
      this._scheduleReconnect()
    }

    this.socket.onclose = () => {
      this._setStatus('disconnected')
      this._scheduleReconnect()
    }
  }

  private _scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    const delay = BACKOFF_MS[Math.min(this.reconnectAttempt, BACKOFF_MS.length - 1)]
    this.reconnectAttempt++
    this.reconnectTimer = setTimeout(() => this._doConnect(), delay)
  }

  private _setStatus(s: WSClient['_status']) {
    this._status = s
    this.statusListeners.forEach((l) => l(s))
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.socket) {
      this.socket.onclose = null
      this.socket.close()
      this.socket = null
    }
    this._setStatus('disconnected')
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

export const wsClient = new WSClient()
