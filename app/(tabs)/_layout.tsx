import React from 'react'
import { Tabs } from 'expo-router'
import { Text } from 'react-native'
import { dark } from '@/constants/theme'

export default function TabsLayout() {
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
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>📚</Text>,
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
