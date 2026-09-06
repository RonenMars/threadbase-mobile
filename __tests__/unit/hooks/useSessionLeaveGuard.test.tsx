import React from 'react'
import { Platform, Pressable, Text, View } from 'react-native'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { usePreventRemove } from 'expo-router/react-navigation'
import { useSessionLeaveGuard } from '@/hooks/useSessionLeaveGuard'
import { useSettingsStore } from '@/stores/settings'
import { wsManager } from '@/services/ws-client'

jest.mock('@/services/ws-client', () => ({
  wsManager: {
    holdSessionWaitingInput: jest.fn(() => Promise.resolve({ ok: true })),
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

type StopSessionMutateAsync = Parameters<typeof useSessionLeaveGuard>[0]['stopSessionMutateAsync']

function LeaveGuardProbe({
  navigation,
  session,
  isPending,
  skipInitialReplace,
  stopSessionMutateAsync,
}: {
  navigation: ReturnType<typeof makeNav>['navigation']
  session: typeof live
  isPending: boolean
  skipInitialReplace?: boolean
  stopSessionMutateAsync: StopSessionMutateAsync
}) {
  const [renderNonce, setRenderNonce] = React.useState(0)
  const {
    leaveModalVisible,
    leavePhase,
    cancelLeave,
    confirmLeave,
    dismissLeaveError,
    onModalDismiss,
  } = useSessionLeaveGuard({
    // A fresh object every render, exactly like app/session/[id].tsx passes.
    navigation: { dispatch: (action) => navigation.dispatch(action) },
    serverId: 'srv1',
    sessionId: 'sess-live',
    session,
    isPending,
    skipInitialReplace,
    stopSessionMutateAsync,
  })
  return (
    <View>
      <Text testID="leave-modal-visible">{leaveModalVisible ? 'yes' : 'no'}</Text>
      <Text testID="leave-phase">{leavePhase}</Text>
      <Pressable testID="leave-cancel" onPress={cancelLeave} />
      <Pressable testID="leave-confirm-kill" onPress={() => confirmLeave('kill', false)} />
      <Pressable testID="leave-confirm-leave" onPress={() => confirmLeave('leave', false)} />
      <Pressable testID="leave-confirm-idle" onPress={() => confirmLeave('kill_on_idle', false)} />
      <Pressable
        testID="leave-confirm-kill-remember"
        onPress={() => confirmLeave('kill', true)}
      />
      <Pressable testID="leave-dismiss-error" onPress={dismissLeaveError} />
      <Pressable testID="leave-modal-dismiss" onPress={onModalDismiss} />
      <Pressable testID="force-rerender" onPress={() => setRenderNonce(renderNonce + 1)} />
    </View>
  )
}

describe('useSessionLeaveGuard', () => {
  const stopSessionMutateAsync = jest.fn(() => Promise.resolve())
  const originalPlatformOS = Platform.OS

  beforeEach(() => {
    ;(usePreventRemove as jest.Mock).mockClear()
    stopSessionMutateAsync.mockClear()
    ;(wsManager.holdSessionWaitingInput as jest.Mock).mockClear()
    ;(wsManager.holdSessionWaitingInput as jest.Mock).mockResolvedValue({ ok: true })
    useSettingsStore.setState({ sessionLeaveAction: 'ask' })
    Platform.OS = 'ios'
  })

  afterEach(() => {
    Platform.OS = originalPlatformOS
  })

  async function setup(session = live, extra?: { isPending?: boolean; skipInitialReplace?: boolean }) {
    const nav = makeNav()
    const view = await render(
      <LeaveGuardProbe
        navigation={nav.navigation}
        session={session}
        isPending={extra?.isPending ?? false}
        skipInitialReplace={extra?.skipInitialReplace}
        stopSessionMutateAsync={stopSessionMutateAsync}
      />,
    )
    return { ...nav, unmount: view.unmount }
  }

  // The modal was showing on every path exercised below (session live ->
  // "Always ask" prompts it), so on iOS every one of these must wait for the
  // simulated native dismiss before dispatch fires — see finishLeave.
  async function fireModalDismiss() {
    await fireEvent.press(screen.getByTestId('leave-modal-dismiss'))
  }

  it('Always ask: back from live session shows the modal; Cancel stays', async () => {
    const { fire, dispatch } = await setup()
    const { preventRemove } = await fire()
    expect(preventRemove).toBe(true)
    expect(screen.getByTestId('leave-modal-visible')).toHaveTextContent('yes')
    expect(dispatch).not.toHaveBeenCalled()
    expect(stopSessionMutateAsync).not.toHaveBeenCalled()

    await fireEvent.press(screen.getByTestId('leave-cancel'))
    expect(screen.getByTestId('leave-modal-visible')).toHaveTextContent('no')
    expect(dispatch).not.toHaveBeenCalled()
    expect(stopSessionMutateAsync).not.toHaveBeenCalled()
    expect(wsManager.holdSessionWaitingInput).not.toHaveBeenCalled()
  })

  it('on iOS, dispatch waits for the real modal dismiss instead of racing it', async () => {
    const { fire, dispatch } = await setup()
    const { action } = await fire()
    await fireEvent.press(screen.getByTestId('leave-confirm-leave'))

    // The bug this guards: dispatching while the native <Modal> is still
    // mid-close can be silently dropped by iOS, which read as "the first
    // back press does nothing; a second press then navigates with no modal."
    expect(dispatch).not.toHaveBeenCalled()
    const [preventRemoveStillArmed] = (usePreventRemove as jest.Mock).mock.calls.at(-1)
    expect(preventRemoveStillArmed).toBe(true)

    await fireModalDismiss()
    expect(dispatch).toHaveBeenCalledWith(action)
  })

  it('on iOS, dispatch fires from a bounded fallback if onDismiss never comes', async () => {
    // Confirmed on-device on a build with only the onDismiss-based fix: it
    // does not reliably fire for every choice, stranding the user past the
    // first back press. The fallback must not depend on onDismiss at all.
    jest.useFakeTimers()
    try {
      const { fire, dispatch } = await setup()
      const { action } = await fire()
      await act(async () => {
        fireEvent.press(screen.getByTestId('leave-confirm-leave'))
      })
      expect(dispatch).not.toHaveBeenCalled()

      await act(async () => {
        jest.advanceTimersByTime(500)
      })
      expect(dispatch).toHaveBeenCalledWith(action)
    } finally {
      jest.useRealTimers()
    }
  })

  it('on Android, dispatch fires immediately — no onDismiss race to defer for', async () => {
    Platform.OS = 'android'
    const { fire, dispatch } = await setup()
    const { action } = await fire()
    await fireEvent.press(screen.getByTestId('leave-confirm-leave'))
    expect(dispatch).toHaveBeenCalledWith(action)
  })

  it('a back press while awaiting the modal dismiss is swallowed, not re-prompted', async () => {
    const { fire, dispatch } = await setup()
    await fire()
    await fireEvent.press(screen.getByTestId('leave-confirm-leave'))
    expect(dispatch).not.toHaveBeenCalled()

    await fire()
    expect(screen.getByTestId('leave-modal-visible')).toHaveTextContent('no')
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('Confirm+Kill shows a loader, awaits stop, then navigates once dismissed', async () => {
    const { fire, dispatch } = await setup()
    const { action } = await fire()
    await fireEvent.press(screen.getByTestId('leave-confirm-kill'))
    expect(wsManager.holdSessionWaitingInput).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.getByTestId('leave-phase')).toHaveTextContent('idle'))
    expect(stopSessionMutateAsync).toHaveBeenCalled()
    expect(dispatch).not.toHaveBeenCalled()

    await fireModalDismiss()
    expect(dispatch).toHaveBeenCalledWith(action)
  })

  it('Confirm+Leave navigates with no stop/hold, once dismissed', async () => {
    const { fire, dispatch } = await setup()
    await fire()
    await fireEvent.press(screen.getByTestId('leave-confirm-leave'))
    expect(stopSessionMutateAsync).not.toHaveBeenCalled()
    expect(wsManager.holdSessionWaitingInput).not.toHaveBeenCalled()

    await fireModalDismiss()
    expect(dispatch).toHaveBeenCalled()
  })

  it('allows the automatic replacement that opens a starting session', async () => {
    // No leave modal is ever shown on this path, so there is nothing to
    // dismiss — the effect-driven dispatch stays immediate.
    const { fire, dispatch } = await setup(live, { skipInitialReplace: true })
    const { action } = await fire('REPLACE')

    expect(screen.getByTestId('leave-modal-visible')).toHaveTextContent('no')
    expect(dispatch).toHaveBeenCalledWith(action)
  })

  it('dispatches the continued action once, not on every later render', async () => {
    const { fire, dispatch } = await setup()
    await fire()
    await fireEvent.press(screen.getByTestId('leave-confirm-leave'))
    await fireModalDismiss()
    await fireEvent.press(screen.getByTestId('force-rerender'))

    expect(dispatch).toHaveBeenCalledTimes(1)
  })

  it('turns off removal prevention only once the deferred dispatch actually fires', async () => {
    const { fire } = await setup()
    await fire()
    await fireEvent.press(screen.getByTestId('leave-confirm-leave'))

    const [stillArmed] = (usePreventRemove as jest.Mock).mock.calls.at(-1)
    expect(stillArmed).toBe(true)

    await fireModalDismiss()
    const [preventRemove] = (usePreventRemove as jest.Mock).mock.calls.at(-1)
    expect(preventRemove).toBe(false)
  })

  it('Confirm+Kill on idle sends when: waiting_input, awaits the ack, then navigates once dismissed', async () => {
    const { fire, dispatch } = await setup()
    const { action } = await fire()
    await fireEvent.press(screen.getByTestId('leave-confirm-idle'))
    expect(wsManager.holdSessionWaitingInput).toHaveBeenCalledWith('srv1', 'sess-live')
    await waitFor(() => expect(screen.getByTestId('leave-phase')).toHaveTextContent('idle'))
    expect(stopSessionMutateAsync).not.toHaveBeenCalled()
    expect(dispatch).not.toHaveBeenCalled()

    await fireModalDismiss()
    expect(dispatch).toHaveBeenCalledWith(action)
  })

  it('kill-on-idle with no ack (old streamer / disconnected) still navigates — degrade, not error', async () => {
    ;(wsManager.holdSessionWaitingInput as jest.Mock).mockResolvedValue(null)
    const { fire, dispatch } = await setup()
    const { action } = await fire()
    await fireEvent.press(screen.getByTestId('leave-confirm-idle'))
    await waitFor(() => expect(screen.getByTestId('leave-phase')).toHaveTextContent('idle'))

    await fireModalDismiss()
    expect(dispatch).toHaveBeenCalledWith(action)
  })

  it('kill-on-idle denied by the streamer shows the error state instead of navigating', async () => {
    ;(wsManager.holdSessionWaitingInput as jest.Mock).mockResolvedValue({
      ok: false,
      reason: 'permission_denied',
    })
    const { fire, dispatch } = await setup()
    await fire()
    await fireEvent.press(screen.getByTestId('leave-confirm-idle'))
    await waitFor(() => expect(screen.getByTestId('leave-phase')).toHaveTextContent('error'))
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('a failed Kill it shows the error state; dismissing then pressing back navigates home', async () => {
    stopSessionMutateAsync.mockRejectedValueOnce(new Error('stop failed'))
    const { fire, dispatch } = await setup()
    const { action } = await fire()
    await fireEvent.press(screen.getByTestId('leave-confirm-kill'))
    await waitFor(() => expect(screen.getByTestId('leave-phase')).toHaveTextContent('error'))
    expect(dispatch).not.toHaveBeenCalled()

    // Acknowledging the error itself never dispatches — the error card has
    // already been visible (and closing) for a while, so no dismiss race.
    await fireEvent.press(screen.getByTestId('leave-dismiss-error'))
    expect(screen.getByTestId('leave-phase')).toHaveTextContent('errorAcked')
    expect(dispatch).not.toHaveBeenCalled()

    await fire()
    expect(dispatch).toHaveBeenCalledWith(action)
    expect(screen.getByTestId('leave-phase')).toHaveTextContent('idle')
  })

  it('a back press while pending is swallowed, not re-shown as the options modal', async () => {
    let resolveStop: () => void = () => {}
    stopSessionMutateAsync.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveStop = resolve
      }),
    )
    const { fire, dispatch } = await setup()
    await fire()
    await fireEvent.press(screen.getByTestId('leave-confirm-kill'))
    expect(screen.getByTestId('leave-phase')).toHaveTextContent('pending')

    await fire()
    expect(screen.getByTestId('leave-modal-visible')).toHaveTextContent('no')
    expect(dispatch).not.toHaveBeenCalled()

    await act(async () => {
      resolveStop()
    })
    await waitFor(() => expect(screen.getByTestId('leave-phase')).toHaveTextContent('idle'))
    await fireModalDismiss()
    expect(dispatch).toHaveBeenCalled()
  })

  it('Don’t ask again + Kill it persists the setting; next leave stops with no modal', async () => {
    const first = await setup()
    await first.fire()
    await fireEvent.press(screen.getByTestId('leave-confirm-kill-remember'))
    expect(useSettingsStore.getState().sessionLeaveAction).toBe('kill')
    await waitFor(() => expect(screen.getByTestId('leave-phase')).toHaveTextContent('idle'))
    await fireModalDismiss()
    await waitFor(() => expect(first.dispatch).toHaveBeenCalled())
    await first.unmount()

    stopSessionMutateAsync.mockClear()
    const second = await setup()
    const { preventRemove } = await second.fire()
    expect(screen.getByTestId('leave-modal-visible')).toHaveTextContent('no')
    expect(preventRemove).toBe(true)
    await waitFor(() => expect(stopSessionMutateAsync).toHaveBeenCalled())
    await fireModalDismiss()
    await waitFor(() => expect(second.dispatch).toHaveBeenCalled())
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
    expect(stopSessionMutateAsync).not.toHaveBeenCalled()
    expect(wsManager.holdSessionWaitingInput).not.toHaveBeenCalled()
    await leaveRun.unmount()

    useSettingsStore.setState({ sessionLeaveAction: 'kill_on_idle' })
    const idleRun = await setup()
    await idleRun.fire()
    expect(screen.getByTestId('leave-modal-visible')).toHaveTextContent('no')
    await waitFor(() =>
      expect(wsManager.holdSessionWaitingInput).toHaveBeenCalledWith('srv1', 'sess-live'),
    )
    await idleRun.unmount()

    useSettingsStore.setState({ sessionLeaveAction: 'kill' })
    const killRun = await setup()
    await killRun.fire()
    expect(screen.getByTestId('leave-modal-visible')).toHaveTextContent('no')
    await waitFor(() => expect(stopSessionMutateAsync).toHaveBeenCalled())
  })

  it('Always ask: empty live session also shows the modal (no auto-stop)', async () => {
    const { fire, dispatch } = await setup(live)
    const { preventRemove } = await fire()
    expect(screen.getByTestId('leave-modal-visible')).toHaveTextContent('yes')
    expect(preventRemove).toBe(true)
    expect(stopSessionMutateAsync).not.toHaveBeenCalled()
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
    expect(stopSessionMutateAsync).not.toHaveBeenCalled()
  })

  it('one leave through stacked routes: one prompt max', async () => {
    const { fire } = await setup()
    await fire()
    await fireEvent.press(screen.getByTestId('leave-confirm-leave'))
    await fireModalDismiss()
    const second = await fire()
    expect(second.preventRemove).toBe(false)
  })
})
