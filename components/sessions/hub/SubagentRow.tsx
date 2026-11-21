import { View, StyleSheet } from 'react-native'
import { ConvRow } from '@/components/sessions/hub/ConvRow'
import { SubagentStatusBadge } from '@/components/sessions/SubagentStatusBadge'
import { spacing } from '@/constants/theme'
import { resolveSubagentStatus, resolveSubagentType } from '@/lib/subagents'
import type { ConvRowProps } from './types'

interface Props extends ConvRowProps {
  /** Off when the group header already names the one type every row shares. */
  showType?: boolean
}

/** A ConvRow for a sub-agent: a status badge when the streamer reports one, the type leading the meta line. */
export function SubagentRow({ conv, showType = true, ...rest }: Props) {
  const type = showType ? resolveSubagentType(conv) : undefined
  const status = resolveSubagentStatus(conv)
  return (
    <View style={styles.row}>
      {status ? <SubagentStatusBadge status={status} testID={`subagent-status-${conv.id}`} /> : null}
      <View style={styles.body}>
        <ConvRow conv={conv} {...rest} leading="none" titleLines={2} metaLead={type} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 },
  body: { flex: 1 },
})
