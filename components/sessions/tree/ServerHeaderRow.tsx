import React from 'react'
import { View, Text } from 'react-native'
import { styles } from './ServerHeaderRow.styles'

interface Props {
  serverLabel: string
  totalCount: number
}

export function ServerHeaderRow({ serverLabel, totalCount }: Props) {
  return (
    <View style={styles.row}>
      <Text style={styles.label} numberOfLines={1}>{serverLabel}</Text>
      <Text style={styles.count}>{totalCount}</Text>
    </View>
  )
}
