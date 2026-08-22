import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useLoadingStateStore, type QueryCategory } from '@/stores/loading-state'
import { queryClient } from '@/services/query-client'
import { useBannerSync } from '@/hooks/useBannerSync'
import type { AlertSpec } from '@/types/alerts'

const TITLE_KEYS = {
  sessions: 'errorBanner.titleSessions',
  conversations: 'errorBanner.titleConversations',
  messages: 'errorBanner.titleMessages',
  'session-detail': 'errorBanner.titleSessionDetail',
  browse: 'errorBanner.titleBrowse',
  other: 'errorBanner.titleOther',
} as const satisfies Record<QueryCategory, string>

const MESSAGE_KEYS = {
  sessions: 'errorBanner.messageSessions',
  conversations: 'errorBanner.messageConversations',
  messages: 'errorBanner.messageMessages',
  'session-detail': 'errorBanner.messageSessionDetail',
  browse: 'errorBanner.messageBrowse',
  other: 'errorBanner.messageOther',
} as const satisfies Record<QueryCategory, string>

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
    const categoryTitle = t(TITLE_KEYS[current.category])
    const title = count > 1 ? t('errorBanner.countSuffix', { title: categoryTitle, total: count }) : categoryTitle
    return {
      level: 'error',
      title,
      message: t(MESSAGE_KEYS[current.category]),
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
