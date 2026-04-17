import { create } from 'zustand'
import type { Session, SessionStatus, QueuedPrompt, MultiSession } from '@/types/api'
import { useServersStore } from '@/stores/servers'

function compoundKey(serverId: string, sessionId: string): string {
  return `${serverId}::${sessionId}`
}

interface SessionsStore {
  /** Internal per-server session storage. */
  _byServer: Record<string, Session[]>
  /** Merged sessions from all servers, decorated with serverId/serverLabel. */
  sessions: MultiSession[]
  /** Prompt queues keyed by compound key (serverId::sessionId). */
  promptQueues: Record<string, QueuedPrompt[]>

  setSessions: (serverId: string, sessions: Session[]) => void
  updateSession: (serverId: string, sessionId: string, patch: Partial<Session>) => void
  sessionsByStatus: () => Record<SessionStatus, MultiSession[]>
  setQueue: (serverId: string, sessionId: string, queue: QueuedPrompt[]) => void
  addToQueue: (serverId: string, sessionId: string, prompt: QueuedPrompt) => void
  removeFromQueue: (serverId: string, sessionId: string, promptId: string) => void
  reorderQueue: (serverId: string, sessionId: string, queue: QueuedPrompt[]) => void
}

function mergeSessions(byServer: Record<string, Session[]>): MultiSession[] {
  const servers = useServersStore.getState().servers
  const merged: MultiSession[] = []
  for (const [serverId, sessions] of Object.entries(byServer)) {
    const label = servers[serverId]?.label
    for (const session of sessions) {
      merged.push({ ...session, serverId, serverLabel: label })
    }
  }
  return merged
}

export const useSessionsStore = create<SessionsStore>((set, get) => ({
  _byServer: {},
  sessions: [],
  promptQueues: {},

  setSessions: (serverId, sessions) =>
    set((state) => {
      const _byServer = { ...state._byServer, [serverId]: sessions }
      return { _byServer, sessions: mergeSessions(_byServer) }
    }),

  updateSession: (serverId, sessionId, patch) =>
    set((state) => {
      const serverSessions = state._byServer[serverId] ?? []
      const updated = serverSessions.map((s) => (s.id === sessionId ? { ...s, ...patch } : s))
      const _byServer = { ...state._byServer, [serverId]: updated }
      return { _byServer, sessions: mergeSessions(_byServer) }
    }),

  sessionsByStatus: () => {
    const { sessions } = get()
    const result: Record<SessionStatus, MultiSession[]> = {
      running: [],
      waiting_input: [],
      completed: [],
      failed: [],
      idle: [],
    }
    for (const session of sessions) {
      result[session.status].push(session)
    }
    return result
  },

  setQueue: (serverId, sessionId, queue) =>
    set((state) => ({
      promptQueues: { ...state.promptQueues, [compoundKey(serverId, sessionId)]: queue },
    })),

  addToQueue: (serverId, sessionId, prompt) =>
    set((state) => {
      const key = compoundKey(serverId, sessionId)
      return {
        promptQueues: {
          ...state.promptQueues,
          [key]: [...(state.promptQueues[key] ?? []), prompt],
        },
      }
    }),

  removeFromQueue: (serverId, sessionId, promptId) =>
    set((state) => {
      const key = compoundKey(serverId, sessionId)
      return {
        promptQueues: {
          ...state.promptQueues,
          [key]: (state.promptQueues[key] ?? []).filter((p) => p.id !== promptId),
        },
      }
    }),

  reorderQueue: (serverId, sessionId, queue) =>
    set((state) => ({
      promptQueues: { ...state.promptQueues, [compoundKey(serverId, sessionId)]: queue },
    })),
}))
