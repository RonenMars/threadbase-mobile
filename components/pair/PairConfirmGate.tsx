import React from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import {
  SafeAreaProvider,
  SafeAreaView,
  initialWindowMetrics,
} from 'react-native-safe-area-context'
import { ShieldCheck, ShieldSlash, ShieldWarning } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { type Theme, font, radius, spacing } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { ScreenHeader } from '@/components/shared/ScreenHeader'
import { IdentityFingerprintBlock } from '@/components/pair/IdentityFingerprintBlock'
import { isolateLtr } from '@/components/pair/ltr-isolate'
import { useDirectionStyle } from '@/lib/rtl'

/**
 * A deep link or a pasted credential has no out-of-band channel — a camera
 * scan is exempt because pointing a camera at a screen *is* one. This is the
 * confirmation step that stands in for it (mobile-design.md §3.3): the target
 * server's identity is shown and an explicit confirm is required before the
 * caller may add it.
 *
 * `'e2ee'` — a pair URI carrying `spk`; the fingerprint is real and there is
 * something to compare it against.
 * `'no-spk'` — a pair URI with no `spk` (a pre-E2EE server, or one field an
 * intermediary stripped — the two are indistinguishable, and the copy says so
 * rather than guessing).
 * `'api-key'` — a pasted long-lived key. There is no exchange, so no fingerprint
 * and no machine name ever existed to show.
 */
export type PairConfirmKind = 'e2ee' | 'no-spk' | 'api-key'

export interface PendingPairTarget {
  kind: PairConfirmKind
  machineName: string | null
  url: string
  /** Pre-formatted by `services/e2ee/fingerprint.ts`. Null for `'no-spk'`/`'api-key'`. */
  fingerprint: string | null
}

interface Props {
  visible: boolean
  target: PendingPairTarget | null
  onConfirm: () => void
  onCancel: () => void
}

export function PairConfirmGate({ visible, target, onConfirm, onCancel }: Props) {
  const { t } = useTranslation('pair')
  const theme = useTheme()
  const styles = makeStyles(theme)
  const directionStyle = useDirectionStyle()

  if (!target) return null

  let icon: React.ReactNode
  let title: string
  let bodyText: string
  let ctaWarning: boolean
  if (target.kind === 'e2ee') {
    icon = <ShieldCheck size={22} color={theme.text.success} weight="fill" testID="pair-confirm-icon-e2ee" />
    title = t('confirm.checkTitle')
    bodyText = t('confirm.encryptedLine')
    ctaWarning = false
  } else if (target.kind === 'no-spk') {
    icon = <ShieldWarning size={22} color={theme.text.warning} weight="fill" testID="pair-confirm-icon-no-spk" />
    title = t('confirm.noSpkTitle')
    bodyText = t('confirm.noSpkBody')
    ctaWarning = true
  } else {
    icon = <ShieldSlash size={22} color={theme.text.warning} weight="fill" testID="pair-confirm-icon-api-key" />
    title = t('confirm.apiKeyTitle')
    bodyText = t('confirm.apiKeyBody')
    ctaWarning = true
  }

  const machineName = target.machineName ?? t('confirm.machineFallback')

  // A RN Modal is a new native window; without its own SafeAreaProvider the
  // insets read as 0 and the title sits under the status bar. initialWindowMetrics
  // seeds the first frame so there is no unpadded flash while the provider measures.
  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onCancel}
      presentationStyle="fullScreen"
      statusBarTranslucent
    >
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <SafeAreaView style={[styles.screen, directionStyle]} edges={['top', 'bottom']} testID="pair-confirm-screen">
          <ScreenHeader title={t('screenTitle')} onBack={onCancel} />
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <View style={styles.heading}>
              {icon}
              <Text style={styles.title}>{title}</Text>
            </View>

            <View style={styles.detailRows}>
              {target.kind !== 'api-key' ? (
                <DetailRow theme={theme} label={t('confirm.machineLabel')} value={machineName} />
              ) : null}
              <DetailRow
                theme={theme}
                label={t('confirm.urlLabel')}
                value={target.url}
                mono
                testID="pair-confirm-url"
              />
            </View>

            {target.kind === 'e2ee' && target.fingerprint ? (
              <IdentityFingerprintBlock fingerprint={target.fingerprint} variant="deep-link" />
            ) : null}

            <Text style={[styles.body, ctaWarning && styles.bodyWarning]}>{bodyText}</Text>
          </ScrollView>

          <View style={styles.actions}>
            <Pressable
              style={styles.cancelBtn}
              onPress={onCancel}
              testID="pair-confirm-cancel-btn"
              accessibilityRole="button"
            >
              <Text style={styles.cancelText}>{t('confirm.cancelButton')}</Text>
            </Pressable>
            <Pressable
              style={[styles.confirmBtn, ctaWarning && styles.confirmBtnWarning]}
              onPress={onConfirm}
              testID="pair-confirm-add-btn"
              accessibilityRole="button"
            >
              <Text style={[styles.confirmText, ctaWarning && styles.confirmTextWarning]}>
                {t('confirm.addButton')}
              </Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  )
}

function DetailRow({
  theme,
  label,
  value,
  mono,
  testID,
}: {
  theme: Theme
  label: string
  value: string
  mono?: boolean
  testID?: string
}) {
  const styles = makeStyles(theme)
  const displayValue = mono ? isolateLtr(value) : value
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, mono && styles.mono]} numberOfLines={2} testID={testID}>
        {displayValue}
      </Text>
    </View>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: theme.bg.primary,
    },
    scroll: {
      padding: spacing.lg,
      gap: spacing.md,
      paddingBottom: spacing.xl,
    },
    heading: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    title: {
      flex: 1,
      color: theme.text.primary,
      fontSize: font.lg,
      fontWeight: '700',
    },
    detailRows: {
      gap: spacing.xs,
    },
    detailRow: {
      flexDirection: 'row',
      gap: spacing.md,
      alignItems: 'flex-start',
    },
    detailLabel: {
      color: theme.text.secondary,
      fontSize: font.sm,
      width: 96,
    },
    detailValue: {
      color: theme.text.primary,
      fontSize: font.sm,
      flex: 1,
    },
    mono: {
      fontFamily: 'monospace',
      fontSize: font.xs,
      writingDirection: 'ltr',
    },
    body: {
      color: theme.text.primary,
      fontSize: font.sm,
      lineHeight: 19,
    },
    bodyWarning: {
      color: theme.text.warning,
    },
    actions: {
      flexDirection: 'row',
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
      paddingTop: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.border,
    },
    cancelBtn: {
      flex: 1,
      paddingVertical: spacing.sm,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: radius.md,
      backgroundColor: theme.bg.card,
      minHeight: 44,
      justifyContent: 'center',
    },
    cancelText: {
      color: theme.text.primary,
      fontSize: font.base,
      fontWeight: '600',
    },
    confirmBtn: {
      flex: 1,
      paddingVertical: spacing.sm,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.text.accent,
      borderRadius: radius.md,
      backgroundColor: theme.bg.card,
      minHeight: 44,
      justifyContent: 'center',
    },
    confirmBtnWarning: {
      borderColor: theme.text.warning,
    },
    confirmText: {
      color: theme.text.accent,
      fontSize: font.base,
      fontWeight: '700',
    },
    confirmTextWarning: {
      color: theme.text.warning,
    },
  })
}
