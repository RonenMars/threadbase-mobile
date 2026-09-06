import { useEffect } from 'react'
import { useSettingsStore } from '@/stores/settings'
import { setAnonymousDiagnosticsEnabled } from '@/services/sentry'

/**
 * Keeps the Sentry consent gate in lockstep with the persisted setting.
 *
 * - On mount (after settings hydrate) it makes the SDK ready (a no-op if it
 *   already is) and applies the hydrated consent value.
 * - Whenever the consent toggle flips, it flips the gate immediately so
 *   disabling stops passive reporting right away.
 *
 * `setAnonymousDiagnosticsEnabled` is itself gated (DSN + environment) and
 * never throws, so this hook is safe to run unconditionally at the app root.
 */
export function useCrashReportingSync(): void {
  const enabled = useSettingsStore((s) => s.anonymousDiagnosticsEnabled)

  useEffect(() => {
    if (__DEV__) console.log('[sentry] consent sync fired, anonymousDiagnosticsEnabled =', enabled)
    void setAnonymousDiagnosticsEnabled(enabled)
  }, [enabled])
}
