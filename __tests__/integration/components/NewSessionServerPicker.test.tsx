import React from 'react'
import { StyleSheet, type ViewStyle } from 'react-native'
import { render, fireEvent } from '@testing-library/react-native'
import { NewSessionServerPicker } from '@/components/servers/NewSessionServerPicker'
import { DirectionRoot } from '@/lib/direction-root'
import type { ServerConfig } from '@/types/api'
import i18n from '@/test-utils/i18n-setup'

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
  afterEach(async () => {
    await i18n.changeLanguage('en')
  })
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
    const { getByText, getByTestId, queryByText } = await render(
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
    expect(getByTestId('new-session-server-0')).toBeTruthy()
    expect(getByTestId('new-session-server-1')).toBeTruthy()
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
    const { getByTestId, getByText } = await render(
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
    await fireEvent.press(getByTestId('new-session-server-1'))
    expect(onPick).toHaveBeenLastCalledWith('beta')
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

  it('right-aligns the translated title in RTL and keeps server identifiers LTR', async () => {
    function isMirrored(element: { props: { style?: ViewStyle | ViewStyle[] } }): boolean {
      const style = StyleSheet.flatten(element.props.style)
      const transform = style.transform
      if (!Array.isArray(transform)) return false
      return transform.some((entry) => 'scaleX' in entry && entry.scaleX === -1)
    }

    await i18n.changeLanguage('he')
    const { getByText, getByTestId } = await render(
      <DirectionRoot>
        <NewSessionServerPicker
          visible
          serverIds={['alpha']}
          servers={servers}
          onPick={jest.fn()}
          onClose={jest.fn()}
        />
      </DirectionRoot>,
    )

    expect(StyleSheet.flatten(getByText('התחל סשן על').props.style)).toEqual(
      expect.objectContaining({
        direction: 'rtl',
        writingDirection: 'rtl',
        textAlign: 'auto',
        width: '100%',
      }),
    )
    expect(StyleSheet.flatten(getByText('Alpha Box').props.style)).toEqual(
      expect.objectContaining({ direction: 'ltr', writingDirection: 'ltr' }),
    )
    expect(StyleSheet.flatten(getByText('http://alpha.local:7070').props.style)).toEqual(
      expect.objectContaining({ direction: 'ltr', writingDirection: 'ltr' }),
    )
    expect(isMirrored(getByTestId('phosphor-react-native-caret-right-undefined'))).toBe(true)
  })
})
