import { useCallback, useEffect, useRef, useState } from 'react'
import { clientLog } from '@/lib/clientLog'
import {
  applySessionLeaveAction,
  clearSessionLeaveInFlight,
  coerceSessionLeaveAction,
  decideSessionLeave,
  isSessionLeaveInFlight,
  markSessionLeaveInFlight,
  type AppliedSessionLeaveAction,
  type LeaveSessionSnapshot,
} from '@/lib/sessionLeavePolicy'
import { clearSessionUsed, wasSessionUsed } from '@/lib/sessionUsage'
import { wsManager } from '@/services/ws-client'
import { useSettingsStore } from '@/stores/settings'

export interface BeforeRemoveEvent {
  preventDefault: () => void
  data: { action: { type: string } }
}

export interface SessionLeaveNavigation {
  addListener: (event: 'beforeRemove', cb: (e: BeforeRemoveEvent) => void) => () => void
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
  stopSessionMutate: (
    vars: undefined,
    options?: { onError?: (err: unknown) => void },
  ) => void
}): {
  leaveModalVisible: boolean
  cancelLeave: () => void
  confirmLeave: (choice: AppliedSessionLeaveAction, remember: boolean) => void
} {
  const { navigation, serverId, sessionId, session, isPending, stopSessionMutate } = opts
  const [leaveModalVisible, setLeaveModalVisible] = useState(false)
  const pendingActionRef = useRef<{ type: string } | null>(null)
  const allowRemoveRef = useRef(false)
  const modalVisibleRef = useRef(false)
  const sessionRef = useRef(session)
  sessionRef.current = session
  const stopRef = useRef(stopSessionMutate)
  stopRef.current = stopSessionMutate

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
      if (!sessionId || !action) return
      allowRemoveRef.current = true
      markSessionLeaveInFlight(sessionId)
      navigation.dispatch(action)
    },
    [navigation, sessionId],
  )

  useEffect(() => {
    if (isPending || !sessionId) return
    const unsub = navigation.addListener('beforeRemove', (e) => {
      if (allowRemoveRef.current || isSessionLeaveInFlight(sessionId)) return
      if (modalVisibleRef.current) {
        e.preventDefault()
        return
      }

      const decision = decideSessionLeave({
        session: sessionRef.current,
        wasUsed: wasSessionUsed(sessionId),
        setting: coerceSessionLeaveAction(readLeaveSetting()),
      })

      if (decision.kind === 'none') return

      if (decision.kind === 'discard_unused') {
        clientLog.info('session', 'discard unused empty session on back', {
          sessionId,
          serverId,
        })
        clearSessionUsed(sessionId)
        stopRef.current(undefined, {
          onError: (err) => {
            clientLog.info('session', 'discard stop failed', {
              sessionId,
              err: err instanceof Error ? err.message : String(err),
            })
          },
        })
        return
      }

      e.preventDefault()

      if (decision.kind === 'apply') {
        applyChoice(decision.action)
        proceed(e.data.action)
        return
      }

      pendingActionRef.current = e.data.action
      modalVisibleRef.current = true
      setLeaveModalVisible(true)
    })
    return () => {
      unsub()
      if (sessionId) clearSessionLeaveInFlight(sessionId)
    }
  }, [navigation, isPending, sessionId, serverId, applyChoice, proceed])

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
