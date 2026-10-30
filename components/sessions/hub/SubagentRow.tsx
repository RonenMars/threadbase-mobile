import { useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/contexts/ThemeContext'
import { ConvRow } from '@/components/sessions/hub/ConvRow'
import { font, spacing, type Theme } from '@/constants/theme'
import { resolveSubagentType } from '@/lib/subagents'
import type { ConvRowProps } from './types'

/** A ConvRow with the sub-agent extras: a live dot while it runs and its type tag. */
export function SubagentRow({ conv, ...rest }: ConvRowProps) {
  const { t } = useTranslation('sessions')
  const theme = useTheme()
  const styles = useMemo(() => makeStyles(theme), [theme])
  const type = resolveSubagentType(conv)
  return (
    <View style={styles.row}>
      {conv.subagentActive === true ? (
        <View style={styles.activeDot} accessibilityLabel={t('subagents.active')} testID={`subagent-board-active-${conv.id}`} />
      ) : null}
      <View style={styles.body}>
        <ConvRow conv={conv} {...rest} />
      </View>
      {type ? <Text style={styles.tag}>{type}</Text> : null}
    </View>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 },
    body: { flex: 1 },
    tag: { color: theme.text.secondary, fontSize: font.xs - 1, backgroundColor: theme.bg.primary, borderRadius: 4, paddingHorizontal: 5, overflow: 'hidden' },
    activeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: theme.text.accent },
  })
}
