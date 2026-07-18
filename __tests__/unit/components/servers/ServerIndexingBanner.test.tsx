import React from 'react'
import { ServerIndexingBanner } from '@/components/servers/ServerIndexingBanner'
import { useServerFetchStatusStore } from '@/stores/serverFetchStatus'
import { useServersStore } from '@/stores/servers'
import { renderWithI18n } from '@/test-utils/render'

const SERVER_ID = 'srv-test'

beforeEach(() => {
  useServersStore.setState({
    servers: {
      [SERVER_ID]: {
        id: SERVER_ID,
        url: 'http://test.local',
        apiKey: 'k',
        isConnected: true,
        serverInfo: null,
        connectionError: null,
      },
    },
    activeServerIds: [SERVER_ID],
    displayedServerIds: [SERVER_ID],
    scanProgress: {},
  })
  useServerFetchStatusStore.getState().reset()
})

describe('ServerIndexingBanner', () => {
  it('stays hidden without an explicit warm-up response', async () => {
    const { toJSON } = await renderWithI18n(<ServerIndexingBanner />)
    expect(toJSON()).toBeNull()
  })

  it('renders after the server returns its warm-up status', async () => {
    useServerFetchStatusStore.setState({
      statuses: {
        [SERVER_ID]: {
          status: 'warming_up',
          warmupState: 'startup',
          lastCheckedAt: Date.now(),
        },
      },
    })

    const { findByText } = await renderWithI18n(<ServerIndexingBanner />)
    expect(await findByText('Scanning and indexing conversations…')).toBeTruthy()
  })

  it('stays hidden for ordinary fetch errors', async () => {
    useServerFetchStatusStore.getState().recordFailure(SERVER_ID, new Error('unreachable'))
    const { toJSON } = await renderWithI18n(<ServerIndexingBanner />)
    expect(toJSON()).toBeNull()
  })
})
