import { render, fireEvent, waitFor } from '@testing-library/react-native'
import { RootErrorBoundaryFallback } from '@/components/RootErrorBoundary'
import { useSettingsStore } from '@/stores/settings'
import { reportOneShot } from '@/services/sentry'

jest.mock('@/services/sentry', () => ({
  captureHandledError: jest.fn(),
  reportOneShot: jest.fn(),
}))

describe('RootErrorBoundaryFallback — Anonymous Diagnostics checkbox (spec §8)', () => {
  beforeEach(() => {
    useSettingsStore.setState({ anonymousDiagnosticsEnabled: false })
    ;(reportOneShot as jest.Mock).mockReset()
  })

  it('shows an unchecked checkbox and a Report button while consent is OFF', async () => {
    const { getByTestId } = await render(
      <RootErrorBoundaryFallback onReload={jest.fn()} error={new Error('boom')} />,
    )
    const checkbox = getByTestId('error-boundary-diagnostics-checkbox')
    expect(checkbox.props.accessibilityState.checked).toBe(false)
    expect(getByTestId('error-boundary-report')).toBeTruthy()
  })

  it('sends only the current crash when the checkbox stays unchecked (criterion 6)', async () => {
    ;(reportOneShot as jest.Mock).mockResolvedValue('evt_1')
    const { getByTestId } = await render(
      <RootErrorBoundaryFallback onReload={jest.fn()} error={new Error('boom')} />,
    )
    fireEvent.press(getByTestId('error-boundary-report'))
    await waitFor(() => expect(reportOneShot).toHaveBeenCalledTimes(1))
    expect(useSettingsStore.getState().anonymousDiagnosticsEnabled).toBe(false)
  })

  it('enables standing consent only after checking the box AND submitting (criterion 8)', async () => {
    ;(reportOneShot as jest.Mock).mockResolvedValue('evt_1')
    const { getByTestId } = await render(
      <RootErrorBoundaryFallback onReload={jest.fn()} error={new Error('boom')} />,
    )
    const checkbox = getByTestId('error-boundary-diagnostics-checkbox')
    fireEvent.press(checkbox)
    await waitFor(() => expect(checkbox.props.accessibilityState.checked).toBe(true))
    expect(useSettingsStore.getState().anonymousDiagnosticsEnabled).toBe(false) // checking alone does nothing
    fireEvent.press(getByTestId('error-boundary-report'))
    await waitFor(() => expect(useSettingsStore.getState().anonymousDiagnosticsEnabled).toBe(true))
  })

  it('leaves consent OFF if the box is checked but Report is never pressed', async () => {
    const { getByTestId } = await render(
      <RootErrorBoundaryFallback onReload={jest.fn()} error={new Error('boom')} />,
    )
    const checkbox = getByTestId('error-boundary-diagnostics-checkbox')
    fireEvent.press(checkbox)
    await waitFor(() => expect(checkbox.props.accessibilityState.checked).toBe(true))
    expect(useSettingsStore.getState().anonymousDiagnosticsEnabled).toBe(false)
    expect(reportOneShot).not.toHaveBeenCalled()
  })

  it('does not enable consent when the report fails even with the box checked', async () => {
    ;(reportOneShot as jest.Mock).mockResolvedValue(undefined)
    const { getByTestId } = await render(
      <RootErrorBoundaryFallback onReload={jest.fn()} error={new Error('boom')} />,
    )
    const checkbox = getByTestId('error-boundary-diagnostics-checkbox')
    fireEvent.press(checkbox)
    await waitFor(() => expect(checkbox.props.accessibilityState.checked).toBe(true))
    fireEvent.press(getByTestId('error-boundary-report'))
    await waitFor(() => expect(reportOneShot).toHaveBeenCalledTimes(1))
    expect(useSettingsStore.getState().anonymousDiagnosticsEnabled).toBe(false)
  })

  it('hides the checkbox and report button while consent is already ON (avoids duplicate reporting)', async () => {
    useSettingsStore.setState({ anonymousDiagnosticsEnabled: true })
    const { queryByTestId } = await render(
      <RootErrorBoundaryFallback onReload={jest.fn()} error={new Error('boom')} />,
    )
    expect(queryByTestId('error-boundary-diagnostics-checkbox')).toBeNull()
    expect(queryByTestId('error-boundary-report')).toBeNull()
  })

  it('never shows the checkbox/report row when there is no error to report', async () => {
    const { queryByTestId } = await render(<RootErrorBoundaryFallback onReload={jest.fn()} />)
    expect(queryByTestId('error-boundary-diagnostics-checkbox')).toBeNull()
    expect(queryByTestId('error-boundary-report')).toBeNull()
  })
})
