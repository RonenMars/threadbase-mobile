import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { dark, font, radius, spacing } from '@/constants/theme'
import {
  exchangeToken,
  parsePairUri,
  PairExchangeError,
  PairUriError,
  type ExchangeResult,
} from '@/services/pair-exchange'

interface Props {
  visible: boolean
  onClose: () => void
  onSuccess: (result: ExchangeResult) => void
}

type Phase = 'permission' | 'scanning' | 'exchanging' | 'error'

function resolveErrorMessage(err: unknown, t: TFunction<'pair'>): string {
  if (err instanceof PairUriError) {
    return t(`scanner.errors.uri.${err.code}`)
  }
  if (err instanceof PairExchangeError) {
    if (err.kind === 'network' || err.kind === 'server') {
      return t(`scanner.errors.exchange.${err.kind}`, { message: err.message })
    }
    return t(`scanner.errors.exchange.${err.kind}`)
  }
  return t('scanner.errors.generic')
}

export function PairScannerModal({ visible, onClose, onSuccess }: Props) {
  const { t } = useTranslation('pair')
  const [permission, requestPermission] = useCameraPermissions()
  const [phase, setPhase] = useState<Phase>('scanning')
  const [error, setError] = useState<string | null>(null)
  const [scanEnabled, setScanEnabled] = useState(true)
  const handledRef = useRef(false)

  const reset = useCallback(() => {
    handledRef.current = false
    setScanEnabled(true)
    setPhase('scanning')
    setError(null)
  }, [])

  const handleClose = useCallback(() => {
    reset()
    onClose()
  }, [onClose, reset])

  useEffect(() => {
    if (visible) queueMicrotask(reset)
  }, [visible, reset])

  const handleScanned = useCallback(
    async ({ data }: { data: string }) => {
      if (!scanEnabled || handledRef.current) return
      handledRef.current = true
      setScanEnabled(false)
      setPhase('exchanging')
      try {
        const parsed = parsePairUri(data)
        const result = await exchangeToken({ url: parsed.url, token: parsed.token })
        reset()
        onSuccess(result)
        onClose()
      } catch (err) {
        setError(resolveErrorMessage(err, t))
        setPhase('error')
      }
    },
    [onClose, onSuccess, reset, scanEnabled, t],
  )

  const showCamera =
    phase === 'scanning' && permission?.granted && visible && scanEnabled

  // Decide which screen state to show.
  let body: React.ReactNode
  if (!permission) {
    body = (
      <View style={styles.center}>
        <ActivityIndicator color={dark.text.primary} />
      </View>
    )
  } else if (!permission.granted) {
    body = (
      <View style={styles.permissionWrap}>
        <Text style={styles.permissionTitle}>{t('scanner.permissionTitle')}</Text>
        <Text style={styles.permissionBody}>{t('scanner.permissionBody')}</Text>
        {permission.canAskAgain ? (
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={async () => {
              const next = await requestPermission()
              if (next.granted) reset()
            }}
          >
            <Text style={styles.primaryBtnText}>{t('scanner.allowCamera')}</Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.permissionHint}>{t('scanner.permissionHint')}</Text>
        )}
      </View>
    )
  } else if (phase === 'exchanging') {
    body = (
      <View style={styles.center}>
        <ActivityIndicator color={dark.text.primary} />
        <Text style={styles.statusText}>{t('scanner.exchanging')}</Text>
      </View>
    )
  } else if (phase === 'error') {
    body = (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>{t('scanner.errorTitle')}</Text>
        <Text style={styles.errorBody}>{error}</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={reset}>
          <Text style={styles.primaryBtnText}>{t('scanner.tryAgain')}</Text>
        </TouchableOpacity>
      </View>
    )
  } else {
    body = (
      <>
        {showCamera && (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={handleScanned}
          />
        )}
        <View style={styles.reticleWrap} pointerEvents="none">
          <View style={styles.reticle} />
          <Text style={styles.reticleHint}>{t('scanner.reticleHint')}</Text>
        </View>
      </>
    )
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
    >
      <View style={styles.root} testID="pair-scanner-modal">
        {body}
        <TouchableOpacity style={styles.closeBtn} onPress={handleClose} accessibilityLabel="Close">
          <Text style={styles.closeText}>×</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  closeBtn: {
    position: 'absolute',
    top: 56,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { color: '#fff', fontSize: 28, lineHeight: 30 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  statusText: { color: dark.text.primary, fontSize: font.base },
  permissionWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  permissionTitle: { color: dark.text.primary, fontSize: font.xl, fontWeight: '700' },
  permissionBody: {
    color: dark.text.secondary,
    fontSize: font.base,
    textAlign: 'center',
    lineHeight: 22,
  },
  permissionHint: { color: dark.text.warning, fontSize: font.sm, textAlign: 'center' },
  primaryBtn: {
    marginTop: spacing.md,
    backgroundColor: dark.text.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  primaryBtnText: { color: '#fff', fontSize: font.base, fontWeight: '700' },
  reticleWrap: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  reticle: {
    width: 240,
    height: 240,
    borderWidth: 2,
    borderColor: '#fff',
    borderRadius: radius.lg,
    backgroundColor: 'transparent',
  },
  reticleHint: {
    color: '#fff',
    fontSize: font.base,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowRadius: 6,
  },
  errorTitle: { color: dark.text.danger, fontSize: font.lg, fontWeight: '700' },
  errorBody: {
    color: dark.text.primary,
    fontSize: font.base,
    textAlign: 'center',
    lineHeight: 22,
  },
})
