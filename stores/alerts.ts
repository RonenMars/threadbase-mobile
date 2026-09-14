import { create } from 'zustand'
import { alertFingerprint, TOAST_DEFAULT_TIMEOUT_MS, type AlertCause, type AlertEntry, type AlertSpec } from '@/types/alerts'

export type AlertInput = AlertSpec & {
  id: string
  viewport: string
}

type AlertState = {
  alerts: AlertEntry[]
  detailsId: string | null
  inlineClaims: Record<string, number>
  upsert: (entry: AlertInput) => void
  dismiss: (id: string) => void
  stickyDismiss: (id: string) => void
  openDetails: (id: string) => void
  closeDetails: () => void
  claimInline: (cause: AlertCause) => void
  releaseInline: (cause: AlertCause) => void
  reset: () => void
}

const timers = new Map<string, ReturnType<typeof setTimeout>>()
const stickyFingerprints = new Map<string, string>()

// `alertFingerprint` answers "is this the same alert?" and drives sticky
// suppression, so it covers copy only. This answers "does the row need
// repainting?", which also covers the non-copy props Toast renders. `icon` is a
// ReactNode and can't be compared, so it rides along with the callbacks.
function renderSignature(entry: AlertSpec & { id: string; viewport: string }): string {
  return [
    alertFingerprint(entry),
    entry.cause,
    entry.viewport,
    entry.buttonText ?? '',
    entry.buttonVariant ?? '',
    entry.hideCloseButton ? '1' : '',
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

function scheduleTimeout(entry: AlertEntry) {
  clearTimer(entry.id)
  if (entry.level !== 'info') return
  const timeout = entry.timeout === undefined ? TOAST_DEFAULT_TIMEOUT_MS : entry.timeout
  if (timeout == null) return
  timers.set(
    entry.id,
    setTimeout(() => {
      timers.delete(entry.id)
      useAlertStore.getState().stickyDismiss(entry.id)
    }, timeout),
  )
}

function withRaisedAt(entry: AlertInput, raisedAt: number): AlertEntry {
  return { ...entry, raisedAt }
}

export const useAlertStore = create<AlertState>((set, get) => ({
  alerts: [],
  detailsId: null,
  inlineClaims: {},
  upsert: (entry) => {
    const fingerprint = alertFingerprint(entry)
    if (stickyFingerprints.get(entry.id) === fingerprint) return

    const existing = get().alerts.find((alert) => alert.id === entry.id)
    if (existing) {
      const next = withRaisedAt(entry, existing.raisedAt)
      // Nothing visible changed: refresh the callbacks in place so consumers
      // keep live handlers without a re-render (and without restarting the
      // timer). Toast reads them off this object at call time.
      if (renderSignature(existing) === renderSignature(next)) {
        existing.buttonAction = next.buttonAction
        existing.onPress = next.onPress
        existing.onClose = next.onClose
        existing.icon = next.icon
        return
      }
      // New copy is a new alert, so it earns a fresh timeout.
      scheduleTimeout(next)
      set({
        alerts: get().alerts.map((alert) => (alert.id === entry.id ? next : alert)),
      })
      return
    }

    stickyFingerprints.delete(entry.id)
    const next = withRaisedAt(entry, Date.now())
    scheduleTimeout(next)
    set({ alerts: [...get().alerts, next] })
  },
  dismiss: (id) => {
    clearTimer(id)
    stickyFingerprints.delete(id)
    const { alerts, detailsId } = get()
    if (!alerts.some((alert) => alert.id === id) && detailsId !== id) return
    set({
      alerts: alerts.filter((alert) => alert.id !== id),
      detailsId: detailsId === id ? null : detailsId,
    })
  },
  stickyDismiss: (id) => {
    const alert = get().alerts.find((entry) => entry.id === id)
    if (alert) stickyFingerprints.set(id, alertFingerprint(alert))
    clearTimer(id)
    const { alerts, detailsId } = get()
    set({
      alerts: alerts.filter((entry) => entry.id !== id),
      detailsId: detailsId === id ? null : detailsId,
    })
  },
  openDetails: (id) => set({ detailsId: id }),
  closeDetails: () => set({ detailsId: null }),
  claimInline: (cause) =>
    set((s) => ({
      inlineClaims: { ...s.inlineClaims, [cause]: (s.inlineClaims[cause] ?? 0) + 1 },
    })),
  releaseInline: (cause) =>
    set((s) => {
      const current = s.inlineClaims[cause] ?? 0
      if (current <= 1) {
        const { [cause]: _removed, ...inlineClaims } = s.inlineClaims
        return { inlineClaims }
      }
      return { inlineClaims: { ...s.inlineClaims, [cause]: current - 1 } }
    }),
  reset: () => {
    for (const id of timers.keys()) clearTimer(id)
    stickyFingerprints.clear()
    set({ alerts: [], detailsId: null, inlineClaims: {} })
  },
}))
