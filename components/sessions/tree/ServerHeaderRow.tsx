import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { CaretDown, CaretRight } from 'phosphor-react-native'
import { KnightRiderScanner } from '@/components/sessions/KnightRiderScanner'
import { SERVER_COLOR_DEFAULT } from '@/components/sessions/shared/serverPalette'
import { useServersStore } from '@/stores/servers'
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
}

/**
 * Group header for one machine. Its 3px rail carries the server's assigned
 * colour, the same one its rows' chips use: identity is a rail colour and a
 * chip, never a state colour.
 */
export function ServerHeaderRow({ serverId, serverLabel, totalCount, collapsible, isExpanded, onToggle, isRefreshing }: Props) {
  const { styles, theme } = useThemedStyles(makeStyles)
  const serverColor = useServersStore((s) => s.servers[serverId]?.color) ?? SERVER_COLOR_DEFAULT

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

  const inner = (
    <>
      <View style={[styles.rail, { backgroundColor: serverColor }]} testID={`server-rail-${serverId}`} />
      <Text style={styles.label} numberOfLines={1}>{serverLabel}</Text>
      {scanner}
      <Text style={styles.count}>{totalCount}</Text>
      {chevron}
    </>
  )

  if (collapsible) {
    return (
      <TouchableOpacity style={styles.row} testID={`server-header-${serverId}`} onPress={onToggle} activeOpacity={0.65}>
        {inner}
      </TouchableOpacity>
    )
  }

  return (
    <View style={styles.row} testID={`server-header-${serverId}`}>
      {inner}
    </View>
  )
}
