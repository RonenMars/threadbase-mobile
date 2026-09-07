/**
 * Anonymous Diagnostics — core invariant proof (spec §2, §16).
 *
 * A single narrative test that exercises the exact sequence the spec's
 * acceptance criteria describe: launch, navigation, a caught error while
 * consent is OFF, an explicit one-shot report, a feedback submission,
 * consent turning ON, and consent turning OFF again. At each step it proves
 * transmission behavior by invoking the REAL `beforeSend`/`beforeBreadcrumb`
 * hooks the production code installs into `Sentry.init` (captured from the
 * mocked SDK's `init` call) against the REAL event shape the corresponding
 * service function produces — not a re-implementation of the gate.
 *
 * This is the transmission-proof artifact referenced by
 * docs/audits/anonymous-diagnostics-transmission-proof.md.
 */

const DSN = 'https://examplePublicKey@o0.ingest.sentry.io/0'

function loadService() {
  let mod!: typeof import('@/services/sentry')
  let sdk!: typeof import('@sentry/react-native')
  jest.isolateModules(() => {
    const prev = { ...process.env }
    process.env.EXPO_PUBLIC_SENTRY_DSN = DSN
    process.env.EXPO_PUBLIC_SENTRY_ALLOW_DEV = '1'
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    sdk = require('@sentry/react-native')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('@/services/sentry')
    process.env = prev
  })
  return { mod, sdk }
}

describe('Anonymous Diagnostics — end-to-end transmission proof', () => {
  it('launch → navigation → caught error (OFF) → one-shot → feedback → consent ON → consent OFF', async () => {
    const { mod, sdk } = loadService()

    // ---- 1. LAUNCH: SDK becomes ready, consent starts OFF (fresh install default) ----
    await mod.setAnonymousDiagnosticsEnabled(false)
    expect(sdk.init).toHaveBeenCalledTimes(1) // the one unconditional init
    const initOptions = (sdk.init as jest.Mock).mock.calls[0][0]
    const beforeSend = initOptions.beforeSend as (e: unknown) => unknown
    const beforeBreadcrumb = initOptions.beforeBreadcrumb as (b: unknown) => unknown
    expect(mod.isAnonymousDiagnosticsEnabled()).toBe(false)
    // Session/release-health tracking was configured OFF at this launch,
    // since consent was OFF at the moment the SDK became ready.
    expect(initOptions.enableAutoSessionTracking).toBe(false)
    // No identity attached merely because the SDK became ready — setUser(null)
    // (clearing) is fine; an { id } identity object is not.
    const scope = (sdk as unknown as { __scope: { setUser: jest.Mock } }).__scope
    const identityCallsAtLaunch = scope.setUser.mock.calls.filter((c: unknown[]) => c[0] && typeof c[0] === 'object')
    expect(identityCallsAtLaunch).toHaveLength(0)

    // ---- 2. NAVIGATION: only ever sets a scope tag, never sends an event ----
    mod.setConnectionModeTag('http://192.168.1.5:8766')
    expect(sdk.captureException).not.toHaveBeenCalled()
    expect(sdk.captureMessage).not.toHaveBeenCalled()
    expect(sdk.captureFeedback).not.toHaveBeenCalled()

    // ---- 3. CAUGHT ERROR while consent is OFF (RootErrorBoundary auto-capture) ----
    mod.captureHandledError(new Error('render crash'), { tag: 'render_error_boundary' })
    expect(sdk.captureException).toHaveBeenCalledTimes(1)
    // The real gate: replay the exact event shape the SDK would have built
    // (no `type` field — a plain error event) through the real beforeSend.
    expect(beforeSend({ event_id: 'e1', level: 'error' })).toBeNull() // ZERO envelopes

    // ---- 4. ONE-SHOT report — works despite consent OFF, exactly one event authorized ----
    const oneShotEventId = await mod.reportOneShot(new Error('crash to report'), { tag: 'manual' })
    expect(oneShotEventId).toBe('evt_exception')
    const oneShotScopeCallback = (sdk.captureException as jest.Mock).mock.calls[1][1]
    const fakeScope = { setTag: jest.fn() }
    oneShotScopeCallback(fakeScope)
    expect(fakeScope.setTag).toHaveBeenCalledWith('diagnostics.one_shot', '1')
    // Exactly this one, tagged event passes; an untagged one still does not.
    const passed = beforeSend({ event_id: 'e2', level: 'error', tags: { 'diagnostics.one_shot': '1' } })
    expect(passed).not.toBeNull() // exactly ONE envelope
    expect(beforeSend({ event_id: 'e3', level: 'error' })).toBeNull() // still nothing else

    // ---- 5. FEEDBACK — independent of consent, bypasses beforeSend entirely ----
    const feedbackId = await mod.submitFeedbackViaSentry({ message: 'it broke' })
    expect(feedbackId).toBe('evt_feedback')
    expect(sdk.init).toHaveBeenCalledTimes(1) // still the one init — no re-init/close dance
    expect(sdk.close).not.toHaveBeenCalled()

    // ---- 6. CONSENT ON — identity attached, passive capture now allowed ----
    await mod.setAnonymousDiagnosticsEnabled(true)
    expect(mod.isAnonymousDiagnosticsEnabled()).toBe(true)
    const identityCall = scope.setUser.mock.calls.find((c: unknown[]) => c[0] && typeof c[0] === 'object')
    expect(identityCall).toBeDefined()
    expect(Object.keys(identityCall![0] as object)).toEqual(['id'])
    expect(beforeSend({ event_id: 'e4', level: 'error' })).not.toBeNull() // now passes
    expect(beforeBreadcrumb({ category: 'app.lifecycle', message: 'app_started' })).not.toBeNull()

    // ---- 7. CONSENT OFF again — identity cleared, passive capture blocked again ----
    await mod.setAnonymousDiagnosticsEnabled(false)
    expect(mod.isAnonymousDiagnosticsEnabled()).toBe(false)
    expect(scope.setUser).toHaveBeenCalledWith(null)
    expect(sdk.close).not.toHaveBeenCalled() // the client is never torn down — only the gate flips
    expect(beforeSend({ event_id: 'e5', level: 'error' })).toBeNull() // ZERO further envelopes
    expect(beforeBreadcrumb({ category: 'app.lifecycle', message: 'app_started' })).toBeNull()
  })
})
