import { render, fireEvent } from '@testing-library/react-native'
import i18n from '@/test-utils/i18n-setup'
import { DoneStep } from '@/components/onboarding/steps/DoneStep'
import { useSettingsStore } from '@/stores/settings'

describe('DoneStep — Anonymous Diagnostics onboarding experiment (spec §7)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
    useSettingsStore.setState({
      onboardingDiagnosticsExperimentVariant: null,
      anonymousDiagnosticsEnabled: false,
    })
  })

  it('shows no diagnostics prompt for the control arm', async () => {
    useSettingsStore.setState({ onboardingDiagnosticsExperimentVariant: 'control' })
    const { queryByTestId } = await render(<DoneStep onEnter={jest.fn()} />)
    expect(queryByTestId('onboarding-diagnostics-row')).toBeNull()
    expect(queryByTestId('onboarding-diagnostics-toggle')).toBeNull()
  })

  it('shows the toggle, defaulted OFF, for the treatment arm (criteria 3, 4)', async () => {
    useSettingsStore.setState({ onboardingDiagnosticsExperimentVariant: 'treatment' })
    const { getByTestId } = await render(<DoneStep onEnter={jest.fn()} />)
    expect(getByTestId('onboarding-diagnostics-row')).toBeTruthy()
    expect(useSettingsStore.getState().anonymousDiagnosticsEnabled).toBe(false)
  })

  it('turning it ON grants standing consent', async () => {
    useSettingsStore.setState({ onboardingDiagnosticsExperimentVariant: 'treatment' })
    const { getByTestId } = await render(<DoneStep onEnter={jest.fn()} />)
    fireEvent(getByTestId('onboarding-diagnostics-toggle'), 'valueChange', true)
    expect(useSettingsStore.getState().anonymousDiagnosticsEnabled).toBe(true)
  })

  it('Continue works regardless of the toggle state (criterion 5)', async () => {
    useSettingsStore.setState({ onboardingDiagnosticsExperimentVariant: 'treatment' })
    const onEnter = jest.fn()
    const { getByTestId } = await render(<DoneStep onEnter={onEnter} />)
    fireEvent.press(getByTestId('onboarding-done-cta'))
    expect(onEnter).toHaveBeenCalledTimes(1)
    // Leaving it OFF is neutral — no suppression flag is written anywhere.
    expect(useSettingsStore.getState().anonymousDiagnosticsEnabled).toBe(false)
  })
})
