import React from 'react'
import { ActivityIndicator, View, Text, TouchableOpacity } from 'react-native'
import { useTheme } from '@/contexts/ThemeContext'
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

  const spinner = isRefreshing
    ? <ActivityIndicator size="small" color={theme.text.secondary} testID={`server-header-refreshing-${serverId}`} />
    : null

  if (collapsible) {
    return (
      <TouchableOpacity style={styles.row} testID={`server-header-${serverId}`} onPress={onToggle} activeOpacity={0.65}>
        <Text style={[styles.chevron, isExpanded && styles.chevronOpen]}>›</Text>
        <Text style={styles.label} numberOfLines={1}>{serverLabel}</Text>
        {spinner}
        <Text style={styles.count}>{totalCount}</Text>
      </TouchableOpacity>
    )
  }

  return (
    <View style={styles.row} testID={`server-header-${serverId}`}>
      <Text style={styles.label} numberOfLines={1}>{serverLabel}</Text>
      {spinner}
      <Text style={styles.count}>{totalCount}</Text>
    </View>
  )
}
