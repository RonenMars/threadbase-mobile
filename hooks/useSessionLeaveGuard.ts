import { useCallback, useEffect, useRef, useState } from 'react'
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

function sendHoldSession(serverId: string, sessionId: string): boolean {
  if (wsManager.status(serverId) !== 'connected') {
    clientLog.info('session', 'kill-on-idle fallback to leave (no WS)', { serverId, sessionId })
    return false
  }
  wsManager.send(serverId, { type: 'hold_session', sessionId })
  return true
}

export function useSessionLeaveGuard(opts: {
  navigation: SessionLeaveNavigation
  serverId: string
  sessionId: string | undefined
  session: LeaveSessionSnapshot | null | undefined
  isPending: boolean
  skipInitialReplace?: boolean
  stopSessionMutate: (
    vars: undefined,
    options?: { onError?: (err: unknown) => void },
  ) => void
}): {
  leaveModalVisible: boolean
  cancelLeave: () => void
  confirmLeave: (choice: AppliedSessionLeaveAction, remember: boolean) => void
} {
  const { navigation, serverId, sessionId, session, isPending, skipInitialReplace = false, stopSessionMutate } = opts
  const [leaveModalVisible, setLeaveModalVisible] = useState(false)
  const [continueAction, setContinueAction] = useState<{ type: string } | null>(null)
  const pendingActionRef = useRef<{ type: string } | null>(null)
  const skipInitialReplaceRef = useRef(skipInitialReplace)
  const modalVisibleRef = useRef(false)
  const sessionRef = useRef(session)
  const stopRef = useRef(stopSessionMutate)
  useEffect(() => {
    sessionRef.current = session
  }, [session])
  useEffect(() => {
    stopRef.current = stopSessionMutate
  }, [stopSessionMutate])
  useEffect(() => {
    if (!skipInitialReplace) return
    const timer = setTimeout(() => {
      skipInitialReplaceRef.current = false
    }, 0)
    return () => clearTimeout(timer)
  }, [skipInitialReplace])

  const applyChoice = useCallback(
    (choice: AppliedSessionLeaveAction) => {
      if (!sessionId) return
      const result = applySessionLeaveAction({
        action: choice,
        stopSession: () => {
          stopRef.current(undefined, {
            onError: (err) => {
              clientLog.info('session', 'leave stop failed', {
                sessionId,
                err: err instanceof Error ? err.message : String(err),
              })
            },
          })
        },
        sendHold: () => sendHoldSession(serverId, sessionId),
      })
      if (result === 'leave_fallback') {
        clientLog.info('session', 'kill-on-idle fell back to leave', { sessionId, serverId })
      }
    },
    [serverId, sessionId],
  )

  const proceed = useCallback(
    (action: { type: string } | null) => {
      if (!action) return
      setContinueAction(action)
    },
    [],
  )

  const shouldPreventRemove = !continueAction && !isPending && Boolean(sessionId) && isLiveAttachedPty(session)
  usePreventRemove(shouldPreventRemove, ({ data }) => {
    if (!sessionId || modalVisibleRef.current) return

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
      applyChoice(decision.action)
      proceed(data.action)
      return
    }

    pendingActionRef.current = data.action
    modalVisibleRef.current = true
    setLeaveModalVisible(true)
  })

  useEffect(() => {
    if (!continueAction) return
    navigation.dispatch(continueAction)
  }, [continueAction, navigation])

  const cancelLeave = useCallback(() => {
    modalVisibleRef.current = false
    pendingActionRef.current = null
    setLeaveModalVisible(false)
  }, [])

  const confirmLeave = useCallback(
    (choice: AppliedSessionLeaveAction, remember: boolean) => {
      if (remember) persistLeaveSetting(choice)
      applyChoice(choice)
      const action = pendingActionRef.current
      modalVisibleRef.current = false
      pendingActionRef.current = null
      setLeaveModalVisible(false)
      proceed(action)
    },
    [applyChoice, proceed],
  )

  return { leaveModalVisible, cancelLeave, confirmLeave }
}
