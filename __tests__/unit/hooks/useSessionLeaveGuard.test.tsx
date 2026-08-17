import { renderHook, act } from '@testing-library/react-native'
import { useSessionLeaveGuard, type BeforeRemoveEvent } from '@/hooks/useSessionLeaveGuard'
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
  let listener: ((e: BeforeRemoveEvent) => void) | undefined
  const dispatch = jest.fn()
  return {
    navigation: {
      addListener: (_event: 'beforeRemove', cb: (e: BeforeRemoveEvent) => void) => {
        listener = cb
        return () => {
          listener = undefined
        }
      },
      dispatch,
    },
    fire: async (overrides?: Partial<BeforeRemoveEvent>) => {
      const preventDefault = jest.fn()
      const action = { type: 'GO_BACK' }
      await act(() => {
        listener?.({
          preventDefault,
          data: { action },
          ...overrides,
        })
      })
      return { preventDefault, action, dispatch }
    },
    dispatch,
  }
}

describe('useSessionLeaveGuard', () => {
  const stopSessionMutate = jest.fn()

  beforeEach(() => {
    stopSessionMutate.mockClear()
    ;(wsManager.send as jest.Mock).mockClear()
    ;(wsManager.status as jest.Mock).mockReturnValue('connected')
    useSettingsStore.setState({ sessionLeaveAction: 'ask' })
    clearSessionLeaveInFlight('sess-live')
  })

  async function setup(session = live, extra?: { isPending?: boolean }) {
    const nav = makeNav()
    const hook = await renderHook(() =>
      useSessionLeaveGuard({
        navigation: nav.navigation,
        serverId: 'srv1',
        sessionId: 'sess-live',
        session,
        isPending: extra?.isPending ?? false,
        stopSessionMutate,
      }),
    )
    return { ...nav, hook }
  }

  it('Always ask: back from live session shows the modal; Cancel stays', async () => {
    const { fire, dispatch, hook } = await setup()
    const { preventDefault } = await fire()
    expect(preventDefault).toHaveBeenCalled()
    expect(hook.result.current.leaveModalVisible).toBe(true)
    expect(dispatch).not.toHaveBeenCalled()
    expect(stopSessionMutate).not.toHaveBeenCalled()

    await act(() => {
      hook.result.current.cancelLeave()
    })
    expect(hook.result.current.leaveModalVisible).toBe(false)
    expect(dispatch).not.toHaveBeenCalled()
    expect(stopSessionMutate).not.toHaveBeenCalled()
    expect(wsManager.send).not.toHaveBeenCalled()
  })

  it('Confirm+Kill calls stop then navigates', async () => {
    const { fire, dispatch, hook } = await setup()
    const { action } = await fire()
    await act(() => {
      hook.result.current.confirmLeave('kill', false)
    })
    expect(stopSessionMutate).toHaveBeenCalled()
    expect(wsManager.send).not.toHaveBeenCalled()
    expect(dispatch).toHaveBeenCalledWith(action)
  })

  it('Confirm+Leave navigates with no stop/hold', async () => {
    const { fire, dispatch, hook } = await setup()
    await fire()
    await act(() => {
      hook.result.current.confirmLeave('leave', false)
    })
    expect(stopSessionMutate).not.toHaveBeenCalled()
    expect(wsManager.send).not.toHaveBeenCalled()
    expect(dispatch).toHaveBeenCalled()
  })

  it('Confirm+Kill on idle sends hold_session then navigates', async () => {
    const { fire, hook } = await setup()
    await fire()
    await act(() => {
      hook.result.current.confirmLeave('kill_on_idle', false)
    })
    expect(wsManager.send).toHaveBeenCalledWith('srv1', {
      type: 'hold_session',
      sessionId: 'sess-live',
    })
    expect(stopSessionMutate).not.toHaveBeenCalled()
  })

  it('kill-on-idle without WS falls back to leave (no stop)', async () => {
    ;(wsManager.status as jest.Mock).mockReturnValue('disconnected')
    const { fire, hook } = await setup()
    await fire()
    await act(() => {
      hook.result.current.confirmLeave('kill_on_idle', false)
    })
    expect(wsManager.send).not.toHaveBeenCalled()
    expect(stopSessionMutate).not.toHaveBeenCalled()
  })

  it('Don’t ask again + Kill it persists the setting; next leave stops with no modal', async () => {
    const first = await setup()
    await first.fire()
    await act(() => {
      first.hook.result.current.confirmLeave('kill', true)
    })
    expect(useSettingsStore.getState().sessionLeaveAction).toBe('kill')
    first.hook.unmount()
    clearSessionLeaveInFlight('sess-live')

    stopSessionMutate.mockClear()
    const second = await setup()
    const { preventDefault } = await second.fire()
    expect(second.hook.result.current.leaveModalVisible).toBe(false)
    expect(preventDefault).toHaveBeenCalled()
    expect(stopSessionMutate).toHaveBeenCalled()
    expect(second.dispatch).toHaveBeenCalled()
  })

  it('Settings Always ask restores the modal', async () => {
    useSettingsStore.setState({ sessionLeaveAction: 'kill' })
    useSettingsStore.getState().setSessionLeaveAction('ask')
    const { fire, hook } = await setup()
    await fire()
    expect(hook.result.current.leaveModalVisible).toBe(true)
  })

  it('Settings Kill it / Leave it / Kill on idle skip the modal', async () => {
    useSettingsStore.setState({ sessionLeaveAction: 'leave' })
    const leaveRun = await setup()
    await leaveRun.fire()
    expect(leaveRun.hook.result.current.leaveModalVisible).toBe(false)
    expect(stopSessionMutate).not.toHaveBeenCalled()
    expect(wsManager.send).not.toHaveBeenCalled()
    leaveRun.hook.unmount()
    clearSessionLeaveInFlight('sess-live')

    useSettingsStore.setState({ sessionLeaveAction: 'kill_on_idle' })
    const idleRun = await setup()
    await idleRun.fire()
    expect(idleRun.hook.result.current.leaveModalVisible).toBe(false)
    expect(wsManager.send).toHaveBeenCalledWith('srv1', {
      type: 'hold_session',
      sessionId: 'sess-live',
    })
    idleRun.hook.unmount()
    clearSessionLeaveInFlight('sess-live')

    useSettingsStore.setState({ sessionLeaveAction: 'kill' })
    const killRun = await setup()
    await killRun.fire()
    expect(killRun.hook.result.current.leaveModalVisible).toBe(false)
    expect(stopSessionMutate).toHaveBeenCalled()
  })

  it('Always ask: empty live session also shows the modal (no auto-stop)', async () => {
    const { fire, dispatch, hook } = await setup(live)
    const { preventDefault } = await fire()
    expect(hook.result.current.leaveModalVisible).toBe(true)
    expect(preventDefault).toHaveBeenCalled()
    expect(stopSessionMutate).not.toHaveBeenCalled()
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('idle / on_hold: no modal', async () => {
    const idle = await setup({ ...live, status: 'idle', ptyAttached: false })
    const idleEvt = await idle.fire()
    expect(idle.hook.result.current.leaveModalVisible).toBe(false)
    expect(idleEvt.preventDefault).not.toHaveBeenCalled()
    idle.hook.unmount()

    const held = await setup({ ...live, status: 'on_hold', ptyAttached: false })
    const heldEvt = await held.fire()
    expect(held.hook.result.current.leaveModalVisible).toBe(false)
    expect(heldEvt.preventDefault).not.toHaveBeenCalled()
    expect(stopSessionMutate).not.toHaveBeenCalled()
  })

  it('one leave through stacked routes: one prompt max', async () => {
    const { fire, hook } = await setup()
    await fire()
    await act(() => {
      hook.result.current.confirmLeave('leave', false)
    })
    const second = await fire()
    expect(second.preventDefault).not.toHaveBeenCalled()
  })
})
