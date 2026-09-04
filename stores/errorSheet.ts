import { create } from 'zustand'

/**
 * Open/closed state for the global error recovery sheet, separate from the
 * errors themselves (loading-state.ts / serverFetchStatus.ts). Closing the
 * sheet is a minimize, not a dismiss — the underlying errors stay live so the
 * compact IssuesIndicator can reopen the same sheet.
 */
interface ErrorSheetState {
  open: boolean
  openSheet: () => void
  closeSheet: () => void
}

export const useErrorSheetStore = create<ErrorSheetState>((set) => ({
  open: false,
  openSheet: () => set({ open: true }),
  closeSheet: () => set({ open: false }),
}))
