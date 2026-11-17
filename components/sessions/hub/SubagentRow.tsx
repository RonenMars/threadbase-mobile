import { useMemo } from 'react'
import { View, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/contexts/ThemeContext'
import { ConvRow } from '@/components/sessions/hub/ConvRow'
import { spacing, type Theme } from '@/constants/theme'
import { resolveSubagentType } from '@/lib/subagents'
import type { ConvRowProps } from './types'

interface Props extends ConvRowProps {
  /** Off when the group header already names the one type every row shares. */
  showType?: boolean
}

/** A ConvRow for a sub-agent: a live dot only while it runs, the type leading the meta line. */
export function SubagentRow({ conv, showType = true, ...rest }: Props) {
  const { t } = useTranslation('sessions')
  const theme = useTheme()
  const styles = useMemo(() => makeStyles(theme), [theme])
  const type = showType ? resolveSubagentType(conv) : undefined
  return (
    <View style={styles.row}>
      {conv.subagentActive === true ? (
        <View style={styles.activeDot} accessibilityLabel={t('subagents.active')} testID={`subagent-board-active-${conv.id}`} />
      ) : null}
      <View style={styles.body}>
        <ConvRow conv={conv} {...rest} leading="none" titleLines={2} metaLead={type} />
      </View>
    </View>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 },
    body: { flex: 1 },
    activeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: theme.status.running },
  })
}
