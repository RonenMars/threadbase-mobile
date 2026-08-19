import 'react-native-get-random-values'
import '../global.css'
import React, { useEffect, useState } from 'react'
import { Pressable, View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native'
import { useBiometricLock } from '@/hooks/useBiometricLock'
import {
  Stack,
  useGlobalSearchParams,
  useRootNavigationState,
  useRouter,
  useSegments,
  ThemeProvider as NavThemeProvider,
  DefaultTheme as NavDefaultTheme,
  DarkTheme as NavDarkTheme,
} from 'expo-router'
import type { Href } from 'expo-router'
import { CaretLeft } from 'phosphor-react-native'
import { StatusBar } from 'expo-status-bar'
import { LinearGradient } from 'expo-linear-gradient'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { queryClient, queryPersister, persistBuster, shouldPersistQuery } from '@/services/query-client'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { KeyboardProvider } from 'react-native-keyboard-controller'
import * as Notifications from 'expo-notifications'
import { useServersStore } from '@/stores/servers'
import { useSettingsStore } from '@/stores/settings'
import { useSessionNamesStore } from '@/stores/sessionNames'
import { useQuickAccessStore } from '@/stores/quickAccess'
import { useViewPrefsStore } from '@/stores/viewPrefs'
import { wsManager } from '@/services/ws-client'
import { applySessionUpdateToEagerCache, refreshEagerConversations } from '@/lib/eagerCacheSync'
import { isHostPressureLevel, parseHostPressureOs, parseHostPressureReasons, type Session } from '@/types/api'
import { authToken } from '@/services/authed-fetch'
import { registerPushTokenForAll } from '@/services/push'
import {
  adoptRunningActivities,
  reconcile as reconcileLiveActivity,
} from '@/services/live-activity'
import { SplashAnimation } from '@/components/SplashAnimation'
import { goBackOrHub } from '@/lib/goBackOrHub'
import { SlowQueryBanner } from '@/components/SlowQueryBanner'
import { ErrorBanner } from '@/components/ErrorBanner'
import { NavigationLockOverlay } from '@/components/ui/NavigationLockOverlay'
import * as SplashScreen from 'expo-splash-screen'
import { ThemeProvider, useTheme, useIsGlass } from '@/contexts/ThemeContext'
import { GlassView } from '@/components/ui/GlassView'
import { I18nextProvider } from 'react-i18next';
import i18n from '@/lib/i18n';
import { installClientLogCapture, clientLog } from '@/lib/clientLog'
import { markNavigatedToSession, shouldSkipAutoNav } from '@/lib/sessionNavGuard'
import { resolveColdStartRoute, sessionRouteFromNotificationData } from '@/lib/coldStartDeepLink'
import { useTranslation } from 'react-i18next'
import { RootErrorBoundary } from '@/components/RootErrorBoundary'
import { CacheAlertSync } from '@/components/servers/CacheAlertSync'
import { useCrashReportingSync } from '@/hooks/useCrashReportingSync'
import { wrap as sentryWrap } from '@/services/sentry'
import { recordDiagnosticEvent } from '@/services/diagnostic-events'

installClientLogCapture()
clientLog.info('boot', 'app module loaded')
recordDiagnosticEvent('app_started')

SplashScreen.preventAutoHideAsync()

// global persists across Expo fast-refresh reloads; resets on native restart.
const g = global as typeof global & { __splashShown?: boolean }

/**
 * Whether a route with no paired servers should be bounced to onboarding.
 *
 * `pair` is exempt alongside `onboarding`: a `threadbase://pair` deep link runs
 * an async token exchange that adds the server itself. Redirecting mid-flight
 * races that, and on a failed exchange it unmounts the error screen before it
 * renders — so an expired link would look like the app ignoring the tap, which
 * is the silent first-run failure the pair route exists to fix.
 */
export function shouldRedirectToOnboarding(
  firstSegment: string | undefined,
  hasServers: boolean,
): boolean {
  if (hasServers) return false
  return firstSegment !== 'onboarding' && firstSegment !== 'pair'
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const segments = useSegments()
  const { mode } = useGlobalSearchParams<{ mode?: string }>()
  const navState = useRootNavigationState()
  const activeServerIds = useServersStore((s) => s.activeServerIds)
  const isLoading = useServersStore((s) => s.isLoading)
  const loadPersistedServers = useServersStore((s) => s.loadPersistedServers)
  const hydrateSettings = useSettingsStore((s) => s.hydrate)
  const hydrateSessionNames = useSessionNamesStore((s) => s.hydrate)
  const hydrateQuickAccess = useQuickAccessStore((s) => s.hydrate)
  const hydrateViewPrefs = useViewPrefsStore((s) => s.hydrate)
  const setConnected = useServersStore((s) => s.setConnected)
  const setScanProgress = useServersStore((s) => s.setScanProgress)
  const setCacheAlert = useServersStore((s) => s.setCacheAlert)
  const clearCacheAlert = useServersStore((s) => s.clearCacheAlert)
  const setHostPressure = useServersStore((s) => s.setHostPressure)
  const clearHostPressure = useServersStore((s) => s.clearHostPressure)

  useEffect(() => {
    hydrateSettings().then(() => {
      const locale = useSettingsStore.getState().locale;
      i18n.changeLanguage(locale);
    });
    void hydrateSessionNames()
    void hydrateQuickAccess()
    void hydrateViewPrefs()
  }, [hydrateSettings, hydrateSessionNames, hydrateQuickAccess, hydrateViewPrefs])

  useEffect(() => {
    loadPersistedServers()
  }, [loadPersistedServers])

  useEffect(() => {
    if (isLoading) return
    if (!navState?.key) return
    const inOnboarding = segments[0] === 'onboarding'
    const addingServer = inOnboarding && mode === 'add'
    const hasServers = activeServerIds.length > 0
    const handle = requestAnimationFrame(() => {
      if (shouldRedirectToOnboarding(segments[0], hasServers)) {
        router.replace('/onboarding')
      } else if (hasServers && inOnboarding && !addingServer) {
        router.replace('/')
      }
    })
    return () => cancelAnimationFrame(handle)
    // segments/router intentionally omitted: effect should only fire on
    // auth-state changes (activeServerIds/isLoading), not on every tab switch.
    // Reading from the closure is correct here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeServerIds, isLoading, mode, navState?.key])

  // Live surfaces outlive the JS context. Anything still on screen from a
  // previous launch is untracked and could never be updated or ended, so it
  // would sit frozen on stale data — clear it before the first session_update
  // can start new ones. Mount-only: re-running per server change would tear
  // down surfaces this session had just raised.
  useEffect(() => {
    void adoptRunningActivities()
  }, [])

  // Wire WebSocket for all servers
  useEffect(() => {
    if (activeServerIds.length === 0) return

    const currentServers = useServersStore.getState().servers
    for (const serverId of activeServerIds) {
      const server = currentServers[serverId]
      if (server) {
        wsManager.connect(serverId, server.url, authToken(server))
      }
    }

    const unsubUpdate = wsManager.onAll('session_update', (msg) => {
      if (msg.type !== 'session_update') return
      if (__DEV__) {
        console.log(`[session_update] id=${msg.session.id} status=${msg.session.status} pty=${msg.session.ptyAttached} prompts=${msg.session.promptCount}`)
      }
      const key = ['session', msg.serverId, msg.session.id]
      // Cancel any in-flight HTTP fetch for this session so it can't overwrite
      // the authoritative status that just arrived over the WS.
      void queryClient.cancelQueries({ queryKey: key })
      queryClient.setQueryData<Session>(key, (prev) =>
        prev ? { ...prev, ...msg.session } : (msg.session as Session),
      )
      // Patch the eager paginated sessions cache (home-screen list) in place so
      // the row's status flips without an HTTP refetch; if the session isn't in
      // the list yet (e.g. a newly-alive external session), invalidate so it
      // appears without a manual pull-to-refresh.
      applySessionUpdateToEagerCache(queryClient, msg.serverId, msg.session)
      // Live surfaces are driven from this one frame — it is the only place
      // every status change passes through with its serverId already stamped.
      void reconcileLiveActivity(msg.serverId, msg.session)
    })
    // External-session liveness ping: a conversation's JSONL grew without a PTY
    // the streamer owns. Refresh the eager conversations list so its row updates.
    const unsubConvUpdated = wsManager.onAll('conversation_updated', (msg) => {
      if (msg.type !== 'conversation_updated') return
      refreshEagerConversations(queryClient)
    })
    const unsubReady = wsManager.onAll('session_ready', (msg) => {
      if (msg.type !== 'session_ready') return
      clientLog.info('layout.session_ready', 'global listener received', {
        sessionId: msg.session.id,
        serverId: msg.serverId,
        projectId: msg.session.projectId,
        projectPath: msg.session.projectPath,
      })
      const skip = shouldSkipAutoNav(msg.session.id)
      if (skip) {
        clientLog.info('layout.session_ready', 'skip auto-nav (guard marked)', {
          sessionId: msg.session.id,
          serverId: msg.serverId,
        })
        return
      }
      const target: Href = `/session/${msg.session.id}?server=${msg.serverId}`
      clientLog.info('layout.session_ready', 'auto-nav router.push', {
        sessionId: msg.session.id,
        serverId: msg.serverId,
        target,
      })
      router.push(target)
    })
    const unsubStatus = wsManager.onAnyStatusChange((serverId, status) => {
      setConnected(serverId, status === 'connected')
    })
    const unsubCacheReady = wsManager.onAll('cache_ready', (msg) => {
      if (msg.type !== 'cache_ready') return
      void queryClient.invalidateQueries({ queryKey: ['sessions-eager'] })
      void queryClient.invalidateQueries({ queryKey: ['sessions'] })
      void queryClient.invalidateQueries({ queryKey: ['conversations-eager'] })
      void queryClient.invalidateQueries({ queryKey: ['conversations'] })
    })
    const unsubScanProgress = wsManager.onAll('scan_progress', (msg) => {
      if (msg.type !== 'scan_progress') return
      setScanProgress(msg.serverId, msg.scanned, msg.total)
    })
    const unsubCacheAlert = wsManager.onAll('cache_alert', (msg) => {
      if (msg.type !== 'cache_alert') return
      setCacheAlert(msg.serverId, {
        fingerprint: msg.fingerprint,
        severity: msg.severity,
        detectedAt: msg.detectedAt,
        missingCount: msg.missingCount,
        totalRows: msg.totalRows,
      })
    })
    const unsubCacheAlertResolved = wsManager.onAll('cache_alert_resolved', (msg) => {
      if (msg.type !== 'cache_alert_resolved') return
      clearCacheAlert(msg.serverId, msg.fingerprint)
    })
    const unsubHostPressure = wsManager.onAll('host_pressure', (msg) => {
      if (msg.type !== 'host_pressure') return
      if (!isHostPressureLevel(msg.level)) return
      const liveAgents = typeof msg.liveAgents === 'number' && Number.isFinite(msg.liveAgents)
        ? msg.liveAgents
        : 0
      const updatedAt = typeof msg.updatedAt === 'string' ? msg.updatedAt : ''
      const reasons = Array.isArray(msg.reasons) ? parseHostPressureReasons(msg.reasons) : []
      const os = typeof msg.os === 'string' ? parseHostPressureOs(msg.os) : undefined
      setHostPressure(msg.serverId, {
        level: msg.level,
        reasons,
        liveAgents,
        updatedAt,
        ...(os ? { os } : {}),
      })
    })
    const unsubHostPressureCleared = wsManager.onAll('host_pressure_cleared', (msg) => {
      if (msg.type !== 'host_pressure_cleared') return
      clearHostPressure(msg.serverId)
    })

    // Register push tokens for all servers
    registerPushTokenForAll(activeServerIds).catch(() => {})

    return () => {
      unsubUpdate()
      unsubConvUpdated()
      unsubReady()
      unsubStatus()
      unsubCacheReady()
      unsubScanProgress()
      unsubCacheAlert()
      unsubCacheAlertResolved()
      unsubHostPressure()
      unsubHostPressureCleared()
      wsManager.disconnectAll()
    }
    // router from expo-router is a stable singleton; setConnected is a stable
    // Zustand setter. Wiring is intentionally scoped to activeServerIds changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeServerIds])

  // Handle notification taps
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const target = sessionRouteFromNotificationData(
        response.notification.request.content.data as { sessionId?: string; serverId?: string },
      )
      if (target) router.push(target.path)
    })
    return () => sub.remove()
  }, [router])

  // Cold start: a tap that launched the app is never delivered to the warm
  // handlers above, so the launch URL / notification response has to be read
  // back explicitly. Held until servers hydrate and the navigator has a key,
  // otherwise the push lands before there is a route tree to push onto and
  // AuthGate's redirect stomps it.
  const coldStartHandled = React.useRef(false)
  useEffect(() => {
    if (coldStartHandled.current) return
    if (isLoading || !navState?.key) return
    if (activeServerIds.length === 0) return
    coldStartHandled.current = true

    let cancelled = false
    void (async () => {
      const [url, response] = await Promise.all([
        Linking.getInitialURL(),
        Notifications.getLastNotificationResponseAsync(),
      ])
      if (cancelled) return
      const target = resolveColdStartRoute({
        url,
        notificationData: response
          ? (response.notification.request.content.data as {
              sessionId?: string
              serverId?: string
            })
          : null,
      })
      if (!target) return
      // Mark before pushing so the session_ready listener does not fire a
      // second, duplicate navigation for the same session.
      markNavigatedToSession(target.sessionId)
      router.push(target.path)
    })()
    return () => {
      cancelled = true
    }
  }, [activeServerIds, isLoading, navState?.key, router])

  return (
    <>
      <CacheAlertSync />
      {children}
    </>
  )
}

function BiometricLockGate({ children }: { children: React.ReactNode }) {
  const { locked, authenticate } = useBiometricLock()
  const { t } = useTranslation('common')
  if (!locked) return <>{children}</>
  return (
    <View style={lockStyles.container}>
      <Text style={lockStyles.title}>{t('biometricLock.title')}</Text>
      <TouchableOpacity style={lockStyles.btn} onPress={authenticate}>
        <Text style={lockStyles.btnText}>{t('biometricLock.unlock')}</Text>
      </TouchableOpacity>
    </View>
  )
}

const lockStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117', alignItems: 'center', justifyContent: 'center', gap: 24 },
  title: { color: '#e6edf3', fontSize: 20, fontWeight: '600' },
  btn: { backgroundColor: '#238636', paddingHorizontal: 28, paddingVertical: 12, borderRadius: 8 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
})

