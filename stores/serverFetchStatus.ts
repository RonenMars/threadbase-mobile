import { create } from 'zustand'
import type { ServerWarmupState } from '@/types/api'

// Per-server HTTP fetch health, separate from the WebSocket connection status
// in ws-client. A server can be WS-connected but failing GETs (or vice versa).
// The Hub header dot and ServerStatusModal AND-combine both signals when
// deciding green/amber/red.

export type ServerFetchStatus = 'ok' | 'error' | 'warming_up'

export interface ServerFetchStatusEntry {
  status: ServerFetchStatus
  /** Human-readable error message when status === 'error'. */
  error?: string
  /** HTTP status the failing request returned, when there was one. */
  httpStatus?: number
  /** Server-supplied error code, when the response carried one. */
  code?: string
  warmupState?: ServerWarmupState
  lastCheckedAt: number
}

interface State {
  statuses: Record<string, ServerFetchStatusEntry>
}

interface Actions {
  recordSuccess: (serverId: string) => void
  recordReady: (serverId: string) => void
  recordFailure: (serverId: string, error: unknown) => void
  recordWarmingUp: (serverId: string, warmupState: ServerWarmupState) => void
  clearServer: (serverId: string) => void
  reset: () => void
}

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  try {
    return JSON.stringify(error)
  } catch {
    return String(error)
  }
}

export const useServerFetchStatusStore = create<State & Actions>((set) => ({
  statuses: {},
  recordSuccess: (serverId) =>
    // No-op when nothing changes: a warming server stays warming, and a server
    // already 'ok' keeps its entry. Returning the same state means zustand does
    // not notify subscribers, so a successful response for an already-healthy
    // server does not re-render the Hub (only lastCheckedAt would differ, and
    // it is not on any render hot path).
    set((s) => {
      const cur = s.statuses[serverId]?.status
      if (cur === 'warming_up' || cur === 'ok') return s
      return {
        statuses: {
          ...s.statuses,
          [serverId]: { status: 'ok', lastCheckedAt: Date.now() },
        },
      }
    }),
  recordReady: (serverId) =>
    // Same identity-stability guard, but recordReady is also the transition out
    // of 'warming_up', so it only short-circuits when already 'ok'.
    set((s) => {
      if (s.statuses[serverId]?.status === 'ok') return s
      return {
        statuses: {
          ...s.statuses,
          [serverId]: { status: 'ok', lastCheckedAt: Date.now() },
        },
      }
    }),
  recordFailure: (serverId, error) =>
    set((s) => ({
      statuses: {
        ...s.statuses,
        [serverId]: {
          status: 'error',
          error: describeError(error),
          httpStatus: error && typeof error === 'object' && 'status' in error
            ? (error as { status?: number }).status
            : undefined,
          code: error && typeof error === 'object' && 'code' in error
            ? (error as { code?: string }).code
            : undefined,
          lastCheckedAt: Date.now(),
        },
      },
    })),
  recordWarmingUp: (serverId, warmupState) =>
    set((s) => ({
      statuses: {
        ...s.statuses,
        [serverId]: { status: 'warming_up', warmupState, lastCheckedAt: Date.now() },
      },
    })),
  // Removing a server must drop its status with it. A left-behind 'error' entry
  // outlives the ServerConfig it names, and anything keyed off these ids then
  // renders a row for a server it cannot resolve.
  clearServer: (serverId) =>
    set((s) => {
      if (!s.statuses[serverId]) return s
      const { [serverId]: _removed, ...statuses } = s.statuses
      return { statuses }
    }),

  reset: () => set({ statuses: {} }),
}))
