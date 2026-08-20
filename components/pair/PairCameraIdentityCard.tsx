import React from 'react'
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { type Theme, font, radius, spacing } from '@/constants/theme'
import { useTheme, useIsGlass } from '@/contexts/ThemeContext'
import { GlassFill } from '@/components/ui/GlassFill'
import { IdentityFingerprintBlock } from '@/components/pair/IdentityFingerprintBlock'

interface Props {
  visible: boolean
  fingerprint: string | null
  onDone: () => void
}

/**
 * After a camera scan, the QR *was* the out-of-band channel, so this is not a
 * gate. It shows the same fingerprint the streamer prints next to that QR so
 * the two can be glanced at in the same room. Done continues the add.
 */
export function PairCameraIdentityCard({ visible, fingerprint, onDone }: Props) {
  const { t } = useTranslation('pair')
  const theme = useTheme()
  const isGlass = useIsGlass()
  const styles = makeStyles(theme)

  if (!fingerprint) return null

  const doneLabel = t('confirm.cameraDone')

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDone} statusBarTranslucent>
      <View style={styles.backdrop} testID="pair-camera-identity-card">
        <View style={[styles.sheet, isGlass && styles.sheetGlass]}>
          <GlassFill />
          <IdentityFingerprintBlock fingerprint={fingerprint} variant="camera" />
          <Pressable
            style={styles.doneBtn}
            onPress={onDone}
            testID="pair-camera-identity-done"
            accessibilityRole="button"
            accessibilityLabel={doneLabel}
          >
            <Text style={styles.doneText}>{doneLabel}</Text>
          </Pressable>
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
      backgroundColor: theme.bg.secondary,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: theme.border,
      padding: spacing.md,
      gap: spacing.md,
    },
    sheetGlass: {
      backgroundColor: 'transparent',
      overflow: 'hidden',
    },
    doneBtn: {
      paddingVertical: spacing.sm,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.text.accent,
      borderRadius: radius.md,
      backgroundColor: theme.bg.card,
      minHeight: 44,
      justifyContent: 'center',
    },
    doneText: {
      color: theme.text.accent,
      fontSize: font.base,
      fontWeight: '700',
    },
  })
}
