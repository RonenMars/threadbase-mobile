import React, { useState } from 'react'
import {
  View,
  Text,
  Switch,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  RefreshControl,
} from 'react-native'
import Constants from 'expo-constants'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import * as Notifications from 'expo-notifications'
import { useServersStore } from '@/stores/servers'
import { useSettingsStore, type AddServerAction } from '@/stores/settings'
import { DisplayedServersList } from '@/components/servers/DisplayedServersList'
import { ServerListCard } from '@/components/servers/ServerListCard'
import { ServerErrorModal } from '@/components/servers/ServerErrorModal'
import { ServerEditModal } from '@/components/servers/ServerEditModal'
import { dark, font, radius, spacing } from '@/constants/theme'

function addServerActionLabel(action: AddServerAction): string {
  switch (action) {
    case 'ask': return 'Ask each time'
    case 'add': return 'Add to displayed'
    case 'replace': return 'Display only new'
    case 'keep': return 'Keep current'
  }
}

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
  const { servers, activeServerIds, displayedServerIds, removeServer, setDisplayedServerIds, refreshServerInfo } = useServersStore()
  const {
    notifications,
    setNotifications,
    historyMessageDisplay,
    setHistoryMessageDisplay,
    addServerAction,
    setAddServerAction,
  } = useSettingsStore()
  const [isAddBehaviorOpen, setIsAddBehaviorOpen] = React.useState(false)
  const [refreshingServerIds, setRefreshingServerIds] = useState<Set<string>>(new Set())
  const [isPullRefreshing, setIsPullRefreshing] = useState(false)
  const [errorServerId, setErrorServerId] = useState<string | null>(null)
  const [editServerId, setEditServerId] = useState<string | null | 'new'>(null)

  const handleTestNotification = async () => {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '⚡ Test Notification',
        body: 'Threadbase notifications are working!',
      },
      trigger: null,
    })
  }

  const handleRemoveServer = async (serverId: string) => {
    await removeServer(serverId)
    if (activeServerIds.length <= 1) {
      router.replace('/onboarding')
    }
  }

  const handleRefreshServer = async (serverId: string) => {
    setRefreshingServerIds((prev) => new Set(prev).add(serverId))
    await refreshServerInfo(serverId)
    setRefreshingServerIds((prev) => {
      const next = new Set(prev)
      next.delete(serverId)
      return next
    })
  }

  const handlePullRefresh = async () => {
    setIsPullRefreshing(true)
    await Promise.all(activeServerIds.map((id) => refreshServerInfo(id)))
    setIsPullRefreshing(false)
  }

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isPullRefreshing}
            onRefresh={handlePullRefresh}
            tintColor={dark.text.secondary}
          />
        }
      >
        <SectionHeader title="Servers" />
        {activeServerIds.map((id) => {
          const server = servers[id]
          if (!server) return null
          return (
            <ServerListCard
              key={id}
              server={server}
              isRefreshing={refreshingServerIds.has(id)}
              onRemove={handleRemoveServer}
              onEdit={(sid) => setEditServerId(sid)}
              onRefresh={handleRefreshServer}
              onViewError={(sid) => setErrorServerId(sid)}
            />
          )
        })}
        <TouchableOpacity
          style={styles.addServerBtn}
          onPress={() => setEditServerId('new')}
        >
          <Text style={styles.addServerText}>+ Add Server</Text>
        </TouchableOpacity>

        <SectionHeader title="Displayed Servers" />
        <DisplayedServersList
          activeServerIds={activeServerIds}
          servers={servers}
          selectedServerIds={displayedServerIds}
          onChange={setDisplayedServerIds}
        />

        <SectionHeader title="When Adding A New Server" />
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.row}
            onPress={() => setIsAddBehaviorOpen((v) => !v)}
          >
            <Text style={styles.rowLabel}>Selected action on create</Text>
            <Text style={styles.rowValue}>{addServerActionLabel(addServerAction)}</Text>
          </TouchableOpacity>
          {isAddBehaviorOpen ? (
            <View style={styles.accordionBody}>
              <ActionSegment value={addServerAction} onChange={setAddServerAction} />
              <TouchableOpacity style={styles.resetBtn} onPress={() => setAddServerAction('ask')}>
                <Text style={styles.resetBtnText}>Reset to ask each time</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        <SectionHeader title="Notifications" />
        <View style={styles.card}>
          <SettingsRow label="Waiting for Input" value={notifications.waitingInput} onValueChange={(v) => setNotifications({ waitingInput: v })} />
          <SettingsRow label="Session Completed" value={notifications.sessionComplete} onValueChange={(v) => setNotifications({ sessionComplete: v })} />
          <SettingsRow label="Session Failed" value={notifications.sessionFailed} onValueChange={(v) => setNotifications({ sessionFailed: v })} />
          <SettingsRow label="Diff Ready" value={notifications.diffReady} onValueChange={(v) => setNotifications({ diffReady: v })} />
          <SettingsRow label="Show Badge Count" value={notifications.showBadge} onValueChange={(v) => setNotifications({ showBadge: v })} />
          <SettingsRow label="Quiet Hours" value={notifications.quietHoursEnabled} onValueChange={(v) => setNotifications({ quietHoursEnabled: v })} />
          <TouchableOpacity style={styles.testBtn} onPress={handleTestNotification}>
            <Text style={styles.testBtnText}>Send Test Notification</Text>
          </TouchableOpacity>
        </View>

        <SectionHeader title="History" />
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Message Preview</Text>
            <View style={styles.segmentedControl}>
              <TouchableOpacity
                style={[styles.segmentBtn, historyMessageDisplay === 'first' && styles.segmentBtnActive]}
                onPress={() => setHistoryMessageDisplay('first')}
              >
                <Text style={[styles.segmentBtnText, historyMessageDisplay === 'first' && styles.segmentBtnTextActive]}>First</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.segmentBtn, historyMessageDisplay === 'last' && styles.segmentBtnActive]}
                onPress={() => setHistoryMessageDisplay('last')}
              >
                <Text style={[styles.segmentBtnText, historyMessageDisplay === 'last' && styles.segmentBtnTextActive]}>Last</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <SectionHeader title="Help" />
        <View style={styles.card}>
          <TouchableOpacity style={styles.row} onPress={() => router.push('/onboarding')}>
            <Text style={styles.rowLabel}>Restart onboarding</Text>
            <Text style={styles.rowValue}>›</Text>
          </TouchableOpacity>
        </View>

        <SectionHeader title="About" />
        <View style={styles.card}>
          <Text style={styles.aboutText}>
            {`Threadbase Mobile v${Constants.expoConfig?.version ?? '—'} (${
              Platform.OS === 'ios'
                ? (Constants.expoConfig?.ios?.buildNumber ?? '—')
                : (Constants.expoConfig?.android?.versionCode ?? '—')
            })`}
          </Text>
          <Text style={styles.aboutSubtext}>AI Agent Control Center</Text>
        </View>
      </ScrollView>

      <ServerErrorModal
        visible={errorServerId !== null}
        server={errorServerId ? servers[errorServerId] ?? null : null}
        onClose={() => setErrorServerId(null)}
      />

      <ServerEditModal
        visible={editServerId !== null}
        serverId={editServerId === 'new' ? null : editServerId}
        onClose={() => setEditServerId(null)}
      />
    </SafeAreaView>
  )
}

