import { AlertHost } from '@/components/alerts/AlertHost'
import { useLoadingStateStore } from '@/stores/loading-state'
import { useServerFetchStatusStore } from '@/stores/serverFetchStatus'
import { useServersStore } from '@/stores/servers'
import { useErrorSheetStore } from '@/stores/errorSheet'
import { useAlertStore } from '@/stores/alerts'
import { renderWithI18n } from '@/test-utils/render'
import { queryClient } from '@/services/query-client'
import { act, fireEvent, waitFor } from '@testing-library/react-native'

describe('Status sheet category rows', () => {
  beforeEach(() => {
    useErrorSheetStore.setState({ open: false })
    useAlertStore.getState().reset()
    useLoadingStateStore.setState({ errors: [], dismissed: [] })
    useServerFetchStatusStore.setState({ statuses: {} })
    useServersStore.setState({ servers: {} })
  })

  it('does not auto-open the status sheet', async () => {
    useLoadingStateStore.setState({
      errors: [{ id: 'messages', category: 'messages', message: 'boom' }],
    })
    const { queryByTestId } = await renderWithI18n(<AlertHost />)
    expect(queryByTestId('status-sheet')).toBeNull()
    expect(useErrorSheetStore.getState().open).toBe(false)
  })

  it('single error: shows Retry, no Retry everything, and a code/raw-message technical row', async () => {
    useLoadingStateStore.setState({
      errors: [{ id: 'messages', category: 'messages', status: 503, message: 'The server is busy; retrying shortly' }],
    })
    useErrorSheetStore.setState({ open: true })
    const { getByTestId, findByText, queryByText } = await renderWithI18n(<AlertHost />)

    getByTestId('error-sheet-retry-messages')
    expect(queryByText('Retry everything')).toBeNull()

    fireEvent.press(getByTestId('status-row-details-messages'))
    await findByText('HTTP_503')
    await findByText('The server is busy; retrying shortly')
  })

  it('multiple errors: lists every failure and shows Retry everything', async () => {
    useLoadingStateStore.setState({
      errors: [
        { id: 'messages', category: 'messages', message: 'boom' },
        { id: 'session-detail', category: 'session-detail', message: 'boom too' },
      ],
    })
    useErrorSheetStore.setState({ open: true })
    const { getByTestId, getByText } = await renderWithI18n(<AlertHost />)

    getByTestId('error-sheet-row-messages')
    getByTestId('error-sheet-row-session-detail')
    getByText('Retry everything')
  })

  it('retry success removes the row from the sheet', async () => {
    useLoadingStateStore.setState({
      errors: [{ id: 'messages', category: 'messages', message: 'boom' }],
    })
    useErrorSheetStore.setState({ open: true })
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined)
    const { getByTestId, queryByTestId } = await renderWithI18n(<AlertHost />)

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
    useErrorSheetStore.setState({ open: true })
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined)
    const { getByTestId, queryByTestId } = await renderWithI18n(<AlertHost />)

    fireEvent.press(getByTestId('error-sheet-retry-messages'))
    await new Promise((r) => setTimeout(r, 0))

    expect(queryByTestId('error-sheet-row-messages')).toBeNull()
    getByTestId('error-sheet-row-session-detail')
    invalidate.mockRestore()
  })

  it('closing the sheet is a minimize — opening it again shows the same errors', async () => {
    useLoadingStateStore.setState({
      errors: [{ id: 'messages', category: 'messages', message: 'boom' }],
    })
    useErrorSheetStore.setState({ open: true })
    const { getByTestId, queryByTestId, findByTestId } = await renderWithI18n(<AlertHost />)

    getByTestId('status-sheet')
    fireEvent.press(getByTestId('error-sheet-close'))

    await waitFor(() => expect(queryByTestId('status-sheet')).toBeNull())
    expect(useLoadingStateStore.getState().errors).toHaveLength(1)

    await act(async () => {
      useErrorSheetStore.getState().openSheet()
    })
    await findByTestId('status-sheet')
  })

  it('excludes browse-category failures from the sheet entirely', async () => {
    useLoadingStateStore.setState({
      errors: [{ id: 'browse', category: 'browse', message: 'file tree down' }],
    })
    useErrorSheetStore.setState({ open: true })
    const { queryByTestId } = await renderWithI18n(<AlertHost />)

    expect(queryByTestId('status-sheet')).toBeNull()
  })

  it('keeps blocking auth failures out of the global status sheet', async () => {
    useLoadingStateStore.setState({
      errors: [{ id: 'sessions', category: 'sessions', status: 401, message: 'expired' }],
    })
    useErrorSheetStore.setState({ open: true })
    const { queryByTestId } = await renderWithI18n(<AlertHost />)

    expect(queryByTestId('status-sheet')).toBeNull()
  })

  it('omits Retry when classifyError marks the failure not retryable', async () => {
    useLoadingStateStore.setState({
      errors: [{ id: 'messages', category: 'messages', status: 404, message: 'gone' }],
    })
    useErrorSheetStore.setState({ open: true })
    const { getByTestId, queryByTestId, findByText } = await renderWithI18n(<AlertHost />)

    getByTestId('error-sheet-row-messages')
    expect(queryByTestId('error-sheet-retry-messages')).toBeNull()
    fireEvent.press(getByTestId('status-row-details-messages'))
    await findByText('HTTP_404')
    await findByText('gone')
  })
})
