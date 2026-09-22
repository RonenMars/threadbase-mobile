import { useEffect, useState } from 'react'
import { Alert } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useSessionActions } from '@/hooks/useSessionActions'
import { sessionEndKey, supportsSessionEndActions } from '@/lib/sessionEnd'
import { SessionNotFoundError } from '@/services/api-client'
import { wsManager } from '@/services/ws-client'
import { useServersStore } from '@/stores/servers'
import { useSessionEndStore } from '@/stores/sessionEnd'

export type EndSessionDialog = 'delete' | 'watchers' | null

/**
 * The end-session actions behind both the session header menu and the list's
 * action sheet. Terminate is a plain /stop that every server answers; the
 * others are offered only when `supported`.
 */
export function useEndSession(serverId: string, sessionId: string, live: boolean) {
  const { t } = useTranslation('sessions')
  const { stopSession, stopWhenIdle } = useSessionActions(serverId, sessionId)
  const supported = useServersStore((s) =>
    supportsSessionEndActions(s.servers?.[serverId]?.serverInfo?.version),
  )
  const key = sessionEndKey(serverId, sessionId)
  const armed = useSessionEndStore((s) => s.armed[key] === true)
  const terminatingAt = useSessionEndStore((s) => s.terminatingAt[key])
  const [dialog, setDialog] = useState<EndSessionDialog>(null)
  // Set from the confirm tap, not the response: the session_update that ends
  // the session can arrive on the socket before the /stop stream closes.
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!live) useSessionEndStore.getState().clear(key)
  }, [live, key])

  const fail = () => Alert.alert(t('endSession.section'), t('endSession.failed'))
  // A 404 from /stop or /kill means the PTY is already gone: what was asked for.
  const failUnlessGone = (err: Error) => {
    if (!(err instanceof SessionNotFoundError)) fail()
  }

  const terminate = () => {
    useSessionEndStore.getState().setTerminating(key, Date.now())
    stopSession.mutate({}, {
      onError: (err) => {
        useSessionEndStore.getState().setTerminating(key, null)
        failUnlessGone(err)
      },
    })
  }

  const forceTerminate = () => {
    useSessionEndStore.getState().setTerminating(key, null)
    stopSession.mutate({ force: true }, { onError: failUnlessGone })
  }

  // Without ignoreWatchers the latch is cancelled by the next subscribe, this
  // phone's own included, so every arm the user asked for is pinned with it.
  const arm = async () => {
    const result = await stopWhenIdle.mutateAsync({ ignoreWatchers: true })
    if (result.status === 'armed') useSessionEndStore.getState().markArmed(key)
  }

  const terminateWhenDone = async () => {
    try {
      const probe = await stopWhenIdle.mutateAsync({})
      if (probe.status === 'killed') return
      if (probe.status === 'watchers_present') {
        // The server counts this phone's own socket whenever it is subscribed.
        const self = wsManager.isSessionAcquired(serverId, sessionId) ? 1 : 0
        if (probe.watcherCount - self > 0) {
          setDialog('watchers')
          return
        }
      }
      await arm()
    } catch {
      fail()
    }
  }

  const confirmWatchers = () => {
    setDialog(null)
    arm().catch(fail)
  }

  const confirmDelete = () => {
    setDialog(null)
    setDeleting(true)
    stopSession.mutate({ delete: true }, {
      onError: () => {
        setDeleting(false)
        fail()
      },
    })
  }

  return {
    supported,
    armed,
    terminatingAt,
    terminate,
    forceTerminate,
    terminateWhenDone,
    requestDelete: () => setDialog('delete'),
    deleting,
    dialog,
    confirmDelete,
    confirmWatchers,
    dismissDialog: () => setDialog(null),
  }
}
