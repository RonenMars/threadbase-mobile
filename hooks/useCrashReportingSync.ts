import { useEffect } from 'react'
import { useSettingsStore } from '@/stores/settings'
import {
  currentDiagnosticsTermsKey,
  isSentryTrackingEnforced,
  setAnonymousDiagnosticsEnabled,
} from '@/services/sentry'

/**
 * Keeps the Sentry consent gate in lockstep with the persisted setting.
 *
 * - Nothing is applied until settings hydrate, so the first call carries the
 *   user's real answer — that call fixes session tracking for the whole process.
 * - Until the user answers the launch diagnostics notice for this build's terms
 *   (`DiagnosticsTermsGate`), consent is off whatever the stored toggle says.
 * - Whenever the consent toggle flips, it flips the gate immediately so
 *   disabling stops passive reporting right away.
 * - With EXPO_PUBLIC_ENFORCE_SENTRY_TRACKING and a DSN, consent is forced on once
 *   the user has agreed, and the setting flipped to match, so the toggle shows
 *   what is really happening.
 *
 * `setAnonymousDiagnosticsEnabled` is itself gated (DSN + environment) and
 * never throws, so this hook is safe to run unconditionally at the app root.
 */
export function useCrashReportingSync(): void {
  const enabled = useSettingsStore((s) => s.anonymousDiagnosticsEnabled)
  const hydrated = useSettingsStore((s) => s.hydrated)
  const accepted = useSettingsStore((s) => s.diagnosticsTermsAccepted === currentDiagnosticsTermsKey())

  useEffect(() => {
    if (!hydrated) return
    const forced = accepted && isSentryTrackingEnforced()
    if (forced && !enabled) useSettingsStore.getState().setAnonymousDiagnosticsEnabled(true)
    if (__DEV__) console.log('[sentry] consent sync fired, anonymousDiagnosticsEnabled =', enabled, forced ? '(enforced)' : '', accepted ? '' : '(terms not answered)')
    void setAnonymousDiagnosticsEnabled(accepted && (enabled || forced))
  }, [enabled, hydrated, accepted])
}
