import React from 'react'
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { type Theme, font, radius, spacing } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { IdentityFingerprintBlock } from '@/components/pair/IdentityFingerprintBlock'
import { textDirectionStyle, useAppDirection, useDirectionStyle } from '@/lib/rtl'
import { webModalWidth } from '@/lib/webModal'

interface Props {
  visible: boolean
  fingerprint: string | null
  onDone: () => void
  onReject: () => void
}

/**
 * After a camera scan, the QR already carried the key, so nothing is added until
 * Save. This shows the same fingerprint the streamer prints next to that QR so
 * the two can be compared in the same room. "It matches" continues the add;
 * "Doesn't match" (and dismissing the sheet) discards the scan without adding.
 */
export function PairCameraIdentityCard({ visible, fingerprint, onDone, onReject }: Props) {
  const { t } = useTranslation('pair')
  const theme = useTheme()
  const directionStyle = useDirectionStyle()
  const { direction } = useAppDirection()
  const copyStyle = textDirectionStyle(direction)
  const styles = makeStyles(theme)

  if (!fingerprint) return null

  const doneLabel = t('confirm.cameraMatches')
  const rejectLabel = t('confirm.cameraReject')

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onReject} statusBarTranslucent>
      <View style={[styles.backdrop, directionStyle]} testID="pair-camera-identity-card">
        <View style={styles.sheet} testID="pair-camera-identity-sheet">
          <IdentityFingerprintBlock fingerprint={fingerprint} variant="camera" />
          <View style={styles.actions}>
            <Pressable
              style={styles.rejectBtn}
              onPress={onReject}
              testID="pair-camera-identity-reject"
              accessibilityRole="button"
              accessibilityLabel={rejectLabel}
            >
              <Text style={[styles.rejectText, copyStyle]}>{rejectLabel}</Text>
            </Pressable>
            <Pressable
              style={styles.doneBtn}
              onPress={onDone}
              testID="pair-camera-identity-done"
              accessibilityRole="button"
              accessibilityLabel={doneLabel}
            >
              <Text style={[styles.doneText, copyStyle]}>{doneLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'flex-end',
      paddingBottom: 40,
      paddingHorizontal: spacing.md,
    },
    sheet: {
      ...webModalWidth,
      backgroundColor: theme.bg.secondary,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: theme.border,
      padding: spacing.md,
      gap: spacing.md,
    },
    actions: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    rejectBtn: {
      flex: 1,
      paddingVertical: spacing.sm,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: radius.md,
      minHeight: 44,
      justifyContent: 'center',
    },
    rejectText: {
      color: theme.text.secondary,
      fontSize: font.base,
      fontWeight: '500',
    },
    doneBtn: {
      flex: 1,
      paddingVertical: spacing.sm,
      alignItems: 'center',
      borderRadius: radius.md,
      backgroundColor: theme.text.accent,
      minHeight: 44,
      justifyContent: 'center',
    },
    doneText: {
      color: theme.text.onAccent,
      fontSize: font.base,
      fontWeight: '600',
    },
  })
}
