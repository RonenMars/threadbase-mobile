import React from 'react'
import { fireEvent } from '@testing-library/react-native'
import { ToastViewport } from '@/components/ui/ToastViewport'
import { useAlertStore, type AlertInput } from '@/stores/alerts'
import { renderWithI18n } from '@/test-utils/render'

const infoToast: AlertInput = {
  id: 'server-state',
  cause: 'servers:summary',
  level: 'info',
  title: 'Connecting to My Server…',
  message: 'Establishing a connection to the server.',
}

beforeEach(() => {
  useAlertStore.getState().reset()
})

describe('ToastViewport', () => {
  it('shows the message on the toast without opening a modal', async () => {
    useAlertStore.getState().upsert(infoToast)
    const { findByTestId, queryByTestId, getByText } = await renderWithI18n(
      <ToastViewport />,
    )
    expect(queryByTestId('alert-details-sheet')).toBeNull()
    await findByTestId('toast-server-state')
    getByText('Establishing a connection to the server.')
    fireEvent.press(await findByTestId('toast-server-state'))
    expect(queryByTestId('alert-details-sheet')).toBeNull()
  })

  it('shows details inline on the toast', async () => {
    useAlertStore.getState().upsert({
      ...infoToast,
      details: '3 of the cached histories are missing.',
    })
    const { getByText } = await renderWithI18n(<ToastViewport />)
    getByText('Establishing a connection to the server.')
    getByText('3 of the cached histories are missing.')
  })

  it('prefers an explicit onPress over doing nothing', async () => {
    const onPress = jest.fn()
    useAlertStore.getState().upsert({ ...infoToast, id: 'connecting', onPress })
    const { findByTestId } = await renderWithI18n(<ToastViewport />)
    fireEvent.press(await findByTestId('toast-connecting'))
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('renders only the first info toast', async () => {
    useAlertStore.getState().upsert(infoToast)
    useAlertStore.getState().upsert({ ...infoToast, id: 'second', title: 'Also connecting…' })
    const { queryByTestId } = await renderWithI18n(<ToastViewport />)
    expect(queryByTestId('toast-server-state')).toBeTruthy()
    expect(queryByTestId('toast-second')).toBeNull()
  })

  it('runs the action the store currently holds, not the one captured at render', async () => {
    const stale = jest.fn()
    const fresh = jest.fn()
    useAlertStore.getState().upsert({ ...infoToast, buttonText: 'Details', buttonAction: stale })
    const { findByTestId } = await renderWithI18n(<ToastViewport />)
    useAlertStore.getState().upsert({ ...infoToast, buttonText: 'Details', buttonAction: fresh })
    fireEvent.press(await findByTestId('toast-action-server-state'))
    expect(fresh).toHaveBeenCalledTimes(1)
    expect(stale).not.toHaveBeenCalled()
  })

  it('does not render a warning — that belongs on the status pill', async () => {
    useAlertStore.getState().upsert({
      ...infoToast,
      level: 'warning',
      title: 'Host under load',
      timeout: null,
    })
    const { queryByTestId } = await renderWithI18n(<ToastViewport />)
    expect(queryByTestId('toast-server-state')).toBeNull()
  })

  it('does not render an error — that belongs on the pill and strip', async () => {
    useAlertStore.getState().upsert({
      ...infoToast,
      level: 'error',
      title: "Can't reach My Server",
      timeout: null,
    })
    const { queryByTestId } = await renderWithI18n(<ToastViewport />)
    expect(queryByTestId('toast-server-state')).toBeNull()
  })
})
