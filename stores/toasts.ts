import { create } from 'zustand'
import { alertFingerprint, TOAST_DEFAULT_TIMEOUT_MS, type AlertSpec } from '@/types/alerts'

export type ToastEntry = AlertSpec & {
  id: string
  viewport: string
}

type ToastState = {
  toasts: ToastEntry[]
  detailsId: string | null
  upsert: (entry: ToastEntry) => void
  dismiss: (id: string) => void
  stickyDismiss: (id: string) => void
  openDetails: (id: string) => void
  closeDetails: () => void
  reset: () => void
}

const timers = new Map<string, ReturnType<typeof setTimeout>>()
const stickyFingerprints = new Map<string, string>()

function clearTimer(id: string) {
  const timer = timers.get(id)
  if (timer) clearTimeout(timer)
  timers.delete(id)
}

function scheduleTimeout(entry: ToastEntry) {
  clearTimer(entry.id)
  const timeout = entry.timeout === undefined ? TOAST_DEFAULT_TIMEOUT_MS : entry.timeout
  if (timeout == null) return
  timers.set(
    entry.id,
    setTimeout(() => {
      timers.delete(entry.id)
      useToastStore.getState().stickyDismiss(entry.id)
    }, timeout),
  )
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  detailsId: null,
  upsert: (entry) => {
    const fingerprint = alertFingerprint(entry)
    if (stickyFingerprints.get(entry.id) === fingerprint) return

    const existing = get().toasts.find((toast) => toast.id === entry.id)
    if (existing) {
      // Same copy: refresh the callbacks in place so the viewport keeps the
      // live handlers without a re-render (and without restarting the timer).
      if (alertFingerprint(existing) === fingerprint) {
        existing.buttonAction = entry.buttonAction
        existing.onPress = entry.onPress
        existing.onClose = entry.onClose
        existing.icon = entry.icon
        existing.buttonText = entry.buttonText
        existing.buttonVariant = entry.buttonVariant
        existing.hideCloseButton = entry.hideCloseButton
        existing.timeout = entry.timeout
        existing.accent = entry.accent
        existing.testID = entry.testID
        return
      }
      set({
        toasts: get().toasts.map((toast) => (toast.id === entry.id ? entry : toast)),
      })
      return
    }

    stickyFingerprints.delete(entry.id)
    scheduleTimeout(entry)
    set({ toasts: [...get().toasts, entry] })
  },
  dismiss: (id) => {
    clearTimer(id)
    stickyFingerprints.delete(id)
    const { toasts, detailsId } = get()
    if (!toasts.some((toast) => toast.id === id) && detailsId !== id) return
    set({
      toasts: toasts.filter((toast) => toast.id !== id),
      detailsId: detailsId === id ? null : detailsId,
    })
  },
  stickyDismiss: (id) => {
    const toast = get().toasts.find((entry) => entry.id === id)
    if (toast) stickyFingerprints.set(id, alertFingerprint(toast))
    clearTimer(id)
    const { toasts, detailsId } = get()
    set({
      toasts: toasts.filter((entry) => entry.id !== id),
      detailsId: detailsId === id ? null : detailsId,
    })
  },
  openDetails: (id) => set({ detailsId: id }),
  closeDetails: () => set({ detailsId: null }),
  reset: () => {
    for (const id of timers.keys()) clearTimer(id)
    stickyFingerprints.clear()
    set({ toasts: [], detailsId: null })
  },
}))
