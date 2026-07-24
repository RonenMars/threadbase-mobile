import React, { useCallback, useMemo, useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { Bell, ArrowsClockwise } from 'phosphor-react-native'
import { useTheme, useIsGlass } from '@/contexts/ThemeContext'
import { GlassFill } from '@/components/ui/GlassFill'
import { type Theme, font, radius, spacing } from '@/constants/theme'
import { MIN_TOUCH_TARGET } from '@/constants/a11y'
import { useServersStore } from '@/stores/servers'
import { useSettingsStore } from '@/stores/settings'
import { usePushHealth } from '@/hooks/usePushHealth'
import { formatEpoch } from '@/services/push-health'
import { isInQuietHours, registerPushToken } from '@/services/push'
import type { PushTokenHealth, PushTokenState } from '@/types/push-health'

export default function NotificationHealthScreen() {
  const { t } = useTranslation(['settings', 'common'])
  const theme = useTheme()
  const isGlass = useIsGlass()
  const s = useMemo(() => styles(theme), [theme])

  const servers = useServersStore((st) => st.servers)
  const activeServerIds = useServersStore((st) => st.activeServerIds)
  const serverIds = useMemo(
    () => activeServerIds.filter((id) => !!servers[id]),
    [activeServerIds, servers],
  )

  const notifications = useSettingsStore((st) => st.notifications)

  const [pickedId, setPickedId] = useState<string | null>(null)
  const selectedId =
    pickedId && serverIds.includes(pickedId) ? pickedId : (serverIds[0] ?? null)
  const selected = selectedId ? servers[selectedId] : undefined
  const serverLabel = selected?.label?.trim() || selected?.url || selectedId || '—'

  const { data, error, isLoading, isFetching, refetch } = usePushHealth(selectedId)
  const [reregistering, setReregistering] = useState(false)
  const [actionMsg, setActionMsg] = useState<string | null>(null)

  const quietPreview = notifications.quietHoursEnabled
    ? isInQuietHours(notifications.quietHoursFrom, notifications.quietHoursTo)
    : false

  const quietPreviewLabel = quietPreview
    ? t('settings:notificationHealth.quietActive')
    : t('settings:notificationHealth.quietInactive')

  const handleRetry = useCallback(() => {
    setActionMsg(null)
    void refetch()
  }, [refetch])

  const handleReregister = useCallback(async () => {
    if (!selectedId) return
    setReregistering(true)
    setActionMsg(null)
    try {
      const result = await registerPushToken(selectedId)
      if (!result.ok) {
        const skipMsg =
          result.reason === 'permission_denied'
            ? t('settings:notificationHealth.reregisterNeedsPermission')
            : t('settings:notificationHealth.reregisterNeedsDevice')
        setActionMsg(skipMsg)
        return
      }
      setActionMsg(t('settings:notificationHealth.reregistered'))
      await refetch()
    } catch {
      setActionMsg(t('settings:notificationHealth.reregisterFailed'))
    } finally {
      setReregistering(false)
    }
  }, [selectedId, refetch, t])

  if (serverIds.length === 0) {
    return (
      <SafeAreaView style={s.container} edges={['bottom']}>
        <View style={s.centered}>
          <Text style={s.emptyTitle}>{t('settings:notificationHealth.emptyTitle')}</Text>
          <Text style={s.emptyBody}>{t('settings:notificationHealth.emptyBody')}</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.content}>
        <View style={s.headerRow}>
          <Bell size={24} color={theme.text.accent} />
          <Text style={s.heading}>{t('settings:notificationHealth.heading')}</Text>
        </View>
        <Text style={s.subtitle}>{t('settings:notificationHealth.subtitle')}</Text>

        {serverIds.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
            {serverIds.map((id) => {
              const label = servers[id]?.label?.trim() || servers[id]?.url || id
              const selectedChip = id === selectedId
              return (
                <TouchableOpacity
                  key={id}
                  style={[s.chip, selectedChip && s.chipSelected]}
                  onPress={() => {
                    setPickedId(id)
                    setActionMsg(null)
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: selectedChip }}
                  testID={`notif-health-chip-${id}`}
                >
                  <Text style={[s.chipText, selectedChip && s.chipTextSelected]} numberOfLines={1}>
                    {label}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </ScrollView>
        ) : null}

        <View style={[s.card, isGlass && s.cardGlass]} testID="notif-health-quiet">
          <GlassFill />
          <Text style={s.cardTitle}>{t('settings:notificationHealth.quietPreview')}</Text>
          <Text style={s.cardBody}>{quietPreviewLabel}</Text>
          {notifications.quietHoursEnabled ? (
            <Text style={s.meta}>
              {t('settings:notificationHealth.quietWindow', {
                from: notifications.quietHoursFrom,
                to: notifications.quietHoursTo,
              })}
            </Text>
          ) : null}
        </View>

        <View style={s.toolbar}>
          <TouchableOpacity
            style={s.toolbarBtn}
            onPress={handleRetry}
            disabled={isFetching}
            accessibilityRole="button"
            testID="notif-health-retry"
          >
            <ArrowsClockwise size={18} color={theme.text.accent} />
            <Text style={s.toolbarBtnText}>{t('settings:notificationHealth.retry')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.toolbarBtn}
            onPress={() => void handleReregister()}
            disabled={reregistering}
            accessibilityRole="button"
            testID="notif-health-reregister"
          >
            <Text style={s.toolbarBtnText}>
              {reregistering
                ? t('settings:notificationHealth.reregistering')
                : t('settings:notificationHealth.reregister')}
            </Text>
          </TouchableOpacity>
        </View>

        {isLoading && !data ? (
          <View style={s.centeredInline}>
            <ActivityIndicator size="small" color={theme.text.accent} />
            <Text style={s.loadingText}>{t('settings:notificationHealth.loading')}</Text>
          </View>
        ) : null}

        {error && !data ? (
          <View style={[s.card, isGlass && s.cardGlass]}>
            <GlassFill />
            <Text style={s.errorText}>
              {error instanceof Error ? error.message : t('settings:notificationHealth.loadFailed')}
            </Text>
          </View>
        ) : null}

        {data ? (
          <>
            <View style={[s.card, isGlass && s.cardGlass]} testID="notif-health-store">
              <GlassFill />
              <Text style={s.cardTitle}>{serverLabel}</Text>
              <Text style={s.cardBody}>
                {data.available
                  ? t('settings:notificationHealth.storeAvailable')
                  : t('settings:notificationHealth.storeUnavailable')}
              </Text>
            </View>

            {data.tokens.length === 0 ? (
              <View style={[s.card, isGlass && s.cardGlass]}>
                <GlassFill />
                <Text style={s.cardBody}>{t('settings:notificationHealth.noTokens')}</Text>
              </View>
            ) : (
              data.tokens.map((token, idx) => (
                <TokenCard key={`${token.platform}-${token.registeredAt}-${idx}`} token={token} theme={theme} isGlass={isGlass} />
              ))
            )}
          </>
        ) : null}

        {actionMsg ? <Text style={s.actionMsg}>{actionMsg}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  )
}

function TokenCard({
  token,
  theme,
  isGlass,
}: {
  token: PushTokenHealth
  theme: Theme
  isGlass: boolean
}) {
  const { t } = useTranslation('settings')
  const s = useMemo(() => styles(theme), [theme])
  const stateLabel = stateLabelFor(t, token.state)
  let deliveryHint = t('notificationHealth.hintHealthy')
  if (token.state === 'never-delivered') deliveryHint = t('notificationHealth.hintNeverDelivered')
  else if (token.state === 'failing' || token.state === 'dead') {
    deliveryHint = t('notificationHealth.hintDelivery')
  } else if (token.state === 'revoked') deliveryHint = t('notificationHealth.hintRevoked')

  return (
    <View style={[s.card, isGlass && s.cardGlass]} testID={`notif-health-token-${token.state}`}>
      <GlassFill />
      <Text style={s.cardTitle}>{stateLabel}</Text>
      <Text style={s.cardBody}>{deliveryHint}</Text>
      <Text style={s.meta}>{`${t('notificationHealth.platform')}: ${token.platform}`}</Text>
      <Text style={s.meta}>
        {`${t('notificationHealth.registeredAt')}: ${formatEpoch(token.registeredAt)}`}
      </Text>
      <Text style={s.meta}>
        {`${t('notificationHealth.lastSuccess')}: ${formatEpoch(token.lastSuccessAt)}`}
      </Text>
      <Text style={s.meta}>
        {`${t('notificationHealth.lastFailure')}: ${formatEpoch(token.lastFailureAt)}`}
      </Text>
      {token.lastFailureCode ? (
        <Text style={s.meta}>
          {`${t('notificationHealth.failureCode')}: ${token.lastFailureCode}`}
        </Text>
      ) : null}
      <Text style={s.meta}>
        {`${t('notificationHealth.failureStreak')}: ${token.failureStreak}`}
      </Text>
    </View>
  )
}

function stateLabelFor(
  t: (key:
    | 'notificationHealth.state.never-delivered'
    | 'notificationHealth.state.healthy'
    | 'notificationHealth.state.failing'
    | 'notificationHealth.state.dead'
    | 'notificationHealth.state.revoked') => string,
  state: PushTokenState,
): string {
  switch (state) {
    case 'never-delivered':
      return t('notificationHealth.state.never-delivered')
    case 'healthy':
      return t('notificationHealth.state.healthy')
    case 'failing':
      return t('notificationHealth.state.failing')
    case 'dead':
      return t('notificationHealth.state.dead')
    case 'revoked':
      return t('notificationHealth.state.revoked')
  }
}

function styles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg.primary },
    content: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xxl },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.lg },
    centeredInline: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
    emptyTitle: { color: theme.text.primary, fontSize: font.lg, fontWeight: '600', textAlign: 'center' },
    emptyBody: { color: theme.text.secondary, fontSize: font.base, textAlign: 'center', lineHeight: 21 },
    loadingText: { color: theme.text.secondary, fontSize: font.base },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
    heading: { color: theme.text.primary, fontSize: font.xl, fontWeight: '700' },
    subtitle: { color: theme.text.secondary, fontSize: font.base, lineHeight: 21 },
    chips: { gap: spacing.xs, paddingVertical: spacing.xs },
    chip: {
      paddingHorizontal: spacing.md,
      minHeight: MIN_TOUCH_TARGET,
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.bg.card,
      justifyContent: 'center',
      maxWidth: 220,
    },
    chipSelected: { borderColor: theme.text.accent, backgroundColor: theme.bg.secondary },
    chipText: { color: theme.text.secondary, fontSize: font.sm },
    chipTextSelected: { color: theme.text.accent, fontWeight: '600' },
    toolbar: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.md },
    toolbarBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      minHeight: MIN_TOUCH_TARGET,
      paddingHorizontal: spacing.sm,
    },
    toolbarBtnText: { color: theme.text.accent, fontSize: font.sm, fontWeight: '600' },
    card: {
      backgroundColor: theme.bg.card,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: 'hidden',
      padding: spacing.md,
      gap: spacing.xs,
    },
    cardGlass: { backgroundColor: 'transparent' },
    cardTitle: { color: theme.text.primary, fontSize: font.base, fontWeight: '700' },
    cardBody: { color: theme.text.secondary, fontSize: font.sm, lineHeight: 19 },
    meta: { color: theme.text.secondary, fontSize: font.xs, fontFamily: 'monospace' },
    errorText: { color: theme.text.danger, fontSize: font.sm },
    actionMsg: { color: theme.text.secondary, fontSize: font.sm },
  })
}
