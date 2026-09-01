import React, { useState, useMemo, useCallback, useRef } from 'react'
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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import * as Notifications from 'expo-notifications'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import i18n from '@/lib/i18n'
import { getSupportedLocaleLabel, SUPPORTED_LOCALES, type SupportedLocale } from '@/lib/locale'
import { useServersStore } from '@/stores/servers'
import { useSettingsStore, type AddServerAction, type SessionLeaveAction } from '@/stores/settings'
import { DisplayedServersList } from '@/components/servers/DisplayedServersList'
import { ServerListCard } from '@/components/servers/ServerListCard'
import { ServerErrorModal } from '@/components/servers/ServerErrorModal'
import { ServerEditModal } from '@/components/servers/ServerEditModal'
import { PairScannerModal } from '@/components/pair/PairScannerModal'
import { PairCameraIdentityCard } from '@/components/pair/PairCameraIdentityCard'
import { formatFingerprint } from '@/services/e2ee/fingerprint'
import { wsManager } from '@/services/ws-client'
import type { ExchangeResult } from '@/services/pair-exchange'
import { QrCode, CaretRight } from 'phosphor-react-native'
import { captureHandledError } from '@/services/sentry'
import { SUPPORT_EMAIL } from '@/services/feedback-transport'
import { THEMES, font, radius, spacing } from '@/constants/theme'
import type { ThemeId } from '@/constants/theme'
import { useTheme, useIsGlass } from '@/contexts/ThemeContext'
import { GlassFill } from '@/components/ui/GlassFill'
import { Badge } from '@/components/ui/Badge'
import { usePermissionsStatus, type PermissionStatus } from '@/hooks/usePermissionsStatus'

function getAddServerActionLabel(action: AddServerAction, t: TFunction<'settings'>): string {
  switch (action) {
    case 'ask':
      return t('addServer.actionAsk')
    case 'add':
      return t('addServer.actionAdd')
    case 'replace':
      return t('addServer.actionReplace')
    case 'keep':
      return t('addServer.actionKeep')
  }
}

function getSessionLeaveActionLabel(action: SessionLeaveAction, t: TFunction<'settings'>): string {
  switch (action) {
    case 'ask':
      return t('session.leaveActionAsk')
    case 'kill':
      return t('session.leaveActionKill')
    case 'leave':
      return t('session.leaveActionLeave')
    case 'kill_on_idle':
      return t('session.leaveActionKillOnIdle')
  }
}

function SectionHeader({ title, badge }: { title: string; badge?: string }) {
  const theme = useTheme()
  const isGlass = useIsGlass()
  const s = useMemo(() => styles(theme), [theme])
  return (
    <View style={s.sectionHeaderRow}>
      <Text style={[s.sectionHeader, isGlass && s.sectionHeaderGlass]}>{title}</Text>
      {badge ? <Badge label={badge} /> : null}
    </View>
  )
}

function SettingsRow({
  label,
  value,
  onValueChange,
  testID,
  badge,
}: {
  label: string
  value: boolean
  onValueChange: (v: boolean) => void
  testID?: string
  badge?: string
}) {
  const theme = useTheme()
  const s = useMemo(() => styles(theme), [theme])
  return (
    <View style={s.row} testID={testID}>
      <View style={s.rowLabelGroup}>
        <Text style={s.rowLabel}>{label}</Text>
        {badge ? (
          <View style={{ marginTop: -10 }}>
            <Badge label={badge} bg={theme.text.beta} color="#1a1a1a" />
          </View>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: theme.border, true: theme.text.accent }}
        thumbColor="#fff"
      />
    </View>
  )
}

function PermissionRow({
  label,
  description,
  status,
  onPress,
  isLast,
  badge,
}: {
  label: string
  description: string
  status: PermissionStatus
  onPress: () => void
  isLast?: boolean
  badge?: string
}) {
  const theme = useTheme()
  const s = useMemo(() => styles(theme), [theme])
  const { t } = useTranslation('settings')

  const dotColor =
    status === 'granted'
      ? theme.text.success
      : status === 'denied'
        ? theme.text.danger
        : theme.text.secondary

  const statusLabel =
    status === 'granted'
      ? t('permissions.statusGranted')
      : status === 'denied'
        ? t('permissions.statusDenied')
        : t('permissions.statusUndetermined')

  const actionLabel =
    status === 'undetermined'
      ? t('permissions.actionAllow')
      : t('permissions.actionManage')

  return (
    <TouchableOpacity
      style={[s.row, isLast && { borderBottomWidth: 0 }]}
      onPress={onPress}
    >
      <View style={s.permissionRowLeft}>
        <View style={s.rowLabelGroup}>
          <Text style={s.rowLabel}>{label}</Text>
          {badge ? <Badge label={badge} /> : null}
        </View>
        <Text style={s.permissionRowDesc}>{description}</Text>
      </View>
      <View style={s.permissionRowRight}>
        <View style={[s.permissionDot, { backgroundColor: dotColor }]} />
        <Text style={[s.rowValue, { color: dotColor }]}>{statusLabel}</Text>
        <Text style={s.permissionRowAction}>{actionLabel}</Text>
      </View>
    </TouchableOpacity>
  )
}

