import { create } from 'zustand'

// In-memory only: both marks describe a live process, so a cold start has
// nothing true to restore. Keyed by `sessionEndKey`.
type SessionEndState = {
  armed: Record<string, true>
  terminatingAt: Record<string, number>
  markArmed: (key: string) => void
  setTerminating: (key: string, at: number | null) => void
  clear: (key: string) => void
}

export const useSessionEndStore = create<SessionEndState>((set) => ({
  armed: {},
  terminatingAt: {},
  markArmed: (key) => set((s) => ({ armed: { ...s.armed, [key]: true } })),
  setTerminating: (key, at) =>
    set((s) => {
      const { [key]: _at, ...rest } = s.terminatingAt
      return { terminatingAt: at == null ? rest : { ...rest, [key]: at } }
    }),
  clear: (key) =>
    set((s) => {
      if (!(key in s.armed) && !(key in s.terminatingAt)) return s
      const { [key]: _armed, ...armed } = s.armed
      const { [key]: _at, ...terminatingAt } = s.terminatingAt
      return { armed, terminatingAt }
    }),
}))
