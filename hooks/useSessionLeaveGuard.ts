import { useCallback, useEffect, useRef, useState } from 'react'
import { Platform } from 'react-native'
import { usePreventRemove } from 'expo-router/react-navigation'
import { clientLog } from '@/lib/clientLog'
import {
  applySessionLeaveAction,
  coerceSessionLeaveAction,
  decideSessionLeave,
  isLiveAttachedPty,
  type AppliedSessionLeaveAction,
  type LeaveSessionSnapshot,
} from '@/lib/sessionLeavePolicy'
import { wsManager } from '@/services/ws-client'
import { useSettingsStore } from '@/stores/settings'

export interface SessionLeaveNavigation {
  dispatch: (action: { type: string }) => void
}

export type SessionLeavePhase = 'idle' | 'pending' | 'error' | 'errorAcked'

function readLeaveSetting(): unknown {
  const store = useSettingsStore as typeof useSettingsStore & {
    getState?: () => { sessionLeaveAction?: unknown }
  }
  return store.getState?.()?.sessionLeaveAction
}

function persistLeaveSetting(action: AppliedSessionLeaveAction): void {
  const store = useSettingsStore as typeof useSettingsStore & {
    getState?: () => { setSessionLeaveAction?: (v: AppliedSessionLeaveAction) => void }
  }
  store.getState?.()?.setSessionLeaveAction?.(action)
}

async function sendHoldSession(serverId: string, sessionId: string): Promise<boolean> {
  const result = await wsManager.holdSessionWaitingInput(serverId, sessionId)
  // `null` means no ack arrived (disconnected socket, old streamer, or a lost
  // frame) — the server-contract rule is degrade, not error, so this is a
  // soft success, not a failure the user needs to see.
  if (result === null) {
    clientLog.info('session', 'kill-on-idle sent without ack (degraded)', { serverId, sessionId })
    return true
  }
  return result.ok
}

