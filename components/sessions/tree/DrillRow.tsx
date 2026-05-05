import { View, Text, TouchableOpacity } from 'react-native'
import { dark } from '@/constants/theme'
import { STATUS_COLOR } from './treeUtils'
import { LiveDot } from '@/components/sessions/LiveDot'
import { styles } from './DrillRow.styles'
import type { DrillItem } from './types'

interface Props {
  item: DrillItem
}

export function DrillRow({ item }: Props) {
  const dotColor = item.status
    ? (STATUS_COLOR[item.status] ?? dark.text.secondary)
    : dark.text.secondary
  const isLive = item.status === 'running' || item.status === 'waiting_input'

  return (
    <TouchableOpacity style={styles.drillRow} onPress={item.onPress} activeOpacity={0.65}>
      <LiveDot live={isLive} color={dotColor} size={8} />
      <View style={styles.drillContent}>
        <Text style={styles.drillLabel} numberOfLines={1}>{item.label}</Text>
        {item.status ? (
          <Text style={[styles.drillStatus, { color: STATUS_COLOR[item.status] ?? dark.text.secondary }]}>
            {item.status.replace('_', ' ')}
          </Text>
        ) : null}
      </View>
      <Text style={styles.drillTime}>{item.time}</Text>
    </TouchableOpacity>
  )
}
