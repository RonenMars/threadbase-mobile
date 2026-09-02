import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { useLoadingStateStore, type QueryCategory } from '@/stores/loading-state'
import { useServerFetchStatusStore } from '@/stores/serverFetchStatus'
import { useServersStore } from '@/stores/servers'
import { ServerErrorModal } from '@/components/servers/ServerErrorModal'
import { queryClient } from '@/services/query-client'
import { useBannerSync } from '@/hooks/useBannerSync'
import type { AlertItem, AlertSpec } from '@/types/alerts'

function getCategoryTitle(category: QueryCategory, t: TFunction<'common'>): string {
  switch (category) {
    case 'sessions':
      return t('errorBanner.titleSessions')
    case 'conversations':
      return t('errorBanner.titleConversations')
    case 'messages':
      return t('errorBanner.titleMessages')
    case 'session-detail':
      return t('errorBanner.titleSessionDetail')
    case 'browse':
      return t('errorBanner.titleBrowse')
    case 'other':
      return t('errorBanner.titleOther')
  }
}

function getCategoryMessage(category: QueryCategory, t: TFunction<'common'>): string {
  switch (category) {
    case 'sessions':
      return t('errorBanner.messageSessions')
    case 'conversations':
      return t('errorBanner.messageConversations')
    case 'messages':
      return t('errorBanner.messageMessages')
    case 'session-detail':
      return t('errorBanner.messageSessionDetail')
    case 'browse':
      return t('errorBanner.messageBrowse')
    case 'other':
      return t('errorBanner.messageOther')
  }
}

function formatDetails(status?: number, message?: string): string | undefined {
  const parts: string[] = []
  if (status) parts.push(`HTTP ${status}`)
  if (message) parts.push(message)
  return parts.length ? parts.join('\n') : undefined
}

function categoryQueryKey(category: QueryCategory): unknown[] {
  switch (category) {
    case 'sessions': return ['sessions']
    case 'conversations': return ['conversations']
    case 'messages': return ['conversation']
    case 'session-detail': return ['session']
    case 'browse': return ['browse']
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

  // Only servers still in the store: a row whose ServerConfig cannot be
  // resolved renders as a bare id and taps into a modal that returns null, so
  // it reads as a dead button. Dropping it falls through to the category rows,
  // which always carry their own details.
  const failedServerIds = useMemo(
    () => Object.keys(statuses).filter((id) => statuses[id].status === 'error' && servers[id]),
    [statuses, servers],
  )

  const spec = useMemo((): AlertSpec | null => {
    if (errors.length === 0) return null

    const dismissAll = () => errors.forEach((error) => dismissError(error.id))

    // One row per failing server. The aggregate queries (`sessions`,
    // `conversations`) span every server at once, so a per-category row cannot
    // say which of 68 went down — serverFetchStatus can. Falls back to category
    // rows when nothing is attributable to a server.
    const items: AlertItem[] = failedServerIds.length > 0
      ? failedServerIds.map((serverId): AlertItem => {
          const server = servers[serverId]
          const label = server.label?.trim()
          return {
            id: serverId,
            title: label || server.url,
            message: statuses[serverId].error ?? t('errorBanner.messageOther'),
            // Tapping drills into ServerErrorModal, which already renders the
            // full error unclamped alongside the machine/platform/version rows.
            onPress: () => setErrorServerId(serverId),
            buttonText: t('button.retry'),
            buttonAction: () => {
              // serverId sits at varying positions across key shapes
              // (['session', id, …] vs ['conversations', filter, epoch, …ids]),
              // so match on membership rather than a key prefix.
              queryClient.invalidateQueries({
                predicate: (query) => query.queryKey.includes(serverId),
              })
              dismissAll()
            },
            buttonVariant: 'primary',
          }
        })
      : errors.map((error): AlertItem => ({
          id: error.id,
          title: getCategoryTitle(error.category, t),
          message: getCategoryMessage(error.category, t),
          details: formatDetails(error.status, error.message),
          buttonText: t('button.retry'),
          buttonAction: () => {
            queryClient.invalidateQueries({ queryKey: categoryQueryKey(error.category) })
            dismissError(error.id)
          },
          buttonVariant: 'primary',
        }))

    const retryAll = items.length > 1
      ? {
          buttonText: t('button.retryAll'),
          // No key filter: the rows span every server and category that failed,
          // so "all" is literally the whole cache.
          buttonAction: () => {
            queryClient.invalidateQueries()
            dismissAll()
          },
          buttonVariant: 'primary' as const,
        }
      : {}

    return {
      level: 'error',
      // Always the generic header, and deliberately not titleOther: the rows
      // carry the server address or the category, so echoing either a single
      // row's title or the 'other' row printed the same line twice.
      title: t('errorBanner.listTitle'),
      message: getCategoryMessage(errors[0].category, t),
      items,
      ...retryAll,
      onClose: dismissAll,
    }
  }, [errors, failedServerIds, servers, statuses, dismissError, t])

  useBannerSync('query-error', spec)

  return (
    <ServerErrorModal
      visible={errorServerId !== null}
      server={errorServerId ? servers[errorServerId] ?? null : null}
      onClose={() => setErrorServerId(null)}
    />
  )
}
