import { useEffect } from 'react'
import { useSettingsStore } from '@/stores/settings'
import { isDevDiagnosticsForced, setAnonymousDiagnosticsEnabled } from '@/services/sentry'

/**
 * Keeps the Sentry consent gate in lockstep with the persisted setting.
 *
 * - On mount (after settings hydrate) it makes the SDK ready (a no-op if it
 *   already is) and applies the hydrated consent value.
 * - Whenever the consent toggle flips, it flips the gate immediately so
 *   disabling stops passive reporting right away.
 * - In a DEV run with a DSN, consent is forced on and the setting flipped to
 *   match, so QA always reports and the toggle shows what is really happening.
 *   The forced value reaches the SDK on the first call, since that call fixes
 *   session tracking for the whole process.
 *
 * `setAnonymousDiagnosticsEnabled` is itself gated (DSN + environment) and
 * never throws, so this hook is safe to run unconditionally at the app root.
 */
export function useCrashReportingSync(): void {
  const enabled = useSettingsStore((s) => s.anonymousDiagnosticsEnabled)

  useEffect(() => {
    const forced = isDevDiagnosticsForced()
    if (forced && !enabled) useSettingsStore.getState().setAnonymousDiagnosticsEnabled(true)
    if (__DEV__) console.log('[sentry] consent sync fired, anonymousDiagnosticsEnabled =', enabled, forced ? '(forced on in DEV)' : '')
    void setAnonymousDiagnosticsEnabled(enabled || forced)
  }, [enabled])
}
