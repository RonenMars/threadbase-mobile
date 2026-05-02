import React from 'react'
import { WarningCircle } from 'phosphor-react-native'
import { Banner } from '@/components/ui/Banner'
import { useLoadingStateStore, type QueryCategory } from '@/stores/loading-state'
import { queryClient } from '@/services/query-client'

const ERROR_RED = '#ef4444'

const TITLES: Record<QueryCategory, string> = {
  sessions: 'Sessions failed to load',
  messages: 'Messages failed to load',
  'session-detail': 'Session details failed to load',
  browse: 'File tree failed to load',
  other: 'Something went wrong',
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
    case 'messages': return ['conversation']
    case 'session-detail': return ['session']
    case 'browse': return ['browse']
    default: return []
  }
}

export function ErrorBanner() {
  const errors = useLoadingStateStore((s) => s.errors)
  const dismissError = useLoadingStateStore((s) => s.dismissError)

  if (errors.length === 0) return null

  const current = errors[0]
  const count = errors.length

  function handleRetry() {
    queryClient.invalidateQueries({ queryKey: categoryQueryKey(current.category) })
    dismissError(current.id)
  }

  return (
    <Banner
      title={count > 1 ? `${TITLES[current.category]} (1 of ${count})` : TITLES[current.category]}
      message="An error occurred while loading data. Tap 'Retry' to try again."
      accent={ERROR_RED}
      icon={<WarningCircle size={28} color={ERROR_RED} weight="fill" />}
      details={formatDetails(current.status, current.message)}
      action={{ label: 'Retry', onPress: handleRetry }}
      secondaryAction={{ label: 'Close', onPress: () => dismissError(current.id) }}
    />
  )
}
