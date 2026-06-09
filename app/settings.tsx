import React, { useState, useMemo, useCallback } from 'react'
import {
  Alert,
  View,
  Text,
  Switch,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  RefreshControl,
  Linking,
} from 'react-native'
import Constants from 'expo-constants'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import * as Notifications from 'expo-notifications'
import { useTranslation } from 'react-i18next'
import i18n from '@/lib/i18n'
import { useServersStore } from '@/stores/servers'
import { useSettingsStore, type AddServerAction } from '@/stores/settings'
import { useQuickAccessStore } from '@/stores/quickAccess'
import { DisplayedServersList } from '@/components/servers/DisplayedServersList'
import { ServerListCard } from '@/components/servers/ServerListCard'
import { ServerErrorModal } from '@/components/servers/ServerErrorModal'
import { ServerEditModal } from '@/components/servers/ServerEditModal'
import { PairScannerModal } from '@/components/pair/PairScannerModal'
import { wsManager } from '@/services/ws-client'
import type { ExchangeResult } from '@/services/pair-exchange'
import { QrCode } from 'phosphor-react-native'
import { THEMES, font, radius, spacing } from '@/constants/theme'
import type { ThemeId } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import AsyncStorage from '@react-native-async-storage/async-storage'

function addServerActionLabel(action: AddServerAction): string {
  switch (action) {
    case 'ask': return 'Ask each time'
    case 'add': return 'Add to displayed'
    case 'replace': return 'Display only new'
    case 'keep': return 'Keep current'
  }
}

function SectionHeader({ title }: { title: string }) {
  const theme = useTheme()
  const s = useMemo(() => styles(theme), [theme])
  return <Text style={s.sectionHeader}>{title}</Text>
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
  const theme = useTheme()
  const s = useMemo(() => styles(theme), [theme])
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: theme.border, true: theme.text.accent }}
        thumbColor="#fff"
      />
    </View>
  )
}

const THEME_LABELS: Record<Exclude<ThemeId, 'system'>, string> = {
  dark: 'Dark',
  light: 'Light',
  dracula: 'Dracula',
  catppuccin: 'Mocha',
  nord: 'Nord',
}

