import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'

/**
 * Optimistic user turns not yet echoed back by the transcript. Persisted so a
 * reload keeps a message the agent may never have received on screen instead
 * of silently dropping it.
 */
export interface PendingSend {
  id: string
  text: string
  /** The streamer's prompt count for this send, from the POST /input reply. */
  promptCount?: number
  /** Epoch ms of the POST 200; starts the "not confirmed" fallback. */
  sentAt?: number
  /** No echo arrived within the fallback window. */
  unconfirmed?: boolean
  /** `inputNotSubmitted.at` this bubble already retried, so the flag stops showing. */
  retriedFor?: string
}

export const pendingSendsKey = (serverId: string, sessionId: string) => `${serverId}::${sessionId}`

interface PendingSendsStore {
  byKey: Record<string, PendingSend[]>
  add: (key: string, send: PendingSend) => void
  update: (key: string, id: string, patch: Partial<PendingSend>) => void
  /** The POST /input returned 200: start the fallback clock. */
  markSent: (key: string, id: string, promptCount?: number) => void
  remove: (key: string, ids: string[]) => void
}

export const usePendingSendsStore = create<PendingSendsStore>()(
  persist(
    (set, get) => ({
      byKey: {},
      add: (key, send) => set((s) => ({ byKey: { ...s.byKey, [key]: [...(s.byKey[key] ?? []), send] } })),
      update: (key, id, patch) =>
        set((s) =>
          s.byKey[key]
            ? { byKey: { ...s.byKey, [key]: s.byKey[key].map((p) => (p.id === id ? { ...p, ...patch } : p)) } }
            : s,
        ),
      markSent: (key, id, promptCount) => get().update(key, id, { sentAt: Date.now(), promptCount }),
      remove: (key, ids) =>
        set((s) => {
          const left = (s.byKey[key] ?? []).filter((p) => !ids.includes(p.id))
          const byKey = { ...s.byKey }
          if (left.length) byKey[key] = left
          else delete byKey[key]
          return { byKey }
        }),
    }),
    {
      name: 'threadbase_pending_sends',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ byKey: s.byKey }),
    },
  ),
)
