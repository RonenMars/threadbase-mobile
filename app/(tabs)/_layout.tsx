import React from 'react'
import { Tabs } from 'expo-router'
import { Text, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import { useServersStore } from '@/stores/servers'
import { dark } from '@/constants/theme'

export default function TabsLayout() {
  const router = useRouter()
  const activeServerIds = useServersStore((s) => s.activeServerIds)

  const newSessionButton = () => (
    <TouchableOpacity
      onPress={() => {
        const serverId = activeServerIds[0]
        if (serverId) router.push(`/browse?server=${serverId}`)
      }}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      style={{ paddingHorizontal: 16, paddingVertical: 8 }}
    >
      <Text style={{ color: dark.text.accent, fontSize: 24, fontWeight: '300' }}>+</Text>
    </TouchableOpacity>
  )

  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          backgroundColor: dark.bg.secondary,
          borderTopColor: dark.border,
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: dark.text.accent,
        tabBarInactiveTintColor: dark.text.secondary,
        headerStyle: { backgroundColor: dark.bg.secondary },
        headerTintColor: dark.text.primary,
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="sessions"
        options={{
          title: 'Sessions',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>⚡</Text>,
          headerRight: newSessionButton,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>📚</Text>,
          headerRight: newSessionButton,
          // Mount eagerly so the conversations list is fetched on app open
          // (parity with Sessions which lands first), without waiting for the
          // user to navigate to History.
          lazy: false,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>⚙️</Text>,
        }}
      />
    </Tabs>
  )
}
