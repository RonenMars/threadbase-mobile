import React, { useCallback } from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { dateLabel } from './hubUtils'
import { styles } from './ConvRow.styles'
import type { ConvRowProps } from './types'

export function ConvRow({ conv, multipleToday }: ConvRowProps) {
  const router = useRouter()

  const handlePress = useCallback(() => {
    Haptics.selectionAsync()
    router.push(`/conversation/${conv.id}?server=${conv.serverId}`)
  }, [conv, router])

  const label = dateLabel(conv.lastActivity, multipleToday)
  const branch = conv.branch ?? '—'
  const msgs = conv.messageCount

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.75} style={styles.row}>
      <View style={styles.convRowInner}>
        <Text style={styles.convTitle} numberOfLines={1}>{conv.title}</Text>
        <Text style={styles.rowSecondary} numberOfLines={1}>
          {branch} · {msgs} msg{msgs !== 1 ? 's' : ''}
        </Text>
        {conv.serverLabel ? (
          <Text style={styles.serverLabel} numberOfLines={1}>{conv.serverLabel}</Text>
        ) : null}
      </View>
      <Text style={styles.rowDate}>{label}</Text>
    </TouchableOpacity>
  )
}
