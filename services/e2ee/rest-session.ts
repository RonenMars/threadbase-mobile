/**
 * The long-lived REST transport context: one per stable server id, opened
 * lazily with the first sealed request, rolled over on 24 h / 1 GiB /
 * foreground, drained 10 s, never persisted.
 *
 * NONCE-DESIGN §6, §8, §12 at streamer tag `v1.73.0`.
 */
import { AppState, type AppStateStatus, type NativeEventSubscription } from 'react-native'
import {
  openContext,
  type OpenContextArgs,
  type TransportContext,
} from '@/services/e2ee/context'

/** How long an evicted REST context keeps answering in-flight responses (§12). */
export const REST_DRAIN_MS = 10_000

/** 1 GiB of sealed frame bytes, send plus receive, then rollover (§8). */
export const REST_BYTE_LIMIT = 1024 * 1024 * 1024

type RestOpener = (args: OpenContextArgs) => Promise<TransportContext>

type RestBinding = {
  context: TransportContext
  bytes: number
  needsRollover: boolean
  draining: { context: TransportContext; until: number }[]
}

const live = new Map<string, RestBinding>()
const inFlight = new Map<string, Promise<TransportContext>>()

let opener: RestOpener = openContext
let nowMs = () => Date.now()
let appStateSub: NativeEventSubscription | null = null

function drainExpired(binding: RestBinding, t: number) {
  const kept: RestBinding['draining'] = []
  for (const entry of binding.draining) {
    if (t >= entry.until) entry.context.destroy()
    else kept.push(entry)
  }
  binding.draining = kept
}

function retire(binding: RestBinding, t: number) {
  binding.draining.push({ context: binding.context, until: t + REST_DRAIN_MS })
  binding.bytes = 0
  binding.needsRollover = false
}

function shouldRollover(binding: RestBinding, t: number): boolean {
  drainExpired(binding, t)
  if (binding.needsRollover) return true
  if (binding.bytes >= REST_BYTE_LIMIT) return true
  if (t >= binding.context.expiresAt) return true
  return false
}

function onAppState(status: AppStateStatus) {
  if (status !== 'active') return
  for (const binding of live.values()) binding.needsRollover = true
}

function ensureForegroundHook() {
  if (appStateSub) return
  appStateSub = AppState.addEventListener('change', onAppState)
}

/**
 * Returns the live REST context for this server, opening or rolling over as
 * needed. Concurrent waiters share this object — REST has one send counter
 * per server, unlike a socket context.
 */
export async function acquireRestContext(args: OpenContextArgs): Promise<TransportContext> {
  ensureForegroundHook()
  const serverId = args.serverId
  const t = nowMs()
  const existing = live.get(serverId)
  if (existing && !shouldRollover(existing, t)) return existing.context

  const pending = inFlight.get(serverId)
  if (pending) return pending

  const attempt = (async () => {
    if (existing && shouldRollover(existing, nowMs())) {
      retire(existing, nowMs())
    }
    const context = await opener({ ...args, kind: 'rest' })
    const current = live.get(serverId)
    if (current) {
      current.context = context
      current.bytes = 0
      current.needsRollover = false
    } else {
      live.set(serverId, { context, bytes: 0, needsRollover: false, draining: [] })
    }
    return context
  })()

  inFlight.set(serverId, attempt)
  try {
    return await attempt
  } finally {
    if (inFlight.get(serverId) === attempt) inFlight.delete(serverId)
  }
}

export function noteRestBytes(serverId: string, n: number) {
  const binding = live.get(serverId)
  if (!binding) return
  binding.bytes += n
}

/** A recovered `E2EE_CTX_UNKNOWN`: drop the live context so the retry opens fresh. */
export function invalidateRestContext(serverId: string) {
  const binding = live.get(serverId)
  if (!binding) return
  binding.context.destroy()
  for (const entry of binding.draining) entry.context.destroy()
  live.delete(serverId)
}

export function _resetRestSessionsForTests() {
  for (const binding of live.values()) {
    binding.context.destroy()
    for (const entry of binding.draining) entry.context.destroy()
  }
  live.clear()
  inFlight.clear()
  opener = openContext
  nowMs = () => Date.now()
  appStateSub?.remove()
  appStateSub = null
}

export function _setRestOpenForTests(next: RestOpener | null) {
  opener = next ?? openContext
}

export function _setRestNowForTests(next: (() => number) | null) {
  nowMs = next ?? (() => Date.now())
}

export function _restLiveCount(): number {
  return live.size
}

export function _markRestForegroundForTests() {
  onAppState('active')
}
