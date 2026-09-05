import { ErrorBanner } from '@/components/ErrorBanner'
import { useLoadingStateStore } from '@/stores/loading-state'
import { useServerFetchStatusStore } from '@/stores/serverFetchStatus'
import { useServersStore } from '@/stores/servers'
import { useErrorSheetStore } from '@/stores/errorSheet'
import { renderWithI18n } from '@/test-utils/render'
import { queryClient } from '@/services/query-client'
import { fireEvent, waitFor } from '@testing-library/react-native'

describe('ErrorBanner category rows', () => {
  beforeEach(() => {
    useErrorSheetStore.setState({ open: false })
    useLoadingStateStore.setState({ errors: [], dismissed: [] })
    useServerFetchStatusStore.setState({ statuses: {} })
    useServersStore.setState({ servers: {} })
  })

  it('single error: shows Retry, no Retry all, and a code/raw-message technical row', async () => {
    useLoadingStateStore.setState({
      errors: [{ id: 'messages', category: 'messages', status: 503, message: 'The server is busy; retrying shortly' }],
    })
    const { getByTestId, findByText, queryByText } = await renderWithI18n(<ErrorBanner />)

    getByTestId('error-sheet-retry-messages')
    expect(queryByText('Retry all')).toBeNull()

    fireEvent.press(getByTestId('error-sheet-row-messages'))
    await findByText('HTTP_503')
    await findByText('The server is busy; retrying shortly')
  })

  it('multiple errors: lists every failure and shows Retry all', async () => {
    useLoadingStateStore.setState({
      errors: [
        { id: 'messages', category: 'messages', message: 'boom' },
        { id: 'session-detail', category: 'session-detail', message: 'boom too' },
      ],
    })
    const { getByTestId, getByText } = await renderWithI18n(<ErrorBanner />)

    getByTestId('error-sheet-row-messages')
    getByTestId('error-sheet-row-session-detail')
    getByText('Retry all')
  })

  it('retry success removes the row from the sheet', async () => {
    useLoadingStateStore.setState({
      errors: [{ id: 'messages', category: 'messages', message: 'boom' }],
    })
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined)
    const { getByTestId, queryByTestId } = await renderWithI18n(<ErrorBanner />)

    fireEvent.press(getByTestId('error-sheet-retry-messages'))
    await new Promise((r) => setTimeout(r, 0))
    expect(queryByTestId('error-sheet-row-messages')).toBeNull()
    invalidate.mockRestore()
  })

  it('retry partial success: resolving one error leaves the other visible', async () => {
    useLoadingStateStore.setState({
      errors: [
        { id: 'messages', category: 'messages', message: 'boom' },
        { id: 'session-detail', category: 'session-detail', message: 'boom too' },
      ],
    })
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined)
    const { getByTestId, queryByTestId } = await renderWithI18n(<ErrorBanner />)

    fireEvent.press(getByTestId('error-sheet-retry-messages'))
    await new Promise((r) => setTimeout(r, 0))

    expect(queryByTestId('error-sheet-row-messages')).toBeNull()
    getByTestId('error-sheet-row-session-detail')
    invalidate.mockRestore()
  })

  it('dismissing the sheet keeps the errors sticky and shows the compact indicator, which reopens it', async () => {
    useLoadingStateStore.setState({
      errors: [{ id: 'messages', category: 'messages', message: 'boom' }],
    })
    const { getByTestId, queryByTestId, findByTestId } = await renderWithI18n(<ErrorBanner />)

    getByTestId('error-recovery-sheet')
    fireEvent.press(getByTestId('error-sheet-close'))

    await waitFor(() => expect(queryByTestId('error-recovery-sheet')).toBeNull())
    const indicator = await findByTestId('issues-indicator')
    fireEvent.press(indicator)
    await findByTestId('error-recovery-sheet')
  })

  it('excludes browse-category failures from the sheet entirely', async () => {
    useLoadingStateStore.setState({
      errors: [{ id: 'browse', category: 'browse', message: 'file tree down' }],
    })
    const { queryByTestId } = await renderWithI18n(<ErrorBanner />)

    expect(queryByTestId('error-recovery-sheet')).toBeNull()
    expect(queryByTestId('issues-indicator')).toBeNull()
  })

  it('keeps blocking auth failures out of the global recovery sheet', async () => {
    useLoadingStateStore.setState({
      errors: [{ id: 'sessions', category: 'sessions', status: 401, message: 'expired' }],
    })
    const { queryByTestId } = await renderWithI18n(<ErrorBanner />)

    expect(queryByTestId('error-recovery-sheet')).toBeNull()
    expect(queryByTestId('issues-indicator')).toBeNull()
  })
})