export function useSessionLeaveGuard(opts: {
  navigation: SessionLeaveNavigation
  serverId: string
  sessionId: string | undefined
  session: LeaveSessionSnapshot | null | undefined
  isPending: boolean
  skipInitialReplace?: boolean
  stopSessionMutateAsync: () => Promise<unknown>
}): {
  leaveModalVisible: boolean
  leavePhase: SessionLeavePhase
  isLeaving: boolean
  cancelLeave: () => void
  confirmLeave: (choice: AppliedSessionLeaveAction, remember: boolean) => void
  dismissLeaveError: () => void
  onModalDismiss: () => void
} {
  const {
    navigation,
    serverId,
    sessionId,
    session,
    isPending,
    skipInitialReplace = false,
    stopSessionMutateAsync,
  } = opts
  const [leaveModalVisible, setLeaveModalVisible] = useState(false)
  const [leavePhase, setLeavePhase] = useState<SessionLeavePhase>('idle')
  const [continueAction, setContinueAction] = useState<{ type: string } | null>(null)
  const pendingActionRef = useRef<{ type: string } | null>(null)
  // One-shot, armed at mount and disarmed by the first REPLACE — not on a timer:
  // the automatic replacement lands whenever session_ready arrives, which can be
  // long after the screen mounted.
  const skipInitialReplaceRef = useRef(skipInitialReplace)
  const modalVisibleRef = useRef(false)
  const leavePhaseRef = useRef<SessionLeavePhase>('idle')
  // Mirrors whether the native <Modal> (options, pending, or error) is
  // currently up, independent of the React state that drives it — see
  // finishLeave for why this needs to survive past the state flip that
  // starts the modal's close animation.
  const modalIsShowingRef = useRef(false)
  const pendingContinueRef = useRef<{ type: string } | null>(null)
  const sessionRef = useRef(session)
  const stopRef = useRef(stopSessionMutateAsync)
  const navRef = useRef(navigation)
  useEffect(() => {
    sessionRef.current = session
  }, [session])
  useEffect(() => {
    stopRef.current = stopSessionMutateAsync
  }, [stopSessionMutateAsync])
  useEffect(() => {
    navRef.current = navigation
  }, [navigation])
  useEffect(() => {
    leavePhaseRef.current = leavePhase
  }, [leavePhase])

  const proceed = useCallback(
    (action: { type: string } | null) => {
      if (!action) return
      setContinueAction(action)
    },
    [],
  )

  // navigation.dispatch() fired while the native <Modal> is still mid-dismiss
  // can be silently dropped by iOS UIKit — the app looked like it needed a
  // second back press to actually leave. Defer to the modal's real onDismiss
  // (fired once the close animation has genuinely finished) whenever one was
  // showing. Android's Modal has no equivalent race and never calls
  // onDismiss, so it stays on the immediate path.
  const finishLeave = useCallback(
    (action: { type: string } | null) => {
      if (!action) return
      if (Platform.OS === 'ios' && modalIsShowingRef.current) {
        pendingContinueRef.current = action
        return
      }
      modalIsShowingRef.current = false
      proceed(action)
    },
    [proceed],
  )

  const onModalDismiss = useCallback(() => {
    modalIsShowingRef.current = false
    const action = pendingContinueRef.current
    pendingContinueRef.current = null
    if (action) proceed(action)
  }, [proceed])

  const runLeaveAction = useCallback(
    async (choice: AppliedSessionLeaveAction, action: { type: string } | null) => {
      if (!sessionId) return
      if (choice === 'leave') {
        finishLeave(action)
        return
      }
      modalIsShowingRef.current = true
      setLeavePhase('pending')
      const outcome = await applySessionLeaveAction({
        action: choice,
        stopSession: async () => {
          await stopRef.current()
        },
        sendHold: () => sendHoldSession(serverId, sessionId),
      })
      if (outcome.ok) {
        setLeavePhase('idle')
        finishLeave(action)
        return
      }
      clientLog.info('session', 'leave action failed', { sessionId, serverId, applied: outcome.applied })
      setLeavePhase('error')
    },
    [serverId, sessionId, finishLeave],
  )

  const shouldPreventRemove =
    !continueAction &&
    (leavePhase !== 'idle' || (!isPending && Boolean(sessionId) && isLiveAttachedPty(session)))
  usePreventRemove(shouldPreventRemove, ({ data }) => {
    if (!sessionId) return

    // An acknowledged error means the user already saw it and this back
    // press (or swipe) is the "now take me home" the spec asks for — skip
    // the leave-options modal entirely, this choice was already made.
    if (leavePhaseRef.current === 'errorAcked') {
      setLeavePhase('idle')
      proceed(pendingActionRef.current ?? data.action)
      pendingActionRef.current = null
      return
    }
    // Still sending the action, or the error hasn't been acknowledged yet:
    // swallow the back press rather than re-opening the modal underneath it.
    if (leavePhaseRef.current !== 'idle') return

    // Confirmed and waiting on the native modal's real dismiss (finishLeave)
    // — `leavePhase` is already back to 'idle' for a plain `leave` by this
    // point, so without this check a stray back press here would re-run
    // decideSessionLeave and could re-open the modal underneath the one
    // still animating out.
    if (pendingContinueRef.current) return

    if (modalVisibleRef.current) return

    if (skipInitialReplaceRef.current && data.action.type === 'REPLACE') {
      skipInitialReplaceRef.current = false
      proceed(data.action)
      return
    }

    const decision = decideSessionLeave({
      session: sessionRef.current,
      setting: coerceSessionLeaveAction(readLeaveSetting()),
    })

    if (decision.kind === 'none') {
      proceed(data.action)
      return
    }

    if (decision.kind === 'apply') {
      pendingActionRef.current = data.action
      void runLeaveAction(decision.action, data.action)
      return
    }

    pendingActionRef.current = data.action
    modalVisibleRef.current = true
    modalIsShowingRef.current = true
    setLeaveModalVisible(true)
  })

  // navRef, not navigation: the screen passes a fresh { dispatch } object every
  // render, so depending on it here would re-dispatch the same action on every
  // subsequent render until the screen unmounts.
  useEffect(() => {
    if (!continueAction) return
    navRef.current.dispatch(continueAction)
  }, [continueAction])

  const cancelLeave = useCallback(() => {
    modalVisibleRef.current = false
    modalIsShowingRef.current = false
    pendingActionRef.current = null
    setLeaveModalVisible(false)
  }, [])

  const confirmLeave = useCallback(
    (choice: AppliedSessionLeaveAction, remember: boolean) => {
      if (remember) persistLeaveSetting(choice)
      const action = pendingActionRef.current
      modalVisibleRef.current = false
      setLeaveModalVisible(false)
      void runLeaveAction(choice, action)
    },
    [runLeaveAction],
  )

  const dismissLeaveError = useCallback(() => {
    // No dispatch happens here — the user's next back press (a real gesture,
    // not a programmatic one) is what navigates, well after this card's
    // close animation finishes, so there is no dismiss race to defer for.
    modalIsShowingRef.current = false
    setLeavePhase('errorAcked')
  }, [])

  return {
    leaveModalVisible,
    leavePhase,
    isLeaving: leavePhase !== 'idle' || continueAction != null,
    cancelLeave,
    confirmLeave,
    dismissLeaveError,
    onModalDismiss,
  }
}