function ActionSegment({
  value,
  onChange,
}: {
  value: AddServerAction
  onChange: (v: AddServerAction) => void
}) {
  const options: { id: AddServerAction; label: string }[] = [
    { id: 'ask', label: 'Ask' },
    { id: 'add', label: 'Add' },
    { id: 'replace', label: 'Replace' },
    { id: 'keep', label: 'Keep' },
  ]
  return (
    <View style={styles.segmentedControl}>
      {options.map((option) => (
        <TouchableOpacity
          key={option.id}
          style={[styles.segmentBtn, value === option.id && styles.segmentBtnActive]}
          onPress={() => onChange(option.id)}
        >
          <Text style={[styles.segmentBtnText, value === option.id && styles.segmentBtnTextActive]}>
            {option.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
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
  addServerBtn: {
    backgroundColor: dark.bg.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: dark.border,
    borderStyle: 'dashed',
    padding: spacing.md,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  addServerText: {
    color: dark.text.accent,
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
  rowLabel: { color: dark.text.primary, fontSize: font.base },
  rowValue: { color: dark.text.secondary, fontSize: font.sm },
  accordionBody: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  resetBtn: { minHeight: 44, justifyContent: 'center' },
  resetBtnText: { color: dark.text.accent, fontSize: font.sm, fontWeight: '500' },
  testBtn: { padding: spacing.md, alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  testBtnText: { color: dark.text.accent, fontSize: font.base },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: dark.bg.primary,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  segmentBtn: { paddingVertical: spacing.xs, paddingHorizontal: spacing.md, borderRadius: radius.sm },
  segmentBtnActive: { backgroundColor: dark.text.accent },
  segmentBtnText: { color: dark.text.secondary, fontSize: font.sm, fontWeight: '500' },
  segmentBtnTextActive: { color: '#fff' },
  aboutText: { color: dark.text.primary, fontSize: font.base, padding: spacing.md, fontWeight: '500' },
  aboutSubtext: { color: dark.text.secondary, fontSize: font.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.md },
})
