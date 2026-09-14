import React from 'react'
import { fireEvent } from '@testing-library/react-native'
import { ToastViewport } from '@/components/ui/ToastViewport'
import { useAlertStore, type AlertInput } from '@/stores/alerts'
import { renderWithI18n } from '@/test-utils/render'

const serverState: AlertInput = {
  id: 'server-state',
  viewport: 'home',
  cause: 'servers:summary',
  level: 'warning',
  title: 'My Server is unreachable. Some sessions may be missing.',
  message: 'This server did not respond.',
  timeout: null,
}

beforeEach(() => {
  useAlertStore.getState().reset()
})

describe('ToastViewport', () => {
  // ServerStateMessage carries its explanation in `message` and sets no
  // `details`, so gating the details sheet on `details` alone made that copy
  // unreachable in every language.
  it('opens the details sheet for a toast whose only body copy is message', async () => {
    useAlertStore.getState().upsert(serverState)
    const { findByTestId, queryByTestId, getByText } = await renderWithI18n(
      <ToastViewport id="home" />,
    )
    expect(queryByTestId('alert-details-sheet')).toBeNull()
    fireEvent.press(await findByTestId('toast-server-state'))
    expect(await findByTestId('alert-details-sheet')).toBeTruthy()
    expect(getByText('This server did not respond.')).toBeTruthy()
  })

  it('prefers an explicit onPress over the details sheet', async () => {
    const onPress = jest.fn()
    useAlertStore.getState().upsert({ ...serverState, id: 'host-pressure', onPress })
    const { findByTestId, queryByTestId } = await renderWithI18n(<ToastViewport id="home" />)
    fireEvent.press(await findByTestId('toast-host-pressure'))
    expect(onPress).toHaveBeenCalledTimes(1)
    expect(queryByTestId('alert-details-sheet')).toBeNull()
  })

  it('renders only the toasts belonging to its own viewport', async () => {
    useAlertStore.getState().upsert(serverState)
    useAlertStore.getState().upsert({ ...serverState, id: 'terminal-raw', viewport: 'terminal' })
    const { queryByTestId } = await renderWithI18n(<ToastViewport id="home" />)
    expect(queryByTestId('toast-server-state')).toBeTruthy()
    expect(queryByTestId('toast-terminal-raw')).toBeNull()
  })

  it('runs the action the store currently holds, not the one captured at render', async () => {
    const stale = jest.fn()
    const fresh = jest.fn()
    useAlertStore.getState().upsert({ ...serverState, buttonText: 'Details', buttonAction: stale })
    const { findByTestId } = await renderWithI18n(<ToastViewport id="home" />)
    // Same copy, so the store refreshes callbacks in place without a re-render.
    useAlertStore.getState().upsert({ ...serverState, buttonText: 'Details', buttonAction: fresh })
    fireEvent.press(await findByTestId('toast-action-server-state'))
    expect(fresh).toHaveBeenCalledTimes(1)
    expect(stale).not.toHaveBeenCalled()
  })
})
