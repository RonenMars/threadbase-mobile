/**
 * Slow streamer requests, reported to the streamer they were made against.
 *
 * On 2026-09-12 a session kill sat on "Sending…" for about ten seconds. The
 * streamer's log proves it answered `POST /stop` in 26 ms and that the app's
 * next request arrived 10.7 s later, so the time went somewhere on the client
 * or the wire — and build 232 kept no record of either. `clog()` and
 * `installClientLogCapture()` (`lib/clientLog.ts`) both begin with
 * `if (!__DEV__) return`, so a release build buffers, mirrors and uploads
 * nothing; Sentry runs but samples no traces and ships breadcrumbs only with a
 * captured error, and a slow success is not an error.
 *
 * This is the one reporting path that survives a release build. It deliberately
 * does not lift the `__DEV__` guard in `lib/clientLog.ts`: that guard is what
 * keeps every `console.*` in the app from becoming an upload. What it does
 * reuse is that module's shape — a buffer, a short coalescing timer, a capped
 * batch, and the same `POST /api/__client-log` sink.
 *
 * Two rules it does not bend:
 *
 * - **Reports go to the server the request was made against, never to whichever
 *   server happens to be first in the store.** `lib/clientLog.ts` resolves its
 *   sink with `Object.values(servers)[0]`, which was tolerable while it was
 *   dev-only. It is not tolerable here: a report names the route, the route
 *   carries session and conversation ids, and uploading machine B's ids into
 *   machine A's log is a leak between two machines that never talk. Reports are
 *   therefore buffered per server id and flushed per server.
 * - **Shape and timing only.** No body, no query value, no header, no
 *   credential — the boundary `services/sanitize.ts` holds for every other
 *   outbound payload.
 */
import { useServersStore } from '@/stores/servers'
import { authedFetch, type AuthedTarget } from '@/services/authed-fetch'

/**
 * A request slower than this earns a line. Set so an ordinary call on a bad
 * network stays silent: the point is to attribute a stall a user notices, not
 * to trace every request.
 */
export const SLOW_REQUEST_MS = 2_000

/**
 * The sink's own route. A slow upload that reported itself would enqueue a
 * report of the flush, whose flush would enqueue another, forever.
 */
export const CLIENT_LOG_PATH = '/api/__client-log'

/** Coalescing window, so a burst of slow requests costs one upload. */
const FLUSH_INTERVAL_MS = 1_500

/** Reports per upload, and the ceiling a server's queue is trimmed to. */
const MAX_BATCH = 20
const MAX_PENDING = 100

export interface RequestTiming {
  /** Stable store id of the server the request addressed. */
  serverId?: string
  method: string
  /** Request path, query string and all. The reporter strips it before recording. */
  path: string
  ms: number
  /** HTTP status, or the error class that ended the call. */
  outcome: string
  sealed: boolean
  /** Milliseconds this call spent awaiting a REST transport context. */
  ctxMs: number
}

type Entry = {
  level: 'warn'
  tag: string
  msg: string
  ts: string
  fields: Record<string, unknown>
}

const pending = new Map<string, Entry[]>()
let flushTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Whether reports are collected at all. Off under jest by default: a suite on
 * fake timers can hold a request open past the threshold, and a queued report
 * would start a flush whose own POST changes the `fetch` call count that suite
 * is asserting on.
 */
let enabled = process.env.JEST_WORKER_ID === undefined

function scheduleFlush() {
  if (flushTimer) return
  flushTimer = setTimeout(() => {
    flushTimer = null
    void flush()
  }, FLUSH_INTERVAL_MS)
}

/**
 * Records a finished request, if it was slow enough to be worth a line.
 *
 * A request with no `serverId` is dropped: the pre-pairing credential probes
 * (`hooks/useTBPair.ts`, `components/servers/ServerEditModal.tsx`) build an
 * ad-hoc `{ url, apiKey }` target that is in no store, so there is no server to
 * route their report to and no stored credential to present when sending it.
 */
export function reportRequestTiming(timing: RequestTiming) {
  if (!enabled) return
  if (timing.ms < SLOW_REQUEST_MS) return
  if (!timing.serverId) return
  const path = timing.path.replace(/\?.*$/, '')
  if (path === CLIENT_LOG_PATH) return

  const queue = pending.get(timing.serverId) ?? []
  queue.push({
    level: 'warn',
    tag: 'slow-request',
    msg: 'slow-request',
    ts: new Date().toISOString(),
    fields: {
      method: timing.method,
      path,
      ms: timing.ms,
      outcome: timing.outcome,
      sealed: timing.sealed,
      ctxMs: timing.ctxMs,
    },
  })
  if (queue.length > MAX_PENDING) queue.splice(0, queue.length - MAX_PENDING)
  pending.set(timing.serverId, queue)
  scheduleFlush()
}

/**
 * Uploads the first `MAX_BATCH` of each server's reports to that server, and
 * forgets the queue — including anything past `MAX_BATCH`, which is discarded
 * unsent rather than held for the next window.
 *
 * Nothing is ever requeued, not a refused batch and not an overflowing one. The
 * streamer's bounds on this endpoint are its own (it may answer 429 or 413 and
 * drop the batch); whatever comes back, a retry loop is how instrumentation
 * turns a slow server into an outage. Losing the tail of a burst costs one line
 * in a log that already has twenty describing the same stall.
 */
async function flush() {
  const servers = useServersStore.getState().servers
  for (const [serverId, queue] of [...pending]) {
    pending.delete(serverId)
    const target: AuthedTarget | undefined = servers[serverId]
    // The server was removed while the reports sat in the queue. They describe
    // a machine the app no longer holds a credential for; drop them.
    if (!target) continue
    const batch = queue.slice(0, MAX_BATCH)
    try {
      await authedFetch(target, CLIENT_LOG_PATH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries: batch }),
      })
    } catch {
      // Instrumentation never fails an app action and never retries: this runs
      // on a timer, detached from the request that produced the report.
    }
  }
}

export function _setSlowRequestLogEnabledForTests(next: boolean) {
  enabled = next
}

/** The reports queued for a server and not yet uploaded. */
export function _pendingReportsForTests(serverId: string): Record<string, unknown>[] {
  return (pending.get(serverId) ?? []).map((entry) => entry.fields)
}

export function _resetSlowRequestLogForTests() {
  pending.clear()
  if (flushTimer) clearTimeout(flushTimer)
  flushTimer = null
  enabled = process.env.JEST_WORKER_ID === undefined
}
