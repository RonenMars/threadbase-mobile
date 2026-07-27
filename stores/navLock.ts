import { create } from 'zustand'

// Safety net: if a destination screen never mounts (route error, etc.), the
// overlay must not stay up forever.
const AUTO_CLEAR_MS = 2000

interface NavLockState {
  isNavigating: boolean
  lock: () => void
  clear: () => void
}

let timeoutId: ReturnType<typeof setTimeout> | null = null

export const useNavLockStore = create<NavLockState>((set) => ({
  isNavigating: false,
  lock: () => {
    if (timeoutId) clearTimeout(timeoutId)
    timeoutId = setTimeout(() => {
      timeoutId = null
      set({ isNavigating: false })
    }, AUTO_CLEAR_MS)
    set({ isNavigating: true })
  },
  clear: () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
    set({ isNavigating: false })
  },
}))
