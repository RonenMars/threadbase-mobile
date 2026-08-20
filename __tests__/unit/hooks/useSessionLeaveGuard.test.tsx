import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { usePreventRemove } from 'expo-router/react-navigation'
import { useSessionLeaveGuard } from '@/hooks/useSessionLeaveGuard'
import { clearSessionLeaveInFlight } from '@/lib/sessionLeavePolicy'
import { useSettingsStore } from '@/stores/settings'
import { wsManager } from '@/services/ws-client'

jest.mock('@/services/ws-client', () => ({
  wsManager: {
    status: jest.fn(() => 'connected'),
    send: jest.fn(),
  },
}))

const live = {
  ptyAttached: true,
  status: 'running',
  promptCount: 3,
  resumedFromConversationId: null as string | null,
}

function makeNav() {
  const dispatch = jest.fn()
  return {
    navigation: {
      dispatch,
    },
    fire: async (type = 'GO_BACK') => {
      const [preventRemove, callback] = (usePreventRemove as jest.Mock).mock.calls.at(-1) ?? []
      const action = { type }
      if (preventRemove) {
        await act(() => {
          callback({ data: { action } })
        })
      }
      return { preventRemove, action, dispatch }
    },
    dispatch,
  }
}

type StopSessionMutate = Parameters<typeof useSessionLeaveGuard>[0]['stopSessionMutate']

function LeaveGuardProbe({
  navigation,
  session,
  isPending,
  skipInitialReplace,
  stopSessionMutate,
}: {
  navigation: ReturnType<typeof makeNav>['navigation']
  session: typeof live
  isPending: boolean
  skipInitialReplace?: boolean
  stopSessionMutate: StopSessionMutate
}) {
  const { leaveModalVisible, cancelLeave, confirmLeave } = useSessionLeaveGuard({
    navigation,
    serverId: 'srv1',
    sessionId: 'sess-live',
    session,
    isPending,
    skipInitialReplace,
    stopSessionMutate,
  })
  return (
    <View>
      <Text testID="leave-modal-visible">{leaveModalVisible ? 'yes' : 'no'}</Text>
      <Pressable testID="leave-cancel" onPress={cancelLeave} />
      <Pressable testID="leave-confirm-kill" onPress={() => confirmLeave('kill', false)} />
      <Pressable testID="leave-confirm-leave" onPress={() => confirmLeave('leave', false)} />
      <Pressable testID="leave-confirm-idle" onPress={() => confirmLeave('kill_on_idle', false)} />
      <Pressable
        testID="leave-confirm-kill-remember"
        onPress={() => confirmLeave('kill', true)}
      />
    </View>
  )
}

