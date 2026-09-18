import { isQaForceDiagnosticsConsentUi } from '@/lib/diagnosticsConsentFlag'

const globalWithDev = global as typeof global & { __DEV__: boolean }

describe('isQaForceDiagnosticsConsentUi', () => {
  const previous = process.env.EXPO_PUBLIC_QA_FORCE_DIAGNOSTICS_CONSENT_UI
  const previousDev = globalWithDev.__DEV__

  afterEach(() => {
    if (previous === undefined) delete process.env.EXPO_PUBLIC_QA_FORCE_DIAGNOSTICS_CONSENT_UI
    else process.env.EXPO_PUBLIC_QA_FORCE_DIAGNOSTICS_CONSENT_UI = previous
    globalWithDev.__DEV__ = previousDev
  })

  it('is off when the env var is unset, even in a dev bundle', () => {
    globalWithDev.__DEV__ = true
    delete process.env.EXPO_PUBLIC_QA_FORCE_DIAGNOSTICS_CONSENT_UI
    expect(isQaForceDiagnosticsConsentUi()).toBe(false)
  })

  it('is off for any value other than 1', () => {
    globalWithDev.__DEV__ = true
    process.env.EXPO_PUBLIC_QA_FORCE_DIAGNOSTICS_CONSENT_UI = 'true'
    expect(isQaForceDiagnosticsConsentUi()).toBe(false)
    process.env.EXPO_PUBLIC_QA_FORCE_DIAGNOSTICS_CONSENT_UI = '0'
    expect(isQaForceDiagnosticsConsentUi()).toBe(false)
  })

  it('is on when the env var is exactly 1 in a dev bundle', () => {
    globalWithDev.__DEV__ = true
    process.env.EXPO_PUBLIC_QA_FORCE_DIAGNOSTICS_CONSENT_UI = '1'
    expect(isQaForceDiagnosticsConsentUi()).toBe(true)
  })

  it('is off in a production bundle even when the env var is 1', () => {
    globalWithDev.__DEV__ = false
    process.env.EXPO_PUBLIC_QA_FORCE_DIAGNOSTICS_CONSENT_UI = '1'
    expect(isQaForceDiagnosticsConsentUi()).toBe(false)
  })
})
