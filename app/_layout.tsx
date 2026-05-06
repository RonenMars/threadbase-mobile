import 'react-native-get-random-values'
import '../global.css'
import React, { useEffect, useState } from 'react'
import { Pressable } from 'react-native'
import {
  Stack,
  useGlobalSearchParams,
  useRootNavigationState,
  useRouter,
  useSegments,
} from 'expo-router'
import { CaretLeft } from 'phosphor-react-native'
import { StatusBar } from 'expo-status-bar'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { queryClient, queryPersister, persistBuster, shouldPersistQuery } from '@/services/query-client'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import * as Notifications from 'expo-notifications'
import { useServersStore } from '@/stores/servers'
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
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext'
import { I18nextProvider } from 'react-i18next';
import i18n from '@/lib/i18n';

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

  useEffect(() => {
    hydrateSettings()
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- segments is read but intentionally
    // excluded: this effect should only fire on auth-state changes (activeServerIds/isLoading),
    // not on every tab switch. Reading segments from the closure is correct here.
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
      const serverParam = `?server=${msg.serverId}`
      router.push(`/session/${msg.session.id}${serverParam}`)
    })
    const unsubStatus = wsManager.onAnyStatusChange((serverId, status) => {
      setConnected(serverId, status === 'connected')
    })

    // Register push tokens for all servers
    registerPushTokenForAll(activeServerIds).catch(() => {})

    return () => {
      unsubUpdate()
      unsubReady()
      unsubStatus()
      wsManager.disconnectAll()
    }
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

function ThemedStack({ router }: { router: ReturnType<typeof useRouter> }) {
  const theme = useTheme()
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.bg.secondary },
        headerTintColor: theme.text.primary,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: theme.bg.primary },
        headerLeft: ({ tintColor }) => (
          <Pressable
            onPress={() => router.back()}
            hitSlop={16}
            style={({ pressed }) => ({ paddingHorizontal: 4, opacity: pressed ? 0.5 : 1 })}
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
}

function ThemedStatusBar() {
  const theme = useTheme()
  return <StatusBar style={theme.colorMode === 'light' ? 'dark' : 'light'} />
}

export default function RootLayout() {
  const router = useRouter()
  const [splashDone, setSplashDone] = useState(!!g.__splashShown)

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
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          {!splashDone && <SplashAnimation onComplete={handleSplashComplete} />}
          <PersistQueryClientProvider
            client={queryClient}
            persistOptions={{
              persister: queryPersister,
              buster: persistBuster,
              maxAge: 1000 * 60 * 60 * 24,
              dehydrateOptions: {
                shouldDehydrateMutation: () => false,
                shouldDehydrateQuery: (query) =>
                  query.state.status === 'success' && shouldPersistQuery(query),
              },
            }}
          >
            <AuthGate>
              <SlowQueryBanner />
              <ErrorBanner />
              <ThemedStatusBar />
              <ThemedStack router={router} />
            </AuthGate>
          </PersistQueryClientProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ThemeProvider>
    </I18nextProvider>
  )
}
