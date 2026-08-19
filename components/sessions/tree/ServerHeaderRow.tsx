import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { useTheme } from '@/contexts/ThemeContext'
import { KnightRiderScanner } from '@/components/sessions/KnightRiderScanner'
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

export function ServerHeaderRow({ serverId, serverLabel, totalCount, collapsible, isExpanded, onToggle, isRefreshing }: Props) {
  const theme = useTheme()
  const styles = makeStyles(theme)

  const scanner = isRefreshing ? (
    <KnightRiderScanner testID={`server-header-refreshing-${serverId}`} />
  ) : null

  if (collapsible) {
    return (
      <TouchableOpacity style={styles.row} testID={`server-header-${serverId}`} onPress={onToggle} activeOpacity={0.65}>
        <Text style={[styles.chevron, isExpanded && styles.chevronOpen]}>›</Text>
        <Text style={styles.label} numberOfLines={1}>{serverLabel}</Text>
        {scanner}
        <Text style={styles.count}>{totalCount}</Text>
      </TouchableOpacity>
    )
  }

  return (
    <View style={styles.row} testID={`server-header-${serverId}`}>
      <Text style={styles.label} numberOfLines={1}>{serverLabel}</Text>
      {scanner}
      <Text style={styles.count}>{totalCount}</Text>
    </View>
  )
}
