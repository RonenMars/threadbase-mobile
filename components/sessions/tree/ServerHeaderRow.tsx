import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { CaretDown, CaretRight } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { KnightRiderScanner } from '@/components/sessions/KnightRiderScanner'
import { SERVER_COLOR_DEFAULT } from '@/components/sessions/shared/serverPalette'
import { InlineError } from '@/components/alerts/InlineError'
import { formatListTime } from '@/components/sessions/shared/formatListTime'
import { formatMinutesAgo } from '@/lib/alertLabels'
import { useAlertStore } from '@/stores/alerts'
import { useServerFetchStatusStore } from '@/stores/serverFetchStatus'
import { useServersStore } from '@/stores/servers'
import { serverCause } from '@/types/alerts'
import { useThemedStyles } from '@/hooks/useThemedStyles'
import { makeStyles } from './ServerHeaderRow.styles'

interface Props {
  serverId: string
  serverLabel: string
  totalCount: number
  collapsible?: boolean
  isExpanded?: boolean
  onToggle?: () => void
  isRefreshing?: boolean
  failed?: boolean
  onRetry?: () => void
  onDetails?: () => void
}

/**
 * Group header for one machine. Its 3px rail carries the server's assigned
 * colour, the same one its rows' chips use: identity is a rail colour and a
 * chip, never a state colour. Fetch failure is the Retry control and the
 * dashed panel below, not a recolour of the rail.
 */
export function ServerHeaderRow({
  serverId,
  serverLabel,
  totalCount,
  collapsible,
  isExpanded,
  onToggle,
  isRefreshing,
  failed,
  onRetry,
  onDetails,
}: Props) {
  const { styles, theme } = useThemedStyles(makeStyles)
  const { t } = useTranslation(['common', 'sessions', 'servers'])
  const serverColor = useServersStore((s) => s.servers[serverId]?.color) ?? SERVER_COLOR_DEFAULT
  const alertRaisedAt = useAlertStore((s) => s.alerts.find((a) => a.cause === serverCause(serverId))?.raisedAt)
  const lastCheckedAt = useServerFetchStatusStore((s) => s.statuses[serverId]?.lastCheckedAt)
  const raisedAt = alertRaisedAt ?? lastCheckedAt
  const since = raisedAt != null ? formatListTime(raisedAt) : ''
  const ago = raisedAt != null ? formatMinutesAgo(raisedAt, t) : ''
  const failureTitle = since
    ? t('common:alert.inline.unreachableSince', { time: since })
    : t('sessions:list.serverOffline')
  const failureMessage = totalCount > 0 && ago
    ? t('common:alert.inline.sessionsStale', { count: totalCount, ago })
    : t('common:errorBanner.messageConnection')

  const scanner = isRefreshing ? (
    <KnightRiderScanner testID={`server-header-refreshing-${serverId}`} />
  ) : null

  const chevron = collapsible ? (
    isExpanded ? (
      <CaretDown size={14} color={theme.text.accent} weight="bold" />
    ) : (
      <CaretRight size={14} color={theme.text.secondary} weight="bold" />
    )
  ) : null

  const identity = (
    <>
      <View style={[styles.rail, { backgroundColor: serverColor }]} testID={`server-rail-${serverId}`} />
      <Text style={styles.label} numberOfLines={1}>{serverLabel}</Text>
      {scanner}
      <Text style={styles.count}>{totalCount}</Text>
      {chevron}
    </>
  )

  const retry = failed && onRetry ? (
    <TouchableOpacity
      style={styles.retry}
      onPress={onRetry}
      accessibilityRole="button"
      accessibilityLabel={t('common:button.retry')}
      testID={`server-header-retry-${serverId}`}
    >
      <Text style={styles.retryText}>{t('common:button.retry')}</Text>
    </TouchableOpacity>
  ) : null

  const header = collapsible ? (
    <View style={styles.row} testID={`server-header-${serverId}`}>
      <TouchableOpacity style={styles.identity} onPress={onToggle} activeOpacity={0.65}>
        {identity}
      </TouchableOpacity>
      {retry}
    </View>
  ) : (
    <View style={styles.row} testID={`server-header-${serverId}`}>
      <View style={styles.identity}>{identity}</View>
      {retry}
    </View>
  )

  return (
    <View>
      {header}
      {failed ? (
        <InlineError
          testID={`server-failure-${serverId}`}
          title={failureTitle}
          message={failureMessage}
          onRetry={onRetry}
          retryLabel={t('common:alert.inline.retryNow')}
          onDetails={onDetails}
          detailsLabel={t('servers:action.details')}
        />
      ) : null}
    </View>
  )
}
