import { View, Text, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Card } from '@/components/ui/Card'
import { LiveDot } from '@/components/sessions/LiveDot'
import { font, spacing, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'

interface Props {
  serverLabel: string
}

export function ServerWarmingBanner({ serverLabel }: Props) {
  const theme = useTheme()
  const styles = makeStyles(theme)
  const { t } = useTranslation('sessions')

  return (
    <Card variant="warning" testID="server-warming-banner">
      <View style={styles.row}>
        <LiveDot live color={theme.status.waiting} size={8} />
        <View style={styles.body}>
          <Text style={styles.title}>{t('list.serverWarming')}</Text>
          <Text style={styles.subtitle}>{serverLabel}</Text>
          <Text style={styles.subtitle}>{t('list.serverWarmingSubtitle')}</Text>
        </View>
      </View>
    </Card>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    body: {
      flex: 1,
      gap: 2,
    },
    title: {
      fontSize: font.sm,
      fontWeight: '600',
      color: theme.text.primary,
    },
    subtitle: {
      fontSize: font.xs,
      color: theme.text.secondary,
    },
  })
}
