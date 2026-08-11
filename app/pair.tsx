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
  parsePairUri,
  PairExchangeError,
  PairUriError,
} from '@/services/pair-exchange'
import { defaultPairDeviceName } from '@/services/pair-device-name'
import { SUPPORT_EMAIL } from '@/services/feedback-transport'
import { useServersStore } from '@/stores/servers'
import { clientLog } from '@/lib/clientLog'

type Phase = 'exchanging' | 'error'

// Mirrors PairScannerModal's error mapping so a tapped link and a scanned QR
// produce the same messages for the same failure. The translated copy never
// repeats err.message — it stays a developer detail, routed to clientLog for
// whoever debugs the next pairing failure.
function resolveErrorMessage(err: unknown, t: TFunction<'pair'>): string {
  if (err instanceof PairUriError) {
    return t(`scanner.errors.uri.${err.code}`)
  }
  if (err instanceof PairExchangeError) {
    clientLog.info('pair.exchange', err.kind, { message: err.message })
    return t(`scanner.errors.exchange.${err.kind}`)
  }
  clientLog.info('pair.exchange', 'unrecognized', {
    message: err instanceof Error ? err.message : String(err),
  })
  return t('scanner.errors.generic')
}

// Expo Router splits `threadbase://pair?url=...&token=...&exp=...` into query
// params before this screen mounts; rebuild the URI so parsePairUri can
// validate it exactly as it does for the paste field and the QR scanner.
function buildPairUri(params: { url?: string; token?: string; exp?: string }): string {
  const search = new URLSearchParams()
  if (params.url) search.set('url', params.url)
  if (params.token) search.set('token', params.token)
  if (params.exp) search.set('exp', params.exp)
  return `threadbase://pair?${search.toString()}`
}

export default function PairDeepLinkScreen() {
  const { t } = useTranslation('pair')
  const theme = useTheme()
  const styles = makeStyles(theme)
  const router = useRouter()
  const params = useLocalSearchParams<{ url?: string; token?: string; exp?: string }>()
  const addServer = useServersStore((s) => s.addServer)
  const servers = useServersStore((s) => s.servers)
  const activeServerIds = useServersStore((s) => s.activeServerIds)
  const [phase, setPhase] = useState<Phase>('exchanging')
  const [error, setError] = useState<string | null>(null)
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
    try {
      const parsed = parsePairUri(buildPairUri(params))
      const normalizedUrl = parsed.url.replace(/\/+$/, '')
      // Reopening a link for a server that's already configured must be a
      // no-op, not a second exchange against a (likely already-consumed)
      // token and not a duplicate entry.
      const alreadyPaired = activeServerIds.some((id) => servers[id]?.url === normalizedUrl)
      if (alreadyPaired) {
        router.replace('/')
        return
      }
      const exchanged = await exchangeToken({
        url: parsed.url,
        token: parsed.token,
        deviceName: defaultPairDeviceName(),
      })
      await addServer(exchanged.url, exchanged.apiKey, exchanged.machineName ?? undefined, {
        deviceId: exchanged.deviceId ?? undefined,
        deviceToken: exchanged.deviceToken ?? undefined,
        capabilities: exchanged.capabilities ?? undefined,
      })
      router.replace('/')
    } catch (err) {
      if (!mountedRef.current) return
      setError(resolveErrorMessage(err, t))
      setPhase('error')
    }
  }, [params, activeServerIds, servers, addServer, router, t])

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    void attempt()
    // Runs once per mount; retries are user-initiated via the button below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <SafeAreaView style={styles.root} testID="pair-deep-link-screen">
      {phase === 'exchanging' ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.text.primary} />
          <Text style={styles.statusText}>{t('scanner.exchanging')}</Text>
        </View>
      ) : (
        <View style={styles.center}>
          <Text style={styles.errorTitle}>{t('scanner.errorTitle')}</Text>
          <Text style={styles.errorBody}>{error}</Text>
          <TouchableOpacity
            testID="pair-deep-link-try-again"
            style={styles.primaryBtn}
            onPress={() => void attempt()}
          >
            <Text style={styles.primaryBtnText}>{t('scanner.tryAgain')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="pair-deep-link-support"
            onPress={() => {
              void Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Threadbase%20Pairing%20Help`)
            }}
          >
            <Text style={styles.supportLink}>{t('scanner.contactSupport')}</Text>
          </TouchableOpacity>
        </View>
      )}
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
