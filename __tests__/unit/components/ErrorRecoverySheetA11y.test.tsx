import { ErrorRecoverySheet } from '@/components/ui/ErrorRecoverySheet'
import { renderWithI18n } from '@/test-utils/render'

// @gorhom/bottom-sheet defaults `accessible` to true on the container wrapping
// the sheet's children (DEFAULT_ACCESSIBLE). On iOS an accessible View is a
// single accessibility element and its descendants are hidden, so the whole
// sheet collapsed into one opaque node labelled "Bottom Sheet" — VoiceOver
// could not reach the title, any error row, Retry all or Close, and neither
// could XCUITest. Confirmed on a simulator by pairing to a mock server, killing
// it so the sheet auto-opened, and dumping the accessibility hierarchy.
describe('ErrorRecoverySheet accessibility', () => {
  it('opts the sheet container out of being one accessibility element', async () => {
    const { getByTestId } = await renderWithI18n(
      <ErrorRecoverySheet
        visible
        title="Some requests failed"
        items={[{ id: 'messages', title: 'Messages failed', message: 'boom' }]}
        onClose={() => {}}
      />,
    )

    expect(getByTestId('bottom-sheet').props.accessible).toBe(false)
  })

  it('leaves the sheet controls individually reachable', async () => {
    const { getByTestId } = await renderWithI18n(
      <ErrorRecoverySheet
        visible
        title="Some requests failed"
        items={[{ id: 'messages', title: 'Messages failed', message: 'boom' }]}
        onClose={() => {}}
      />,
    )

    getByTestId('error-recovery-sheet')
    getByTestId('error-sheet-row-messages')
    getByTestId('error-sheet-close')
  })
})
