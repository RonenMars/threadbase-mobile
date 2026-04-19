import '../global.css'
import React, { useEffect } from 'react'
import { Stack, useRootNavigationState, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import * as Notifications from 'expo-notifications'
import { useServersStore } from '@/stores/servers'
import { wsManager } from '@/services/ws-client'
import { useSessionsStore } from '@/stores/sessions'
import { registerPushTokenForAll } from '@/services/push'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000,
    },
  },
})

function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const segments = useSegments()
  const navState = useRootNavigationState()
  const activeServerIds = useServersStore((s) => s.activeServerIds)
  const isLoading = useServersStore((s) => s.isLoading)
  const loadPersistedServers = useServersStore((s) => s.loadPersistedServers)
  const setConnected = useServersStore((s) => s.setConnected)
  const setSessions = useSessionsStore((s) => s.setSessions)
  const updateSession = useSessionsStore((s) => s.updateSession)

  useEffect(() => {
    loadPersistedServers()
  }, [loadPersistedServers])

  useEffect(() => {
    if (isLoading) return
    if (!navState?.key) return
    const inOnboarding = segments[0] === 'onboarding'
    const hasServers = activeServerIds.length > 0
    const handle = requestAnimationFrame(() => {
      if (!hasServers && !inOnboarding) {
        router.replace('/onboarding')
      } else if (hasServers && inOnboarding) {
        router.replace('/(tabs)/sessions')
      }
    })
    return () => cancelAnimationFrame(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- segments is read but intentionally
    // excluded: this effect should only fire on auth-state changes (activeServerIds/isLoading),
    // not on every tab switch. Reading segments from the closure is correct here.
  }, [activeServerIds, isLoading, navState?.key])

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
      if (msg.type === 'session_list') setSessions(msg.serverId, msg.sessions)
    })
    const unsubUpdate = wsManager.onAll('session_update', (msg) => {
      if (msg.type === 'session_update') updateSession(msg.serverId, msg.session.id, msg.session)
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
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthGate>
            <StatusBar style="light" />
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: '#161b22' },
                headerTintColor: '#e6edf3',
                headerShadowVisible: false,
                contentStyle: { backgroundColor: '#0d1117' },
              }}
            >
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="onboarding" options={{ headerShown: false }} />
              <Stack.Screen
                name="session/[id]"
                options={{ title: 'Session', headerBackTitle: 'Back' }}
              />
              <Stack.Screen
                name="conversation/[id]"
                options={{ title: 'Conversation', headerBackTitle: 'Back' }}
              />
            </Stack>
          </AuthGate>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