const THEME_LABELS: Record<Exclude<ThemeId, 'system'>, string> = {
  dark: 'Dark',
  light: 'Light',
  dracula: 'Dracula',
  catppuccin: 'Mocha',
  catppuccinLatte: 'Latte',
  nord: 'Nord',
  oneDark: 'One Dark',
  oneLight: 'One Light',
  githubDark: 'Primer Dark',
  githubLight: 'Primer Light',
  solarizedDark: 'Solarized Dark',
  solarizedLight: 'Solarized Light',
  rosePine: 'Rosé Pine',
  rosePineDawn: 'Rosé Pine Dawn',
  tokyoNight: 'Tokyo Night',
  tokyoNightLight: 'Tokyo Night Light',
}

function ThemePicker({
  current,
  tab,
  onChange,
}: {
  current: ThemeId
  tab: 'dark' | 'light'
  onChange: (id: ThemeId) => void
}) {
  const theme = useTheme()
  const s = useMemo(() => styles(theme), [theme])
  const themeIds = (Object.keys(THEMES) as Exclude<ThemeId, 'system'>[]).filter((id) => THEMES[id].colorMode === tab)

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
              <Text style={[s.themeCardName, { color: t.text.primary }]}>
                {THEME_LABELS[id]}
              </Text>
            </View>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

/** Dev-only: throws unconditionally on render, to exercise RootErrorBoundary
 * end-to-end. Never rendered unless the user explicitly triggers the
 * throw-uncaught test action below. */
function ThrowOnRender(): never {
  throw new Error('Test uncaught render exception from Settings')
}

export default function SettingsScreen() {
  const theme = useTheme()
  const isGlass = useIsGlass()
  const insets = useSafeAreaInsets()
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
    sessionLeaveAction,
    setSessionLeaveAction,
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
    rowPreviewMode,
    setRowPreviewMode,
    rowPathDisplay,
    setRowPathDisplay,
    rowServerIndicator,
    setRowServerIndicator,
    rowServerChipVariant,
    setRowServerChipVariant,
    locale,
    setLocale,
    sessionView,
    setSessionView,
    biometricLock,
    setBiometricLock,
    crashReportingEnabled,
    setCrashReportingEnabled,
  } = useSettingsStore()
  const [isAddBehaviorOpen, setIsAddBehaviorOpen] = React.useState(false)
  const [isLeaveActionOpen, setIsLeaveActionOpen] = React.useState(false)
  const [throwOnRender, setThrowOnRender] = useState(false)
  const [refreshingServerIds, setRefreshingServerIds] = useState<Set<string>>(new Set())
  const [isPullRefreshing, setIsPullRefreshing] = useState(false)
  const [errorServerId, setErrorServerId] = useState<string | null>(null)
  const [editServerId, setEditServerId] = useState<string | null | 'new'>(null)
  const [qrScannerOpen, setQrScannerOpen] = useState(false)
  const [cameraFingerprint, setCameraFingerprint] = useState<string | null>(null)
  // Held across the identity card: the exchange already happened, and the
  // server is only added once the user dismisses the card.
  const pendingScan = useRef<ExchangeResult | null>(null)
  const [themeTab, setThemeTab] = useState<'dark' | 'light'>(() => theme.colorMode === 'light' ? 'light' : 'dark')
  const { statuses: permStatuses, request: requestPermission, openSettings: openPermissionSettings } = usePermissionsStatus()

  const handleTestNotification = async () => {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: i18n.t('settings:notification.testTitle'),
        body: i18n.t('settings:notification.testBody'),
      },
      trigger: null,
    })
  }

  const handleTestCrash = () => {
    Alert.alert(
      t('crashReporting.testCrashConfirmTitle'),
      t('crashReporting.testCrashConfirmMessage'),
      [
        { text: t('common:button.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('crashReporting.testCrashSend'),
          onPress: () => {
            // Route through the explicit capture helper so it is sanitized and
            // gated on consent; never a raw crash of the app.
            captureHandledError(new Error('Test crash reporting from Settings'), {
              tag: 'test_crash',
            })
          },
        },
      ],
    )
  }

  const handleThrowUncaught = () => {
    Alert.alert(
      t('crashReporting.testCrashConfirmTitle'),
      t('crashReporting.testCrashConfirmMessage'),
      [
        { text: t('common:button.cancel', 'Cancel'), style: 'cancel' },
        {
          // Renders a component that throws for real, exercising
          // RootErrorBoundary -> componentDidCatch -> captureHandledError, the
          // same path a genuine unhandled render crash would take — distinct
          // from the already-caught captureHandledError call above.
          text: t('crashReporting.testCrashSend'),
          onPress: () => setThrowOnRender(true),
        },
      ],
    )
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


  // Direction follows i18next, applied as a Yoga `direction` style at the app
  // root, so an LTR↔RTL switch re-renders in place — no forceRTL, no reload.
  const handleLanguageChange = useCallback(async (newLocale: SupportedLocale) => {
    setLocale(newLocale)
    await i18n.changeLanguage(newLocale)
  }, [setLocale])

  // A camera scan needs no confirmation gate — pointing a camera at a screen is
  // itself the out-of-band channel — but the identity code is still shown, so it
  // can be compared against `tb-streamer identity` before the server is added.
  const finishCameraIdentity = () => {
    const result = pendingScan.current
    pendingScan.current = null
    setCameraFingerprint(null)
    if (result) void applyScanResult(result)
  }

  const handleScanQrSuccess = (result: ExchangeResult) => {
    setQrScannerOpen(false)
    if (result.serverPublicKey) {
      pendingScan.current = result
      setCameraFingerprint(formatFingerprint(result.serverPublicKey))
      return
    }
    void applyScanResult(result)
  }

  const applyScanResult = async (result: ExchangeResult) => {
    const label = result.machineName?.trim() || undefined
    const addResult = await addServer(result.url, result.apiKey, label, {
      deviceId: result.deviceId ?? undefined,
      deviceToken: result.deviceToken ?? undefined,
      capabilities: result.capabilities ?? undefined,
      publicUrl: result.publicUrl ?? undefined,
      serverPublicKey: result.serverPublicKey ?? undefined,
      requireEncryption: result.e2eeRequired,
    })
    if (typeof addResult === 'string') {
      const server = useServersStore.getState().servers[addResult]
      wsManager.connect(addResult, result.url, result.apiKey, {
        serverPublicKey: server?.serverPublicKey,
        requireEncryption: server?.requireEncryption,
      })
    } else {
      Alert.alert(
        i18n.t('pair:scanner.alreadyAddedTitle'),
        i18n.t('pair:scanner.errors.alreadyAdded'),
      )
    }
  }

  const s = useMemo(() => styles(theme), [theme])
  // Transparent header (glass themes) doesn't reserve layout space, so the
  // ScrollView starts under it; push content down by the header's own height.
  const headerHeight = Platform.OS === 'ios' ? 44 : 56
  const glassContentStyle = isGlass ? { paddingTop: s.content.padding + insets.top + headerHeight } : null

  return (
    <SafeAreaView style={[s.container, isGlass && s.containerGlass]} edges={[]}>
      <ScrollView
        contentContainerStyle={[s.content, glassContentStyle]}
        refreshControl={
          <RefreshControl
            refreshing={isPullRefreshing}
            onRefresh={handlePullRefresh}
            tintColor={theme.text.secondary}
          />
        }
      >
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
          style={[s.addServerBtn, isGlass && s.cardGlass]}
          onPress={() => setEditServerId('new')}
        >
          <GlassFill />
          <Text style={s.addServerText}>{'+ ' + i18n.t('servers:action.add')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="settings-scan-qr-btn"
          style={[s.scanQrBtn, isGlass && s.cardGlass]}
          onPress={() => setQrScannerOpen(true)}
          accessibilityLabel={t('servers.scanQr')}
        >
          <GlassFill />
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

        <SectionHeader title={t('section.appearance')} />
        <View style={[s.card, isGlass && s.cardGlass]}>
          <GlassFill material />
          <View style={s.row}>
            <Text style={s.rowLabel}>{t('section.language')}</Text>
            <View style={[s.segmentedControl, isGlass && s.segmentedControlGlass]}>
              {SUPPORTED_LOCALES.map((supportedLocale) => (
                <TouchableOpacity
                  key={supportedLocale.code}
                  testID={`settings-language-${supportedLocale.code}`}
                  style={[s.segmentBtn, locale === supportedLocale.code && s.segmentBtnActive]}
                  onPress={() => handleLanguageChange(supportedLocale.code)}
                >
                  <Text style={[s.segmentBtnText, isGlass && s.segmentBtnTextGlass, locale === supportedLocale.code && s.segmentBtnTextActive]}>
                    {getSupportedLocaleLabel(supportedLocale.code, t)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={s.row}>
            <Text style={s.rowLabel}>{t('appearance.layout')}</Text>
            <View style={[s.segmentedControl, isGlass && s.segmentedControlGlass]}>
              <TouchableOpacity
                style={[s.segmentBtn, sessionsLayout === 'tree' && s.segmentBtnActive]}
                onPress={() => setSessionsLayout('tree')}
              >
                <Text style={[s.segmentBtnText, isGlass && s.segmentBtnTextGlass, sessionsLayout === 'tree' && s.segmentBtnTextActive]}>
                  {t('appearance.layoutTree')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.segmentBtn, sessionsLayout === 'hub' && s.segmentBtnActive]}
                onPress={() => setSessionsLayout('hub')}
              >
                <Text style={[s.segmentBtnText, isGlass && s.segmentBtnTextGlass, sessionsLayout === 'hub' && s.segmentBtnTextActive]}>
                  {t('appearance.layoutHub')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.segmentBtn, sessionsLayout === 'classic' && s.segmentBtnActive]}
                onPress={() => setSessionsLayout('classic')}
              >
                <Text style={[s.segmentBtnText, isGlass && s.segmentBtnTextGlass, sessionsLayout === 'classic' && s.segmentBtnTextActive]}>
                  {t('appearance.layoutClassic')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={{ borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border }}>
            <View style={[s.row, { borderBottomWidth: 0, paddingBottom: 0 }]}>
              <Text style={s.rowLabel}>{t('appearance.theme')}</Text>
            </View>
            <View style={s.segmentedTabs}>
              <TouchableOpacity
                style={[s.segmentTab, themeTab === 'dark' && s.segmentTabActive]}
                onPress={() => setThemeTab('dark')}
              >
                <Text style={[s.segmentBtnText, isGlass && s.segmentBtnTextGlass, themeTab === 'dark' && s.segmentBtnTextActive]}>{t('appearance.dark')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.segmentTab, themeTab === 'light' && s.segmentTabActive]}
                onPress={() => setThemeTab('light')}
              >
                <Text style={[s.segmentBtnText, isGlass && s.segmentBtnTextGlass, themeTab === 'light' && s.segmentBtnTextActive]}>{t('appearance.light')}</Text>
              </TouchableOpacity>
            </View>
            <ThemePicker current={colorScheme} tab={themeTab} onChange={setColorScheme} />
          </View>
          <SettingsRow
            label={t('session.mergeChats')}
            value={mergeChats}
            onValueChange={setMergeChats}
            testID="settings-merge-chats-toggle"
          />
        </View>

        <SectionHeader title={t('notifications.whenAddingServer')} />
        <View style={[s.card, isGlass && s.cardGlass]}>
          <GlassFill material />
          <TouchableOpacity
            style={s.row}
            onPress={() => setIsAddBehaviorOpen((v) => !v)}
          >
            <Text style={s.rowLabel}>{t('addServer.selectedAction')}</Text>
            <Text style={s.rowValue}>{getAddServerActionLabel(addServerAction, t)}</Text>
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
        <View style={[s.card, isGlass && s.cardGlass]}>
          <GlassFill material />
          <SettingsRow label={t('notifications.waitingForInput')} value={notifications.waitingInput} onValueChange={(v) => setNotifications({ waitingInput: v })} />
          <SettingsRow label={t('notifications.sessionCompleted')} value={notifications.sessionComplete} onValueChange={(v) => setNotifications({ sessionComplete: v })} />
          <SettingsRow label={t('notifications.sessionFailed')} value={notifications.sessionFailed} onValueChange={(v) => setNotifications({ sessionFailed: v })} />
          <SettingsRow label={t('notifications.diffReady')} value={notifications.diffReady} onValueChange={(v) => setNotifications({ diffReady: v })} />
          <SettingsRow label={t('notifications.showBadgeCount')} value={notifications.showBadge} onValueChange={(v) => setNotifications({ showBadge: v })} />
          <SettingsRow label={t('notifications.quietHours')} value={notifications.quietHoursEnabled} onValueChange={(v) => setNotifications({ quietHoursEnabled: v })} />
          <TouchableOpacity style={s.testBtn} onPress={handleTestNotification} testID="settings-send-test-notification">
            <Text style={s.testBtnText}>{t('notifications.sendTest')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.row}
            onPress={() => router.push('/notification-health')}
            testID="settings-notification-health-row"
          >
            <Text style={s.rowLabel}>{t('notificationHealth.openRow')}</Text>
            <SettingsChevron />
          </TouchableOpacity>
        </View>

        <SectionHeader title={t('sessionNaming.title')} />
        <View style={[s.card, isGlass && s.cardGlass]}>
          <GlassFill material />
          <SettingsRow label={t('sessionNaming.autoNameFromMessage')} value={autoNameFromMessage} onValueChange={setAutoNameFromMessage} />
          <Text style={s.rowNote}>{t('sessionNaming.autoNameNote')}</Text>
          <SettingsRow label={t('sessionNaming.aiGeneratedNames')} value={aiGeneratedNames} onValueChange={setAiGeneratedNames} />
          <Text style={s.rowNote}>{t('sessionNaming.aiGeneratedNote')}</Text>
        </View>

        <SectionHeader title={t('section.session')} />
        <View style={[s.card, isGlass && s.cardGlass]}>
          <GlassFill material />
          <TouchableOpacity
            style={s.row}
            onPress={() => setIsLeaveActionOpen((v) => !v)}
            testID="settings-session-leave-action"
            accessibilityRole="button"
            accessibilityLabel={t('session.leaveAction')}
          >
            <Text style={s.rowLabel}>{t('session.leaveAction')}</Text>
            <Text style={s.rowValue}>{getSessionLeaveActionLabel(sessionLeaveAction, t)}</Text>
          </TouchableOpacity>
          {isLeaveActionOpen ? (
            <View style={s.accordionBody}>
              <SessionLeaveActionList value={sessionLeaveAction} onChange={setSessionLeaveAction} />
              <Text style={s.rowNote}>{t('session.leaveActionNote')}</Text>
            </View>
          ) : null}
        </View>
        <SettingsRow
          label={t('session.chatView')}
          value={sessionView === 'chat'}
          onValueChange={(v) => setSessionView(v ? 'chat' : 'terminal')}
          badge={t('session.betaBadge')}
        />
        <Text style={s.rowNote}>{t('session.chatViewNote')}</Text>

        <SectionHeader title={t('section.history')} />
        <View style={[s.card, isGlass && s.cardGlass]}>
          <GlassFill material />
          <View style={s.row}>
            <Text style={s.rowLabel}>{t('history.messagePreview')}</Text>
            <View style={[s.segmentedControl, isGlass && s.segmentedControlGlass]}>
              <TouchableOpacity
                style={[s.segmentBtn, historyMessageDisplay === 'first' && s.segmentBtnActive]}
                onPress={() => setHistoryMessageDisplay('first')}
              >
                <Text style={[s.segmentBtnText, isGlass && s.segmentBtnTextGlass, historyMessageDisplay === 'first' && s.segmentBtnTextActive]}>{t('history.first')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.segmentBtn, historyMessageDisplay === 'last' && s.segmentBtnActive]}
                onPress={() => setHistoryMessageDisplay('last')}
              >
                <Text style={[s.segmentBtnText, isGlass && s.segmentBtnTextGlass, historyMessageDisplay === 'last' && s.segmentBtnTextActive]}>{t('history.last')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <SectionHeader title={t('conversationRows.title')} />
        <View style={[s.card, isGlass && s.cardGlass]}>
          <GlassFill material />
          <View style={s.row}>
            <Text style={s.rowLabel}>{t('conversationRows.density')}</Text>
            <View style={[s.segmentedControl, isGlass && s.segmentedControlGlass]}>
              <TouchableOpacity
                style={[s.segmentBtn, rowDensity === 'comfortable' && s.segmentBtnActive]}
                onPress={() => setRowDensity('comfortable')}
              >
                <Text style={[s.segmentBtnText, isGlass && s.segmentBtnTextGlass, rowDensity === 'comfortable' && s.segmentBtnTextActive]}>{t('conversationRows.comfortable')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.segmentBtn, rowDensity === 'compact' && s.segmentBtnActive]}
                onPress={() => setRowDensity('compact')}
              >
                <Text style={[s.segmentBtnText, isGlass && s.segmentBtnTextGlass, rowDensity === 'compact' && s.segmentBtnTextActive]}>{t('conversationRows.compact')}</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={s.row}>
            <Text style={s.rowLabel}>{t('conversationRows.messagePreview')}</Text>
            <View style={[s.segmentedControl, isGlass && s.segmentedControlGlass]}>
              <TouchableOpacity
                style={[s.segmentBtn, rowPreviewMode === 'first' && s.segmentBtnActive]}
                onPress={() => setRowPreviewMode('first')}
              >
                <Text style={[s.segmentBtnText, isGlass && s.segmentBtnTextGlass, rowPreviewMode === 'first' && s.segmentBtnTextActive]}>{t('conversationRows.previewFirst')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.segmentBtn, rowPreviewMode === 'last' && s.segmentBtnActive]}
                onPress={() => setRowPreviewMode('last')}
              >
                <Text style={[s.segmentBtnText, isGlass && s.segmentBtnTextGlass, rowPreviewMode === 'last' && s.segmentBtnTextActive]}>{t('conversationRows.previewLast')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.segmentBtn, rowPreviewMode === 'auto' && s.segmentBtnActive]}
                onPress={() => setRowPreviewMode('auto')}
              >
                <Text style={[s.segmentBtnText, isGlass && s.segmentBtnTextGlass, rowPreviewMode === 'auto' && s.segmentBtnTextActive]}>{t('conversationRows.auto')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.segmentBtn, rowPreviewMode === 'off' && s.segmentBtnActive]}
                onPress={() => setRowPreviewMode('off')}
              >
                <Text style={[s.segmentBtnText, isGlass && s.segmentBtnTextGlass, rowPreviewMode === 'off' && s.segmentBtnTextActive]}>{t('conversationRows.previewOff')}</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={s.row}>
            <Text style={s.rowLabel}>{t('conversationRows.pathDisplay')}</Text>
            <View style={[s.segmentedControl, isGlass && s.segmentedControlGlass]}>
              <TouchableOpacity
                style={[s.segmentBtn, rowPathDisplay === 'smart' && s.segmentBtnActive]}
                onPress={() => setRowPathDisplay('smart')}
              >
                <Text style={[s.segmentBtnText, isGlass && s.segmentBtnTextGlass, rowPathDisplay === 'smart' && s.segmentBtnTextActive]}>{t('conversationRows.smart')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.segmentBtn, rowPathDisplay === 'full' && s.segmentBtnActive]}
                onPress={() => setRowPathDisplay('full')}
              >
                <Text style={[s.segmentBtnText, isGlass && s.segmentBtnTextGlass, rowPathDisplay === 'full' && s.segmentBtnTextActive]}>{t('conversationRows.full')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.segmentBtn, rowPathDisplay === 'last-segment' && s.segmentBtnActive]}
                onPress={() => setRowPathDisplay('last-segment')}
              >
                <Text style={[s.segmentBtnText, isGlass && s.segmentBtnTextGlass, rowPathDisplay === 'last-segment' && s.segmentBtnTextActive]}>{t('conversationRows.lastSegment')}</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={s.row}>
            <Text style={s.rowLabel}>{t('conversationRows.serverIndicator')}</Text>
            <View style={[s.segmentedControl, isGlass && s.segmentedControlGlass]}>
              <TouchableOpacity
                style={[s.segmentBtn, rowServerIndicator === 'auto' && s.segmentBtnActive]}
                onPress={() => setRowServerIndicator('auto')}
              >
                <Text style={[s.segmentBtnText, isGlass && s.segmentBtnTextGlass, rowServerIndicator === 'auto' && s.segmentBtnTextActive]}>{t('conversationRows.auto')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.segmentBtn, rowServerIndicator === 'always' && s.segmentBtnActive]}
                onPress={() => setRowServerIndicator('always')}
              >
                <Text style={[s.segmentBtnText, isGlass && s.segmentBtnTextGlass, rowServerIndicator === 'always' && s.segmentBtnTextActive]}>{t('conversationRows.always')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.segmentBtn, rowServerIndicator === 'never' && s.segmentBtnActive]}
                onPress={() => setRowServerIndicator('never')}
              >
                <Text style={[s.segmentBtnText, isGlass && s.segmentBtnTextGlass, rowServerIndicator === 'never' && s.segmentBtnTextActive]}>{t('conversationRows.never')}</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={s.row}>
            <Text style={s.rowLabel}>{t('conversationRows.serverChipStyle')}</Text>
            <View style={[s.segmentedControl, isGlass && s.segmentedControlGlass]}>
              <TouchableOpacity
                style={[s.segmentBtn, rowServerChipVariant === 'label' && s.segmentBtnActive]}
                onPress={() => setRowServerChipVariant('label')}
              >
                <Text style={[s.segmentBtnText, isGlass && s.segmentBtnTextGlass, rowServerChipVariant === 'label' && s.segmentBtnTextActive]}>{t('conversationRows.label')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.segmentBtn, rowServerChipVariant === 'letter' && s.segmentBtnActive]}
                onPress={() => setRowServerChipVariant('letter')}
              >
                <Text style={[s.segmentBtnText, isGlass && s.segmentBtnTextGlass, rowServerChipVariant === 'letter' && s.segmentBtnTextActive]}>{t('conversationRows.letter')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <SectionHeader title={t('section.privacy')} />
        <View style={s.card}>
          <SettingsRow
            label={t('privacy.biometricLock')}
            value={biometricLock}
            onValueChange={setBiometricLock}
            testID="settings-biometric-lock-toggle"
          />
        </View>

        <SectionHeader title={t('section.crashReporting')} />
        <View style={[s.card, isGlass && s.cardGlass]}>
          <GlassFill material />
          <SettingsRow
            label={t('crashReporting.title')}
            value={crashReportingEnabled}
            onValueChange={setCrashReportingEnabled}
            testID="settings-crash-reporting-toggle"
          />
          <Text style={s.rowNote}>{t('crashReporting.description')}</Text>
          <TouchableOpacity
            style={s.row}
            onPress={() => Linking.openURL('https://threadbase.sh/privacy-policy')}
            accessibilityRole="button"
            accessibilityLabel={t('crashReporting.privacyPolicy')}
          >
            <Text style={s.rowLabel}>{t('crashReporting.privacyPolicy')}</Text>
            <SettingsChevron />
          </TouchableOpacity>
          {__DEV__ ? (
            <TouchableOpacity
              style={s.row}
              onPress={handleTestCrash}
              accessibilityRole="button"
              accessibilityLabel={t('crashReporting.testCrash')}
              testID="settings-test-crash-btn"
            >
              <Text style={s.rowLabel}>{t('crashReporting.testCrash')}</Text>
              <SettingsChevron />
            </TouchableOpacity>
          ) : null}
          {__DEV__ ? (
            <TouchableOpacity
              style={[s.row, { borderBottomWidth: 0 }]}
              onPress={handleThrowUncaught}
              accessibilityRole="button"
              accessibilityLabel={t('crashReporting.testThrow')}
              testID="settings-throw-uncaught-btn"
            >
              <Text style={s.rowLabel}>{t('crashReporting.testThrow')}</Text>
              <SettingsChevron />
            </TouchableOpacity>
          ) : null}
        </View>
        {throwOnRender ? <ThrowOnRender /> : null}

        <SectionHeader title={t('section.permissions')} />
        <View style={[s.card, isGlass && s.cardGlass]}>
          <GlassFill material />
          <PermissionRow
            label={t('permissions.camera')}
            description={t('permissions.cameraDesc')}
            status={permStatuses.camera}
            onPress={permStatuses.camera === 'undetermined' ? () => requestPermission('camera') : openPermissionSettings}
          />
          <PermissionRow
            label={t('permissions.microphone')}
            description={t('permissions.microphoneDesc')}
            status={permStatuses.microphone}
            onPress={permStatuses.microphone === 'undetermined' ? () => requestPermission('microphone') : openPermissionSettings}
          />
          <PermissionRow
            label={t('permissions.photos')}
            description={t('permissions.photosDesc')}
            status={permStatuses.photos}
            onPress={permStatuses.photos === 'undetermined' ? () => requestPermission('photos') : openPermissionSettings}
          />
          <PermissionRow
            label={t('permissions.notifications')}
            description={t('permissions.notificationsDesc')}
            status={permStatuses.notifications}
            onPress={permStatuses.notifications === 'undetermined' ? () => requestPermission('notifications') : openPermissionSettings}
            isLast
          />
        </View>

        <SectionHeader title={t('section.about')} />
        <View style={[s.card, isGlass && s.cardGlass]}>
          <GlassFill material />
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
        <View style={[s.card, isGlass && s.cardGlass]}>
          <GlassFill material />
          <TouchableOpacity
            style={s.row}
            onPress={() => router.push('/server-health')}
            testID="settings-server-health-row"
          >
            <Text style={s.rowLabel}>{t('help.serverHealth')}</Text>
            <SettingsChevron />
          </TouchableOpacity>
          <TouchableOpacity
            style={s.row}
            onPress={() => router.push('/paired-devices')}
            testID="settings-paired-devices-row"
          >
            <Text style={s.rowLabel}>{t('help.pairedDevices')}</Text>
            <SettingsChevron />
          </TouchableOpacity>
          <TouchableOpacity
            style={s.row}
            onPress={() => router.push('/backup-restore')}
            testID="settings-backup-restore-row"
          >
            <Text style={s.rowLabel}>{t('help.backupRestore')}</Text>
            <SettingsChevron />
          </TouchableOpacity>
          <TouchableOpacity
            style={s.row}
            onPress={() => router.push('/help-feedback')}
            testID="settings-help-feedback-row"
          >
            <Text style={s.rowLabel}>{i18n.t('feedback:screenTitle')}</Text>
            <SettingsChevron />
          </TouchableOpacity>
          <TouchableOpacity style={s.row} onPress={() => router.push('/onboarding?mode=review')}>
            <Text style={s.rowLabel}>{t('help.restartOnboarding')}</Text>
            <SettingsChevron />
          </TouchableOpacity>
          <TouchableOpacity style={s.row} onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Threadbase%20Support`)}>
            <Text style={s.rowLabel}>{t('help.helpSupport')}</Text>
            <SettingsChevron />
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
      <PairCameraIdentityCard
        visible={cameraFingerprint !== null}
        fingerprint={cameraFingerprint}
        onDone={finishCameraIdentity}
      />
    </SafeAreaView>
  )
}

function SessionLeaveActionList({
  value,
  onChange,
}: {
  value: SessionLeaveAction
  onChange: (v: SessionLeaveAction) => void
}) {
  const theme = useTheme()
  const s = useMemo(() => styles(theme), [theme])
  const { t } = useTranslation('settings')
  const options: SessionLeaveAction[] = ['ask', 'kill', 'leave', 'kill_on_idle']
  return (
    <View accessibilityRole="radiogroup">
      {options.map((id) => {
        const selected = value === id
        return (
          <TouchableOpacity
            key={id}
            style={s.leaveOptionRow}
            onPress={() => onChange(id)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            testID={`settings-session-leave-${id}`}
          >
            <Text style={[s.leaveOptionLabel, selected && s.leaveOptionLabelActive]}>
              {getSessionLeaveActionLabel(id, t)}
            </Text>
          </TouchableOpacity>
        )
      })}
    </View>
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
  const isGlass = useIsGlass()
  const s = useMemo(() => styles(theme), [theme])
  const { t } = useTranslation('settings')
  const options: { id: AddServerAction; label: string }[] = [
    { id: 'ask', label: t('addServer.optionAsk') },
    { id: 'add', label: t('addServer.optionAdd') },
    { id: 'replace', label: t('addServer.optionReplace') },
    { id: 'keep', label: t('addServer.optionKeep') },
  ]
  return (
    <View style={[s.segmentedControl, isGlass && s.segmentedControlGlass]}>
      {options.map((option) => (
        <TouchableOpacity
          key={option.id}
          style={[s.segmentBtn, value === option.id && s.segmentBtnActive]}
          onPress={() => onChange(option.id)}
        >
          <Text style={[s.segmentBtnText, isGlass && s.segmentBtnTextGlass, value === option.id && s.segmentBtnTextActive]}>
            {option.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  )
}

function SettingsChevron() {
  const theme = useTheme()
  return <CaretRight size={16} color={theme.text.secondary} />
}

function styles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg.primary },
    containerGlass: { backgroundColor: 'transparent' },
    content: { padding: spacing.md, gap: spacing.sm },
    sectionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: spacing.md,
      marginBottom: spacing.xs,
    },
    sectionHeader: {
      color: theme.text.secondary,
      fontSize: font.xs,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginStart: spacing.xs,
    },
    sectionHeaderGlass: {
      color: theme.text.primary,
    },
    card: {
      backgroundColor: theme.bg.card,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: 'hidden',
    },
    cardGlass: {
      backgroundColor: 'transparent',
    },
    segmentedControlGlass: {
      backgroundColor: 'transparent',
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
      overflow: 'hidden',
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
      overflow: 'hidden',
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
    rowLabelGroup: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    rowValue: { color: theme.text.secondary, fontSize: font.sm },
    rowNote: { color: theme.text.secondary, fontSize: font.xs, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
    accordionBody: {
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.md,
      gap: spacing.sm,
    },
    resetBtn: { minHeight: 44, justifyContent: 'center' },
    resetBtnText: { color: theme.text.accent, fontSize: font.sm, fontWeight: '500' },
    leaveOptionRow: { minHeight: 44, justifyContent: 'center' },
    leaveOptionLabel: { color: theme.text.secondary, fontSize: font.sm, fontWeight: '500' },
    leaveOptionLabelActive: { color: theme.text.accent, fontWeight: '700' },
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
    segmentBtnTextGlass: { color: theme.text.primary },
    segmentBtnTextActive: { color: theme.text.onAccent },
    aboutText: { color: theme.text.primary, fontSize: font.base, padding: spacing.md, fontWeight: '500' },
    aboutSubtext: { color: theme.text.secondary, fontSize: font.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.md },
    permissionRowLeft: { flex: 1, gap: 2 },
    permissionRowDesc: { color: theme.text.secondary, fontSize: font.xs },
    permissionRowRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    permissionDot: { width: 8, height: 8, borderRadius: 4 },
    permissionRowAction: { color: theme.text.accent, fontSize: font.sm, fontWeight: '500', marginStart: spacing.xs },
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
      overflow: 'hidden',
    },
    themePreviewBand: {
      height: 8,
      borderRadius: radius.sm,
    },
    themeCardName: {
      fontSize: font.xs,
      fontWeight: '600' as const,
      textAlign: 'center' as const,
      paddingVertical: 4,
    },
    segmentedTabs: {
      flexDirection: 'row',
      marginHorizontal: spacing.md,
      marginTop: spacing.xs,
      marginBottom: spacing.xs,
      backgroundColor: theme.bg.primary,
      borderRadius: radius.sm,
      overflow: 'hidden',
    },
    segmentTab: {
      flex: 1,
      paddingVertical: spacing.xs,
      alignItems: 'center',
    },
    segmentTabActive: {
      backgroundColor: theme.text.accent,
    },
  })
}
