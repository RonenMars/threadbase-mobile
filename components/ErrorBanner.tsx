import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { useLoadingStateStore, type QueryCategory } from '@/stores/loading-state'
import { queryClient } from '@/services/query-client'
import { useBannerSync } from '@/hooks/useBannerSync'
import type { AlertSpec } from '@/types/alerts'

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
  const { t } = useTranslation('common')
  const current = errors[0]
  const count = errors.length

  const spec = useMemo((): AlertSpec | null => {
    if (!current) return null
    const categoryTitle = getCategoryTitle(current.category, t)
    const title = count > 1 ? t('errorBanner.countSuffix', { title: categoryTitle, total: count }) : categoryTitle
    return {
      level: 'error',
      title,
      message: getCategoryMessage(current.category, t),
      details: formatDetails(current.status, current.message),
      buttonText: t('button.retry'),
      buttonAction: () => {
        queryClient.invalidateQueries({ queryKey: categoryQueryKey(current.category) })
        dismissError(current.id)
      },
      buttonVariant: 'primary',
      onClose: () => dismissError(current.id),
    }
  }, [count, current, dismissError, t])

  useBannerSync('query-error', spec)
  return null
}
