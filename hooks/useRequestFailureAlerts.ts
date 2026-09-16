import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'expo-router'
import type { TFunction } from 'i18next'
import { useLoadingStateStore, type QueryCategory, type QueryError } from '@/stores/loading-state'
import { useServerFetchStatusStore } from '@/stores/serverFetchStatus'
import { useServersStore } from '@/stores/servers'
import { queryClient } from '@/services/query-client'
import { classifyError } from '@/services/error-policy'
import { useAlertListSync } from '@/hooks/useAlertSync'
import type { AlertInput } from '@/stores/alerts'
import { queryCause, serverCause } from '@/types/alerts'

const VIEWPORT = 'global'

/** Categories published into the global Status sheet. `browse` is excluded:
 * the file-tree screen already renders its own failure inline. */
type SheetCategory = Exclude<QueryCategory, 'browse'>

function isSheetCategory(category: QueryCategory): category is SheetCategory {
  return category !== 'browse'
}

function getCategoryTitle(category: SheetCategory, t: TFunction<'common'>): string {
  switch (category) {
    case 'sessions':
      return t('errorBanner.titleSessions')
    case 'conversations':
      return t('errorBanner.titleConversations')
    case 'messages':
      return t('errorBanner.titleMessages')
    case 'session-detail':
      return t('errorBanner.titleSessionDetail')
    case 'other':
      return t('errorBanner.titleOther')
  }
}

function getCategoryMessage(category: SheetCategory, t: TFunction<'common'>): string {
  switch (category) {
    case 'sessions':
      return t('errorBanner.messageSessions')
    case 'conversations':
      return t('errorBanner.messageConversations')
    case 'messages':
      return t('errorBanner.messageMessages')
    case 'session-detail':
      return t('errorBanner.messageSessionDetail')
    case 'other':
      return t('errorBanner.messageOther')
  }
}

function categoryQueryKey(category: SheetCategory): unknown[] {
  switch (category) {
    case 'sessions': return ['sessions']
    case 'conversations': return ['conversations']
    case 'messages': return ['conversation']
    case 'session-detail': return ['session']
    default: return []
  }
}

export function useRequestFailureAlerts() {
  const errors = useLoadingStateStore((s) => s.errors)
  const dismissError = useLoadingStateStore((s) => s.dismissError)
  const statuses = useServerFetchStatusStore((s) => s.statuses)
  const servers = useServersStore((s) => s.servers)
  const { t } = useTranslation('common')
  const router = useRouter()
  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set())

  const sheetErrors = useMemo(
    (): (QueryError & { category: SheetCategory })[] =>
      errors.filter((e): e is QueryError & { category: SheetCategory } => {
        if (!isSheetCategory(e.category)) return false
        return classifyError({ status: e.status, code: e.code }, t).presentation === 'recovery-sheet'
      }),
    [errors, t],
  )

  const blockingErrors = useMemo(
    (): (QueryError & { category: SheetCategory })[] =>
      errors.filter((e): e is QueryError & { category: SheetCategory } => {
        if (!isSheetCategory(e.category)) return false
        return classifyError({ status: e.status, code: e.code }, t).presentation === 'blocking'
      }),
    [errors, t],
  )

  const failedServerIds = useMemo(
    () => Object.keys(statuses).filter((id) => statuses[id].status === 'error' && servers[id]),
    [statuses, servers],
  )

  const retry = async (id: string, run: () => Promise<unknown>) => {
    setRetryingIds((s) => new Set(s).add(id))
    try {
      await run()
    } finally {
      setRetryingIds((s) => {
        const next = new Set(s)
        next.delete(id)
        return next
      })
    }
  }

  const entries = useMemo((): AlertInput[] => {
    const serverRows: AlertInput[] = failedServerIds.map((serverId): AlertInput => {
      const entry = statuses[serverId]
      const server = servers[serverId]
      const label = server.label?.trim() || server.url
      return {
        id: serverId,
        viewport: VIEWPORT,
        cause: serverCause(serverId),
        level: 'error',
        title: label,
        message: t('errorBanner.messageConnection', { label }),
        code: entry.code ?? (entry.httpStatus ? `HTTP_${entry.httpStatus}` : undefined),
        rawMessage: entry.error,
        retryable: true,
        retrying: retryingIds.has(serverId),
        timeout: null,
        buttonText: t('button.retry'),
        buttonAction: () => {
          void retry(serverId, () =>
            queryClient.invalidateQueries({
              predicate: (query) => query.queryKey.includes(serverId),
            }),
          )
        },
        buttonVariant: 'primary',
      }
    })

    const categoryRows: AlertInput[] = sheetErrors.map((error): AlertInput => {
      const classified = classifyError({ status: error.status, code: error.code }, t)
      const retryable = classified.retryable
      const base: AlertInput = {
        id: error.id,
        viewport: VIEWPORT,
        cause: queryCause(error.id),
        level: 'error',
        title: getCategoryTitle(error.category, t),
        message: classified.description ?? getCategoryMessage(error.category, t),
        code: error.code ?? (error.status ? `HTTP_${error.status}` : undefined),
        rawMessage: error.message,
        retryable,
        retrying: retryingIds.has(error.id),
        timeout: null,
      }
      if (!retryable) return base
      return {
        ...base,
        buttonText: t('button.retry'),
        buttonAction: () => {
          void retry(error.id, () =>
            queryClient.invalidateQueries({ queryKey: categoryQueryKey(error.category) }),
          ).then(() => dismissError(error.id))
        },
        buttonVariant: 'primary',
      }
    })

    const blockingRows: AlertInput[] = blockingErrors.map((error): AlertInput => {
      const classified = classifyError({ status: error.status, code: error.code }, t)
      const close = () => {
        useLoadingStateStore.getState().dismissError(error.id, true)
      }
      return {
        id: `blocking:${error.id}`,
        viewport: VIEWPORT,
        cause: queryCause(error.id),
        level: 'critical',
        title: classified.description ?? t('errorPolicy.sessionExpired'),
        message: t('errorPolicy.blockingHint'),
        code: classified.code,
        rawMessage: error.message,
        retryable: false,
        timeout: null,
        buttonText: t('button.openSettings'),
        buttonAction: () => {
          close()
          router.push('/settings')
        },
        buttonVariant: 'primary',
        onClose: close,
      }
    })

    const rest = failedServerIds.length > 0 ? serverRows : categoryRows
    return [...blockingRows, ...rest]
  }, [failedServerIds, sheetErrors, blockingErrors, servers, statuses, retryingIds, t, dismissError, router])

  useAlertListSync(entries)
}
