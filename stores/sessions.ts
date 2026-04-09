import { create } from 'zustand'
import type { Session, SessionStatus, QueuedPrompt } from '@/types/api'

interface SessionsStore {
  sessions: Session[]
  // sessionId -> queue
  promptQueues: Record<string, QueuedPrompt[]>
  setSessions: (sessions: Session[]) => void
  updateSession: (id: string, patch: Partial<Session>) => void
  sessionsByStatus: () => Record<SessionStatus, Session[]>
  setQueue: (sessionId: string, queue: QueuedPrompt[]) => void
  addToQueue: (sessionId: string, prompt: QueuedPrompt) => void
  removeFromQueue: (sessionId: string, promptId: string) => void
  reorderQueue: (sessionId: string, queue: QueuedPrompt[]) => void
}

export const useSessionsStore = create<SessionsStore>((set, get) => ({
  sessions: [],
  promptQueues: {},

  setSessions: (sessions) => set({ sessions }),

  updateSession: (id, patch) =>
    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    })),

  sessionsByStatus: () => {
    const { sessions } = get()
    const result: Record<SessionStatus, Session[]> = {
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

  setQueue: (sessionId, queue) =>
    set((state) => ({
      promptQueues: { ...state.promptQueues, [sessionId]: queue },
    })),

  addToQueue: (sessionId, prompt) =>
    set((state) => ({
      promptQueues: {
        ...state.promptQueues,
        [sessionId]: [...(state.promptQueues[sessionId] ?? []), prompt],
      },
    })),

  removeFromQueue: (sessionId, promptId) =>
    set((state) => ({
      promptQueues: {
        ...state.promptQueues,
        [sessionId]: (state.promptQueues[sessionId] ?? []).filter((p) => p.id !== promptId),
      },
    })),

  reorderQueue: (sessionId, queue) =>
    set((state) => ({
      promptQueues: { ...state.promptQueues, [sessionId]: queue },
    })),
}))
