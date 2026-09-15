import { TerminalRawModeToast } from '@/components/terminal/TerminalRawModeToast'
import { renderWithI18n } from '@/test-utils/render'

describe('TerminalRawModeToast', () => {
  it('renders the unfiltered-output note when visible', async () => {
    const { getByTestId, getByText } = await renderWithI18n(
      <TerminalRawModeToast visible />,
    )
    getByTestId('terminal-raw-mode-note')
    getByText(/RAW terminal mode/)
    getByText(/showing the stream unfiltered/)
  })

  it('renders nothing when hidden', async () => {
    const { queryByTestId } = await renderWithI18n(
      <TerminalRawModeToast visible={false} />,
    )
    expect(queryByTestId('terminal-raw-mode-note')).toBeNull()
  })
})
