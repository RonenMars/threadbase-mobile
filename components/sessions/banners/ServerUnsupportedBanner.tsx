import { View, Text, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Card } from '@/components/ui/Card'
import { font, spacing, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'

interface Props {
  serverLabel: string
}

export function ServerUnsupportedBanner({ serverLabel }: Props) {
  const theme = useTheme()
  const styles = makeStyles(theme)
  const { t } = useTranslation('sessions')

  return (
    <Card testID="server-unsupported-banner">
      <View style={styles.row}>
        <View style={[styles.dot, { backgroundColor: theme.status.idle }]} />
        <View style={styles.body}>
          <Text style={styles.title}>{t('list.serverNeedsUpgrade')}</Text>
          <Text style={styles.subtitle}>
            {t('list.serverNeedsUpgradeSubtitle', { server: serverLabel })}
          </Text>
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
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
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
