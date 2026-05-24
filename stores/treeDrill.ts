import { create } from 'zustand'

/**
 * Tracks the directory the user is currently drilled into inside TreeView.
 * When the FAB ("Create new session") is tapped while a drill is active,
 * the new-session flow uses this path as its starting cwd instead of the
 * server's default browse root.
 *
 * In-memory only; no persistence. The signal is meaningful only while the
 * user is on the hub with DrillView mounted.
 */
interface DrillTarget {
  serverId: string
  path: string
}

interface TreeDrillStore {
  current: DrillTarget | null
  setCurrent: (target: DrillTarget | null) => void
  clear: () => void
}

export const useTreeDrillStore = create<TreeDrillStore>((set) => ({
  current: null,
  setCurrent: (current) => set({ current }),
  clear: () => set({ current: null }),
}))
