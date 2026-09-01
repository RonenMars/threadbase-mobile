import React from 'react'
import { cleanup } from '@testing-library/react-native'
import { ServerStateMessage } from '@/components/servers/ServerStateMessage'
import { ToastViewport } from '@/components/ui/ToastViewport'
import { wsManager } from '@/services/ws-client'
import { useToastStore } from '@/stores/toasts'
import { renderWithI18n } from '@/test-utils/render'
import i18n from '@/test-utils/i18n-setup'
import type { ServerConfig } from '@/types/api'

const server: ServerConfig = {
  id: 'local',
  url: 'http://localhost:7071',
  apiKey: 'test',
  isConnected: false,
  serverInfo: null,
  connectionError: null,
}

beforeEach(async () => {
  await cleanup()
  useToastStore.getState().reset()
  await i18n.changeLanguage('he')
  jest.spyOn(wsManager, 'status').mockReturnValue('disconnected')
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('ServerStateMessage localization', () => {
  it('renders an unreachable-server message in the active locale', async () => {
    const { getByText, queryByText } = await renderWithI18n(
      <>
        <ServerStateMessage
          activeServerIds={[server.id]}
          servers={{ [server.id]: server }}
          fetchStatuses={{
            [server.id]: { status: 'error', lastCheckedAt: Date.now() },
          }}
          wsConnectedCount={0}
          onViewDetails={() => {}}
          onRetryFailed={() => {}}
          isRetrying={false}
        />
        <ToastViewport id="home" />
      </>,
    )

    expect(getByText('לא ניתן להגיע אל localhost. בדקו את החיבור או את כתובת השרת.')).toBeTruthy()
    expect(queryByText("Can't reach localhost. Check your connection or server address.")).toBeNull()
  })
})
