import { useServersStore } from '@/stores/servers'

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

let flushTimer: ReturnType<typeof setTimeout> | null = null
let installed = false

function scheduleFlush() {
  if (flushTimer) return
  flushTimer = setTimeout(() => {
    flushTimer = null
    void flush()
  }, FLUSH_INTERVAL_MS)
}

function resolveFlushTarget(): { url: string; apiKey: string } | null {
  const anyServer = Object.values(useServersStore.getState().servers)[0]
  if (anyServer && anyServer.apiKey && anyServer.url) {
    return { url: anyServer.url, apiKey: anyServer.apiKey }
  }
  const devUrl = process.env.EXPO_PUBLIC_DEV_STREAMER_URL
  const devKey = process.env.EXPO_PUBLIC_DEV_STREAMER_KEY
  if (devUrl && devKey) return { url: devUrl, apiKey: devKey }
  return null
}

async function flush() {
  if (BUFFER.length === 0) return
  const target = resolveFlushTarget()
  if (!target) {
    // Surfaces the pre-hydration drop window in Metro so this failure mode is
    // diagnosable. Use console.warn directly — going through clog would loop.
    if (typeof console !== 'undefined' && console.warn) {
      console.warn(`[clientLog] dropping batch of ${BUFFER.length}: no server hydrated and no EXPO_PUBLIC_DEV_STREAMER_URL/KEY`)
    }
    return
  }
  const batch = BUFFER.splice(0, MAX_BATCH)
  try {
    await fetch(`${target.url.replace(/\/$/, '')}/api/__client-log`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${target.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ entries: batch }),
    })
  } catch {
    // Re-queue on transport failure; cap the buffer so we don't grow unbounded.
    BUFFER.unshift(...batch)
    if (BUFFER.length > 500) BUFFER.length = 500
  }
  if (BUFFER.length > 0) scheduleFlush()
}

export function clog(
  level: LogLevel,
  tag: string,
  msg: string,
  fields?: Record<string, unknown>,
) {
  // No-op in production builds. clientLog is a development diagnostic; shipping
  // every console call + every QuickAccess render over the wire from TestFlight
  // is bandwidth, battery, and streamer-disk cost for no debugging value.
  if (!__DEV__) return
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

function safeStringify(v: unknown): string {
  if (typeof v === 'string') return v
  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}

export function installClientLogCapture() {
  if (installed) return
  // Skip the console.* hijack entirely in production — RN's console pipeline
  // should stay untouched in release builds where we don't watch logs anyway.
  if (!__DEV__) return
  installed = true

  const origLog = console.log
  const origInfo = console.info
  const origWarn = console.warn
  const origError = console.error

  console.log = (...args: unknown[]) => {
    clog('info', 'console.log', args.map(safeStringify).join(' '))
    origLog.apply(console, args as never[])
  }
  console.info = (...args: unknown[]) => {
    clog('info', 'console.info', args.map(safeStringify).join(' '))
    origInfo.apply(console, args as never[])
  }
  console.warn = (...args: unknown[]) => {
    clog('warn', 'console.warn', args.map(safeStringify).join(' '))
    origWarn.apply(console, args as never[])
  }
  console.error = (...args: unknown[]) => {
    clog('error', 'console.error', args.map(safeStringify).join(' '))
    origError.apply(console, args as never[])
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
