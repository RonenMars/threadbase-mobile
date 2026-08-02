// Conversation-open timing probe. One open = one trace: screen mount → request
// issued → response headers → body parsed → messages merged/adapted → FlashList
// drew its rows. Prints one table so a slow open can be attributed to a stage
// instead of guessed at.
//
// It also runs a JS-thread stall watchdog for the duration of the open. That is
// the part a server log cannot show: a blocked JS thread produces a long gap
// with no network activity at all, which reads as "the server was slow" from
// the outside and as "nothing happened" from the inside.
//
// Off unless EXPO_PUBLIC_OPEN_TRACE=1 — the watchdog's 16 ms interval is not
// something to ship enabled.

import { useEffect } from 'react'

const ENABLED = process.env.EXPO_PUBLIC_OPEN_TRACE === '1'

export type OpenPhase =
  | 'mount'
  | 'request'
  | 'response'
  | 'parsed'
  | 'merged'
  | 'listDrawn'

const PHASE_ORDER: OpenPhase[] = ['mount', 'request', 'response', 'parsed', 'merged', 'listDrawn']

interface Trace {
  id: string
  t0: number
  marks: { phase: OpenPhase; at: number; note?: string }[]
  stalls: { at: number; blockedMs: number }[]
  // Hot work that runs an unknown number of times per open. A stage mark can
  // only say when something last finished; this says how often it ran and what
  // it cost in total, which is what separates "expensive" from "called a lot".
  counters: Map<string, { runs: number; totalMs: number; maxMs: number }>
  timer: ReturnType<typeof setInterval> | null
  lastTick: number
  printed: boolean
}

let current: Trace | null = null

// A tick that lands this far past its 16 ms slot means the JS thread was busy
// for that long — under it, ordinary React work and timer coalescing dominate.
const STALL_THRESHOLD_MS = 250
const TICK_MS = 16
// Backstop: an open that never reaches listDrawn must still report, or the
// watchdog interval outlives the screen.
const MAX_TRACE_MS = 30_000

const BOOTED_AT = Date.now()
/** ms since this module loaded — the common clock for the [stall] and [live] lines. */
export function sinceBoot(): number {
  return Date.now() - BOOTED_AT
}

const LIVE = new Map<string, number>()

/**
 * Counts live mounted instances of a screen.
 * A screen that should exist once but reports 6 live instances is a navigation
 * leak, and every extra instance re-renders on every store/query update — which
 * a per-screen render profile cannot see, because each instance looks fine.
 * That is what turned an open costing 400 ms into one costing 5,000 ms here.
 */
export function useLiveInstanceCount(name: string) {
  useEffect(() => {
    if (!ENABLED) return
    const n = (LIVE.get(name) ?? 0) + 1
    LIVE.set(name, n)
    // eslint-disable-next-line no-console
    console.log(`[live] +${sinceBoot()} mount ${name} — ${n} live`)
    return () => {
      const m = (LIVE.get(name) ?? 1) - 1
      LIVE.set(name, m)
      // eslint-disable-next-line no-console
      console.log(`[live] +${sinceBoot()} unmount ${name} — ${m} live`)
    }
  }, [name])
}

// Always-on stall watchdog, independent of any open. The per-trace watchdog can
// only see blocks between a conversation mount and its listDrawn, so it reports
// every block as if the conversation screen caused it. This one runs for the
// whole process and timestamps against app start, which is what separates "the
// open is slow" from "the app is periodically frozen".
//
// Guarded on globalThis, not on module scope: Fast Refresh re-evaluates this
// module on every edit, and an unguarded interval would leave the previous one
// running. Four stacked watchdogs report the same block four times and add their
// own load to the thread they are measuring.
const GLOBAL_WATCHDOG = '__tbOpenTraceWatchdog'
const globals = globalThis as typeof globalThis & { [GLOBAL_WATCHDOG]?: boolean }

if (ENABLED && !globals[GLOBAL_WATCHDOG]) {
  globals[GLOBAL_WATCHDOG] = true
  const bootedAt = BOOTED_AT
  let last = bootedAt
  setInterval(() => {
    const t = Date.now()
    const late = t - last - TICK_MS
    last = t
    if (late >= STALL_THRESHOLD_MS) {
      // eslint-disable-next-line no-console
      console.log(`[stall] +${Math.round(t - bootedAt)} ms since boot — JS thread blocked ${Math.round(late)} ms`)
    }
  }, TICK_MS)
}

