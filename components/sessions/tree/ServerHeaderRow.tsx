import React from 'react'
import { View, Text } from 'react-native'
import { useTheme } from '@/contexts/ThemeContext'
import { makeStyles } from './ServerHeaderRow.styles'

interface Props {
  serverId: string
  serverLabel: string
  totalCount: number
}

export function ServerHeaderRow({ serverId, serverLabel, totalCount }: Props) {
  const theme = useTheme()
  const styles = makeStyles(theme)
  return (
    <View style={styles.row} testID={`server-header-${serverId}`}>
      <Text style={styles.label} numberOfLines={1}>{serverLabel}</Text>
      <Text style={styles.count}>{totalCount}</Text>
    </View>
  )
}
