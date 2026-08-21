import { useMemo } from 'react'
import { useLoadingStateStore, type QueryCategory } from '@/stores/loading-state'
import { queryClient } from '@/services/query-client'
import { useBannerSync } from '@/hooks/useBannerSync'
import type { AlertSpec } from '@/types/alerts'

const TITLES: Record<QueryCategory, string> = {
  sessions: 'Sessions failed to load',
  conversations: 'History failed to load',
  messages: 'Messages failed to load',
  'session-detail': 'Session details failed to load',
  browse: 'File tree failed to load',
  other: 'Something went wrong',
}

const MESSAGES: Record<QueryCategory, string> = {
  sessions: 'Sessions refused to load. Worth a retry.',
  conversations: 'History didn\'t come through. Retry usually fixes it.',
  messages: 'Messages hit a wall. Tap Retry to try again.',
  'session-detail': 'Session details didn\'t come through. Retry usually fixes it.',
  browse: 'File tree failed to fetch. Check the connection or retry.',
  other: 'Something went wrong on our end. Retry or close and carry on.',
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
  const current = errors[0]
  const count = errors.length

  const spec = useMemo((): AlertSpec | null => {
    if (!current) return null
    const title = count > 1 ? `${TITLES[current.category]} (1 of ${count})` : TITLES[current.category]
    return {
      level: 'error',
      title,
      message: MESSAGES[current.category],
      details: formatDetails(current.status, current.message),
      buttonText: 'Retry',
      buttonAction: () => {
        queryClient.invalidateQueries({ queryKey: categoryQueryKey(current.category) })
        dismissError(current.id)
      },
      buttonVariant: 'primary',
      onClose: () => dismissError(current.id),
    }
  }, [count, current, dismissError])

  useBannerSync('query-error', spec)
  return null
}