export function startOpenTrace(id: string) {
  if (!ENABLED) return
  stopWatchdog()
  const now = Date.now()
  current = { id, t0: now, marks: [], stalls: [], counters: new Map(), timer: null, lastTick: now, printed: false }
  mark('mount')
  current.timer = setInterval(() => {
    const t = Date.now()
    const late = t - (current?.lastTick ?? t) - TICK_MS
    if (current) {
      if (late >= STALL_THRESHOLD_MS) current.stalls.push({ at: t - current.t0, blockedMs: late })
      current.lastTick = t
      if (t - current.t0 > MAX_TRACE_MS) finishOpenTrace('timeout')
    }
  }, TICK_MS)
}

export function mark(phase: OpenPhase, note?: string) {
  if (!ENABLED || !current) return
  // First occurrence wins: back-pages and delta hops re-enter the same call
  // sites, and the open is defined by the first page reaching the screen.
  if (current.marks.some((m) => m.phase === phase)) return
  current.marks.push({ phase, at: Date.now() - current.t0, note })
}

/**
 * Records one execution of a repeatedly-run block. Call it around work that may
 * run many times per open (a memo body, an adapter) so the report can say
 * whether the time is per-execution cost or execution count.
 */
export function count(name: string, ms: number) {
  if (!ENABLED || !current) return
  const c = current.counters.get(name) ?? { runs: 0, totalMs: 0, maxMs: 0 }
  c.runs += 1
  c.totalMs += ms
  if (ms > c.maxMs) c.maxMs = ms
  current.counters.set(name, c)
}

/** Lets hot call sites (every HTTP request) skip their path regex when off. */
export function isTracing(): boolean {
  return ENABLED && current !== null
}

function stopWatchdog() {
  if (current?.timer) clearInterval(current.timer)
  if (current) current.timer = null
}

export function finishOpenTrace(reason: 'listDrawn' | 'timeout' | 'unmount' = 'listDrawn') {
  if (!ENABLED || !current || current.printed) return
  current.printed = true
  stopWatchdog()
  const trace = current
  current = null

  const byPhase = new Map(trace.marks.map((m) => [m.phase, m]))
  const lines: string[] = []
  let prev = 0
  for (const phase of PHASE_ORDER) {
    const m = byPhase.get(phase)
    if (!m) {
      lines.push(`  ${phase.padEnd(12)}        —  (not reached)`)
      continue
    }
    lines.push(
      `  ${phase.padEnd(12)} ${String(Math.round(m.at)).padStart(6)} ms  (+${String(Math.round(m.at - prev)).padStart(5)} ms)${m.note ? `  ${m.note}` : ''}`,
    )
    prev = m.at
  }

  const stalled = trace.stalls.reduce((sum, s) => sum + s.blockedMs, 0)
  const stallLines = trace.stalls.length
    ? trace.stalls.map((s) => `  at +${Math.round(s.at)} ms — JS thread blocked ${Math.round(s.blockedMs)} ms`)
    : ['  none over 250 ms']

  const counterLines = trace.counters.size
    ? [...trace.counters.entries()].map(
        ([name, c]) =>
          `  ${name.padEnd(16)} ${String(c.runs).padStart(6)} runs  ${c.totalMs.toFixed(0).padStart(7)} ms total  ` +
          `${(c.totalMs / Math.max(1, c.runs)).toFixed(2).padStart(7)} ms avg  ${c.maxMs.toFixed(0).padStart(5)} ms max`,
      )
    : ['  none recorded']

  // eslint-disable-next-line no-console
  console.log(
    `\n[open-trace] conversation ${trace.id} — ${reason}, total ${Math.round(prev)} ms\n` +
      `${lines.join('\n')}\n` +
      `  JS-thread stalls (${trace.stalls.length}, ${Math.round(stalled)} ms total):\n${stallLines.join('\n')}\n` +
      `  repeated work:\n${counterLines.join('\n')}\n`,
  )
}