export function ThemedStack({ router }: { router: ReturnType<typeof useRouter> }) {
  const theme = useTheme()
  const isGlass = useIsGlass()
  // expo-router 57.0.4 paints the native screen container with the
  // react-navigation theme's `colors.background`. Its default is opaque light
  // grey, which covers our glass gradient backdrop. Feed it a transparent
  // background under glass (theme.bg.primary otherwise) so the gradient shows.
  const navBase = theme.colorMode === 'light' ? NavDefaultTheme : NavDarkTheme
  const navTheme = {
    ...navBase,
    colors: {
      ...navBase.colors,
      background: isGlass ? 'transparent' : theme.bg.primary,
    },
  }
  const stack = (
    <Stack
      screenOptions={{
        headerStyle: isGlass ? undefined : { backgroundColor: theme.bg.secondary },
        headerTransparent: isGlass,
        headerBackground: isGlass
          ? () => <GlassView style={StyleSheet.absoluteFill} />
          : undefined,
        headerTintColor: theme.text.primary,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: isGlass ? 'transparent' : theme.bg.primary },
        headerLeft: ({ tintColor }) => (
          <Pressable
            onPress={() => goBackOrHub(router)}
            hitSlop={16}
            style={({ pressed }) => ({ paddingHorizontal: 4, opacity: pressed ? 0.5 : 1 })}
            accessibilityLabel="Back"
            testID="header-back"
          >
            <CaretLeft size={28} color={(typeof tintColor === 'string' ? tintColor : undefined) ?? theme.text.primary} />
          </Pressable>
        ),
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="pair" options={{ headerShown: false }} />
      <Stack.Screen name="session" options={{ headerShown: false }} />
      <Stack.Screen name="conversation/[id]" options={{ headerShown: false }} />
      <Stack.Screen
        name="browse"
        options={{
          presentation: 'modal',
          title: 'Browse',
          headerBackTitle: 'Cancel',
        }}
      />
      <Stack.Screen
        name="settings"
        options={{ title: 'Settings', headerShown: true }}
      />
      <Stack.Screen
        name="manage-favorites"
        options={{ title: 'Manage Favorites', headerShown: true }}
      />
      <Stack.Screen
        name="help-feedback"
        options={{ title: i18n.t('feedback:screenTitle'), headerShown: true }}
      />
      <Stack.Screen
        name="diagnostics"
        options={{ title: i18n.t('feedback:diagnostics.screenTitle'), headerShown: true }}
      />
      <Stack.Screen
        name="server-health"
        options={{ title: i18n.t('servers:health.screenTitle'), headerShown: true }}
      />
      <Stack.Screen
        name="notification-health"
        options={{ title: i18n.t('settings:notificationHealth.screenTitle'), headerShown: true }}
      />
      <Stack.Screen
        name="paired-devices"
        options={{ title: i18n.t('settings:pairedDevices.screenTitle'), headerShown: true }}
      />
      <Stack.Screen
        name="backup-restore"
        options={{ title: i18n.t('settings:backup.screenTitle'), headerShown: true }}
      />
      <Stack.Screen
        name="project/[id]"
        options={({ route }) => {
          const params = route.params as { id?: string; path?: string }
          const fromPath = params.path
            ? decodeURIComponent(params.path).split('/').filter(Boolean).pop()
            : undefined
          return { title: fromPath ?? params.id ?? 'Project' }
        }}
      />
    </Stack>
  )

  if (isGlass) {
    return (
      <NavThemeProvider value={navTheme}>
        <View style={styles.flex}>
          {/* Vivid backdrop — gives the frosted surfaces something colorful to
              blur. Deep indigo → violet → magenta on the diagonal, dark enough
              to keep white text readable. */}
          <LinearGradient
            colors={['#1b1d4d', '#3a1d6e', '#6e2b6e', '#1a1330']}
            locations={[0, 0.4, 0.7, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          {/* Soft accent glow in the upper area for extra depth under the blur. */}
          <LinearGradient
            colors={['rgba(10,132,255,0.35)', 'transparent']}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 0.55 }}
            style={StyleSheet.absoluteFill}
          />
          {stack}
        </View>
      </NavThemeProvider>
    )
  }

  return <NavThemeProvider value={navTheme}>{stack}</NavThemeProvider>
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
})

