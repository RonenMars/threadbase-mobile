import { create } from 'zustand'
import type { QueuedPrompt } from '@/types/api'

function compoundKey(serverId: string, sessionId: string): string {
  return `${serverId}::${sessionId}`
}

interface SessionsStore {
  /** Prompt queues keyed by compound key (serverId::sessionId). */
  promptQueues: Record<string, QueuedPrompt[]>

  setQueue: (serverId: string, sessionId: string, queue: QueuedPrompt[]) => void
  addToQueue: (serverId: string, sessionId: string, prompt: QueuedPrompt) => void
  removeFromQueue: (serverId: string, sessionId: string, promptId: string) => void
  reorderQueue: (serverId: string, sessionId: string, queue: QueuedPrompt[]) => void
}

export const useSessionsStore = create<SessionsStore>((set) => ({
  promptQueues: {},

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
