import React, { useEffect } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import * as Notifications from 'expo-notifications'
import { useConnectionStore } from '@/stores/connection'
import { wsClient } from '@/services/ws-client'
import { useSessionsStore } from '@/stores/sessions'
import { registerPushToken } from '@/services/push'

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
  const { apiKey, serverUrl, isLoading, loadPersistedCredentials, setConnected } =
    useConnectionStore()
  const setSessions = useSessionsStore((s) => s.setSessions)
  const updateSession = useSessionsStore((s) => s.updateSession)

  useEffect(() => {
    loadPersistedCredentials()
  }, [loadPersistedCredentials])

  useEffect(() => {
    if (isLoading) return
    const inOnboarding = segments[0] === 'onboarding'
    if (!apiKey && !inOnboarding) {
      router.replace('/onboarding')
    } else if (apiKey && inOnboarding) {
      router.replace('/(tabs)/sessions')
    }
  }, [apiKey, isLoading, segments, router])

  // Wire WebSocket when credentials are available
  useEffect(() => {
    if (!apiKey || !serverUrl) return
    wsClient.connect(serverUrl, apiKey)

    const unsubList = wsClient.on('session_list', (msg) => {
      if (msg.type === 'session_list') setSessions(msg.sessions)
    })
    const unsubUpdate = wsClient.on('session_update', (msg) => {
      if (msg.type === 'session_update') updateSession(msg.session.id, msg.session)
    })
    const unsubStatus = wsClient.onStatusChange((status) => {
      setConnected(status === 'connected')
    })

    // Register push token
    registerPushToken(serverUrl, apiKey).catch(() => {})

    return () => {
      unsubList()
      unsubUpdate()
      unsubStatus()
      wsClient.disconnect()
    }
  }, [apiKey, serverUrl])

  // Handle notification taps
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as { sessionId?: string }
      if (data.sessionId) {
        router.push(`/session/${data.sessionId}`)
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
