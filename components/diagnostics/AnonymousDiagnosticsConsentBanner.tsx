import { useMemo } from 'react'
import { Alert, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Info } from 'phosphor-react-native'
import { Card } from '@/components/ui/Card'
import { font, spacing, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { isQaForceDiagnosticsConsentUi } from '@/lib/diagnosticsConsentFlag'
import { useSettingsStore } from '@/stores/settings'

interface Props {
  /** Test/story seam. Production callers omit this; the env flag decides. */
  forceVisible?: boolean
}

export function AnonymousDiagnosticsConsentBanner({ forceVisible = false }: Props) {
  const theme = useTheme()
  const styles = useMemo(() => makeStyles(theme), [theme])
  const { t } = useTranslation('settings')
  const enabled = useSettingsStore((s) => s.anonymousDiagnosticsEnabled)
  const setEnabled = useSettingsStore((s) => s.setAnonymousDiagnosticsEnabled)

  if (!forceVisible && !isQaForceDiagnosticsConsentUi()) return null

  const handleLearnMore = () => {
    Alert.alert(t('anonymousDiagnostics.title'), t('anonymousDiagnostics.learnMoreBody'))
  }

  return (
    <Card testID="diagnostics-consent-banner" style={styles.card}>
      <View style={styles.row}>
        <Info size={16} color={theme.text.accent} weight="regular" />
        <View style={styles.body}>
          <Text style={styles.title}>{t('anonymousDiagnostics.title')}</Text>
          <Text style={styles.subtitle}>{t('anonymousDiagnostics.description')}</Text>
          <TouchableOpacity
            onPress={handleLearnMore}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('anonymousDiagnostics.learnMore')}
            testID="diagnostics-consent-banner-learn-more"
          >
            <Text style={styles.learnMore}>{t('anonymousDiagnostics.learnMore')}</Text>
          </TouchableOpacity>
        </View>
        <Switch
          value={enabled}
          onValueChange={setEnabled}
          trackColor={{ false: theme.border, true: theme.text.accent }}
          thumbColor="#fff"
          testID="diagnostics-consent-banner-toggle"
        />
      </View>
    </Card>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    card: {
      marginHorizontal: spacing.md,
      marginBottom: spacing.sm,
    },
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
      lineHeight: 16,
    },
    learnMore: {
      fontSize: font.xs,
      fontWeight: '600',
      color: theme.text.accent,
      marginTop: 2,
    },
  })
}
