import { ErrorBanner } from '@/components/ErrorBanner'
import { useLoadingStateStore } from '@/stores/loading-state'
import { useServerFetchStatusStore } from '@/stores/serverFetchStatus'
import { useServersStore } from '@/stores/servers'
import { useErrorSheetStore } from '@/stores/errorSheet'
import { useAlertStore } from '@/stores/alerts'
import { renderWithI18n } from '@/test-utils/render'
import { queryClient } from '@/services/query-client'
import { act, fireEvent, waitFor } from '@testing-library/react-native'

describe('ErrorBanner category rows', () => {
  beforeEach(() => {
    useErrorSheetStore.setState({ open: false })
    useAlertStore.getState().reset()
    useLoadingStateStore.setState({ errors: [], dismissed: [] })
    useServerFetchStatusStore.setState({ statuses: {} })
    useServersStore.setState({ servers: {} })
  })

  it('does not auto-open the recovery sheet', async () => {
    useLoadingStateStore.setState({
      errors: [{ id: 'messages', category: 'messages', message: 'boom' }],
    })
    const { queryByTestId } = await renderWithI18n(<ErrorBanner />)
    expect(queryByTestId('error-recovery-sheet')).toBeNull()
    expect(useErrorSheetStore.getState().open).toBe(false)
  })

  it('single error: shows Retry, no Retry all, and a code/raw-message technical row', async () => {
    useLoadingStateStore.setState({
      errors: [{ id: 'messages', category: 'messages', status: 503, message: 'The server is busy; retrying shortly' }],
    })
    useErrorSheetStore.setState({ open: true })
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
    useErrorSheetStore.setState({ open: true })
    const { getByTestId, getByText } = await renderWithI18n(<ErrorBanner />)

    getByTestId('error-sheet-row-messages')
    getByTestId('error-sheet-row-session-detail')
    getByText('Retry all')
  })

  it('retry success removes the row from the sheet', async () => {
    useLoadingStateStore.setState({
      errors: [{ id: 'messages', category: 'messages', message: 'boom' }],
    })
    useErrorSheetStore.setState({ open: true })
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
    useErrorSheetStore.setState({ open: true })
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined)
    const { getByTestId, queryByTestId } = await renderWithI18n(<ErrorBanner />)

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
    const { getByTestId, queryByTestId, findByTestId } = await renderWithI18n(<ErrorBanner />)

    getByTestId('error-recovery-sheet')
    fireEvent.press(getByTestId('error-sheet-close'))

    await waitFor(() => expect(queryByTestId('error-recovery-sheet')).toBeNull())
    expect(useLoadingStateStore.getState().errors).toHaveLength(1)

    await act(async () => {
      useErrorSheetStore.getState().openSheet()
    })
    await findByTestId('error-recovery-sheet')
  })

  it('excludes browse-category failures from the sheet entirely', async () => {
    useLoadingStateStore.setState({
      errors: [{ id: 'browse', category: 'browse', message: 'file tree down' }],
    })
    useErrorSheetStore.setState({ open: true })
    const { queryByTestId } = await renderWithI18n(<ErrorBanner />)

    expect(queryByTestId('error-recovery-sheet')).toBeNull()
  })

  it('keeps blocking auth failures out of the global recovery sheet', async () => {
    useLoadingStateStore.setState({
      errors: [{ id: 'sessions', category: 'sessions', status: 401, message: 'expired' }],
    })
    useErrorSheetStore.setState({ open: true })
    const { queryByTestId } = await renderWithI18n(<ErrorBanner />)

    expect(queryByTestId('error-recovery-sheet')).toBeNull()
  })
})
