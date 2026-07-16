import { useEffect } from 'react'
import { useSettingsStore } from '@/stores/settings'
import { setCrashReportingEnabled } from '@/services/sentry'

/**
 * Keeps the Sentry client in lockstep with the persisted consent setting.
 *
 * - On mount (after settings hydrate) it initializes Sentry iff consent is on.
 * - Whenever the consent toggle flips, it initializes or immediately tears down
 *   the client so disabling stops reporting right away.
 *
 * `setCrashReportingEnabled` is itself gated (DSN + environment + consent) and
 * never throws, so this hook is safe to run unconditionally at the app root.
 */
export function useCrashReportingSync(): void {
  const enabled = useSettingsStore((s) => s.crashReportingEnabled)

  useEffect(() => {
    if (__DEV__) console.log('[sentry] consent sync fired, crashReportingEnabled =', enabled)
    void setCrashReportingEnabled(enabled)
  }, [enabled])
}
