import React from 'react'
import { cleanup } from '@testing-library/react-native'
import { ServersStatusModal } from '@/components/servers/ServersStatusModal'
import { wsManager } from '@/services/ws-client'
import { useServerFetchStatusStore } from '@/stores/serverFetchStatus'
import { useServersStore } from '@/stores/servers'
import { renderWithI18n } from '@/test-utils/render'
import i18n from '@/test-utils/i18n-setup'

const SERVER_ID = 'local'

beforeEach(async () => {
  await cleanup()
  await i18n.changeLanguage('he')
  useServersStore.setState({
    servers: {
      [SERVER_ID]: {
        id: SERVER_ID,
        url: 'http://localhost:7071',
        label: 'localhost',
        apiKey: 'test',
        isConnected: false,
        serverInfo: null,
        connectionError: 'offline',
      },
    },
    activeServerIds: [SERVER_ID],
    displayedServerIds: [SERVER_ID],
  })
  useServerFetchStatusStore.setState({
    statuses: {
      [SERVER_ID]: { status: 'error', error: 'offline', lastCheckedAt: Date.now() },
    },
  })
  jest.spyOn(wsManager, 'status').mockReturnValue('disconnected')
  jest.spyOn(wsManager, 'onAnyStatusChange').mockReturnValue(() => {})
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('ServersStatusModal localization', () => {
  it('localizes the title, status, and server-menu label', async () => {
    const { getByText, getByLabelText, queryByText } = await renderWithI18n(
      <ServersStatusModal visible onClose={() => {}} />,
    )

    expect(getByText('מצב השרת')).toBeTruthy()
    expect(getByText('לא זמין')).toBeTruthy()
    expect(getByLabelText('אפשרויות שרת')).toBeTruthy()
    expect(queryByText('Server Status')).toBeNull()
    expect(queryByText('Unreachable')).toBeNull()
  })
})