function ThemedStatusBar() {
  const theme = useTheme()
  return <StatusBar style={theme.colorMode === 'light' ? 'dark' : 'light'} />
}

function RootLayout() {
  const router = useRouter()
  const [splashDone, setSplashDone] = useState(!!g.__splashShown)

  // Initialize/tear down crash reporting in lockstep with the consent setting.
  // Runs here (rather than in AuthGate, several layers deeper) so Sentry.init()
  // fires as early as React effects allow — the SDK's App Start tracing span
  // still can't observe a client on the very first frame (Sentry.wrap() runs at
  // module-eval time, before any effect can run, and consent is only known
  // after an async AsyncStorage read), so a one-time "wrap called before init"
  // warning is expected in dev and harmless: it only skips a performance span,
  // and performance tracing is disabled anyway (tracesSampleRate: 0).
  useCrashReportingSync()

  useEffect(() => {
    SplashScreen.hideAsync()
  }, [])

  function handleSplashComplete() {
    g.__splashShown = true
    setSplashDone(true)
  }

  return (
    <I18nextProvider i18n={i18n}>
    <ThemeProvider>
      <RootErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <KeyboardProvider>
        <SafeAreaProvider>
          {!splashDone && <SplashAnimation onComplete={handleSplashComplete} />}
          <PersistQueryClientProvider
            client={queryClient}
            persistOptions={{
              persister: queryPersister,
              buster: persistBuster,
              maxAge: 1000 * 60 * 60 * 24 * 7,
              dehydrateOptions: {
                shouldDehydrateMutation: () => false,
                shouldDehydrateQuery: (query) =>
                  query.state.status === 'success' && shouldPersistQuery(query),
              },
            }}
          >
            <AuthGate>
              <BiometricLockGate>
                <SlowQueryBanner />
                <ErrorBanner />
                <ThemedStatusBar />
                <ThemedStack router={router} />
                <NavigationLockOverlay />
              </BiometricLockGate>
            </AuthGate>
          </PersistQueryClientProvider>
        </SafeAreaProvider>
        </KeyboardProvider>
      </GestureHandlerRootView>
      </RootErrorBoundary>
    </ThemeProvider>
    </I18nextProvider>
  )
}

// Wrap the root with Sentry so native/JS crashes and touch/nav context (already
// stripped to a privacy-safe minimum by our init config) are captured. `wrap`
// is a passthrough when Sentry is not initialized (consent off / no DSN).
export default sentryWrap(RootLayout)
