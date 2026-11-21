import { useMemo } from 'react'
import { View, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Check } from 'phosphor-react-native'
import { useTheme } from '@/contexts/ThemeContext'
import type { Theme } from '@/constants/theme'
import type { SubagentStatus } from '@/types/api'

interface Props {
  status: SubagentStatus
  testID?: string
}

const SIZE = 7

/** running: solid green dot. finished: muted check. quiet: amber ring, since no activity is not proof of done. */
export function SubagentStatusBadge({ status, testID }: Props) {
  const { t } = useTranslation('sessions')
  const theme = useTheme()
  const styles = useMemo(() => makeStyles(theme), [theme])

  switch (status) {
    case 'running':
      return <View style={styles.running} accessibilityLabel={t('subagents.status.running')} testID={testID} />
    case 'finished':
      return (
        <View accessibilityLabel={t('subagents.status.finished')} testID={testID}>
          <Check size={SIZE + 3} weight="bold" color={theme.text.secondary} />
        </View>
      )
    case 'quiet':
      return <View style={styles.quiet} accessibilityLabel={t('subagents.status.quiet')} testID={testID} />
  }
}

function makeStyles(theme: Theme) {
  const dot = { width: SIZE, height: SIZE, borderRadius: SIZE / 2 }
  return StyleSheet.create({
    running: { ...dot, backgroundColor: theme.status.running },
    quiet: { ...dot, borderWidth: 1.5, borderColor: theme.status.waiting },
  })
}
