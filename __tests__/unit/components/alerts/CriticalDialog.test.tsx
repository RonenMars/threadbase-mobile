import { fireEvent } from '@testing-library/react-native'
import { CriticalDialog } from '@/components/alerts/CriticalDialog'
import { renderWithI18n } from '@/test-utils/render'

describe('CriticalDialog', () => {
  it('shows the title and a destructive action when visible', async () => {
    const onTakeOver = jest.fn()
    const { getByTestId, getByText } = await renderWithI18n(
      <CriticalDialog
        visible
        title="Resume this conversation?"
        message="This conversation may still be open."
        onRequestClose={() => {}}
        actions={[
          { label: 'Cancel', variant: 'secondary', onPress: () => {}, testID: 'critical-cancel' },
          { label: 'Take over', variant: 'destructive', onPress: onTakeOver, testID: 'critical-take-over' },
        ]}
      />,
    )

    getByTestId('critical-dialog')
    getByText('Resume this conversation?')
    fireEvent.press(getByTestId('critical-take-over'))
    expect(onTakeOver).toHaveBeenCalledTimes(1)
  })

  it('hides chrome when not visible', async () => {
    const { queryByTestId } = await renderWithI18n(
      <CriticalDialog visible={false} title="Hidden" onRequestClose={() => {}} />,
    )
    expect(queryByTestId('critical-dialog')).toBeNull()
  })

  it('labels the dialog as critical by default', async () => {
    const { getByTestId } = await renderWithI18n(
      <CriticalDialog visible title="Heads up" onRequestClose={() => {}} />,
    )
    expect(getByTestId('critical-dialog').props.accessibilityLabel).toBe('Critical. Heads up')
  })

  it('labels the dialog by the level it is given', async () => {
    const { getByTestId } = await renderWithI18n(
      <CriticalDialog visible level="warning" title="Heads up" onRequestClose={() => {}} />,
    )
    expect(getByTestId('critical-dialog').props.accessibilityLabel).toBe('Warning. Heads up')
  })
})
