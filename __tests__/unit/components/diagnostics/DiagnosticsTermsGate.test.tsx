import { fireEvent, waitFor } from '@testing-library/react-native'
import { DiagnosticsTermsGate } from '@/components/diagnostics/DiagnosticsTermsGate'
import { diagnosticsTermsApply, isSentryTrackingEnforced } from '@/services/sentry'
import { useSettingsStore } from '@/stores/settings'
import { renderWithI18n } from '@/test-utils/render'

jest.mock('@/services/sentry', () => ({
  diagnosticsTermsApply: jest.fn(() => true),
  isSentryTrackingEnforced: jest.fn(() => false),
  currentDiagnosticsTermsKey: jest.fn(() => 'standard-1'),
}))

const applies = diagnosticsTermsApply as jest.MockedFunction<typeof diagnosticsTermsApply>
const enforced = isSentryTrackingEnforced as jest.MockedFunction<typeof isSentryTrackingEnforced>

describe('DiagnosticsTermsGate', () => {
  beforeEach(() => {
    applies.mockReturnValue(true)
    enforced.mockReturnValue(false)
    useSettingsStore.setState({ hydrated: true, diagnosticsTermsAccepted: null, anonymousDiagnosticsEnabled: true })
  })

  it('blocks the app until the current terms are answered', async () => {
    const { getByTestId } = await renderWithI18n(<DiagnosticsTermsGate />)
    expect(getByTestId('diagnostics-terms-gate')).toBeTruthy()
  })

  it('stays hidden before settings hydrate, so a returning user never sees a flash', async () => {
    useSettingsStore.setState({ hydrated: false })
    const { toJSON } = await renderWithI18n(<DiagnosticsTermsGate />)
    expect(toJSON()).toBeNull()
  })

  it('stays hidden when the build cannot send anything', async () => {
    applies.mockReturnValue(false)
    const { toJSON } = await renderWithI18n(<DiagnosticsTermsGate />)
    expect(toJSON()).toBeNull()
  })

  it('stays hidden once these terms are answered, and returns for different ones', async () => {
    useSettingsStore.setState({ diagnosticsTermsAccepted: 'standard-1' })
    expect((await renderWithI18n(<DiagnosticsTermsGate />)).toJSON()).toBeNull()
    useSettingsStore.setState({ diagnosticsTermsAccepted: 'enforced-1' })
    expect((await renderWithI18n(<DiagnosticsTermsGate />)).getByTestId('diagnostics-terms-gate')).toBeTruthy()
  })

  it("Don't allow records the answer with consent off, even if it was on before", async () => {
    const { getByTestId, queryByTestId } = await renderWithI18n(<DiagnosticsTermsGate />)
    fireEvent.press(getByTestId('diagnostics-terms-decline'))
    expect(useSettingsStore.getState()).toMatchObject({ diagnosticsTermsAccepted: 'standard-1', anonymousDiagnosticsEnabled: false })
    await waitFor(() => expect(queryByTestId('diagnostics-terms-gate')).toBeNull())
  })

  it('Allow records the answer with consent on', async () => {
    useSettingsStore.setState({ anonymousDiagnosticsEnabled: false })
    const { getByTestId } = await renderWithI18n(<DiagnosticsTermsGate />)
    fireEvent.press(getByTestId('diagnostics-terms-allow'))
    expect(useSettingsStore.getState()).toMatchObject({ diagnosticsTermsAccepted: 'standard-1', anonymousDiagnosticsEnabled: true })
  })

  it('offers only agreement on an enforced build', async () => {
    enforced.mockReturnValue(true)
    const { getByText, queryByTestId } = await renderWithI18n(<DiagnosticsTermsGate />)
    expect(getByText('I agree')).toBeTruthy()
    expect(queryByTestId('diagnostics-terms-decline')).toBeNull()
  })
})
