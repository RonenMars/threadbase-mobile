import React from 'react'
import { cleanup, fireEvent } from '@testing-library/react-native'
import type { screen } from '@testing-library/react-native'
import { ServersStatusModal } from '@/components/servers/ServersStatusModal'
import { wsManager } from '@/services/ws-client'
import { useServerFetchStatusStore } from '@/stores/serverFetchStatus'
import { useServersStore } from '@/stores/servers'
import { renderWithI18n } from '@/test-utils/render'
import i18n from '@/test-utils/i18n-setup'

type TestNode = ReturnType<typeof screen.getByText>

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

  it('opens the same detail from the status label', async () => {
    const { getByTestId, findByText, queryByTestId } = await renderWithI18n(
      <ServersStatusModal visible onClose={() => {}} />,
    )

    fireEvent.press(getByTestId('status-label-view-error-http://tb-ak.example'))
    await findByText('Machine')

    // A healthy server's label stays inert, same as its row.
    expect(queryByTestId('status-label-view-error-http://ok.example')).toBeNull()
  })
})

// On iOS a view with accessible=true swallows its whole subtree into one
// VoiceOver element, so a control is only reachable when no ancestor is one.
// The control's own accessible host is skipped; anything above it is a merger.
function accessibleAncestors(node: TestNode): string[] {
  const found: string[] = []
  let ownHostSeen = false
  for (let p: TestNode | null = node; p; p = p.parent) {
    if (typeof p.type !== 'string' || p.props.accessible !== true) continue
    if (ownHostSeen) found.push(String(p.props.testID ?? p.type))
    ownHostSeen = true
  }
  return found
}

describe('ServersStatusModal accessibility tree', () => {
  it('keeps the close, row, options and add-server controls out of a merged element', async () => {
    const { getByText, getByTestId, getAllByTestId, getByLabelText } = await renderWithI18n(
      <ServersStatusModal visible onClose={() => {}} />,
    )

    expect(accessibleAncestors(getByText('✕'))).toEqual([])
    expect(accessibleAncestors(getByTestId('status-row-view-error-http://tb-ak.example'))).toEqual([])
    expect(accessibleAncestors(getAllByTestId('server-row-dots-btn')[0])).toEqual([])
    expect(accessibleAncestors(getByLabelText('Add Server'))).toEqual([])
  })

  it('keeps the per-server menu items out of a merged element', async () => {
    const { getAllByTestId, findByText } = await renderWithI18n(
      <ServersStatusModal visible onClose={() => {}} />,
    )
    fireEvent.press(getAllByTestId('server-row-dots-btn')[0])

    expect(accessibleAncestors(await findByText('Edit'))).toEqual([])
    expect(accessibleAncestors(await findByText('Delete'))).toEqual([])
  })
})
