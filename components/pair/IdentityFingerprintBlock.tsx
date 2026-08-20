import React, { useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { CaretDown, CaretUp } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { type Theme, font, radius, spacing } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { isolateLtr } from '@/components/pair/ltr-isolate'

export type FingerprintCheckVariant = 'deep-link' | 'camera' | 'settings'

interface Props {
  fingerprint: string
  variant: FingerprintCheckVariant
}

/**
 * The identity fingerprint a person can eyeball against the computer.
 *
 * `deep-link` — two-sided check plus How to check (CLI), because there is no QR
 * in the room.
 * `camera` — match the code printed next to the QR; no CLI, no accordion.
 * `settings` — same fingerprint later, with How to check for re-verify.
 */
export function IdentityFingerprintBlock({ fingerprint, variant }: Props) {
  const { t } = useTranslation('pair')
  const theme = useTheme()
  const styles = makeStyles(theme)
  const [howToOpen, setHowToOpen] = useState(false)

  const showColumns = variant === 'deep-link'
  const showCameraHint = variant === 'camera'
  const showHowTo = variant === 'deep-link' || variant === 'settings'
  const step3 = variant === 'settings' ? t('confirm.howToCheckStep3Settings') : t('confirm.howToCheckStep3Pair')
  const isolatedFingerprint = isolateLtr(fingerprint)
  const howToLabel = t('confirm.howToCheck')

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{t('confirm.fingerprintLabel')}</Text>
      <Text style={styles.fingerprint} testID="identity-fingerprint">
        {isolatedFingerprint}
      </Text>

      {showColumns ? (
        <View style={styles.columns} testID="identity-compare-columns">
          <View style={styles.column}>
            <Text style={styles.columnLabel}>{t('confirm.phoneColumnLabel')}</Text>
            <Text style={styles.columnBody}>{t('confirm.phoneColumnBody')}</Text>
          </View>
          <View style={styles.column} testID="identity-computer-column">
            <Text style={styles.columnLabel}>{t('confirm.computerColumnLabel')}</Text>
            <Text style={styles.columnBody}>{t('confirm.computerColumnBody')}</Text>
          </View>
        </View>
      ) : null}

      {showCameraHint ? (
        <Text style={styles.hint} testID="identity-camera-hint">
          {t('confirm.cameraMatchHint')}
        </Text>
      ) : null}

      {showHowTo ? (
        <View>
          <TouchableOpacity
            onPress={() => setHowToOpen((open) => !open)}
            accessibilityRole="button"
            accessibilityLabel={howToLabel}
            testID="identity-how-to-check"
            style={styles.toggle}
          >
            <Text style={styles.toggleText}>{howToLabel}</Text>
            {howToOpen ? (
              <CaretUp size={14} color={theme.text.accent} />
            ) : (
              <CaretDown size={14} color={theme.text.accent} />
            )}
          </TouchableOpacity>
          {howToOpen ? (
            <View style={styles.steps} testID="identity-how-to-check-steps">
              <Text style={styles.step}>{t('confirm.howToCheckStep1')}</Text>
              <Text style={styles.step}>{t('confirm.howToCheckStep2')}</Text>
              <Text style={styles.step}>{step3}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    wrap: {
      gap: spacing.sm,
    },
    label: {
      color: theme.text.secondary,
      fontSize: font.sm,
    },
    fingerprint: {
      color: theme.text.primary,
      fontFamily: 'monospace',
      fontSize: font.base,
      lineHeight: 24,
      writingDirection: 'ltr',
      backgroundColor: theme.bg.card,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: theme.border,
      padding: spacing.md,
    },
    columns: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    column: {
      flex: 1,
      gap: 4,
    },
    columnLabel: {
      color: theme.text.secondary,
      fontSize: font.xs,
      fontWeight: '600',
    },
    columnBody: {
      color: theme.text.primary,
      fontSize: font.sm,
      lineHeight: 18,
    },
    hint: {
      color: theme.text.secondary,
      fontSize: font.sm,
      lineHeight: 18,
    },
    toggle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      minHeight: 32,
    },
    toggleText: {
      color: theme.text.accent,
      fontSize: font.sm,
      fontWeight: '500',
    },
    steps: {
      gap: spacing.xs,
      paddingTop: spacing.xs,
    },
    step: {
      color: theme.text.secondary,
      fontSize: font.sm,
      lineHeight: 18,
    },
  })
}
