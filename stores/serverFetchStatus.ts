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
    set((s) => s.statuses[serverId]?.status === 'warming_up'
      ? s
      : {
          statuses: {
            ...s.statuses,
            [serverId]: { status: 'ok', lastCheckedAt: Date.now() },
          },
        }),
  recordReady: (serverId) =>
    set((s) => ({
      statuses: {
        ...s.statuses,
        [serverId]: { status: 'ok', lastCheckedAt: Date.now() },
      },
    })),
  recordFailure: (serverId, error) =>
    set((s) => ({
      statuses: {
        ...s.statuses,
        [serverId]: {
          status: 'error',
          error: describeError(error),
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
  reset: () => set({ statuses: {} }),
}))
