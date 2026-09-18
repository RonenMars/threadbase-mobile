import { Alert } from 'react-native'
import { fireEvent } from '@testing-library/react-native'
import { AnonymousDiagnosticsConsentBanner } from '@/components/diagnostics/AnonymousDiagnosticsConsentBanner'
import { isQaForceDiagnosticsConsentUi } from '@/lib/diagnosticsConsentFlag'
import { useSettingsStore } from '@/stores/settings'
import { renderWithI18n } from '@/test-utils/render'

jest.mock('@/lib/diagnosticsConsentFlag', () => ({
  isQaForceDiagnosticsConsentUi: jest.fn(() => false),
}))

const isQaForceUi = isQaForceDiagnosticsConsentUi as jest.MockedFunction<
  typeof isQaForceDiagnosticsConsentUi
>

describe('AnonymousDiagnosticsConsentBanner', () => {
  beforeEach(() => {
    isQaForceUi.mockReturnValue(false)
    useSettingsStore.setState({ anonymousDiagnosticsEnabled: false })
    jest.spyOn(Alert, 'alert').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('renders nothing when the env flag is off', async () => {
    const { toJSON } = await renderWithI18n(<AnonymousDiagnosticsConsentBanner />)
    expect(toJSON()).toBeNull()
  })

  it('renders the consent card when the env flag is on', async () => {
    isQaForceUi.mockReturnValue(true)
    const { getByTestId, getByText } = await renderWithI18n(<AnonymousDiagnosticsConsentBanner />)
    expect(getByTestId('diagnostics-consent-banner')).toBeTruthy()
    expect(getByText('Anonymous diagnostics')).toBeTruthy()
  })

  it('renders when forceVisible is set even if the env flag is off', async () => {
    const { getByTestId } = await renderWithI18n(
      <AnonymousDiagnosticsConsentBanner forceVisible />,
    )
    expect(getByTestId('diagnostics-consent-banner')).toBeTruthy()
  })

  it('turning the switch on grants standing consent', async () => {
    isQaForceUi.mockReturnValue(true)
    const { getByTestId } = await renderWithI18n(<AnonymousDiagnosticsConsentBanner />)
    fireEvent(getByTestId('diagnostics-consent-banner-toggle'), 'valueChange', true)
    expect(useSettingsStore.getState().anonymousDiagnosticsEnabled).toBe(true)
  })

  it('Learn more opens the disclosure alert', async () => {
    isQaForceUi.mockReturnValue(true)
    const { getByTestId } = await renderWithI18n(<AnonymousDiagnosticsConsentBanner />)
    fireEvent.press(getByTestId('diagnostics-consent-banner-learn-more'))
    expect(Alert.alert).toHaveBeenCalled()
  })
})