function ThemePicker({
  current,
  onChange,
}: {
  current: ThemeId
  onChange: (id: ThemeId) => void
}) {
  const theme = useTheme()
  const s = useMemo(() => styles(theme), [theme])
  const themeIds = Object.keys(THEMES) as Exclude<ThemeId, 'system'>[]

  return (
    <View style={s.themeGrid}>
      {themeIds.map((id) => {
        const t = THEMES[id]
        const isSelected = current === id || (current === 'system' && id === 'dark')
        return (
          <TouchableOpacity
            key={id}
            style={[s.themeCard, isSelected && s.themeCardSelected]}
            onPress={() => onChange(id)}
            activeOpacity={0.7}
          >
            <View style={[s.themeCardPreview, { backgroundColor: t.bg.primary }]}>
              <View style={{ height: 8, borderRadius: 2, backgroundColor: t.bg.card, borderWidth: 1, borderColor: t.border }} />
              <View style={{ height: 6, width: '60%', borderRadius: 2, backgroundColor: t.text.secondary, opacity: 0.6 }} />
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: t.text.accent, alignSelf: 'flex-end' }} />
            </View>
            <View style={{ backgroundColor: t.bg.secondary }}>
              <Text style={[s.themeCardName, { color: t.text.secondary }]}>
                {THEME_LABELS[id]}
              </Text>
            </View>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

export default function SettingsScreen() {
  const theme = useTheme()
  const { t } = useTranslation('settings')
  const router = useRouter()
  const { servers, activeServerIds, displayedServerIds, addServer, removeServer, setDisplayedServerIds, refreshServerInfo } = useServersStore()
  const {
    notifications,
    setNotifications,
    historyMessageDisplay,
    setHistoryMessageDisplay,
    addServerAction,
    setAddServerAction,
    sessionsLayout,
    setSessionsLayout,
    mergeChats,
    setMergeChats,
    colorScheme,
    setColorScheme,
    autoNameFromMessage,
    setAutoNameFromMessage,
    aiGeneratedNames,
    setAiGeneratedNames,
    rowDensity,
    setRowDensity,
    rowPathDisplay,
    setRowPathDisplay,
    rowServerIndicator,
    setRowServerIndicator,
    rowServerChipVariant,
    setRowServerChipVariant,
    locale,
    setLocale,
  } = useSettingsStore()
  const {
    favoritesEnabled, setFavoritesEnabled,
    recentsEnabled, setRecentsEnabled,
    popularEnabled, setPopularEnabled,
  } = useQuickAccessStore()
  const [isAddBehaviorOpen, setIsAddBehaviorOpen] = React.useState(false)
  const [refreshingServerIds, setRefreshingServerIds] = useState<Set<string>>(new Set())
  const [isPullRefreshing, setIsPullRefreshing] = useState(false)
  const [errorServerId, setErrorServerId] = useState<string | null>(null)
  const [editServerId, setEditServerId] = useState<string | null | 'new'>(null)
  const [qrScannerOpen, setQrScannerOpen] = useState(false)

  const handleTestNotification = async () => {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: i18n.t('settings:notification.testTitle'),
        body: i18n.t('settings:notification.testBody'),
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
    await Promise.all(activeServerIds.map((id) => handleRefreshServer(id)))
    setIsPullRefreshing(false)
  }

  // Bug 22: a top-level Settings entry to the QR scanner so users don't have
  // to open the "+ Add server" modal first. Reuses the same pair-exchange
  // flow as the onboarding ConnectStep.
  const handleRestartTour = useCallback(async () => {
    await Promise.all([
      AsyncStorage.removeItem('threadbase_tour_hub'),
      AsyncStorage.removeItem('threadbase_tour_session'),
      AsyncStorage.removeItem('threadbase_tour_new_session'),
    ])
    // eslint-disable-next-line i18next/no-literal-string
    Alert.alert('Tour reset', 'The app tour will reappear next time you visit the Hub and session screens.')
  }, [])

  const handleScanQrSuccess = async (result: ExchangeResult) => {
    setQrScannerOpen(false)
    const label = result.machineName?.trim() || undefined
    const addResult = await addServer(result.url, result.apiKey, label)
    if (typeof addResult === 'string') {
      wsManager.connect(addResult, result.url, result.apiKey)
    }
  }

  const s = useMemo(() => styles(theme), [theme])

  return (
    <SafeAreaView style={s.container} edges={[]}>
      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={
          <RefreshControl
            refreshing={isPullRefreshing}
            onRefresh={handlePullRefresh}
            tintColor={theme.text.secondary}
          />
        }
      >
        <SectionHeader title={t('section.appearance')} />
        <View style={s.card}>
          <View style={s.row}>
            <Text style={s.rowLabel}>{t('section.language')}</Text>
            <View style={s.segmentedControl}>
              <TouchableOpacity
                style={[s.segmentBtn, locale === 'en' && s.segmentBtnActive]}
                onPress={() => {
                  setLocale('en');
                  i18n.changeLanguage('en');
                }}
              >
                <Text style={[s.segmentBtnText, locale === 'en' && s.segmentBtnTextActive]}>
                  {t('language.english')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.segmentBtn, locale === 'he' && s.segmentBtnActive]}
                onPress={() => {
                  setLocale('he');
                  i18n.changeLanguage('he');
                }}
              >
                <Text style={[s.segmentBtnText, locale === 'he' && s.segmentBtnTextActive]}>
                  {t('language.hebrew')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.segmentBtn, locale === 'ar' && s.segmentBtnActive]}
                onPress={() => {
                  setLocale('ar');
                  i18n.changeLanguage('ar');
                }}
              >
                <Text style={[s.segmentBtnText, locale === 'ar' && s.segmentBtnTextActive]}>
                  {t('language.arabic')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={s.row}>
            <Text style={s.rowLabel}>{t('appearance.layout')}</Text>
            <View style={s.segmentedControl}>
              <TouchableOpacity
                style={[s.segmentBtn, sessionsLayout === 'tree' && s.segmentBtnActive]}
                onPress={() => setSessionsLayout('tree')}
              >
                <Text style={[s.segmentBtnText, sessionsLayout === 'tree' && s.segmentBtnTextActive]}>
                  {t('appearance.layoutTree')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.segmentBtn, sessionsLayout === 'hub' && s.segmentBtnActive]}
                onPress={() => setSessionsLayout('hub')}
              >
                <Text style={[s.segmentBtnText, sessionsLayout === 'hub' && s.segmentBtnTextActive]}>
                  {t('appearance.layoutHub')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.segmentBtn, sessionsLayout === 'classic' && s.segmentBtnActive]}
                onPress={() => setSessionsLayout('classic')}
              >
                <Text style={[s.segmentBtnText, sessionsLayout === 'classic' && s.segmentBtnTextActive]}>
                  {t('appearance.layoutClassic')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={{ borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border }}>
            <View style={[s.row, { borderBottomWidth: 0, paddingBottom: 0 }]}>
              <Text style={s.rowLabel}>{t('appearance.theme')}</Text>
            </View>
            <ThemePicker current={colorScheme} onChange={setColorScheme} />
          </View>
          <SettingsRow
            label="Merge sessions & history as Chats"
            value={mergeChats}
            onValueChange={setMergeChats}
          />
        </View>

        <SectionHeader title={t('section.servers')} />
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
          style={s.addServerBtn}
          onPress={() => setEditServerId('new')}
        >
          <Text style={s.addServerText}>{'+ ' + i18n.t('servers:action.add')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="settings-scan-qr-btn"
          style={s.scanQrBtn}
          onPress={() => setQrScannerOpen(true)}
          accessibilityLabel={t('servers.scanQr')}
        >
          <QrCode size={18} color={theme.text.accent} />
          <Text style={s.scanQrText}>{t('servers.scanQr')}</Text>
        </TouchableOpacity>

        <SectionHeader title={t('section.displayedServers')} />
        <DisplayedServersList
          activeServerIds={activeServerIds}
          servers={servers}
          selectedServerIds={displayedServerIds}
          onChange={setDisplayedServerIds}
        />

        <SectionHeader title={t('notifications.whenAddingServer')} />
        <View style={s.card}>
          <TouchableOpacity
            style={s.row}
            onPress={() => setIsAddBehaviorOpen((v) => !v)}
          >
            <Text style={s.rowLabel}>{t('addServer.selectedAction')}</Text>
            <Text style={s.rowValue}>{addServerActionLabel(addServerAction)}</Text>
          </TouchableOpacity>
          {isAddBehaviorOpen ? (
            <View style={s.accordionBody}>
              <ActionSegment value={addServerAction} onChange={setAddServerAction} />
              <TouchableOpacity style={s.resetBtn} onPress={() => setAddServerAction('ask')}>
                <Text style={s.resetBtnText}>{t('addServer.resetAction')}</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        <SectionHeader title={t('section.notifications')} />
        <View style={s.card}>
          <SettingsRow label={t('notifications.waitingForInput')} value={notifications.waitingInput} onValueChange={(v) => setNotifications({ waitingInput: v })} />
          <SettingsRow label={t('notifications.sessionCompleted')} value={notifications.sessionComplete} onValueChange={(v) => setNotifications({ sessionComplete: v })} />
          <SettingsRow label={t('notifications.sessionFailed')} value={notifications.sessionFailed} onValueChange={(v) => setNotifications({ sessionFailed: v })} />
          <SettingsRow label={t('notifications.diffReady')} value={notifications.diffReady} onValueChange={(v) => setNotifications({ diffReady: v })} />
          <SettingsRow label={t('notifications.showBadgeCount')} value={notifications.showBadge} onValueChange={(v) => setNotifications({ showBadge: v })} />
          <SettingsRow label={t('notifications.quietHours')} value={notifications.quietHoursEnabled} onValueChange={(v) => setNotifications({ quietHoursEnabled: v })} />
          <TouchableOpacity style={s.testBtn} onPress={handleTestNotification}>
            <Text style={s.testBtnText}>{t('notifications.sendTest')}</Text>
          </TouchableOpacity>
        </View>

        <SectionHeader title={t('quickAccess.title')} />
        <SettingsRow
          label={t('quickAccess.favorites')}
          value={favoritesEnabled}
          onValueChange={setFavoritesEnabled}
        />
        <SettingsRow
          label={t('quickAccess.recentSessions')}
          value={recentsEnabled}
          onValueChange={setRecentsEnabled}
        />
        <SettingsRow
          label={t('quickAccess.popularProjects')}
          value={popularEnabled}
          onValueChange={setPopularEnabled}
        />

        <SectionHeader title={t('sessionNaming.title')} />
        <View style={s.card}>
          <SettingsRow label={t('sessionNaming.autoNameFromMessage')} value={autoNameFromMessage} onValueChange={setAutoNameFromMessage} />
          <Text style={s.rowNote}>{t('sessionNaming.autoNameNote')}</Text>
          <SettingsRow label={t('sessionNaming.aiGeneratedNames')} value={aiGeneratedNames} onValueChange={setAiGeneratedNames} />
          <Text style={s.rowNote}>{t('sessionNaming.aiGeneratedNote')}</Text>
        </View>

        <SectionHeader title={t('section.history')} />
        <View style={s.card}>
          <View style={s.row}>
            <Text style={s.rowLabel}>{t('history.messagePreview')}</Text>
            <View style={s.segmentedControl}>
              <TouchableOpacity
                style={[s.segmentBtn, historyMessageDisplay === 'first' && s.segmentBtnActive]}
                onPress={() => setHistoryMessageDisplay('first')}
              >
                <Text style={[s.segmentBtnText, historyMessageDisplay === 'first' && s.segmentBtnTextActive]}>{t('history.first')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.segmentBtn, historyMessageDisplay === 'last' && s.segmentBtnActive]}
                onPress={() => setHistoryMessageDisplay('last')}
              >
                <Text style={[s.segmentBtnText, historyMessageDisplay === 'last' && s.segmentBtnTextActive]}>{t('history.last')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <SectionHeader title={t('conversationRows.title')} />
        <View style={s.card}>
          <View style={s.row}>
            <Text style={s.rowLabel}>{t('conversationRows.density')}</Text>
            <View style={s.segmentedControl}>
              <TouchableOpacity
                style={[s.segmentBtn, rowDensity === 'comfortable' && s.segmentBtnActive]}
                onPress={() => setRowDensity('comfortable')}
              >
                <Text style={[s.segmentBtnText, rowDensity === 'comfortable' && s.segmentBtnTextActive]}>{t('conversationRows.comfortable')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.segmentBtn, rowDensity === 'compact' && s.segmentBtnActive]}
                onPress={() => setRowDensity('compact')}
              >
                <Text style={[s.segmentBtnText, rowDensity === 'compact' && s.segmentBtnTextActive]}>{t('conversationRows.compact')}</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={s.row}>
            <Text style={s.rowLabel}>{t('conversationRows.pathDisplay')}</Text>
            <View style={s.segmentedControl}>
              <TouchableOpacity
                style={[s.segmentBtn, rowPathDisplay === 'smart' && s.segmentBtnActive]}
                onPress={() => setRowPathDisplay('smart')}
              >
                <Text style={[s.segmentBtnText, rowPathDisplay === 'smart' && s.segmentBtnTextActive]}>{t('conversationRows.smart')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.segmentBtn, rowPathDisplay === 'full' && s.segmentBtnActive]}
                onPress={() => setRowPathDisplay('full')}
              >
                <Text style={[s.segmentBtnText, rowPathDisplay === 'full' && s.segmentBtnTextActive]}>{t('conversationRows.full')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.segmentBtn, rowPathDisplay === 'last-segment' && s.segmentBtnActive]}
                onPress={() => setRowPathDisplay('last-segment')}
              >
                <Text style={[s.segmentBtnText, rowPathDisplay === 'last-segment' && s.segmentBtnTextActive]}>{t('conversationRows.lastSegment')}</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={s.row}>
            <Text style={s.rowLabel}>{t('conversationRows.serverIndicator')}</Text>
            <View style={s.segmentedControl}>
              <TouchableOpacity
                style={[s.segmentBtn, rowServerIndicator === 'auto' && s.segmentBtnActive]}
                onPress={() => setRowServerIndicator('auto')}
              >
                <Text style={[s.segmentBtnText, rowServerIndicator === 'auto' && s.segmentBtnTextActive]}>{t('conversationRows.auto')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.segmentBtn, rowServerIndicator === 'always' && s.segmentBtnActive]}
                onPress={() => setRowServerIndicator('always')}
              >
                <Text style={[s.segmentBtnText, rowServerIndicator === 'always' && s.segmentBtnTextActive]}>{t('conversationRows.always')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.segmentBtn, rowServerIndicator === 'never' && s.segmentBtnActive]}
                onPress={() => setRowServerIndicator('never')}
              >
                <Text style={[s.segmentBtnText, rowServerIndicator === 'never' && s.segmentBtnTextActive]}>{t('conversationRows.never')}</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={s.row}>
            <Text style={s.rowLabel}>{t('conversationRows.serverChipStyle')}</Text>
            <View style={s.segmentedControl}>
              <TouchableOpacity
                style={[s.segmentBtn, rowServerChipVariant === 'label' && s.segmentBtnActive]}
                onPress={() => setRowServerChipVariant('label')}
              >
                <Text style={[s.segmentBtnText, rowServerChipVariant === 'label' && s.segmentBtnTextActive]}>{t('conversationRows.label')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.segmentBtn, rowServerChipVariant === 'letter' && s.segmentBtnActive]}
                onPress={() => setRowServerChipVariant('letter')}
              >
                <Text style={[s.segmentBtnText, rowServerChipVariant === 'letter' && s.segmentBtnTextActive]}>{t('conversationRows.letter')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <SectionHeader title={t('section.about')} />
        <View style={s.card}>
          <Text style={s.aboutText}>
            {`Threadbase Mobile v${Constants.expoConfig?.version ?? '—'} (${
              Platform.OS === 'ios'
                ? (Constants.expoConfig?.ios?.buildNumber ?? '—')
                : (Constants.expoConfig?.android?.versionCode ?? '—')
            })`}
          </Text>
          <Text style={s.aboutSubtext}>{t('about.subtitle')}</Text>
        </View>

        <SectionHeader title={t('section.help')} />
        <View style={s.card}>
          <TouchableOpacity style={s.row} onPress={() => router.push('/onboarding')}>
            <Text style={s.rowLabel}>{t('help.restartOnboarding')}</Text>
            <Text style={s.rowValue}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="settings-restart-tour"
            style={s.row}
            onPress={handleRestartTour}
          >
            <Text style={s.rowLabel}>{t('restartTour')}</Text>
            <Text style={s.rowValue}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.row} onPress={() => Linking.openURL('mailto:ronenmars@gmail.com?subject=Threadbase%20Support')}>
            <Text style={s.rowLabel}>{t('help.helpSupport')}</Text>
            <Text style={s.rowValue}>›</Text>
          </TouchableOpacity>
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

      <PairScannerModal
        visible={qrScannerOpen}
        onClose={() => setQrScannerOpen(false)}
        onSuccess={handleScanQrSuccess}
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
  const theme = useTheme()
  const s = useMemo(() => styles(theme), [theme])
  const options: { id: AddServerAction; label: string }[] = [
    { id: 'ask', label: 'Ask' },
    { id: 'add', label: 'Add' },
    { id: 'replace', label: 'Replace' },
    { id: 'keep', label: 'Keep' },
  ]
  return (
    <View style={s.segmentedControl}>
      {options.map((option) => (
        <TouchableOpacity
          key={option.id}
          style={[s.segmentBtn, value === option.id && s.segmentBtnActive]}
          onPress={() => onChange(option.id)}
        >
          <Text style={[s.segmentBtnText, value === option.id && s.segmentBtnTextActive]}>
            {option.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  )
}

function styles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg.primary },
    content: { padding: spacing.md, gap: spacing.sm },
    sectionHeader: {
      color: theme.text.secondary,
      fontSize: font.xs,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginTop: spacing.md,
      marginBottom: spacing.xs,
      marginLeft: spacing.xs,
    },
    card: {
      backgroundColor: theme.bg.card,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: 'hidden',
    },
    addServerBtn: {
      backgroundColor: theme.bg.card,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: theme.border,
      borderStyle: 'dashed',
      padding: spacing.md,
      alignItems: 'center',
      minHeight: 44,
      justifyContent: 'center',
    },
    addServerText: {
      color: theme.text.accent,
      fontSize: font.base,
      fontWeight: '500',
    },
    scanQrBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      backgroundColor: theme.bg.card,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: theme.border,
      padding: spacing.md,
      minHeight: 44,
      marginTop: spacing.xs,
    },
    scanQrText: {
      color: theme.text.accent,
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
      borderBottomColor: theme.border,
    },
    rowLabel: { color: theme.text.primary, fontSize: font.base },
    rowValue: { color: theme.text.secondary, fontSize: font.sm },
    rowNote: { color: theme.text.secondary, fontSize: font.xs, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
    accordionBody: {
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.md,
      gap: spacing.sm,
    },
    resetBtn: { minHeight: 44, justifyContent: 'center' },
    resetBtnText: { color: theme.text.accent, fontSize: font.sm, fontWeight: '500' },
    testBtn: { padding: spacing.md, alignItems: 'center', minHeight: 44, justifyContent: 'center' },
    testBtnText: { color: theme.text.accent, fontSize: font.base },
    segmentedControl: {
      flexDirection: 'row',
      backgroundColor: theme.bg.primary,
      borderRadius: radius.sm,
      overflow: 'hidden',
    },
    segmentBtn: { paddingVertical: spacing.xs, paddingHorizontal: spacing.md, borderRadius: radius.sm },
    segmentBtnActive: { backgroundColor: theme.text.accent },
    segmentBtnText: { color: theme.text.secondary, fontSize: font.sm, fontWeight: '500' },
    segmentBtnTextActive: { color: '#fff' },
    aboutText: { color: theme.text.primary, fontSize: font.base, padding: spacing.md, fontWeight: '500' },
    aboutSubtext: { color: theme.text.secondary, fontSize: font.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.md },
    themeGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      padding: spacing.md,
    },
    themeCard: {
      width: '30%',
      borderRadius: radius.sm,
      overflow: 'hidden',
      borderWidth: 2,
      borderColor: 'transparent',
    },
    themeCardSelected: {
      borderColor: theme.text.accent,
    },
    themeCardPreview: {
      height: 52,
      padding: spacing.xs,
      gap: 4,
    },
    themeCardName: {
      fontSize: font.xs,
      fontWeight: '600' as const,
      textAlign: 'center' as const,
      paddingVertical: 4,
    },
  })
}
