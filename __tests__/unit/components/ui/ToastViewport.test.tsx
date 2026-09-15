import React from 'react'
import { fireEvent } from '@testing-library/react-native'
import { ToastViewport } from '@/components/ui/ToastViewport'
import { useAlertStore, type AlertInput } from '@/stores/alerts'
import { renderWithI18n } from '@/test-utils/render'

const infoToast: AlertInput = {
  id: 'server-state',
  viewport: 'home',
  cause: 'servers:summary',
  level: 'info',
  title: 'Connecting to My Server…',
  message: 'Establishing a connection to the server.',
}

beforeEach(() => {
  useAlertStore.getState().reset()
})

describe('ToastViewport', () => {
  it('opens the details sheet for a toast whose only body copy is message', async () => {
    useAlertStore.getState().upsert(infoToast)
    const { findByTestId, queryByTestId, getAllByText } = await renderWithI18n(
      <ToastViewport id="home" />,
    )
    expect(queryByTestId('alert-details-sheet')).toBeNull()
    fireEvent.press(await findByTestId('toast-server-state'))
    expect(await findByTestId('alert-details-sheet')).toBeTruthy()
    expect(getAllByText('Establishing a connection to the server.').length).toBeGreaterThan(0)
  })

  it('prefers an explicit onPress over the details sheet', async () => {
    const onPress = jest.fn()
    useAlertStore.getState().upsert({ ...infoToast, id: 'connecting', onPress })
    const { findByTestId, queryByTestId } = await renderWithI18n(<ToastViewport id="home" />)
    fireEvent.press(await findByTestId('toast-connecting'))
    expect(onPress).toHaveBeenCalledTimes(1)
    expect(queryByTestId('alert-details-sheet')).toBeNull()
  })

  it('renders only the toasts belonging to its own viewport', async () => {
    useAlertStore.getState().upsert(infoToast)
    useAlertStore.getState().upsert({ ...infoToast, id: 'terminal-raw', viewport: 'terminal' })
    const { queryByTestId } = await renderWithI18n(<ToastViewport id="home" />)
    expect(queryByTestId('toast-server-state')).toBeTruthy()
    expect(queryByTestId('toast-terminal-raw')).toBeNull()
  })

  it('runs the action the store currently holds, not the one captured at render', async () => {
    const stale = jest.fn()
    const fresh = jest.fn()
    useAlertStore.getState().upsert({ ...infoToast, buttonText: 'Details', buttonAction: stale })
    const { findByTestId } = await renderWithI18n(<ToastViewport id="home" />)
    useAlertStore.getState().upsert({ ...infoToast, buttonText: 'Details', buttonAction: fresh })
    fireEvent.press(await findByTestId('toast-action-server-state'))
    expect(fresh).toHaveBeenCalledTimes(1)
    expect(stale).not.toHaveBeenCalled()
  })

  it('does not render a home warning — that belongs on the status pill', async () => {
    useAlertStore.getState().upsert({
      ...infoToast,
      level: 'warning',
      title: 'Host under load',
      timeout: null,
    })
    const { queryByTestId } = await renderWithI18n(<ToastViewport id="home" />)
    expect(queryByTestId('toast-server-state')).toBeNull()
  })

  it('does not render a home error — that belongs on the pill and strip', async () => {
    useAlertStore.getState().upsert({
      ...infoToast,
      level: 'error',
      title: "Can't reach My Server",
      timeout: null,
    })
    const { queryByTestId } = await renderWithI18n(<ToastViewport id="home" />)
    expect(queryByTestId('toast-server-state')).toBeNull()
  })

  it('does not render a terminal-viewport warning — raw mode is inline now', async () => {
    useAlertStore.getState().upsert({
      ...infoToast,
      level: 'error',
      title: "Can't reach My Server",
      timeout: null,
    })
    useAlertStore.getState().upsert({
      id: 'terminal-raw',
      viewport: 'terminal',
      cause: 'terminal:raw-mode',
      level: 'warning',
      title: 'Raw mode',
      message: 'body',
      timeout: null,
    })
    const { queryByTestId } = await renderWithI18n(<ToastViewport id="terminal" />)
    expect(queryByTestId('toast-terminal-raw')).toBeNull()
  })
})
