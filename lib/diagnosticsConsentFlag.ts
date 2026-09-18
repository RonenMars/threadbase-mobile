/**
 * QA-only presentation override for the Anonymous Diagnostics consent UI.
 *
 * This may force consent UI visibility, but must never alter persisted
 * diagnostics consent or Sentry transmission authorization
 * (`beforeSend` / `beforeBreadcrumb`, `isAnonymousDiagnosticsEnabled`,
 * `setAnonymousDiagnosticsEnabled`). It only decides whether the consent
 * surfaces render.
 *
 * Active only when BOTH are true:
 * - the JS bundle is a dev bundle (`__DEV__`)
 * - `EXPO_PUBLIC_QA_FORCE_DIAGNOSTICS_CONSENT_UI=1` is inlined from `.env` /
 *   `.env.local` (a shell export alone does not reach the client)
 *
 * The `__DEV__` gate is the trust boundary, evaluated here at the point the
 * override is interpreted: a Release/production bundle never honours it, even
 * if the env var was set to `1` at build time. Restart Metro with `--clear`
 * after changing it.
 *
 * Unlike `EXPO_PUBLIC_FORCE_DIAGNOSTICS_VARIANT`, this is checked at render
 * time, so it still shows the consent UI after the 40/60 experiment arm has
 * already been persisted as control — without rewriting that assignment.
 */
export function isQaForceDiagnosticsConsentUi(): boolean {
  return __DEV__ && process.env.EXPO_PUBLIC_QA_FORCE_DIAGNOSTICS_CONSENT_UI === '1'
}
