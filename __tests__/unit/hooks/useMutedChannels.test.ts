import { act, renderHook, waitFor } from '@testing-library/react-native'
import { Linking, Platform } from 'react-native'
import * as Notifications from 'expo-notifications'
import { useMutedChannels } from '@/hooks/useMutedChannels'

const getChannel = Notifications.getNotificationChannelAsync as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
  jest.replaceProperty(Platform, 'OS', 'android')
})

describe('useMutedChannels', () => {
  it('lists only channels whose importance is NONE', async () => {
    getChannel.mockImplementation(async (id: string) => ({
      importance: id === 'updates' ? Notifications.AndroidImportance.NONE : Notifications.AndroidImportance.HIGH,
    }))
    const { result } = await renderHook(() => useMutedChannels())

    await waitFor(() => expect(result.current.muted).toEqual(['updates']))
  })

  it('ignores channels the app has not created yet', async () => {
    getChannel.mockResolvedValue(null)
    const { result } = await renderHook(() => useMutedChannels())

    await waitFor(() => expect(getChannel).toHaveBeenCalledTimes(3))
    expect(result.current.muted).toEqual([])
  })

  it('never asks the OS on iOS, which has no channels', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios')
    await renderHook(() => useMutedChannels())

    expect(getChannel).not.toHaveBeenCalled()
  })

  it('opens the channel page, falling back to app settings', async () => {
    getChannel.mockResolvedValue(null)
    const sendIntent = jest.spyOn(Linking, 'sendIntent').mockRejectedValueOnce(new Error('no activity'))
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue()
    const { result } = await renderHook(() => useMutedChannels())

    await act(async () => result.current.openChannelSettings('needs-you'))

    expect(sendIntent).toHaveBeenCalledWith(
      'android.settings.CHANNEL_NOTIFICATION_SETTINGS',
      expect.arrayContaining([{ key: 'android.provider.extra.CHANNEL_ID', value: 'needs-you' }]),
    )
    await waitFor(() => expect(openSettings).toHaveBeenCalled())
  })
})
