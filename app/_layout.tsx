import 'react-native-get-random-values'
import '../global.css'
import React, { useEffect, useState } from 'react'
import { TouchableOpacity } from 'react-native'
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
import { queryClient, queryPersister, persistBuster } from '@/services/query-client'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import * as Notifications from 'expo-notifications'
import { useServersStore } from '@/stores/servers'
import { useSettingsStore } from '@/stores/settings'
import { wsManager } from '@/services/ws-client'
import type { Session } from '@/types/api'
import { registerPushTokenForAll } from '@/services/push'
import { SplashAnimation } from '@/components/SplashAnimation'
import * as SplashScreen from 'expo-splash-screen'

SplashScreen.preventAutoHideAsync()

function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const segments = useSegments()
  const { mode } = useGlobalSearchParams<{ mode?: string }>()
  const navState = useRootNavigationState()
  const activeServerIds = useServersStore((s) => s.activeServerIds)
  const isLoading = useServersStore((s) => s.isLoading)
  const loadPersistedServers = useServersStore((s) => s.loadPersistedServers)
  const hydrateSettings = useSettingsStore((s) => s.hydrate)
  const setConnected = useServersStore((s) => s.setConnected)

  useEffect(() => {
    hydrateSettings()
  }, [hydrateSettings])

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
        router.replace('/(tabs)/sessions')
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

    const unsubList = wsManager.onAll('session_list', (msg) => {
      if (msg.type !== 'session_list') return
      queryClient.setQueriesData<{ serverId: string; sessions: Session[] }[]>(
        { queryKey: ['sessions'] },
        (old) =>
          old?.map((entry) =>
            entry.serverId === msg.serverId ? { ...entry, sessions: msg.sessions } : entry,
          ),
      )
    })
    const unsubUpdate = wsManager.onAll('session_update', (msg) => {
      if (msg.type !== 'session_update') return
      const key = ['session', msg.serverId, msg.session.id]
      // Cancel any in-flight HTTP fetch for this session so it can't overwrite
      // the authoritative status that just arrived over the WS.
      void queryClient.cancelQueries({ queryKey: key })
      queryClient.setQueryData<Session>(key, (prev) =>
        prev ? { ...prev, ...msg.session } : (msg.session as Session),
      )
      queryClient.setQueriesData<{ serverId: string; sessions: Session[] }[]>(
        { queryKey: ['sessions'] },
        (old) =>
          old?.map((entry) =>
            entry.serverId === msg.serverId
              ? {
                  ...entry,
                  sessions: entry.sessions.map((s) =>
                    s.id === msg.session.id ? { ...s, ...msg.session } : s,
                  ),
                }
              : entry,
          ),
      )
    })
    const unsubStatus = wsManager.onAnyStatusChange((serverId, status) => {
      setConnected(serverId, status === 'connected')
    })

    // Register push tokens for all servers
    registerPushTokenForAll(activeServerIds).catch(() => {})

    return () => {
      unsubList()
      unsubUpdate()
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

export default function RootLayout() {
  const router = useRouter()
  const [splashDone, setSplashDone] = useState(false)

  useEffect(() => {
    SplashScreen.hideAsync()
  }, [])

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        {!splashDone && <SplashAnimation onComplete={() => setSplashDone(true)} />}
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{
            persister: queryPersister,
            buster: persistBuster,
            maxAge: 1000 * 60 * 60 * 24,
            dehydrateOptions: {
              shouldDehydrateMutation: () => false,
              shouldDehydrateQuery: (query) =>
                query.state.status === 'success' &&
                (query.meta as { persist?: boolean } | undefined)?.persist !== false,
            },
          }}
        >
          <AuthGate>
            <StatusBar style="light" />
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: '#161b22' },
                headerTintColor: '#e6edf3',
                headerShadowVisible: false,
                contentStyle: { backgroundColor: '#0d1117' },
                headerLeft: ({ tintColor }) => (
                  <TouchableOpacity
                    onPress={() => router.back()}
                    hitSlop={16}
                    activeOpacity={1}
                    style={{ paddingHorizontal: 4 }}
                  >
                    <CaretLeft size={28} color={tintColor ?? '#e6edf3'} />
                  </TouchableOpacity>
                ),
              }}
            >
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="onboarding" options={{ headerShown: false }} />
              <Stack.Screen name="session/[id]" options={{ title: 'Session' }} />
              <Stack.Screen name="conversation/[id]" options={{ title: 'Conversation' }} />
              <Stack.Screen
                name="browse"
                options={{
                  presentation: 'modal',
                  title: 'Browse',
                  headerBackTitle: 'Cancel',
                }}
              />
            </Stack>
          </AuthGate>
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
