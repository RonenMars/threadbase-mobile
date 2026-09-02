import React from 'react'
import { cleanup, fireEvent } from '@testing-library/react-native'
import { ServersStatusModal } from '@/components/servers/ServersStatusModal'
import { wsManager } from '@/services/ws-client'
import { useServerFetchStatusStore } from '@/stores/serverFetchStatus'
import { useServersStore } from '@/stores/servers'
import { renderWithI18n } from '@/test-utils/render'
import i18n from '@/test-utils/i18n-setup'

const FETCH_ONLY = 'fetch-only'
const HEALTHY = 'healthy'
const LONG_ERROR =
  'Failed to reach http://tb-ak.example/api/conversations: CleartextBlockedError: Refused to send unencrypted traffic'

beforeEach(async () => {
  await cleanup()
  await i18n.changeLanguage('en')
  useServersStore.setState({
    servers: {
      // connectionError null on purpose: this server failed its HTTP fetches
      // only, the case that used to open the modal on an empty error box.
      [FETCH_ONLY]: {
        id: FETCH_ONLY, url: 'http://tb-ak.example', label: 'AK', apiKey: 't',
        isConnected: false, serverInfo: null, connectionError: null,
      },
      [HEALTHY]: {
        id: HEALTHY, url: 'http://ok.example', label: 'OK', apiKey: 't',
        isConnected: true, serverInfo: null, connectionError: null,
      },
    },
    activeServerIds: [FETCH_ONLY, HEALTHY],
    displayedServerIds: [FETCH_ONLY, HEALTHY],
  })
  useServerFetchStatusStore.setState({
    statuses: { [FETCH_ONLY]: { status: 'error', error: LONG_ERROR, lastCheckedAt: Date.now() } },
  })
  jest.spyOn(wsManager, 'status').mockReturnValue('disconnected')
  jest.spyOn(wsManager, 'onAnyStatusChange').mockReturnValue(() => {})
})

afterEach(() => jest.restoreAllMocks())

describe('ServersStatusModal error drill-in', () => {
  it('opens the full error from a failing row, falling back to the fetch error', async () => {
    const { getByTestId, findByText, findAllByText, queryByText } = await renderWithI18n(
      <ServersStatusModal visible onClose={() => {}} />,
    )

    // Clamped preview in the row; the detail modal is not open yet.
    expect(queryByText('Machine')).toBeNull()

    fireEvent.press(getByTestId('status-row-view-error-http://tb-ak.example'))

    // ServerErrorModal's own detail rows, plus the unclamped error text.
    await findByText('Machine')
    // Twice now: the row's clamped preview and the modal's unclamped copy.
    expect(await findAllByText(LONG_ERROR)).toHaveLength(2)
  })

  it('leaves a healthy row inert', async () => {
    const { queryByTestId } = await renderWithI18n(
      <ServersStatusModal visible onClose={() => {}} />,
    )
    expect(queryByTestId('status-row-view-error-http://ok.example')).toBeNull()
  })

  it('titles the detail modal with the hostname when the server has no label', async () => {
    useServersStore.setState({
      servers: {
        [FETCH_ONLY]: {
          id: FETCH_ONLY, url: 'http://tb-ak.example', label: undefined, apiKey: 't',
          isConnected: false, serverInfo: null, connectionError: null,
        },
      },
      activeServerIds: [FETCH_ONLY],
      displayedServerIds: [FETCH_ONLY],
    })

    const { getByTestId, findByText } = await renderWithI18n(
      <ServersStatusModal visible onClose={() => {}} />,
    )
    fireEvent.press(getByTestId('status-row-view-error-http://tb-ak.example'))

    await findByText('tb-ak.example')
  })
})
