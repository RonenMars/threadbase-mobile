import React from 'react'
import { Alert, type AlertButton } from 'react-native'
import { cleanup, fireEvent } from '@testing-library/react-native'
import { ServersStatusModal } from '@/components/servers/ServersStatusModal'
import { wsManager } from '@/services/ws-client'
import { useServersStore } from '@/stores/servers'
import { renderWithI18n } from '@/test-utils/render'
import i18n from '@/test-utils/i18n-setup'

const PINNED = 'pinned'
const PLAIN = 'plain'
const forgetDevice = jest.fn().mockResolvedValue(undefined)

function seed(ids: string[]) {
  const all = {
    [PINNED]: {
      id: PINNED, url: 'http://pinned.example', label: 'Pinned', apiKey: 't',
      serverPublicKey: 'spk', requireEncryption: true,
      isConnected: false, serverInfo: null, connectionError: null,
    },
    [PLAIN]: {
      id: PLAIN, url: 'http://plain.example', label: 'Plain', apiKey: 't',
      isConnected: false, serverInfo: null, connectionError: null,
    },
  }
  useServersStore.setState({
    servers: Object.fromEntries(ids.map((id) => [id, all[id as keyof typeof all]])),
    activeServerIds: ids,
    displayedServerIds: ids,
    forgetDevice,
  })
}

beforeEach(async () => {
  await cleanup()
  forgetDevice.mockClear()
  await i18n.changeLanguage('en')
  jest.spyOn(wsManager, 'status').mockReturnValue('disconnected')
  jest.spyOn(wsManager, 'onAnyStatusChange').mockReturnValue(() => {})
})

afterEach(() => jest.restoreAllMocks())

describe('ServersStatusModal forget this device', () => {
  it('offers the action for a pinned server only', async () => {
    seed([PLAIN])
    const plain = await renderWithI18n(<ServersStatusModal visible onClose={() => {}} />)
    await fireEvent.press(plain.getByTestId('server-row-dots-btn'))
    expect(plain.getByText('Delete')).toBeTruthy()
    expect(plain.queryByText('Forget this device')).toBeNull()
    await cleanup()

    seed([PINNED])
    const pinned = await renderWithI18n(<ServersStatusModal visible onClose={() => {}} />)
    await fireEvent.press(pinned.getByTestId('server-row-dots-btn'))
    expect(pinned.getByText('Forget this device')).toBeTruthy()
  })

  it('asks for confirmation and forgets the device only on confirm', async () => {
    seed([PINNED])
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    const { getByTestId, getByText } = await renderWithI18n(
      <ServersStatusModal visible onClose={() => {}} />,
    )
    await fireEvent.press(getByTestId('server-row-dots-btn'))
    await fireEvent.press(getByText('Forget this device'))

    expect(alert).toHaveBeenCalledTimes(1)
    expect(forgetDevice).not.toHaveBeenCalled()
    const buttons = alert.mock.calls[0][2] as AlertButton[]

    const cancel = buttons.find((b) => b.style === 'cancel')
    await cancel?.onPress?.()
    expect(forgetDevice).not.toHaveBeenCalled()

    const confirm = buttons.find((b) => b.style === 'destructive')
    await confirm?.onPress?.()
    expect(forgetDevice).toHaveBeenCalledWith(PINNED)
  })
})
