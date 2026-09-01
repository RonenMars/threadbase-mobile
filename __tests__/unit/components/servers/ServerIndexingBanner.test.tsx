import React from 'react'
import { StyleSheet } from 'react-native'
import { ServerIndexingBanner } from '@/components/servers/ServerIndexingBanner'
import { useServerFetchStatusStore } from '@/stores/serverFetchStatus'
import { useServersStore } from '@/stores/servers'
import { renderWithI18n } from '@/test-utils/render'
import i18n from '@/test-utils/i18n-setup'

const SERVER_ID = 'srv-test'

beforeEach(async () => {
  await i18n.changeLanguage('en')
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

  it('renders progress for every warming server', async () => {
    const secondServerId = 'srv-second'
    const firstServer = useServersStore.getState().servers[SERVER_ID]

    useServersStore.setState({
      servers: {
        [SERVER_ID]: { ...firstServer, label: 'Alpha Server' },
        [secondServerId]: {
          id: secondServerId,
          label: 'Beta Server',
          url: 'http://second.test.local',
          apiKey: 'k',
          isConnected: true,
          serverInfo: null,
          connectionError: null,
        },
      },
      activeServerIds: [SERVER_ID, secondServerId],
      displayedServerIds: [SERVER_ID, secondServerId],
      scanProgress: {
        [SERVER_ID]: { scanned: 12, total: 100 },
        [secondServerId]: { scanned: 34, total: 200 },
      },
    })
    useServerFetchStatusStore.setState({
      statuses: {
        [SERVER_ID]: {
          status: 'warming_up',
          warmupState: 'startup',
          lastCheckedAt: Date.now(),
        },
        [secondServerId]: {
          status: 'warming_up',
          warmupState: 'cache_reset',
          lastCheckedAt: Date.now(),
        },
      },
    })

    const { findByText } = await renderWithI18n(<ServerIndexingBanner />)
    expect(await findByText('Alpha Server')).toBeTruthy()
    expect(await findByText('12 / 100 files')).toBeTruthy()
    expect(await findByText('Beta Server')).toBeTruthy()
    expect(await findByText('34 / 200 files')).toBeTruthy()
  })

  it('right-aligns translated copy, isolates identifiers, and fills from the logical start', async () => {
    useServersStore.setState({
      scanProgress: {
        [SERVER_ID]: { scanned: 12, total: 100 },
      },
    })
    useServerFetchStatusStore.setState({
      statuses: {
        [SERVER_ID]: {
          status: 'warming_up',
          warmupState: 'startup',
          lastCheckedAt: Date.now(),
        },
      },
    })

    await i18n.changeLanguage('he')
    const { findByText, getByTestId } = await renderWithI18n(<ServerIndexingBanner />)

    expect(StyleSheet.flatten((await findByText('סורק ומאנדקס שיחות…')).props.style)).toEqual(
      expect.objectContaining({
        direction: 'rtl',
        writingDirection: 'rtl',
        textAlign: 'auto',
        width: '100%',
      }),
    )
    expect(StyleSheet.flatten((await findByText('http://test.local')).props.style)).toEqual(
      expect.objectContaining({ direction: 'ltr', writingDirection: 'ltr' }),
    )
    expect(StyleSheet.flatten((await findByText('12 / 100 קבצים')).props.style)).toEqual(
      expect.objectContaining({
        direction: 'rtl',
        writingDirection: 'rtl',
        textAlign: 'auto',
      }),
    )
    expect(StyleSheet.flatten(getByTestId('indexing-progress-fill').props.style)).toEqual(
      expect.objectContaining({ start: 0 }),
    )
  })

  it('stays hidden for ordinary fetch errors', async () => {
    useServerFetchStatusStore.getState().recordFailure(SERVER_ID, new Error('unreachable'))
    const { toJSON } = await renderWithI18n(<ServerIndexingBanner />)
    expect(toJSON()).toBeNull()
  })
})
