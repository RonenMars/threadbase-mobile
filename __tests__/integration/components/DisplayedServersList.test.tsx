import React from 'react'
import { render } from '@testing-library/react-native'
import { DisplayedServersList } from '@/components/servers/DisplayedServersList'
import type { ServerConfig } from '@/types/api'

const serverA: ServerConfig = {
  id: 'srv_a', url: 'http://a.local:7070', apiKey: 'key-a',
  isConnected: false, serverInfo: null, connectionError: null,
}
const serverB: ServerConfig = {
  id: 'srv_b', url: 'http://b.local:7070', apiKey: 'key-b',
  isConnected: false, serverInfo: null, connectionError: null,
}

const servers = { srv_a: serverA, srv_b: serverB }
const activeServerIds = ['srv_a', 'srv_b']

describe('DisplayedServersList — normal mode', () => {
  it('renders a Switch for each server', async () => {
    const { getByTestId } = await render(
      <DisplayedServersList
        activeServerIds={activeServerIds}
        servers={servers}
        selectedServerIds={activeServerIds}
        onChange={jest.fn()}
      />
    )
    expect(getByTestId('server-toggle-srv_a')).toBeTruthy()
    expect(getByTestId('server-toggle-srv_b')).toBeTruthy()
  })
})

describe('DisplayedServersList — edit order mode', () => {
  it('does not render Switch components when isEditingOrder is true', async () => {
    const { queryByTestId } = await render(
      <DisplayedServersList
        activeServerIds={activeServerIds}
        servers={servers}
        selectedServerIds={activeServerIds}
        onChange={jest.fn()}
        isEditingOrder
        onReorder={jest.fn()}
      />
    )
    expect(queryByTestId('server-toggle-srv_a')).toBeNull()
    expect(queryByTestId('server-toggle-srv_b')).toBeNull()
  })

  it('renders drag handle for each server when isEditingOrder is true', async () => {
    const { getByTestId } = await render(
      <DisplayedServersList
        activeServerIds={activeServerIds}
        servers={servers}
        selectedServerIds={activeServerIds}
        onChange={jest.fn()}
        isEditingOrder
        onReorder={jest.fn()}
      />
    )
    expect(getByTestId('drag-handle-srv_a')).toBeTruthy()
    expect(getByTestId('drag-handle-srv_b')).toBeTruthy()
  })

  it('does not render quick-action buttons when isEditingOrder is true', async () => {
    const { queryByTestId } = await render(
      <DisplayedServersList
        activeServerIds={activeServerIds}
        servers={servers}
        selectedServerIds={activeServerIds}
        onChange={jest.fn()}
        isEditingOrder
        onReorder={jest.fn()}
        showQuickActions
      />
    )
    expect(queryByTestId('quick-actions')).toBeNull()
  })
})
