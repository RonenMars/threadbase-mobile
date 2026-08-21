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

// `alertFingerprint` answers "is this the same alert?" and drives sticky
// suppression, so it covers copy only. This answers "does the row need
// repainting?", which also covers the non-copy props Toast renders. `icon` is a
// ReactNode and can't be compared, so it rides along with the callbacks.
function renderSignature(entry: ToastEntry): string {
  return [
    alertFingerprint(entry),
    entry.viewport,
    entry.buttonText ?? '',
    entry.buttonVariant ?? '',
    entry.hideCloseButton ? '1' : '',
    entry.accent ?? '',
    entry.testID ?? '',
    // Presence only: `onPress` decides whether the body is a button at all.
    entry.onPress ? '1' : '',
  ].join('\u0000')
}

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
      // Nothing visible changed: refresh the callbacks in place so consumers
      // keep live handlers without a re-render (and without restarting the
      // timer). Toast reads them off this object at call time.
      if (renderSignature(existing) === renderSignature(entry)) {
        existing.buttonAction = entry.buttonAction
        existing.onPress = entry.onPress
        existing.onClose = entry.onClose
        existing.icon = entry.icon
        return
      }
      // New copy is a new alert, so it earns a fresh timeout.
      scheduleTimeout(entry)
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
