import 'react-native-get-random-values'
import '../global.css'
import React, { useEffect, useState } from 'react'
import { Pressable, View, Text, TouchableOpacity, StyleSheet } from 'react-native'
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
import { useServerFetchStatusStore } from '@/stores/serverFetchStatus'
import { useSettingsStore } from '@/stores/settings'
import { useSessionNamesStore } from '@/stores/sessionNames'
import { useQuickAccessStore } from '@/stores/quickAccess'
import { wsManager } from '@/services/ws-client'
import type { Session, MultiSession } from '@/types/api'
import { registerPushTokenForAll } from '@/services/push'
import { SplashAnimation } from '@/components/SplashAnimation'
import { SlowQueryBanner } from '@/components/SlowQueryBanner'
import { ErrorBanner } from '@/components/ErrorBanner'
import * as SplashScreen from 'expo-splash-screen'
import { ThemeProvider, useTheme, useIsGlass } from '@/contexts/ThemeContext'
import { GlassView } from '@/components/ui/GlassView'
import { I18nextProvider } from 'react-i18next';
import i18n from '@/lib/i18n';
import { installClientLogCapture, clientLog } from '@/lib/clientLog'
import { shouldSkipAutoNav } from '@/lib/sessionNavGuard'
import { useTranslation } from 'react-i18next'
import { RootErrorBoundary } from '@/components/RootErrorBoundary'
import { useCrashReportingSync } from '@/hooks/useCrashReportingSync'
import { wrap as sentryWrap } from '@/services/sentry'
import { recordDiagnosticEvent } from '@/services/diagnostic-events'

installClientLogCapture()
clientLog.info('boot', 'app module loaded')
recordDiagnosticEvent('app_started')

SplashScreen.preventAutoHideAsync()

// global persists across Expo fast-refresh reloads; resets on native restart.
const g = global as typeof global & { __splashShown?: boolean }

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
  const setConnected = useServersStore((s) => s.setConnected)
  const setCacheReady = useServersStore((s) => s.setCacheReady)
  const recordFetchSuccess = useServerFetchStatusStore((s) => s.recordSuccess)
  const setScanProgress = useServersStore((s) => s.setScanProgress)

  useEffect(() => {
    hydrateSettings().then(() => {
      const locale = useSettingsStore.getState().locale;
      i18n.changeLanguage(locale);
    });
    void hydrateSessionNames()
    void hydrateQuickAccess()
  }, [hydrateSettings, hydrateSessionNames, hydrateQuickAccess])

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
      if (!hasServers && !inOnboarding) {
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

  // Wire WebSocket for all servers
  useEffect(() => {
    if (activeServerIds.length === 0) return

    const currentServers = useServersStore.getState().servers
    for (const serverId of activeServerIds) {
      const server = currentServers[serverId]
      if (server) {
        wsManager.connect(serverId, server.url, server.apiKey)
      }
    }

    const unsubUpdate = wsManager.onAll('session_update', (msg) => {
      if (msg.type !== 'session_update') return
      const key = ['session', msg.serverId, msg.session.id]
      // Cancel any in-flight HTTP fetch for this session so it can't overwrite
      // the authoritative status that just arrived over the WS.
      void queryClient.cancelQueries({ queryKey: key })
      queryClient.setQueryData<Session>(key, (prev) =>
        prev ? { ...prev, ...msg.session } : (msg.session as Session),
      )
      // Patch the eager paginated sessions cache (home-screen list) in place
      // so the row's status flips without an HTTP refetch.
      queryClient.setQueriesData<MultiSession[]>(
        { queryKey: ['sessions-eager'] },
        (old) =>
          Array.isArray(old)
            ? old.map((s) =>
                s.serverId === msg.serverId && s.id === msg.session.id
                  ? { ...s, ...msg.session }
                  : s,
              )
            : old,
      )
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
      const target = `/session/${msg.session.id}?server=${msg.serverId}`
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
      setCacheReady(msg.serverId)
      recordFetchSuccess(msg.serverId)
    })
    const unsubScanProgress = wsManager.onAll('scan_progress', (msg) => {
      if (msg.type !== 'scan_progress') return
      setScanProgress(msg.serverId, msg.scanned, msg.total)
    })

    // Register push tokens for all servers
    registerPushTokenForAll(activeServerIds).catch(() => {})

    return () => {
      unsubUpdate()
      unsubReady()
      unsubStatus()
      unsubCacheReady()
      unsubScanProgress()
      wsManager.disconnectAll()
    }
    // router from expo-router is a stable singleton; setConnected/setCacheReady
    // are stable Zustand setters. Wiring is intentionally scoped to activeServerIds changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeServerIds])

  // Handle notification taps
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as {
        sessionId?: string
        serverId?: string
      }
      if (data.sessionId) {
        const serverParam = data.serverId ? `?server=${data.serverId}` : ''
        router.push(`/session/${data.sessionId}${serverParam}`)
      }
    })
    return () => sub.remove()
  }, [router])

  return <>{children}</>
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
            onPress={() => router.back()}
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
      <Stack.Screen name="session/[id]" options={{ headerShown: false }} />
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
