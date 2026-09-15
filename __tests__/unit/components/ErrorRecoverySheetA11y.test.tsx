import { AlertHost } from '@/components/alerts/AlertHost'
import { useAlertStore } from '@/stores/alerts'
import { useErrorSheetStore } from '@/stores/errorSheet'
import { useLoadingStateStore } from '@/stores/loading-state'
import { useServerFetchStatusStore } from '@/stores/serverFetchStatus'
import { useServersStore } from '@/stores/servers'
import { renderWithI18n } from '@/test-utils/render'
import { serverCause } from '@/types/alerts'

// @gorhom/bottom-sheet defaults `accessible` to true on the container wrapping
// the sheet's children (DEFAULT_ACCESSIBLE). On iOS an accessible View is a
// single accessibility element and its descendants are hidden, so the whole
// sheet collapsed into one opaque node labelled "Bottom Sheet" — VoiceOver
// could not reach the title, any error row, Retry everything or Close, and neither
// could XCUITest. Confirmed on a simulator by pairing to a mock server, killing
// it so the sheet auto-opened, and dumping the accessibility hierarchy.
describe('StatusSheet accessibility', () => {
  beforeEach(() => {
    useAlertStore.getState().reset()
    useErrorSheetStore.setState({ open: false })
    useLoadingStateStore.setState({ errors: [], dismissed: [] })
    useServerFetchStatusStore.setState({ statuses: {} })
    useServersStore.setState({ servers: {} })
    useAlertStore.getState().upsert({
      id: 'messages',
      viewport: 'global',
      cause: serverCause('messages'),
      level: 'error',
      title: 'Messages failed',
      message: 'boom',
      timeout: null,
    })
    useErrorSheetStore.setState({ open: true })
  })

  it('opts the sheet container out of being one accessibility element', async () => {
    const { getByTestId } = await renderWithI18n(<AlertHost />)

    expect(getByTestId('bottom-sheet').props.accessible).toBe(false)
  })

  it('leaves the sheet controls individually reachable', async () => {
    const { getByTestId } = await renderWithI18n(<AlertHost />)

    getByTestId('status-sheet')
    getByTestId('error-sheet-row-messages')
    getByTestId('error-sheet-close')
  })
})
