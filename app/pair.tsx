import React, { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { type Theme, font, radius, spacing } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import {
  exchangeToken,
  isRetryablePairFailure,
  parsePairUri,
  PairExchangeError,
  PairUriError,
  type ExchangeResult,
} from '@/services/pair-exchange'
import { resolvePairFailureMessage } from '@/services/pair-failure-message'
import { defaultPairDeviceName } from '@/services/pair-device-name'
import { PairConfirmGate, type PendingPairTarget } from '@/components/pair/PairConfirmGate'
import { ScreenHeader } from '@/components/shared/ScreenHeader'
import { pendingTargetFromExchange } from '@/services/pair-confirm-target'
import { SUPPORT_EMAIL } from '@/services/feedback-transport'
import { isServerUrlAlreadyAdded, useServersStore } from '@/stores/servers'
import { clientLog } from '@/lib/clientLog'

type Phase = 'exchanging' | 'confirm' | 'error'

function resolveErrorMessage(err: Error, t: TFunction<'pair'>): string {
  if (err instanceof PairExchangeError) {
    clientLog.info('pair.exchange', err.kind, { message: err.message })
  } else if (!(err instanceof PairUriError)) {
    clientLog.info('pair.exchange', 'unrecognized', { message: err.message })
  }
  return resolvePairFailureMessage(err, t)
}

function canRetryPairFailure(err: Error): boolean {
  // This screen is bound to the URL that opened it. An expired or malformed
  // link cannot become valid by retrying the same query params — unlike the
  // camera, which can scan a fresh QR.
  if (err instanceof PairUriError) return false
  if (err instanceof PairExchangeError) return isRetryablePairFailure(err)
  return true
}

// One name for both the params this screen accepts and the params it rebuilds,
// so the two lists cannot drift apart.
type PairParams = { url?: string; token?: string; exp?: string; spk?: string; v?: string }

// Expo Router splits `threadbase://pair?url=...&token=...&exp=...&spk=...&v=...`
// into query params before this screen mounts; rebuild the URI so parsePairUri
// can validate it exactly as it does for the paste field and the QR scanner.
//
// The allowlist is the trap: a parameter missing here is dropped silently on
// this path only, so the deep link and the scanner stop agreeing on what a pair
// URI contains, with no error either side. Anything parsePairUri reads must be
// listed here too.
function buildPairUri(params: PairParams): string {
  const search = new URLSearchParams()
  if (params.url) search.set('url', params.url)
  if (params.token) search.set('token', params.token)
  if (params.exp) search.set('exp', params.exp)
  // Empty string is present-invalid, not absent. Dropping it here would
  // rebuild a URI with no `spk` and select the plaintext path for a
  // damaged key the scanner would have rejected.
  if (params.spk !== undefined) search.set('spk', params.spk)
  if (params.v) search.set('v', params.v)
  return `threadbase://pair?${search.toString()}`
}

export default function PairDeepLinkScreen() {
  const { t } = useTranslation('pair')
  const theme = useTheme()
  const styles = makeStyles(theme)
  const router = useRouter()
  const params = useLocalSearchParams<PairParams>()
  const addServer = useServersStore((s) => s.addServer)
  const [phase, setPhase] = useState<Phase>('exchanging')
  const [error, setError] = useState<string | null>(null)
  const [alreadyAdded, setAlreadyAdded] = useState(false)
  const [canRetry, setCanRetry] = useState(true)
  const [confirmTarget, setConfirmTarget] = useState<PendingPairTarget | null>(null)
  const pendingExchange = useRef<ExchangeResult | null>(null)
  const startedRef = useRef(false)
  const mountedRef = useRef(true)
  useEffect(() => {
    return () => {
      mountedRef.current = false
    }
  }, [])

  const attempt = useCallback(async () => {
    setPhase('exchanging')
    setError(null)
    setAlreadyAdded(false)
    try {
      const parsed = parsePairUri(buildPairUri(params))
      if (isServerUrlAlreadyAdded(parsed.url)) {
        setAlreadyAdded(true)
        setError(t('scanner.errors.alreadyAdded'))
        setCanRetry(false)
        setPhase('error')
        return
      }
      const exchanged = await exchangeToken({
        url: parsed.url,
        token: parsed.token,
        deviceName: defaultPairDeviceName(),
        serverPublicKey: parsed.spk,
      })
      if (!mountedRef.current) return
      pendingExchange.current = exchanged
      setConfirmTarget(
        pendingTargetFromExchange({
          url: exchanged.url,
          machineName: exchanged.machineName,
          serverPublicKey: exchanged.serverPublicKey ?? parsed.spk ?? null,
        }),
      )
      setPhase('confirm')
    } catch (err) {
      if (!mountedRef.current) return
      const failure = err instanceof Error ? err : new Error('Pairing failed')
      setError(resolveErrorMessage(failure, t))
      setCanRetry(canRetryPairFailure(failure))
      setPhase('error')
    }
  }, [params, t])

  const commitPending = useCallback(async () => {
    const exchanged = pendingExchange.current
    if (!exchanged) return
    pendingExchange.current = null
    setConfirmTarget(null)
    await addServer(exchanged.url, exchanged.apiKey, exchanged.machineName ?? undefined, {
      deviceId: exchanged.deviceId ?? undefined,
      deviceToken: exchanged.deviceToken ?? undefined,
      capabilities: exchanged.capabilities ?? undefined,
      publicUrl: exchanged.publicUrl ?? undefined,
      serverPublicKey: exchanged.serverPublicKey ?? undefined,
      requireEncryption: exchanged.e2eeRequired,
    })
    router.replace('/')
  }, [addServer, router])

  const cancelPending = useCallback(() => {
    pendingExchange.current = null
    setConfirmTarget(null)
    router.replace('/')
  }, [router])

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    void attempt()
    // Runs once per mount; retries are user-initiated via the button below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const errorHeading = alreadyAdded ? t('scanner.alreadyAddedTitle') : t('scanner.errorTitle')

  return (
    <SafeAreaView style={styles.root} testID="pair-deep-link-screen" edges={['top', 'bottom']}>
      <ScreenHeader title={t('screenTitle')} />
      {phase === 'exchanging' ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.text.primary} />
          <Text style={styles.statusText}>{t('scanner.exchanging')}</Text>
        </View>
      ) : phase === 'error' ? (
        <View style={styles.center}>
          <Text style={styles.errorTitle}>{errorHeading}</Text>
          <Text
            style={styles.errorBody}
            testID={alreadyAdded ? 'pair-deep-link-already-added' : undefined}
          >
            {error}
          </Text>
          {canRetry ? (
            <TouchableOpacity
              testID="pair-deep-link-try-again"
              style={styles.primaryBtn}
              onPress={() => void attempt()}
            >
              <Text style={styles.primaryBtnText}>{t('scanner.tryAgain')}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              testID="pair-deep-link-close"
              style={styles.primaryBtn}
              onPress={() => router.replace('/')}
            >
              <Text style={styles.primaryBtnText}>{t('scanner.close')}</Text>
            </TouchableOpacity>
          )}
          {alreadyAdded ? null : (
            <TouchableOpacity
              testID="pair-deep-link-support"
              onPress={() => {
                void Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Threadbase%20Pairing%20Help`)
              }}
            >
              <Text style={styles.supportLink}>{t('scanner.contactSupport')}</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : null}
      <PairConfirmGate
        visible={phase === 'confirm'}
        target={confirmTarget}
        onConfirm={() => void commitPending()}
        onCancel={cancelPending}
      />
    </SafeAreaView>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.bg.primary },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
      gap: spacing.md,
    },
    statusText: { color: theme.text.primary, fontSize: font.base },
    errorTitle: { color: theme.text.danger, fontSize: font.lg, fontWeight: '700' },
    errorBody: {
      color: theme.text.primary,
      fontSize: font.base,
      textAlign: 'center',
      lineHeight: 22,
    },
    primaryBtn: {
      marginTop: spacing.md,
      backgroundColor: theme.text.accent,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
    },
    primaryBtnText: { color: theme.text.onAccent, fontSize: font.base, fontWeight: '700' },
    supportLink: {
      color: theme.text.accent,
      fontSize: font.sm,
      fontWeight: '600',
      marginTop: spacing.sm,
    },
  })
}
