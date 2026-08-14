import { useServersStore } from '@/stores/servers'
import { authedFetch, AuthError, type AuthedTarget } from '@/services/authed-fetch'

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

type Entry = {
  level: LogLevel
  msg: string
  ts: string
  tag?: string
  fields?: Record<string, unknown>
}

const BUFFER: Entry[] = []
const FLUSH_INTERVAL_MS = 1500
const MAX_BATCH = 50

// Capture originals at module load so mirroring still works after
// installClientLogCapture() wraps console.* (avoids recursion).
const _origLog = console.log.bind(console)
const _origInfo = console.info.bind(console)
const _origWarn = console.warn.bind(console)
const _origError = console.error.bind(console)

let flushTimer: ReturnType<typeof setTimeout> | null = null
let installed = false

function scheduleFlush() {
  if (flushTimer) return
  flushTimer = setTimeout(() => {
    flushTimer = null
    void flush()
  }, FLUSH_INTERVAL_MS)
}

function resolveFlushTarget(): AuthedTarget | null {
  const anyServer = Object.values(useServersStore.getState().servers)[0]
  if (anyServer && anyServer.apiKey && anyServer.url) return anyServer
  const devUrl = process.env.EXPO_PUBLIC_DEV_STREAMER_URL
  const devKey = process.env.EXPO_PUBLIC_DEV_STREAMER_KEY
  if (devUrl && devKey) return { url: devUrl, apiKey: devKey }
  return null
}

async function flush() {
  if (BUFFER.length === 0) return
  const target = resolveFlushTarget()
  if (!target) {
    _origWarn(`[clientLog] dropping batch of ${BUFFER.length}: no server hydrated and no EXPO_PUBLIC_DEV_STREAMER_URL/KEY`)
    BUFFER.length = 0
    return
  }
  const batch = BUFFER.splice(0, MAX_BATCH)
  try {
    await authedFetch(target, '/api/__client-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries: batch }),
    })
  } catch (err) {
    // A refused credential won't accept the batch on any later attempt either —
    // requeueing it would pin the buffer at its cap and drop live logs instead.
    if (err instanceof AuthError) {
      _origWarn(`[clientLog] dropping batch of ${batch.length}: server rejected the credential`)
    } else {
      BUFFER.unshift(...batch)
      if (BUFFER.length > 500) BUFFER.length = 500
    }
  }
  if (BUFFER.length > 0) scheduleFlush()
}

function safeStringify(v: unknown): string {
  if (typeof v === 'string') return v
  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}

function mirrorToConsole(
  level: LogLevel,
  tag: string,
  msg: string,
  fields?: Record<string, unknown>,
) {
  // installClientLogCapture already prints the original console.* args to Metro;
  // skip mirroring those to avoid duplicate lines.
  if (
    tag === 'console.log' ||
    tag === 'console.info' ||
    tag === 'console.warn' ||
    tag === 'console.error'
  ) {
    return
  }
  const line =
    fields && Object.keys(fields).length > 0
      ? `[${tag}] ${msg} ${safeStringify(fields)}`
      : `[${tag}] ${msg}`
  switch (level) {
    case 'debug':
      _origLog(line)
      break
    case 'info':
      _origInfo(line)
      break
    case 'warn':
      _origWarn(line)
      break
    case 'error':
      _origError(line)
      break
  }
}

export function clog(
  level: LogLevel,
  tag: string,
  msg: string,
  fields?: Record<string, unknown>,
) {
  if (!__DEV__) return
  if (process.env.JEST_WORKER_ID !== undefined) return
  mirrorToConsole(level, tag, msg, fields)
  BUFFER.push({
    level,
    msg,
    ts: new Date().toISOString(),
    tag,
    fields,
  })
  if (BUFFER.length > 500) BUFFER.shift()
  scheduleFlush()
}

export const clientLog = {
  debug: (tag: string, msg: string, fields?: Record<string, unknown>) => clog('debug', tag, msg, fields),
  info: (tag: string, msg: string, fields?: Record<string, unknown>) => clog('info', tag, msg, fields),
  warn: (tag: string, msg: string, fields?: Record<string, unknown>) => clog('warn', tag, msg, fields),
  error: (tag: string, msg: string, fields?: Record<string, unknown>) => clog('error', tag, msg, fields),
}

export function installClientLogCapture() {
  if (installed) return
  if (!__DEV__) return
  installed = true

  console.log = (...args: unknown[]) => {
    clog('info', 'console.log', args.map(safeStringify).join(' '))
    _origLog(...(args as never[]))
  }
  console.info = (...args: unknown[]) => {
    clog('info', 'console.info', args.map(safeStringify).join(' '))
    _origInfo(...(args as never[]))
  }
  console.warn = (...args: unknown[]) => {
    clog('warn', 'console.warn', args.map(safeStringify).join(' '))
    _origWarn(...(args as never[]))
  }
  console.error = (...args: unknown[]) => {
    clog('error', 'console.error', args.map(safeStringify).join(' '))
    _origError(...(args as never[]))
  }

  const errorUtils = (globalThis as unknown as { ErrorUtils?: {
    setGlobalHandler: (h: (err: Error, isFatal: boolean) => void) => void
    getGlobalHandler: () => (err: Error, isFatal: boolean) => void
  } }).ErrorUtils
  if (errorUtils) {
    const prev = errorUtils.getGlobalHandler()
    errorUtils.setGlobalHandler((err, isFatal) => {
      clog('error', 'global.error', err?.message ?? String(err), {
        stack: err?.stack,
        isFatal,
        name: err?.name,
      })
      prev?.(err, isFatal)
    })
  }

  if (typeof globalThis.addEventListener === 'function') {
    globalThis.addEventListener('unhandledrejection', (event: { reason?: unknown }) => {
      clog('error', 'unhandledrejection', safeStringify(event?.reason))
    })
  }
}
