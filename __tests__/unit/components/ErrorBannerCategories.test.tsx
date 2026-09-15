import { AlertHost } from '@/components/alerts/AlertHost'
import { useLoadingStateStore } from '@/stores/loading-state'
import { useServerFetchStatusStore } from '@/stores/serverFetchStatus'
import { useServersStore } from '@/stores/servers'
import { useErrorSheetStore } from '@/stores/errorSheet'
import { useAlertStore } from '@/stores/alerts'
import { renderWithI18n } from '@/test-utils/render'
import { queryClient } from '@/services/query-client'
import { act, fireEvent, waitFor } from '@testing-library/react-native'
import { useRouter } from 'expo-router'
import type { ServerConfig } from '@/types/api'

describe('Status sheet category rows', () => {
  beforeEach(() => {
    useErrorSheetStore.setState({ open: false })
    useAlertStore.getState().reset()
    useLoadingStateStore.setState({ errors: [], dismissed: [] })
    useServerFetchStatusStore.setState({ statuses: {} })
    useServersStore.setState({ servers: {} })
    ;(useRouter as jest.Mock).mockImplementation(() => ({
      push: jest.fn(),
      replace: jest.fn(),
      back: jest.fn(),
      navigate: jest.fn(),
      setParams: jest.fn(),
      canGoBack: jest.fn(() => true),
    }))
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
    const { queryByTestId, getByTestId, getByText } = await renderWithI18n(<AlertHost />)

    expect(queryByTestId('status-sheet')).toBeNull()
    getByTestId('critical-dialog')
    getByText('Your session has expired')
    getByText('Open Settings to pair this device again or update the API key.')
  })

  it('routes a 401 to Settings and sticky-dismisses so the dialog does not return', async () => {
    const push = jest.fn()
    ;(useRouter as jest.Mock).mockReturnValue({
      push,
      replace: jest.fn(),
      back: jest.fn(),
      navigate: jest.fn(),
      setParams: jest.fn(),
      canGoBack: jest.fn(() => true),
    })
    useLoadingStateStore.setState({
      errors: [{ id: 'sessions', category: 'sessions', status: 401, message: 'expired' }],
    })
    const { getByTestId, queryByTestId } = await renderWithI18n(<AlertHost />)

    fireEvent.press(getByTestId('critical-dialog-action'))
    expect(push).toHaveBeenCalledWith('/settings')
    expect(useLoadingStateStore.getState().errors).toHaveLength(0)
    expect(useLoadingStateStore.getState().dismissed).toContain('sessions')
    await waitFor(() => {
      expect(useAlertStore.getState().alerts).toHaveLength(0)
      expect(queryByTestId('critical-dialog')).toBeNull()
    })
  })

  it('still raises the critical dialog when servers are also down', async () => {
    const server: ServerConfig = {
      id: 's0',
      url: 'https://host.example',
      apiKey: '',
      label: 'Studio Mac',
      isConnected: false,
      serverInfo: null,
      connectionError: null,
    }
    useServersStore.setState({ servers: { s0: server } })
    useServerFetchStatusStore.setState({
      statuses: { s0: { status: 'error', error: 'unreachable', lastCheckedAt: 0 } },
    })
    useLoadingStateStore.setState({
      errors: [{ id: 'sessions', category: 'sessions', status: 401, message: 'expired' }],
    })
    useErrorSheetStore.setState({ open: true })
    const { getByTestId, queryByTestId } = await renderWithI18n(<AlertHost />)

    getByTestId('critical-dialog')
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

  it('names the displayed server on a messages failure', async () => {
    useServersStore.setState({
      servers: {
        s0: {
          id: 's0',
          url: 'http://studio.local',
          apiKey: '',
          label: 'Studio Mac',
          isConnected: true,
          serverInfo: null,
          connectionError: null,
        },
      },
      activeServerIds: ['s0'],
      displayedServerIds: ['s0'],
    })
    useLoadingStateStore.setState({
      errors: [{ id: 'messages', category: 'messages', message: 'boom' }],
    })
    useErrorSheetStore.setState({ open: true })
    const { getByText } = await renderWithI18n(<AlertHost />)

    getByText("Messages didn't load from Studio Mac.")
    getByText('This conversation may be missing recent replies.')
  })

  it('opens Server Status from the sheet without stacking it over the sheet', async () => {
    useLoadingStateStore.setState({
      errors: [{ id: 'messages', category: 'messages', message: 'boom' }],
    })
    useErrorSheetStore.setState({ open: true })
    const { getByTestId, queryByTestId, getByText } = await renderWithI18n(<AlertHost />)

    getByTestId('status-sheet-server-status')
    fireEvent.press(getByTestId('status-sheet-server-status'))
    await waitFor(() => expect(queryByTestId('status-sheet')).toBeNull())
    getByText(/Servers? Status/)
    expect(useErrorSheetStore.getState().open).toBe(false)
  })
})
