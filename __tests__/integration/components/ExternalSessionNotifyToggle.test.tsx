/**
 * The turn-end alert toggle on an external session.
 *
 * The server keeps no list we can read back, and prunes a subscription after
 * 14 days idle, so the stored flag is a hint: opening the screen re-sends the
 * PUT. A null token means notifications are off, and the user is told so.
 */
import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import { ExternalSessionNotifyToggle } from '@/components/sessions/ExternalSessionNotifyToggle'
import { useExternalSubscriptionsStore } from '@/stores/externalSubscriptions'

const mockSupports = jest.fn()
const mockSubscribe = jest.fn()
const mockUnsubscribe = jest.fn()
jest.mock('@/services/push', () => ({
  serverSupportsPushSubscriptions: (...args: unknown[]) => mockSupports(...args),
  subscribeExternalSession: (...args: unknown[]) => mockSubscribe(...args),
  unsubscribeExternalSession: (...args: unknown[]) => mockUnsubscribe(...args),
}))

const isOn = () => useExternalSubscriptionsStore.getState().isSubscribed('srv', 'conv-1')

beforeEach(() => {
  jest.clearAllMocks()
  mockSupports.mockReturnValue(true)
  mockSubscribe.mockResolvedValue(true)
  mockUnsubscribe.mockResolvedValue(true)
  useExternalSubscriptionsStore.setState({ subscribed: {} })
})

const renderToggle = () =>
  render(<ExternalSessionNotifyToggle serverId="srv" conversationId="conv-1" />)

describe('ExternalSessionNotifyToggle', () => {
  it('is hidden when the server does not support subscriptions', async () => {
    mockSupports.mockReturnValue(false)
    const { queryByTestId } = await renderToggle()
    expect(queryByTestId('external-session-notify')).toBeNull()
    expect(mockSupports).toHaveBeenCalledWith('srv')
  })

  it('starts off and sends nothing on open when not subscribed', async () => {
    const { getByTestId } = await renderToggle()
    expect(getByTestId('external-session-notify-switch').props.value).toBe(false)
    expect(mockSubscribe).not.toHaveBeenCalled()
  })

  it('subscribes when switched on and remembers it', async () => {
    const { getByTestId } = await renderToggle()
    fireEvent(getByTestId('external-session-notify-switch'), 'valueChange', true)

    await waitFor(() => expect(isOn()).toBe(true))
    expect(mockSubscribe).toHaveBeenCalledWith('srv', 'conv-1')
    expect(getByTestId('external-session-notify-switch').props.value).toBe(true)
  })

  it('says notifications are off instead of failing silently when there is no token', async () => {
    mockSubscribe.mockResolvedValue(false)
    const { getByTestId, findByTestId } = await renderToggle()
    fireEvent(getByTestId('external-session-notify-switch'), 'valueChange', true)

    const note = await findByTestId('external-session-notify-note')
    expect(note.props.children).toBe('Turn on notifications for Threadbase to get this alert.')
    expect(isOn()).toBe(false)
    expect(getByTestId('external-session-notify-switch').props.value).toBe(false)
  })

  it('shows an error and stays off when the request fails', async () => {
    mockSubscribe.mockRejectedValue(new Error('network down'))
    const { getByTestId, findByTestId } = await renderToggle()
    fireEvent(getByTestId('external-session-notify-switch'), 'valueChange', true)

    const note = await findByTestId('external-session-notify-note')
    expect(note.props.children).toBe("Couldn't update the alert. Try again.")
    expect(isOn()).toBe(false)
  })

  it('re-sends the subscription on open when the stored flag says subscribed', async () => {
    useExternalSubscriptionsStore.getState().setSubscribed('srv', 'conv-1', true)
    const { getByTestId } = await renderToggle()

    await waitFor(() => expect(mockSubscribe).toHaveBeenCalledWith('srv', 'conv-1'))
    expect(mockSubscribe).toHaveBeenCalledTimes(1)
    expect(getByTestId('external-session-notify-switch').props.value).toBe(true)
  })

  it('unsubscribes when switched off and forgets it', async () => {
    useExternalSubscriptionsStore.getState().setSubscribed('srv', 'conv-1', true)
    const { getByTestId } = await renderToggle()
    fireEvent(getByTestId('external-session-notify-switch'), 'valueChange', false)

    await waitFor(() => expect(isOn()).toBe(false))
    expect(mockUnsubscribe).toHaveBeenCalledWith('srv', 'conv-1')
  })

  it('keeps the flag of another session or server separate', async () => {
    const store = useExternalSubscriptionsStore.getState()
    store.setSubscribed('srv', 'conv-1', true)
    expect(store.isSubscribed('srv', 'conv-2')).toBe(false)
    expect(store.isSubscribed('other', 'conv-1')).toBe(false)
  })
})
