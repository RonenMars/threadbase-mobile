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
  const navigateHome = jest.fn()
  return {
    navigation: {
      dispatch,
    },
    navigateHome,
    fire: async (type = 'GO_BACK') => {
      const [preventRemove, callback] = (usePreventRemove as jest.Mock).mock.calls.at(-1) ?? []
      const action = { type }
      if (preventRemove) {
        await act(() => {
          callback({ data: { action } })
        })
      }
      return { preventRemove, action, dispatch, navigateHome }
    },
    dispatch,
  }
}

type StopSessionMutateAsync = Parameters<typeof useSessionLeaveGuard>[0]['stopSessionMutateAsync']

function LeaveGuardProbe({
  navigation,
  navigateHome,
  session,
  isPending,
  skipInitialReplace,
  stopSessionMutateAsync,
}: {
  navigation: ReturnType<typeof makeNav>['navigation']
  navigateHome: () => void
  session: typeof live
  isPending: boolean
  skipInitialReplace?: boolean
  stopSessionMutateAsync: StopSessionMutateAsync
}) {
  const [renderNonce, setRenderNonce] = React.useState(0)
  const {
    leaveModalVisible,
    leavePhase,
    isLeaving,
    cancelLeave,
    confirmLeave,
    dismissLeaveError,
    onModalDismiss,
  } = useSessionLeaveGuard({
    // A fresh object every render, exactly like app/session/[id].tsx passes.
    navigation: { dispatch: (action) => navigation.dispatch(action) },
    navigateHome,
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
      <Text testID="leave-is-leaving">{isLeaving ? 'yes' : 'no'}</Text>
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
        navigateHome={nav.navigateHome}
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
    const { fire, navigateHome } = await setup()
    const { preventRemove } = await fire()
    expect(preventRemove).toBe(true)
    expect(screen.getByTestId('leave-modal-visible')).toHaveTextContent('yes')
    expect(navigateHome).not.toHaveBeenCalled()
    expect(stopSessionMutateAsync).not.toHaveBeenCalled()

    await fireEvent.press(screen.getByTestId('leave-cancel'))
    expect(screen.getByTestId('leave-modal-visible')).toHaveTextContent('no')
    expect(navigateHome).not.toHaveBeenCalled()
    expect(stopSessionMutateAsync).not.toHaveBeenCalled()
    expect(wsManager.holdSessionWaitingInput).not.toHaveBeenCalled()
  })

  it('on iOS, dispatch waits for the real modal dismiss instead of racing it', async () => {
    const { fire, navigateHome } = await setup()
    await fire()
    await fireEvent.press(screen.getByTestId('leave-confirm-leave'))

    // The bug this guards: dispatching while the native <Modal> is still
    // mid-close can be silently dropped by iOS, which read as "the first
    // back press does nothing; a second press then navigates with no modal."
    expect(navigateHome).not.toHaveBeenCalled()
    const [preventRemoveStillArmed] = (usePreventRemove as jest.Mock).mock.calls.at(-1)
    expect(preventRemoveStillArmed).toBe(true)

    await fireModalDismiss()
    expect(navigateHome).toHaveBeenCalled()
  })

  it('on iOS, dispatch fires from a bounded fallback if onDismiss never comes', async () => {
    // Confirmed on-device on a build with only the onDismiss-based fix: it
    // does not reliably fire for every choice, stranding the user past the
    // first back press. The fallback must not depend on onDismiss at all.
    jest.useFakeTimers()
    try {
      const { fire, navigateHome } = await setup()
      await fire()
      await act(async () => {
        fireEvent.press(screen.getByTestId('leave-confirm-leave'))
      })
      expect(navigateHome).not.toHaveBeenCalled()

      await act(async () => {
        jest.advanceTimersByTime(500)
      })
      expect(navigateHome).toHaveBeenCalled()
    } finally {
      jest.useRealTimers()
    }
  })

  it('on Android, dispatch fires immediately — no onDismiss race to defer for', async () => {
    Platform.OS = 'android'
    const { fire, navigateHome } = await setup()
    await fire()
    await fireEvent.press(screen.getByTestId('leave-confirm-leave'))
    expect(navigateHome).toHaveBeenCalled()
  })

  it('a back press while awaiting the modal dismiss is swallowed, not re-prompted', async () => {
    const { fire, navigateHome } = await setup()
    await fire()
    await fireEvent.press(screen.getByTestId('leave-confirm-leave'))
    expect(navigateHome).not.toHaveBeenCalled()

    await fire()
    expect(screen.getByTestId('leave-modal-visible')).toHaveTextContent('no')
    expect(navigateHome).not.toHaveBeenCalled()
  })

  it('Confirm+Kill shows a loader, awaits stop, then navigates once dismissed', async () => {
    const { fire, navigateHome } = await setup()
    await fire()
    await fireEvent.press(screen.getByTestId('leave-confirm-kill'))
    expect(wsManager.holdSessionWaitingInput).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.getByTestId('leave-phase')).toHaveTextContent('navigating'))
    expect(stopSessionMutateAsync).toHaveBeenCalled()
    expect(navigateHome).not.toHaveBeenCalled()

    await fireModalDismiss()
    expect(navigateHome).toHaveBeenCalled()
  })

  // The response is not what makes a kill stick — the POST is durable once the
  // streamer has it, and the WS `session_update` is what turns the screen to
  // history. Observed 2026-09-12: a stop the streamer answered in 26 ms left
  // the card on "Sending…" for ~10 s while "Session ended" was already
  // rendered behind it.
  it('Kill it stops waiting on the response once the grace window passes', async () => {
    jest.useFakeTimers()
    try {
      stopSessionMutateAsync.mockReturnValueOnce(new Promise<void>(() => {}))
      const { fire, navigateHome } = await setup()
      await fire()
      await act(async () => {
        fireEvent.press(screen.getByTestId('leave-confirm-kill'))
      })
      expect(screen.getByTestId('leave-phase')).toHaveTextContent('pending')

      await act(async () => {
        jest.advanceTimersByTime(1500)
      })
      expect(screen.getByTestId('leave-phase')).toHaveTextContent('navigating')

      await act(async () => {
        jest.advanceTimersByTime(500)
      })
      expect(navigateHome).toHaveBeenCalled()
    } finally {
      jest.useRealTimers()
    }
  })

  it('Confirm+Leave navigates with no stop/hold, once dismissed', async () => {
    const { fire, navigateHome } = await setup()
    await fire()
    await fireEvent.press(screen.getByTestId('leave-confirm-leave'))
    expect(stopSessionMutateAsync).not.toHaveBeenCalled()
    expect(wsManager.holdSessionWaitingInput).not.toHaveBeenCalled()

    await fireModalDismiss()
    expect(navigateHome).toHaveBeenCalled()
  })

  it('allows the automatic replacement that opens a starting session', async () => {
    // No leave modal is ever shown on this path, so there is nothing to
    // dismiss — the effect-driven dispatch stays immediate.
    const { fire, dispatch, navigateHome } = await setup(live, { skipInitialReplace: true })
    const { action } = await fire('REPLACE')

    expect(screen.getByTestId('leave-modal-visible')).toHaveTextContent('no')
    expect(dispatch).toHaveBeenCalledWith(action)
    expect(navigateHome).not.toHaveBeenCalled()
  })

  it('dispatches the continued action once, not on every later render', async () => {
    const { fire, navigateHome } = await setup()
    await fire()
    await fireEvent.press(screen.getByTestId('leave-confirm-leave'))
    await fireModalDismiss()
    await fireEvent.press(screen.getByTestId('force-rerender'))

    expect(navigateHome).toHaveBeenCalledTimes(1)
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
    const { fire, navigateHome } = await setup()
    await fire()
    await fireEvent.press(screen.getByTestId('leave-confirm-idle'))
    expect(wsManager.holdSessionWaitingInput).toHaveBeenCalledWith('srv1', 'sess-live')
    await waitFor(() => expect(screen.getByTestId('leave-phase')).toHaveTextContent('navigating'))
    expect(stopSessionMutateAsync).not.toHaveBeenCalled()
    expect(navigateHome).not.toHaveBeenCalled()

    await fireModalDismiss()
    expect(navigateHome).toHaveBeenCalled()
  })

  // app/session/[id].tsx suppresses its own redirect to /conversation/<id>
  // while `isLeaving` is true. A killed session flips to history the moment
  // the stop lands, so any gap here hands that redirect the screen and the
  // user ends up on the conversation view instead of the homepage.
  it('stays "leaving" for the whole deferred window, so the screen keeps suppressing its redirect', async () => {
    const { fire, navigateHome } = await setup()
    await fire()
    await fireEvent.press(screen.getByTestId('leave-confirm-kill'))

    // The stop has resolved and the modal is closing, but the navigation has
    // not been dispatched yet — the exact window the redirect used to win.
    await waitFor(() => expect(screen.getByTestId('leave-phase')).toHaveTextContent('navigating'))
    expect(navigateHome).not.toHaveBeenCalled()
    expect(screen.getByTestId('leave-is-leaving')).toHaveTextContent('yes')

    await fireModalDismiss()
    expect(navigateHome).toHaveBeenCalled()
    expect(screen.getByTestId('leave-is-leaving')).toHaveTextContent('yes')
  })

  it('kill-on-idle with no ack (old streamer / disconnected) still navigates — degrade, not error', async () => {
    ;(wsManager.holdSessionWaitingInput as jest.Mock).mockResolvedValue(null)
    const { fire, navigateHome } = await setup()
    await fire()
    await fireEvent.press(screen.getByTestId('leave-confirm-idle'))
    await waitFor(() => expect(screen.getByTestId('leave-phase')).toHaveTextContent('navigating'))

    await fireModalDismiss()
    expect(navigateHome).toHaveBeenCalled()
  })

  it('kill-on-idle denied by the streamer shows the error state instead of navigating', async () => {
    ;(wsManager.holdSessionWaitingInput as jest.Mock).mockResolvedValue({
      ok: false,
      reason: 'permission_denied',
    })
    const { fire, navigateHome } = await setup()
    await fire()
    await fireEvent.press(screen.getByTestId('leave-confirm-idle'))
    await waitFor(() => expect(screen.getByTestId('leave-phase')).toHaveTextContent('error'))
    expect(navigateHome).not.toHaveBeenCalled()
  })

  it('a failed Kill it shows the error state; dismissing then pressing back navigates home', async () => {
    stopSessionMutateAsync.mockRejectedValueOnce(new Error('stop failed'))
    const { fire, navigateHome } = await setup()
    await fire()
    await fireEvent.press(screen.getByTestId('leave-confirm-kill'))
    await waitFor(() => expect(screen.getByTestId('leave-phase')).toHaveTextContent('error'))
    expect(navigateHome).not.toHaveBeenCalled()

    // Acknowledging the error itself never dispatches — the error card has
    // already been visible (and closing) for a while, so no dismiss race.
    await fireEvent.press(screen.getByTestId('leave-dismiss-error'))
    expect(screen.getByTestId('leave-phase')).toHaveTextContent('errorAcked')
    expect(navigateHome).not.toHaveBeenCalled()

    await fire()
    expect(navigateHome).toHaveBeenCalled()
    expect(screen.getByTestId('leave-phase')).toHaveTextContent('idle')
  })

  it('a back press while pending is swallowed, not re-shown as the options modal', async () => {
    let resolveStop: () => void = () => {}
    stopSessionMutateAsync.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveStop = resolve
      }),
    )
    const { fire, navigateHome } = await setup()
    await fire()
    await fireEvent.press(screen.getByTestId('leave-confirm-kill'))
    expect(screen.getByTestId('leave-phase')).toHaveTextContent('pending')

    await fire()
    expect(screen.getByTestId('leave-modal-visible')).toHaveTextContent('no')
    expect(navigateHome).not.toHaveBeenCalled()

    await act(async () => {
      resolveStop()
    })
    await waitFor(() => expect(screen.getByTestId('leave-phase')).toHaveTextContent('navigating'))
    await fireModalDismiss()
    expect(navigateHome).toHaveBeenCalled()
  })

  it('Don’t ask again + Kill it persists the setting; next leave stops with no modal', async () => {
    const first = await setup()
    await first.fire()
    await fireEvent.press(screen.getByTestId('leave-confirm-kill-remember'))
    expect(useSettingsStore.getState().sessionLeaveAction).toBe('kill')
    await waitFor(() => expect(screen.getByTestId('leave-phase')).toHaveTextContent('navigating'))
    await fireModalDismiss()
    await waitFor(() => expect(first.navigateHome).toHaveBeenCalled())
    await first.unmount()

    stopSessionMutateAsync.mockClear()
    const second = await setup()
    const { preventRemove } = await second.fire()
    expect(screen.getByTestId('leave-modal-visible')).toHaveTextContent('no')
    expect(preventRemove).toBe(true)
    await waitFor(() => expect(stopSessionMutateAsync).toHaveBeenCalled())
    await fireModalDismiss()
    await waitFor(() => expect(second.navigateHome).toHaveBeenCalled())
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
    const { fire, navigateHome } = await setup(live)
    const { preventRemove } = await fire()
    expect(screen.getByTestId('leave-modal-visible')).toHaveTextContent('yes')
    expect(preventRemove).toBe(true)
    expect(stopSessionMutateAsync).not.toHaveBeenCalled()
    expect(navigateHome).not.toHaveBeenCalled()
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
