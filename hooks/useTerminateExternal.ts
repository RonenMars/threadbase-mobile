import { useCallback } from 'react'
import { Alert } from 'react-native'
import { useTranslation } from 'react-i18next'
import { createApiForServer, NotFoundError } from '@/services/api-client'
import { queryClient } from '@/services/query-client'

/**
 * Terminate for an external session: the streamer SIGTERMs the
 * process that owns it, which is the user's own terminal session, so every
 * call confirms first. Returns the function that opens that confirmation.
 */
export function useTerminateExternal(serverId: string, sessionId: string): () => void {
  const { t } = useTranslation(['sessions', 'common'])

  return useCallback(() => {
    const run = async () => {
      try {
        await createApiForServer(serverId).post(`/api/sessions/${sessionId}/terminate`)
      } catch (err) {
        // A 404 means the process is already gone: what was asked for.
        if (!(err instanceof NotFoundError)) {
          Alert.alert(t('terminateExternal.failed'), err instanceof Error ? err.message : String(err))
          return
        }
      }
      void queryClient.invalidateQueries({ queryKey: ['sessions'] })
      void queryClient.invalidateQueries({ queryKey: ['conversation', serverId, sessionId] })
    }
    Alert.alert(t('terminateExternal.title'), t('terminateExternal.body'), [
      { text: t('common:button.cancel'), style: 'cancel' },
      { text: t('terminateExternal.confirm'), style: 'destructive', onPress: () => void run() },
    ])
  }, [serverId, sessionId, t])
}
