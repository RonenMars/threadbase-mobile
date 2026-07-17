import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { View, Text, TouchableOpacity, Alert, StyleSheet, ActivityIndicator } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useStartSession, START_SESSION_TIMEOUT_MS } from '@/hooks/useBrowse'
import { NetworkError } from '@/services/api-client'
import { CODEX_CLI_PROVIDER } from '@/constants/providers'
import { font, radius, spacing, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import {
  markNavigatedToSession,
  suppressAutoNavForBrowseStart,
  clearBrowseStartAutoNavSuppress,
} from '@/lib/sessionNavGuard'
import { clientLog } from '@/lib/clientLog'

const TICK_MS = 100

/**
 * Chat-screen URL for a started session, carrying projectId/projectPath so
 * the session screen can render before the next ProjectChat refetch lands.
 */
function buildSessionRoute(
  session: { id: string; projectId?: string; projectPath?: string | null },
  serverId: string,
  opts?: { starting?: boolean },
): string {
  const params = new URLSearchParams({ server: serverId })
  if (session.projectId) params.set('projectId', session.projectId)
  if (session.projectPath) params.set('projectPath', session.projectPath)
  if (opts?.starting) params.set('starting', '1')
  return `/session/${session.id}?${params.toString()}`
}

// Browse dismisses itself and lands here immediately on "Start Session Here" —
// before any session exists. This screen owns the whole start lifecycle
// (browse unmounts right away, and React Query drops mutate() callbacks when
// their component unmounts, so the orchestration can't stay in browse):
// POST /api/sessions/start, a countdown that visualizes the request budget,
// replace to the real session on 200, and a Retry/Cancel dialog on failure.
export default function NewSessionScreen() {
  const router = useRouter()
  const { t } = useTranslation(['browse', 'common'])
  const theme = useTheme()
  const styles = makeStyles(theme)
  const params = useLocalSearchParams<{
    server: string
    path?: string
    projectName?: string
    provider?: string
  }>()
  const serverId = params.server ?? ''
  const path = params.path ?? ''
  const projectName = params.projectName ?? '~'
  const provider = params.provider
  const startSession = useStartSession(serverId)
  const { mutate } = startSession

  // Bumping `attempt` re-runs the start effect (Retry button).
  const [attempt, setAttempt] = useState(0)
  const [remainingMs, setRemainingMs] = useState(START_SESSION_TIMEOUT_MS)
  // Freezes the countdown while the error dialog is up.
  const haltedRef = useRef(false)
  // Dev double-effect guard: one POST per attempt.
  const lastAttemptRef = useRef(-1)

  const handleResult = useCallback(
    (result: { kind: 'ready'; session: { id: string; projectId?: string; projectPath?: string | null } } | { kind: 'pending'; id: string }) => {
      clientLog.info('startSession', 'B. handleStartResult (HTTP success path)', {
        kind: result.kind,
        result,
      })
      if (result.kind === 'ready') {
        const target = buildSessionRoute(result.session, serverId)
        clientLog.info('startSession', 'C. mark + replace to real session', {
          sessionId: result.session.id,
          target,
        })
        markNavigatedToSession(result.session.id)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        router.replace(target as any)
      } else {
        // Server ready-wait timed out (202): hand over to the existing
        // exact-id pending screen, which replaces itself on session_ready.
        const target = buildSessionRoute({ id: result.id }, serverId, { starting: true })
        clientLog.info('startSession', 'C2. mark + replace to pending screen', {
          sessionId: result.id,
          target,
        })
        markNavigatedToSession(result.id)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        router.replace(target as any)
      }
    },
    [router, serverId],
  )

  const handleError = useCallback(
    (err: Error) => {
      clientLog.info('startSession', 'Berr. handleStartError', {
        message: err.message,
        code: err instanceof NetworkError ? err.code : undefined,
      })
      clearBrowseStartAutoNavSuppress()
      haltedRef.current = true
      const isTimeout = err instanceof NetworkError && err.code === 'TIMEOUT'
      const message = isTimeout ? t('error.startTimeout') : err.message
      Alert.alert(
        t('error.startFailed'),
        message,
        [
          {
            text: t('common:button.cancel'),
            style: 'cancel',
            onPress: () => {
              clientLog.info('startSession', 'error dialog CANCEL → back to hub')
              router.back()
            },
          },
          {
            text: t('common:button.retry'),
            onPress: () => {
              clientLog.info('startSession', 'error dialog RETRY → new attempt')
              setRemainingMs(START_SESSION_TIMEOUT_MS)
              setAttempt((a) => a + 1)
            },
          },
        ],
        { cancelable: false },
      )
    },
    [router, t],
  )

  useEffect(() => {
    if (lastAttemptRef.current === attempt) return
    lastAttemptRef.current = attempt
    haltedRef.current = false
    const payload = {
      path,
      projectName,
      ...(provider === CODEX_CLI_PROVIDER ? { provider: CODEX_CLI_PROVIDER } : {}),
    }
    // session_ready can beat the start HTTP response — suppress global
    // auto-nav until the id is known and handleResult owns navigation.
    clientLog.info('startSession', 'A. /session/new attempt — suppress + mutate', {
      attempt,
      serverId,
      payload,
    })
    suppressAutoNavForBrowseStart()
    mutate(payload, { onSuccess: handleResult, onError: handleError })
  }, [attempt, mutate, handleResult, handleError, path, projectName, provider, serverId])

  // The reset to the full budget happens in the Retry handler (state can't be
  // set synchronously inside the effect body); this effect only ticks.
  useEffect(() => {
    const startedAt = Date.now()
    const timer = setInterval(() => {
      if (haltedRef.current) return
      setRemainingMs(Math.max(0, START_SESSION_TIMEOUT_MS - (Date.now() - startedAt)))
    }, TICK_MS)
    return () => clearInterval(timer)
  }, [attempt])

  const secondsLeft = Math.ceil(remainingMs / 1000)

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <ActivityIndicator size="large" color={theme.text.accent} style={styles.spinner} />
        <Text style={styles.title}>{t('starting.title')}</Text>
        <Text style={styles.project} numberOfLines={1}>
          {projectName}
        </Text>
        <View style={styles.track} testID="start-countdown-track">
          <View
            style={[styles.fill, { width: `${(remainingMs / START_SESSION_TIMEOUT_MS) * 100}%` }]}
          />
        </View>
        <Text style={styles.seconds}>{t('starting.secondsLeft', { seconds: secondsLeft })}</Text>
      </View>
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.cancelButton}
          testID="start-cancel"
          onPress={() => {
            clientLog.info('startSession', 'countdown CANCEL → back to hub')
            router.back()
          }}
        >
          <Text style={styles.cancelText}>{t('common:button.cancel')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg.primary },
    content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg, gap: spacing.md },
    spinner: { marginBottom: spacing.md },
    title: { color: theme.text.primary, fontSize: font.lg, fontWeight: '600', textAlign: 'center' },
    project: { color: theme.text.secondary, fontSize: font.base, textAlign: 'center' },
    track: {
      width: '100%',
      maxWidth: 240,
      height: 4,
      borderRadius: radius.sm,
      backgroundColor: theme.border,
      overflow: 'hidden',
    },
    fill: { height: '100%', borderRadius: radius.sm, backgroundColor: theme.text.accent },
    seconds: { color: theme.text.secondary, fontSize: font.sm, textAlign: 'center' },
    footer: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
    cancelButton: {
      borderWidth: 1,
      borderColor: theme.text.danger,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      alignItems: 'center',
    },
    cancelText: { color: theme.text.danger, fontSize: font.base, fontWeight: '500' },
  })
}