describe('useSessionLeaveGuard', () => {
  const stopSessionMutate = jest.fn()

  beforeEach(() => {
    ;(usePreventRemove as jest.Mock).mockClear()
    stopSessionMutate.mockClear()
    ;(wsManager.send as jest.Mock).mockClear()
    ;(wsManager.status as jest.Mock).mockReturnValue('connected')
    useSettingsStore.setState({ sessionLeaveAction: 'ask' })
    clearSessionLeaveInFlight('sess-live')
  })

  async function setup(session = live, extra?: { isPending?: boolean; skipInitialReplace?: boolean }) {
    const nav = makeNav()
    const view = await render(
      <LeaveGuardProbe
        navigation={nav.navigation}
        session={session}
        isPending={extra?.isPending ?? false}
        skipInitialReplace={extra?.skipInitialReplace}
        stopSessionMutate={stopSessionMutate}
      />,
    )
    return { ...nav, unmount: view.unmount }
  }

  it('Always ask: back from live session shows the modal; Cancel stays', async () => {
    const { fire, dispatch } = await setup()
    const { preventRemove } = await fire()
    expect(preventRemove).toBe(true)
    expect(screen.getByTestId('leave-modal-visible')).toHaveTextContent('yes')
    expect(dispatch).not.toHaveBeenCalled()
    expect(stopSessionMutate).not.toHaveBeenCalled()

    await fireEvent.press(screen.getByTestId('leave-cancel'))
    expect(screen.getByTestId('leave-modal-visible')).toHaveTextContent('no')
    expect(dispatch).not.toHaveBeenCalled()
    expect(stopSessionMutate).not.toHaveBeenCalled()
    expect(wsManager.send).not.toHaveBeenCalled()
  })

  it('Confirm+Kill calls stop then navigates', async () => {
    const { fire, dispatch } = await setup()
    const { action } = await fire()
    await fireEvent.press(screen.getByTestId('leave-confirm-kill'))
    expect(stopSessionMutate).toHaveBeenCalled()
    expect(wsManager.send).not.toHaveBeenCalled()
    expect(dispatch).toHaveBeenCalledWith(action)
  })

  it('Confirm+Leave navigates with no stop/hold', async () => {
    const { fire, dispatch } = await setup()
    await fire()
    await fireEvent.press(screen.getByTestId('leave-confirm-leave'))
    expect(stopSessionMutate).not.toHaveBeenCalled()
    expect(wsManager.send).not.toHaveBeenCalled()
    expect(dispatch).toHaveBeenCalled()
  })

  it('allows the automatic replacement that opens a starting session', async () => {
    const { fire, dispatch } = await setup(live, { skipInitialReplace: true })
    const { action } = await fire('REPLACE')

    expect(screen.getByTestId('leave-modal-visible')).toHaveTextContent('no')
    expect(dispatch).toHaveBeenCalledWith(action)
  })

  it('turns off removal prevention before continuing a confirmed leave', async () => {
    const { fire } = await setup()
    await fire()

    await fireEvent.press(screen.getByTestId('leave-confirm-leave'))

    const [preventRemove] = (usePreventRemove as jest.Mock).mock.calls.at(-1)
    expect(preventRemove).toBe(false)
  })

  it('Confirm+Kill on idle sends hold_session then navigates', async () => {
    const { fire } = await setup()
    await fire()
    await fireEvent.press(screen.getByTestId('leave-confirm-idle'))
    expect(wsManager.send).toHaveBeenCalledWith('srv1', {
      type: 'hold_session',
      sessionId: 'sess-live',
    })
    expect(stopSessionMutate).not.toHaveBeenCalled()
  })

  it('kill-on-idle without WS falls back to leave (no stop)', async () => {
    ;(wsManager.status as jest.Mock).mockReturnValue('disconnected')
    const { fire } = await setup()
    await fire()
    await fireEvent.press(screen.getByTestId('leave-confirm-idle'))
    expect(wsManager.send).not.toHaveBeenCalled()
    expect(stopSessionMutate).not.toHaveBeenCalled()
  })

  it('Don’t ask again + Kill it persists the setting; next leave stops with no modal', async () => {
    const first = await setup()
    await first.fire()
    await fireEvent.press(screen.getByTestId('leave-confirm-kill-remember'))
    expect(useSettingsStore.getState().sessionLeaveAction).toBe('kill')
    await first.unmount()
    clearSessionLeaveInFlight('sess-live')

    stopSessionMutate.mockClear()
    const second = await setup()
    const { preventRemove } = await second.fire()
    expect(screen.getByTestId('leave-modal-visible')).toHaveTextContent('no')
    expect(preventRemove).toBe(true)
    expect(stopSessionMutate).toHaveBeenCalled()
    expect(second.dispatch).toHaveBeenCalled()
  })

  it('Settings Always ask restores the modal', async () => {
    useSettingsStore.setState({ sessionLeaveAction: 'kill' })
    useSettingsStore.getState().setSessionLeaveAction('ask')
    const { fire } = await setup()
    await fire()
    expect(screen.getByTestId('leave-modal-visible')).toHaveTextContent('yes')
  })

  it('Settings Kill it / Leave it / Kill on idle skip the modal', async () => {
    useSettingsStore.setState({ sessionLeaveAction: 'leave' })
    const leaveRun = await setup()
    await leaveRun.fire()
    expect(screen.getByTestId('leave-modal-visible')).toHaveTextContent('no')
    expect(stopSessionMutate).not.toHaveBeenCalled()
    expect(wsManager.send).not.toHaveBeenCalled()
    await leaveRun.unmount()
    clearSessionLeaveInFlight('sess-live')

    useSettingsStore.setState({ sessionLeaveAction: 'kill_on_idle' })
    const idleRun = await setup()
    await idleRun.fire()
    expect(screen.getByTestId('leave-modal-visible')).toHaveTextContent('no')
    expect(wsManager.send).toHaveBeenCalledWith('srv1', {
      type: 'hold_session',
      sessionId: 'sess-live',
    })
    await idleRun.unmount()
    clearSessionLeaveInFlight('sess-live')

    useSettingsStore.setState({ sessionLeaveAction: 'kill' })
    const killRun = await setup()
    await killRun.fire()
    expect(screen.getByTestId('leave-modal-visible')).toHaveTextContent('no')
    expect(stopSessionMutate).toHaveBeenCalled()
  })

  it('Always ask: empty live session also shows the modal (no auto-stop)', async () => {
    const { fire, dispatch } = await setup(live)
    const { preventRemove } = await fire()
    expect(screen.getByTestId('leave-modal-visible')).toHaveTextContent('yes')
    expect(preventRemove).toBe(true)
    expect(stopSessionMutate).not.toHaveBeenCalled()
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('idle / on_hold: no modal', async () => {
    const idle = await setup({ ...live, status: 'idle', ptyAttached: false })
    const idleEvt = await idle.fire()
    expect(screen.getByTestId('leave-modal-visible')).toHaveTextContent('no')
    expect(idleEvt.preventRemove).toBe(false)
    await idle.unmount()

    const held = await setup({ ...live, status: 'on_hold', ptyAttached: false })
    const heldEvt = await held.fire()
    expect(screen.getByTestId('leave-modal-visible')).toHaveTextContent('no')
    expect(heldEvt.preventRemove).toBe(false)
    expect(stopSessionMutate).not.toHaveBeenCalled()
  })

  it('one leave through stacked routes: one prompt max', async () => {
    const { fire } = await setup()
    await fire()
    await fireEvent.press(screen.getByTestId('leave-confirm-leave'))
    const second = await fire()
    expect(second.preventRemove).toBe(false)
  })
})
