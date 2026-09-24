import { useMemo } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { ShieldCheck } from 'phosphor-react-native'
import { font, radius, spacing, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { useSettingsStore } from '@/stores/settings'
import {
  currentDiagnosticsTermsKey,
  diagnosticsTermsApply,
  isSentryTrackingEnforced,
} from '@/services/sentry'

interface Props {
  /** Story/test seam: render this variant regardless of build config or stored answer. */
  forceVariant?: 'standard' | 'enforced'
}

/**
 * Full-screen notice shown on launch whenever this build can send diagnostics to
 * Sentry and the user has not answered its current terms. Standard builds offer
 * a real choice and work either way; an enforced (internal test) build can only
 * be used by agreeing.
 */
export function DiagnosticsTermsGate({ forceVariant }: Props) {
  const theme = useTheme()
  const styles = useMemo(() => makeStyles(theme), [theme])
  const insets = useSafeAreaInsets()
  const { t } = useTranslation('settings')
  const hydrated = useSettingsStore((s) => s.hydrated)
  const answered = useSettingsStore((s) => s.diagnosticsTermsAccepted)

  const termsKey = currentDiagnosticsTermsKey()
  if (!forceVariant && (!hydrated || !diagnosticsTermsApply() || answered === termsKey)) return null
  const enforced = forceVariant ? forceVariant === 'enforced' : isSentryTrackingEnforced()

  const answer = (allow: boolean) => {
    const store = useSettingsStore.getState()
    store.setAnonymousDiagnosticsEnabled(allow)
    store.setDiagnosticsTermsAccepted(termsKey)
  }

  const title = enforced ? t('diagnosticsTerms.enforcedTitle') : t('diagnosticsTerms.title')
  const points = enforced
    ? [
        t('diagnosticsTerms.enforcedCollected'),
        t('diagnosticsTerms.enforcedScreenshots'),
        t('diagnosticsTerms.pseudonymous'),
        t('diagnosticsTerms.purpose'),
        t('diagnosticsTerms.enforcedNoChoice'),
      ]
    : [
        t('diagnosticsTerms.collected'),
        t('diagnosticsTerms.pseudonymous'),
        t('diagnosticsTerms.never'),
        t('diagnosticsTerms.purpose'),
        t('diagnosticsTerms.changeLater'),
      ]
  const primaryLabel = enforced ? t('diagnosticsTerms.agree') : t('diagnosticsTerms.allow')

  return (
    <View
      style={[styles.overlay, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.lg }]}
      accessibilityViewIsModal
      testID="diagnostics-terms-gate"
    >
      <ScrollView contentContainerStyle={styles.content}>
        <ShieldCheck size={40} color={theme.text.accent} weight="regular" />
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        <Text style={styles.intro}>
          {enforced ? t('diagnosticsTerms.enforcedIntro') : t('diagnosticsTerms.intro')}
        </Text>
        {points.map((point) => (
          <View key={point} style={styles.point}>
            <View style={styles.bullet} />
            <Text style={styles.pointText}>{point}</Text>
          </View>
        ))}
      </ScrollView>
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.primary}
          onPress={() => answer(true)}
          accessibilityRole="button"
          testID="diagnostics-terms-allow"
        >
          <Text style={styles.primaryText}>{primaryLabel}</Text>
        </TouchableOpacity>
        {!enforced && (
          <TouchableOpacity
            style={styles.secondary}
            onPress={() => answer(false)}
            accessibilityRole="button"
            testID="diagnostics-terms-decline"
          >
            <Text style={styles.secondaryText}>{t('diagnosticsTerms.decline')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    overlay: {
      ...StyleSheet.absoluteFill,
      zIndex: 1000,
      elevation: 1000,
      backgroundColor: theme.bg.primary,
      paddingHorizontal: spacing.xl,
    },
    content: {
      gap: spacing.md,
      paddingBottom: spacing.lg,
    },
    title: {
      fontSize: font.xxl,
      fontWeight: '700',
      color: theme.text.primary,
    },
    intro: {
      fontSize: font.base,
      lineHeight: 22,
      color: theme.text.primary,
    },
    point: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    bullet: {
      width: 6,
      height: 6,
      borderRadius: radius.full,
      backgroundColor: theme.text.accent,
      marginTop: 8,
    },
    pointText: {
      flex: 1,
      fontSize: font.sm,
      lineHeight: 20,
      color: theme.text.secondary,
    },
    actions: {
      gap: spacing.sm,
      paddingTop: spacing.md,
    },
    primary: {
      backgroundColor: theme.text.accent,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      alignItems: 'center',
    },
    primaryText: {
      fontSize: font.base,
      fontWeight: '600',
      color: theme.text.onAccent,
    },
    secondary: {
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: theme.border,
      paddingVertical: spacing.md,
      alignItems: 'center',
    },
    secondaryText: {
      fontSize: font.base,
      fontWeight: '600',
      color: theme.text.primary,
    },
  })
}
