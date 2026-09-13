import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Card } from '@/components/ui/Card'
import { font, spacing, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'

interface Props {
  serverLabel: string
  onRetry: () => void
}

export function ServerOfflineBanner({ serverLabel, onRetry }: Props) {
  const theme = useTheme()
  const styles = makeStyles(theme)
  const { t } = useTranslation(['sessions', 'common'])

  return (
    <Card variant="danger" testID="server-offline-banner">
      <View style={styles.row}>
        <View style={[styles.dot, { backgroundColor: theme.status.failed }]} />
        <View style={styles.body}>
          <Text style={styles.title}>{t('list.serverOffline')}</Text>
          <Text style={styles.subtitle}>{serverLabel}</Text>
          <Text style={styles.subtitle}>{t('list.serverOfflineSubtitle')}</Text>
        </View>
        <TouchableOpacity
          onPress={onRetry}
          accessibilityRole="button"
          testID="server-offline-retry"
          hitSlop={8}
        >
          <Text style={styles.action}>{t('common:button.retry')}</Text>
        </TouchableOpacity>
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
    action: {
      fontSize: font.sm,
      fontWeight: '600',
      color: theme.text.accent,
    },
  })
}
