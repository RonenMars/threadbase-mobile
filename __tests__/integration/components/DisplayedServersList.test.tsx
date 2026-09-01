import React from 'react'
import { StyleSheet } from 'react-native'
import { render } from '@testing-library/react-native'
import { DisplayedServersList } from '@/components/servers/DisplayedServersList'
import { nord } from '@/constants/theme'
import type { ServerConfig } from '@/types/api'

const mockUseIsGlass = jest.fn(() => false)

jest.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => require('@/constants/theme').nord,
  useIsGlass: () => mockUseIsGlass(),
}))

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
  beforeEach(() => {
    mockUseIsGlass.mockReturnValue(false)
  })

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

  it('uses primary text for quick actions over native glass', async () => {
    mockUseIsGlass.mockReturnValue(true)
    const { getByText } = await render(
      <DisplayedServersList
        activeServerIds={activeServerIds}
        servers={servers}
        selectedServerIds={activeServerIds}
        onChange={jest.fn()}
      />
    )

    expect(StyleSheet.flatten(getByText('All').props.style)).toEqual(
      expect.objectContaining({ color: nord.text.primary }),
    )
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
