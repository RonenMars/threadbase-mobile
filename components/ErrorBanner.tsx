import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { useLoadingStateStore, type QueryCategory, type QueryError } from '@/stores/loading-state'
import { useServerFetchStatusStore } from '@/stores/serverFetchStatus'
import { useServersStore } from '@/stores/servers'
import { useErrorSheetStore } from '@/stores/errorSheet'
import { ServerErrorModal } from '@/components/servers/ServerErrorModal'
import { ErrorRecoverySheet } from '@/components/ui/ErrorRecoverySheet'
import { IssuesIndicator } from '@/components/ui/IssuesIndicator'
import { queryClient } from '@/services/query-client'
import { classifyError } from '@/services/error-policy'
import type { AlertItem } from '@/types/alerts'

/** Categories rendered in the global recovery sheet. `browse` is deliberately
 * excluded: the file-tree screen already renders its own failure inline
 * (app/browse.tsx), and the rest of the app stays fully usable when it fails
 * — the local/Option-2 case, not the sheet's job. */
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

export function ErrorBanner() {
  const errors = useLoadingStateStore((s) => s.errors)
  const dismissError = useLoadingStateStore((s) => s.dismissError)
  const statuses = useServerFetchStatusStore((s) => s.statuses)
  const servers = useServersStore((s) => s.servers)
  const { t } = useTranslation('common')
  const [errorServerId, setErrorServerId] = useState<string | null>(null)
  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set())
  const [retryingAll, setRetryingAll] = useState(false)
  const sheetOpen = useErrorSheetStore((s) => s.open)
  const openSheet = useErrorSheetStore((s) => s.openSheet)
  const closeSheet = useErrorSheetStore((s) => s.closeSheet)

  const sheetErrors = useMemo(
    (): (QueryError & { category: SheetCategory })[] =>
      errors.filter((e): e is QueryError & { category: SheetCategory } => isSheetCategory(e.category)),
    [errors],
  )

  // Only servers still in the store: a row whose ServerConfig cannot be
  // resolved renders as a bare id and taps into a modal that returns null, so
  // it reads as a dead button. Dropping it falls through to the category rows,
  // which always carry their own details.
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

  const items = useMemo((): AlertItem[] => {
    const serverRows: AlertItem[] = failedServerIds.map((serverId): AlertItem => {
      const entry = statuses[serverId]
      const server = servers[serverId]
      const label = server.label?.trim() || server.url
      return {
        id: serverId,
        title: label,
        message: t('errorBanner.messageConnection', { label }),
        code: entry.code ?? (entry.httpStatus ? `HTTP_${entry.httpStatus}` : undefined),
        rawMessage: entry.error,
        retrying: retryingIds.has(serverId),
        onPress: () => setErrorServerId(serverId),
        buttonText: t('button.retry'),
        // No explicit dismiss on success: this row is driven by
        // serverFetchStatus, which clears itself via recordSuccess/recordReady
        // once the invalidated queries land — the row disappears on its own.
        buttonAction: () => {
          void retry(serverId, () =>
            // serverId sits at varying positions across key shapes
            // (['session', id, …] vs ['conversations', filter, epoch, …ids]),
            // so match on membership rather than a key prefix.
            queryClient.invalidateQueries({
              predicate: (query) => query.queryKey.includes(serverId),
            }),
          )
        },
        buttonVariant: 'primary',
      }
    })

    const categoryRows: AlertItem[] = sheetErrors.map((error): AlertItem => {
      const classified = classifyError({ status: error.status, code: error.code }, t)
      // A 404 is not retryable, and offering Retry on one is the whole
      // "Retry usually fixes it" complaint: the button re-runs a request whose
      // answer will not change, so the row never clears.
      const retryAction = classified.retryable
        ? {
            buttonText: t('button.retry'),
            buttonAction: () => {
              void retry(error.id, () =>
                queryClient.invalidateQueries({ queryKey: categoryQueryKey(error.category) }),
              ).then(() => dismissError(error.id))
            },
            buttonVariant: 'primary' as const,
          }
        : {}
      return {
        id: error.id,
        title: getCategoryTitle(error.category, t),
        message: classified.description ?? getCategoryMessage(error.category, t),
        code: error.code ?? (error.status ? `HTTP_${error.status}` : undefined),
        rawMessage: error.message,
        retrying: retryingIds.has(error.id),
        ...retryAction,
      }
    })

    return failedServerIds.length > 0 ? serverRows : categoryRows
  }, [failedServerIds, sheetErrors, servers, statuses, retryingIds, t, dismissError])

  // Auto-open the moment a new batch of sheet-worthy failures appears; stays
  // closed (only the compact indicator shows) once the user has minimized it,
  // until it empties out and a fresh batch arrives.
  useEffect(() => {
    if (items.length > 0) openSheet()
  }, [items.length > 0, openSheet]) // eslint-disable-line react-hooks/exhaustive-deps

  const title = t('errorBanner.listTitle')
  const retryAllLabel = items.length > 1
    ? (retryingAll ? t('errorBanner.retryAllRetrying', { count: items.length }) : t('button.retryAll'))
    : undefined

  const handleRetryAll = items.length > 1
    ? () => {
        setRetryingAll(true)
        // No key filter on the invalidate below — every failing server and
        // category is being retried, so clear both, not just whichever the
        // sheet is currently showing (rows are server-first, mutually
        // exclusive with category rows — see the `items` memo above).
        items.forEach((item) => dismissError(item.id))
        sheetErrors.forEach((error) => dismissError(error.id))
        void queryClient.invalidateQueries().finally(() => setRetryingAll(false))
      }
    : undefined

  // Closing the sheet minimizes it — the errors themselves stay live, and the
  // compact IssuesIndicator keeps reminding the user until they're resolved.
  // There is deliberately no "dismiss and never show again": every error
  // shown here is still failing, and a major/critical failure should not be
  // silenceable the way the old single-shot sticky-dismiss allowed.
  const handleClose = () => closeSheet()

  return (
    <>
      <ErrorRecoverySheet
        visible={sheetOpen && items.length > 0}
        title={title}
        items={items}
        retryAllLabel={retryAllLabel}
        retryAllRetrying={retryingAll}
        onRetryAll={handleRetryAll}
        onClose={handleClose}
      />
      <IssuesIndicator count={!sheetOpen ? items.length : 0} onPress={openSheet} />
      <ServerErrorModal
        visible={errorServerId !== null}
        server={errorServerId ? servers[errorServerId] ?? null : null}
        onClose={() => setErrorServerId(null)}
      />
    </>
  )
}
