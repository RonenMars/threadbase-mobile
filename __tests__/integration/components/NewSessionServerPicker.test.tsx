import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import { NewSessionServerPicker } from '@/components/servers/NewSessionServerPicker'
import type { ServerConfig } from '@/types/api'

function makeServer(id: string, overrides: Partial<ServerConfig> = {}): ServerConfig {
  return {
    id,
    url: `http://${id}.local:7070`,
    apiKey: 'key',
    isConnected: false,
    serverInfo: null,
    connectionError: null,
    ...overrides,
  }
}

const servers: Record<string, ServerConfig> = {
  alpha: makeServer('alpha', { label: 'Alpha Box' }),
  beta: makeServer('beta'),
  gamma: makeServer('gamma', { label: 'Gamma Box' }),
}

describe('NewSessionServerPicker', () => {
  it('renders nothing when not visible', async () => {
    const { queryByText } = await render(
      <NewSessionServerPicker
        visible={false}
        serverIds={['alpha', 'beta']}
        servers={servers}
        onPick={jest.fn()}
        onClose={jest.fn()}
      />
    )
    expect(queryByText('Start session on')).toBeNull()
  })

  it('renders one row per provided serverId in order', async () => {
    const { getByText, queryByText } = await render(
      <NewSessionServerPicker
        visible
        serverIds={['alpha', 'beta']}
        servers={servers}
        onPick={jest.fn()}
        onClose={jest.fn()}
      />
    )
    expect(getByText('Start session on')).toBeTruthy()
    // Labelled server shows label as title and url as subtitle
    expect(getByText('Alpha Box')).toBeTruthy()
    expect(getByText('http://alpha.local:7070')).toBeTruthy()
    // Unlabelled server falls back to url as title (no separate subtitle row)
    expect(getByText('http://beta.local:7070')).toBeTruthy()
    // Servers not included in serverIds are not rendered
    expect(queryByText('Gamma Box')).toBeNull()
  })

  it('skips serverIds that are missing from the servers map', async () => {
    const { getByText, queryByText } = await render(
      <NewSessionServerPicker
        visible
        serverIds={['alpha', 'missing']}
        servers={servers}
        onPick={jest.fn()}
        onClose={jest.fn()}
      />
    )
    expect(getByText('Alpha Box')).toBeTruthy()
    expect(queryByText('missing')).toBeNull()
  })

  it('calls onPick with the tapped server id', async () => {
    const onPick = jest.fn()
    const { getByText } = await render(
      <NewSessionServerPicker
        visible
        serverIds={['alpha', 'beta']}
        servers={servers}
        onPick={onPick}
        onClose={jest.fn()}
      />
    )
    await fireEvent.press(getByText('Alpha Box'))
    expect(onPick).toHaveBeenCalledWith('alpha')
    expect(onPick).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when Cancel is pressed', async () => {
    const onClose = jest.fn()
    const onPick = jest.fn()
    const { getByText } = await render(
      <NewSessionServerPicker
        visible
        serverIds={['alpha', 'beta']}
        servers={servers}
        onPick={onPick}
        onClose={onClose}
      />
    )
    await fireEvent.press(getByText('Cancel'))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onPick).not.toHaveBeenCalled()
  })
})
