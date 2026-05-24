import React from 'react'
import { View, Text } from 'react-native'
import { styles } from './ServerHeaderRow.styles'

interface Props {
  serverId: string
  serverLabel: string
  totalCount: number
}

export function ServerHeaderRow({ serverId, serverLabel, totalCount }: Props) {
  return (
    <View style={styles.row} testID={`server-header-${serverId}`}>
      <Text style={styles.label} numberOfLines={1}>{serverLabel}</Text>
      <Text style={styles.count}>{totalCount}</Text>
    </View>
  )
}
