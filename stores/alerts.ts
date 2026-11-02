import { create } from 'zustand'
import { alertFingerprint, TOAST_DEFAULT_TIMEOUT_MS, type AlertCause, type AlertEntry, type AlertSpec } from '@/types/alerts'

export type AlertInput = AlertSpec & {
  id: string
}

type AlertState = {
  alerts: AlertEntry[]
  inlineClaims: Record<string, number>
  upsert: (entry: AlertInput) => void
  push: (entry: AlertInput) => void
  dismiss: (id: string) => void
  stickyDismiss: (id: string, reason?: SuppressionReason) => void
  claimInline: (cause: AlertCause) => void
  releaseInline: (cause: AlertCause) => void
  reset: () => void
}

type SuppressionReason = 'user' | 'expired'

type Suppression = {
  fingerprint: string
  reason: SuppressionReason
  at: number
}

// How long identical copy stays hidden after a user-dismissed alert's condition
// clears. Long enough that a flapping connection doesn't re-nag on every flap,
// short enough that a genuine recurrence later in the same sitting is seen. A
// nag-frequency choice, not a correctness one.
export const USER_DISMISS_COOLDOWN_MS = 5 * 60 * 1000

const timers = new Map<string, ReturnType<typeof setTimeout>>()
// Holds while the condition does: the declarative emitter re-pushes the same
// spec every commit, so a dismissed or expired alert must stay gone until the
// copy changes or `dismiss` reports the condition ended.
const stickyFingerprints = new Map<string, Suppression>()
// Only user dismissals graduate here. An expiry is the toast doing its job, so
// it never earns a cooldown.
const cooldowns = new Map<string, Suppression>()

// `alertFingerprint` answers "is this the same alert?" and drives sticky
// suppression, so it covers copy only. This answers "does the row need
// repainting?", which also covers the non-copy props Toast renders. `icon` is a
// ReactNode and can't be compared, so it rides along with the callbacks.
function renderSignature(entry: AlertSpec & { id: string }): string {
  return [
    alertFingerprint(entry),
    entry.cause,
    entry.buttonText ?? '',
    entry.buttonVariant ?? '',
    entry.hideCloseButton ? '1' : '',
    entry.testID ?? '',
    entry.code ?? '',
    entry.rawMessage ?? '',
    entry.retryable ? '1' : '',
    entry.retrying ? '1' : '',
    // Presence only: `onPress` decides whether the body is a button at all.
    entry.onPress ? '1' : '',
  ].join('\u0000')
}

function clearTimer(id: string) {
  const timer = timers.get(id)
  if (timer) clearTimeout(timer)
  timers.delete(id)
}

function scheduleTimeout(entry: AlertEntry, transient = false) {
  clearTimer(entry.id)
  if (entry.level !== 'info') return
  const timeout = entry.timeout === undefined ? TOAST_DEFAULT_TIMEOUT_MS : entry.timeout
  if (timeout == null) return
  timers.set(
    entry.id,
    setTimeout(() => {
      timers.delete(entry.id)
      const { dismiss, stickyDismiss } = useAlertStore.getState()
      // A pushed toast is an event, not a mirrored condition: expiring it must
      // not leave a record behind for the next occurrence to trip over.
      if (transient) dismiss(entry.id)
      else stickyDismiss(entry.id, 'expired')
    }, timeout),
  )
}

function withRaisedAt(entry: AlertInput, raisedAt: number): AlertEntry {
  return { ...entry, raisedAt }
}

export const useAlertStore = create<AlertState>((set, get) => ({
  alerts: [],
  inlineClaims: {},
  upsert: (entry) => {
    const fingerprint = alertFingerprint(entry)
    if (stickyFingerprints.get(entry.id)?.fingerprint === fingerprint) return
    const cooling = cooldowns.get(entry.id)
    if (cooling?.fingerprint === fingerprint) {
      if (Date.now() - cooling.at < USER_DISMISS_COOLDOWN_MS) return
      cooldowns.delete(entry.id)
    }

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
  push: (entry) => {
    const next = withRaisedAt(entry, Date.now())
    scheduleTimeout(next, true)
    const { alerts } = get()
    set({
      alerts: alerts.some((alert) => alert.id === entry.id)
        ? alerts.map((alert) => (alert.id === entry.id ? next : alert))
        : [...alerts, next],
    })
  },
  dismiss: (id) => {
    clearTimer(id)
    const held = stickyFingerprints.get(id)
    if (held?.reason === 'user') cooldowns.set(id, { ...held, at: Date.now() })
    stickyFingerprints.delete(id)
    const { alerts } = get()
    if (!alerts.some((alert) => alert.id === id)) return
    set({
      alerts: alerts.filter((alert) => alert.id !== id),
    })
  },
  stickyDismiss: (id, reason = 'user') => {
    const alert = get().alerts.find((entry) => entry.id === id)
    if (alert) stickyFingerprints.set(id, { fingerprint: alertFingerprint(alert), reason, at: Date.now() })
    clearTimer(id)
    set({
      alerts: get().alerts.filter((entry) => entry.id !== id),
    })
  },
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
    cooldowns.clear()
    set({ alerts: [], inlineClaims: {} })
  },
}))
