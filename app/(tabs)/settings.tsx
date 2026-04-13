import React from 'react'
import {
  View,
  Text,
  Switch,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import * as Notifications from 'expo-notifications'
import { useConnectionStore } from '@/stores/connection'
import { useSettingsStore } from '@/stores/settings'
import { dark, font, radius, spacing } from '@/constants/theme'

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>
}

function SettingsRow({
  label,
  value,
  onValueChange,
}: {
  label: string
  value: boolean
  onValueChange: (v: boolean) => void
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: dark.border, true: dark.text.accent }}
        thumbColor="#fff"
      />
    </View>
  )
}

export default function SettingsScreen() {
  const router = useRouter()
  const { serverUrl, serverInfo, clearConnection } = useConnectionStore()
  const { notifications, setNotifications } = useSettingsStore()

  const handleTestNotification = async () => {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '⚡ Test Notification',
        body: 'Threadbase notifications are working!',
      },
      trigger: null,
    })
  }

  const handleSignOut = () => {
    Alert.alert('Disconnect', 'Remove server connection and credentials?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: async () => {
          await clearConnection()
          router.replace('/onboarding')
        },
      },
    ])
  }

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <ScrollView contentContainerStyle={styles.content}>
        <SectionHeader title="Server" />
        <View style={styles.card}>
          <Text style={styles.serverUrl}>{serverUrl}</Text>
          {serverInfo ? (
            <Text style={styles.serverMeta}>
              {serverInfo.machineName} · {serverInfo.platform} · v{serverInfo.version}
            </Text>
          ) : null}
          <TouchableOpacity style={styles.disconnectBtn} onPress={handleSignOut}>
            <Text style={styles.disconnectText}>Disconnect</Text>
          </TouchableOpacity>
        </View>

        <SectionHeader title="Notifications" />
        <View style={styles.card}>
          <SettingsRow
            label="Waiting for Input"
            value={notifications.waitingInput}
            onValueChange={(v) => setNotifications({ waitingInput: v })}
          />
          <SettingsRow
            label="Session Completed"
            value={notifications.sessionComplete}
            onValueChange={(v) => setNotifications({ sessionComplete: v })}
          />
          <SettingsRow
            label="Session Failed"
            value={notifications.sessionFailed}
            onValueChange={(v) => setNotifications({ sessionFailed: v })}
          />
          <SettingsRow
            label="Diff Ready"
            value={notifications.diffReady}
            onValueChange={(v) => setNotifications({ diffReady: v })}
          />
          <SettingsRow
            label="Show Badge Count"
            value={notifications.showBadge}
            onValueChange={(v) => setNotifications({ showBadge: v })}
          />
          <SettingsRow
            label="Quiet Hours"
            value={notifications.quietHoursEnabled}
            onValueChange={(v) => setNotifications({ quietHoursEnabled: v })}
          />
          <TouchableOpacity style={styles.testBtn} onPress={handleTestNotification}>
            <Text style={styles.testBtnText}>Send Test Notification</Text>
          </TouchableOpacity>
        </View>

        <SectionHeader title="About" />
        <View style={styles.card}>
          <Text style={styles.aboutText}>Threadbase Mobile v1.0.0</Text>
          <Text style={styles.aboutSubtext}>AI Agent Control Center</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: dark.bg.primary },
  content: { padding: spacing.md, gap: spacing.sm },
  sectionHeader: {
    color: dark.text.secondary,
    fontSize: font.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    marginLeft: spacing.xs,
  },
  card: {
    backgroundColor: dark.bg.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: dark.border,
    overflow: 'hidden',
  },
  serverUrl: {
    color: dark.text.primary,
    fontSize: font.base,
    fontFamily: 'monospace',
    padding: spacing.md,
  },
  serverMeta: {
    color: dark.text.secondary,
    fontSize: font.xs,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  disconnectBtn: {
    borderTopWidth: 1,
    borderTopColor: dark.border,
    padding: spacing.md,
    minHeight: 44,
    justifyContent: 'center',
  },
  disconnectText: {
    color: dark.status.failed,
    fontSize: font.base,
    fontWeight: '500',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    minHeight: 44,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: dark.border,
  },
  rowLabel: {
    color: dark.text.primary,
    fontSize: font.base,
  },
  testBtn: {
    padding: spacing.md,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  testBtnText: {
    color: dark.text.accent,
    fontSize: font.base,
  },
  aboutText: {
    color: dark.text.primary,
    fontSize: font.base,
    padding: spacing.md,
    fontWeight: '500',
  },
  aboutSubtext: {
    color: dark.text.secondary,
    fontSize: font.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
})
