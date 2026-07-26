import { useEffect, useRef, useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { wsManager } from '@/services/ws-client'
import { useSettingsStore } from '@/stores/settings'
import { createApiForServer, NotFoundError } from '@/services/api-client'
import { QUERY_GC_TIME } from '@/services/query-client'
import { VirtualTerminal } from '@/services/virtual-terminal'
import type { ProviderName } from '@/constants/providers'
import type { ParseConfidence } from '@/lib/renderConfidence'

export type TerminalLine = string

interface TerminalHistoryResponse {
  output?: string
  lines?: string[]
}


const EMPTY_HISTORY: TerminalHistoryResponse = { output: '' }
const TERMINAL_REPLAY_TIMEOUT_MS = 2000
// If no WS message of any kind arrives for this long, the connection is
// probably dead without having fired onclose (iOS silently kills TCP while
// the app is in the foreground). Force a reconnect so streaming resumes.
const WS_SILENCE_TIMEOUT_MS = 45_000

export function useTerminalStream(
  serverId: string,
  sessionId: string,
  skipLiveStream = false,
  provider?: ProviderName | string | null,
) {
  const maxLines = useSettingsStore((s) => s.terminalMaxLines)
  const [lines, setLines] = useState<TerminalLine[]>([])
  const [parseConfidence, setParseConfidence] = useState<ParseConfidence>('high')
  const [isStreaming, setIsStreaming] = useState(false)
  // Ground-truth set of texts the streamer wrote to the PTY, normalized (trim).
  // Lets the renderer positively identify user-owned lines instead of guessing.
  // Empty when the streamer is old (no user_message / replay.userMessages) →
  // the caller falls back to the `❯ <text>` heuristic.
  const [userMessageTexts, setUserMessageTexts] = useState<Set<string>>(() => new Set())

  const addUserMessages = useCallback((texts: string[]) => {
    const next = texts.map((t) => t.trim()).filter(Boolean)
    if (next.length === 0) return
    setUserMessageTexts((prev) => {
      const merged = new Set(prev)
      for (const t of next) merged.add(t)
      return merged.size === prev.size ? prev : merged
    })
  }, [])
  const vtRef = useRef<VirtualTerminal | null>(null)
  if (vtRef.current === null) {
    vtRef.current = new VirtualTerminal()
  }
  // Track whether terminal_replay has been received to avoid firing the HTTP fallback
  const replayReceivedRef = useRef(false)
  // Track whether history has been fed (from replay or HTTP) to avoid double-feeding
  const historyFedRef = useRef(false)
  // Last terminal_output seq accepted for the current session/connection
  // generation. A stale frame from a superseded WS connection can otherwise
  // land after a reconnect reset; any terminal_output whose seq isn't
  // greater than this is dropped instead of being fed to the VT. Reset to 0
  // alongside the other per-session refs; baselined from terminal_replay's
  // seq (undefined when the streamer predates this field, or via the HTTP
  // fallback, which carries no seq — the guard then never rejects).
  const lastSeqRef = useRef(0)

  // HTTP fallback query — disabled by default, enabled only when WS replay times out
  const [httpFallbackEnabled, setHttpFallbackEnabled] = useState(false)

  function publishLines() {
    const vt = vtRef.current!
    const confidence = vt.getParseConfidence()
    setParseConfidence(confidence)
    // Low parse confidence → raw lines so we never present chrome-filtered
    // output as if normalization were authoritative.
    const visible = confidence === 'low' ? vt.getRawLines() : vt.getLines()
    setLines(visible.slice(-maxLines))
  }

  const historyQuery = useQuery({
    queryKey: ['terminal-output', serverId, sessionId],
    queryFn: async () => {
      const api = createApiForServer(serverId)
      try {
        return await api.get<TerminalHistoryResponse>(`/api/sessions/${sessionId}/output`)
      } catch (err) {
        // Older streamers 404 when the PTY isn't tracked (e.g. orphaned after a
        // restart). Treat as no buffered output rather than surfacing an error.
        if (err instanceof NotFoundError) return EMPTY_HISTORY
        throw err
      }
    },
    enabled: Boolean(serverId && sessionId) && httpFallbackEnabled,
    gcTime: QUERY_GC_TIME,
    meta: { persist: false },
  })

  function feedHistory(raw: string, baselineSeq = 0) {
    if (historyFedRef.current) return
    historyFedRef.current = true
    lastSeqRef.current = baselineSeq
    vtRef.current!.reset()
    vtRef.current!.setProvider(provider)
    setLines([])
    vtRef.current!.feed(raw)
    publishLines()
  }

  // Feed HTTP fallback history whenever it loads (only if replay wasn't received)
  useEffect(() => {
    const data = historyQuery.data
    if (!data) return
    if (replayReceivedRef.current) return
    let raw: string
    if (Array.isArray(data)) {
      raw = (data as unknown as string[]).join('')
    } else if (data.lines) {
      raw = data.lines.join('\n')
    } else if (data.output) {
      raw = data.output
    } else {
      return
    }
    feedHistory(raw)
    // feedHistory is a local closure that only reads refs + maxLines; keying on
    // [historyQuery.data, maxLines] captures all behavioural inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyQuery.data, maxLines])

  useEffect(() => {
    // Reset state when sessionId changes
    vtRef.current!.reset()
    replayReceivedRef.current = false
    historyFedRef.current = false
    lastSeqRef.current = 0
    queueMicrotask(() => {
      setLines([])
      setParseConfidence('high')
      setHttpFallbackEnabled(false)
      setUserMessageTexts(new Set())
    })
  }, [serverId, sessionId])

  useEffect(() => {
    vtRef.current?.setProvider(provider)
    if (historyFedRef.current || lines.length > 0) {
      publishLines()
    }
    // Re-apply chrome filter when provider identity arrives after first paint.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider])

  useEffect(() => {
    if (skipLiveStream) return

    let idleTimer: ReturnType<typeof setTimeout>
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null
    let silenceTimer: ReturnType<typeof setTimeout> | null = null
    let unsubOutput: (() => void) | null = null
    let unsubReplay: (() => void) | null = null
    let unsubUserMessage: (() => void) | null = null
    let unsubWildcard: (() => void) | null = null

    function resetSilenceTimer() {
      if (silenceTimer) clearTimeout(silenceTimer)
      silenceTimer = setTimeout(() => {
        // No WS traffic for WS_SILENCE_TIMEOUT_MS — the connection is likely
        // dead without having fired onclose (iOS silently kills TCP). Force a
        // reconnect so the backoff machinery re-subscribes and resumes streaming.
        wsManager.forceReconnect(serverId)
        // Re-arm: if the forced redial also dies silently (no message, no
        // 'connected' event), keep retrying instead of going dark after one shot.
        resetSilenceTimer()
      }, WS_SILENCE_TIMEOUT_MS)
    }

    function sendSubscribeAndWaitForReplay() {
      const client = wsManager.getClient(serverId)
      if (!client) return

      // Send subscribe_session — server will unicast terminal_replay back
      client.send({ type: 'subscribe_session', sessionId })

      // Listen for terminal_replay (unicast from server)
      unsubReplay?.()
      unsubReplay = client.on('terminal_replay', (msg) => {
        if (msg.type !== 'terminal_replay' || msg.sessionId !== sessionId) return
        // A card-parked session can replay only blank ring-buffer rows. Treating
        // that as a successful load latches replayReceivedRef and disarms the
        // HTTP fallback, stranding the terminal blank even though /output holds
        // the full transcript. Only accept a replay that carries content; leave
        // the fallback timer armed otherwise so /output fills the screen.
        const hasContent = msg.lines.some((line) => line.trim().length > 0)
        if (!hasContent) return
        replayReceivedRef.current = true
        if (fallbackTimer) {
          clearTimeout(fallbackTimer)
          fallbackTimer = null
        }
        if (msg.userMessages) addUserMessages(msg.userMessages.map((m) => m.text))
        feedHistory(msg.lines.join('\n'), msg.seq ?? 0)
      })

      // Start fallback timer — if no terminal_replay within 2s, fall back to HTTP
      if (fallbackTimer) clearTimeout(fallbackTimer)
      fallbackTimer = setTimeout(() => {
        if (!replayReceivedRef.current) {
          setHttpFallbackEnabled(true)
        }
      }, TERMINAL_REPLAY_TIMEOUT_MS)
    }

    function subscribeOutput() {
      unsubOutput?.()
      const client = wsManager.getClient(serverId)
      if (!client) return
      unsubOutput = client.on('terminal_output', (msg) => {
        if (msg.type !== 'terminal_output' || msg.sessionId !== sessionId) return
        // A stale frame from a superseded connection can arrive after a
        // reconnect reset baselined lastSeqRef higher — drop it rather than
        // feeding it out of order. Streamers that omit seq (older versions)
        // never trip this: seq stays undefined and the check is skipped.
        if (msg.seq != null && msg.seq <= lastSeqRef.current) return
        if (msg.seq != null) lastSeqRef.current = msg.seq

        setIsStreaming(true)
        vtRef.current!.feed(msg.data)
        publishLines()

        clearTimeout(idleTimer)
        idleTimer = setTimeout(() => setIsStreaming(false), 1500)
      })
    }

    function subscribeUserMessage() {
      unsubUserMessage?.()
      const client = wsManager.getClient(serverId)
      if (!client) return
      unsubUserMessage = client.on('user_message', (msg) => {
        if (msg.type !== 'user_message' || msg.sessionId !== sessionId) return
        addUserMessages([msg.text])
      })
    }

    function subscribeWildcard() {
      unsubWildcard?.()
      const client = wsManager.getClient(serverId)
      if (!client) return
      // Any inbound message — including server pings — resets the silence timer.
      unsubWildcard = client.on('*', () => resetSilenceTimer())
    }

    sendSubscribeAndWaitForReplay()
    subscribeOutput()
    subscribeUserMessage()
    subscribeWildcard()
    resetSilenceTimer()

    // Re-subscribe on reconnect. This handles two cases:
    //   1. Client didn't exist yet when this effect ran (React runs child
    //      effects before parent, so _layout.tsx's wsManager.connect() may
    //      not have fired yet).
    //   2. wsManager.connect() created a new WSClient after reconnect.
    // In both cases, the first 'connected' event on the new client re-binds
    // the listeners and re-sends subscribe_session.
    const unsubStatus = wsManager.onAnyStatusChange((sid, status) => {
      if (sid !== serverId || status !== 'connected') return
      replayReceivedRef.current = false
      historyFedRef.current = false
      sendSubscribeAndWaitForReplay()
      subscribeOutput()
      subscribeUserMessage()
      subscribeWildcard()
      resetSilenceTimer()
    })

    return () => {
      unsubOutput?.()
      unsubReplay?.()
      unsubUserMessage?.()
      unsubWildcard?.()
      unsubStatus()
      clearTimeout(idleTimer)
      if (fallbackTimer) clearTimeout(fallbackTimer)
      if (silenceTimer) clearTimeout(silenceTimer)
    }
    // feedHistory is a local closure that only reads refs + maxLines (already
    // in deps); excluding it avoids re-subscribing on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverId, sessionId, maxLines, skipLiveStream])

  const clear = useCallback(() => {
    vtRef.current!.reset()
    setLines([])
    setParseConfidence('high')
  }, [])

  return {
    lines,
    isStreaming,
    userMessageTexts,
    parseConfidence,
    isLoadingHistory: historyQuery.isPending && httpFallbackEnabled,
    clear,
  }
}
