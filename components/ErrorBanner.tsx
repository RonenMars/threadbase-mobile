import React from 'react'
import { WarningCircle } from 'phosphor-react-native'
import { Banner } from '@/components/ui/Banner'
import { useLoadingStateStore, type QueryCategory } from '@/stores/loading-state'
import { queryClient } from '@/services/query-client'

const ERROR_RED = '#ef4444'

const TITLES: Record<QueryCategory, string> = {
  'project-chats': 'Chats failed to load',
  sessions: 'Sessions failed to load',
  conversations: 'History failed to load',
  messages: 'Messages failed to load',
  'session-detail': 'Session details failed to load',
  browse: 'File tree failed to load',
  other: 'Something went wrong',
}

const MESSAGES: Record<QueryCategory, string> = {
  'project-chats': 'The chat list refused to load. Tap Retry.',
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
    case 'project-chats': return ['projectChats']
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
      message={MESSAGES[current.category]}
      accent={ERROR_RED}
      icon={<WarningCircle size={28} color={ERROR_RED} weight="fill" />}
      details={formatDetails(current.status, current.message)}
      action={{ label: 'Retry', onPress: handleRetry, variant: 'primary' }}
      secondaryAction={{ label: 'Close', onPress: () => dismissError(current.id) }}
    />
  )
}
