import { renderHook } from '@testing-library/react-native'
import { useCrashReportingSync } from '@/hooks/useCrashReportingSync'
import { isSentryTrackingEnforced, setAnonymousDiagnosticsEnabled } from '@/services/sentry'
import { useSettingsStore } from '@/stores/settings'

jest.mock('@/services/sentry', () => ({
  currentDiagnosticsTermsKey: jest.fn(() => 'standard-1'),
  isSentryTrackingEnforced: jest.fn(() => false),
  setAnonymousDiagnosticsEnabled: jest.fn(async () => {}),
}))

const setConsent = setAnonymousDiagnosticsEnabled as jest.MockedFunction<typeof setAnonymousDiagnosticsEnabled>
const enforced = isSentryTrackingEnforced as jest.MockedFunction<typeof isSentryTrackingEnforced>

describe('useCrashReportingSync', () => {
  beforeEach(() => {
    setConsent.mockClear()
    enforced.mockReturnValue(false)
  })

  it('applies nothing before settings hydrate', async () => {
    useSettingsStore.setState({ hydrated: false, anonymousDiagnosticsEnabled: true, diagnosticsTermsAccepted: 'standard-1' })
    await renderHook(() => useCrashReportingSync())
    expect(setConsent).not.toHaveBeenCalled()
  })

  it('keeps consent off while the current terms are unanswered, whatever the stored toggle says', async () => {
    useSettingsStore.setState({ hydrated: true, anonymousDiagnosticsEnabled: true, diagnosticsTermsAccepted: 'enforced-1' })
    await renderHook(() => useCrashReportingSync())
    expect(setConsent).toHaveBeenLastCalledWith(false)
  })

  it('applies the stored toggle once the terms are answered', async () => {
    useSettingsStore.setState({ hydrated: true, anonymousDiagnosticsEnabled: true, diagnosticsTermsAccepted: 'standard-1' })
    await renderHook(() => useCrashReportingSync())
    expect(setConsent).toHaveBeenLastCalledWith(true)
  })

  it('does not force an enforced build on before the user agrees', async () => {
    enforced.mockReturnValue(true)
    useSettingsStore.setState({ hydrated: true, anonymousDiagnosticsEnabled: false, diagnosticsTermsAccepted: null })
    await renderHook(() => useCrashReportingSync())
    expect(setConsent).toHaveBeenLastCalledWith(false)
    expect(useSettingsStore.getState().anonymousDiagnosticsEnabled).toBe(false)
  })
})
