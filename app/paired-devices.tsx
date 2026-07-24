import React, { useCallback, useMemo, useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { Devices, ArrowsClockwise, Warning } from 'phosphor-react-native'
import { useTheme, useIsGlass } from '@/contexts/ThemeContext'
import { GlassFill } from '@/components/ui/GlassFill'
import { type Theme, font, radius, spacing } from '@/constants/theme'
import { MIN_TOUCH_TARGET } from '@/constants/a11y'
import { useServersStore } from '@/stores/servers'
import { useDevices, useRevokeDevice } from '@/hooks/useDevices'
import { formatDeviceEpoch } from '@/services/devices'
import { deviceHasCapability, type DeviceCapability, type DeviceView } from '@/types/devices'

export default function PairedDevicesScreen() {
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

  const [pickedId, setPickedId] = useState<string | null>(null)
  const selectedId =
    pickedId && serverIds.includes(pickedId) ? pickedId : (serverIds[0] ?? null)
  const selected = selectedId ? servers[selectedId] : undefined
  const thisDeviceId = selected?.deviceId

  const { data, error, isLoading, isFetching, refetch } = useDevices(selectedId)
  const revoke = useRevokeDevice(selectedId)
  const [actionMsg, setActionMsg] = useState<string | null>(null)

  const handleRetry = useCallback(() => {
    setActionMsg(null)
    void refetch()
  }, [refetch])

  const confirmRevoke = useCallback(
    (device: DeviceView) => {
      if (!selectedId) return
      const isThis = thisDeviceId != null && device.deviceId === thisDeviceId
      const title = t('pairedDevices.revokeTitle')
      const message = isThis
        ? t('pairedDevices.revokeThisBody')
        : t('pairedDevices.revokeBody', {
            name: device.name?.trim() || device.deviceId.slice(0, 8),
          })

      Alert.alert(title, message, [
        { text: t('common:button.cancel'), style: 'cancel' },
        {
          text: t('pairedDevices.revokeConfirm'),
          style: 'destructive',
          onPress: () => {
            revoke.mutate(device.deviceId, {
              onSuccess: (res) => {
                setActionMsg(
                  res.alreadyRevoked
                    ? t('pairedDevices.alreadyRevoked')
                    : t('pairedDevices.revoked'),
                )
              },
              onError: () => {
                setActionMsg(t('pairedDevices.revokeFailed'))
              },
            })
          },
        },
      ])
    },
    [revoke, selectedId, t, thisDeviceId],
  )

  if (serverIds.length === 0) {
    return (
      <SafeAreaView style={s.container} edges={['bottom']}>
        <View style={s.centered}>
          <Text style={s.emptyTitle}>{t('pairedDevices.emptyTitle')}</Text>
          <Text style={s.emptyBody}>{t('pairedDevices.emptyBody')}</Text>
        </View>
      </SafeAreaView>
    )
  }

  const devices = data?.devices ?? []
  const activeDevices = devices.filter((d) => d.revokedAt == null)
  const revokedDevices = devices.filter((d) => d.revokedAt != null)

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.content}>
        <View style={s.headerRow}>
          <Devices size={24} color={theme.text.accent} />
          <Text style={s.heading}>{t('pairedDevices.heading')}</Text>
        </View>
        <Text style={s.subtitle}>{t('pairedDevices.subtitle')}</Text>

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
                  testID={`paired-devices-chip-${id}`}
                >
                  <Text style={[s.chipText, selectedChip && s.chipTextSelected]} numberOfLines={1}>
                    {label}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </ScrollView>
        ) : null}

        <View style={[s.card, isGlass && s.cardGlass]}>
          <GlassFill />
          <Text style={s.cardBody}>{t('pairedDevices.controlNote')}</Text>
        </View>

        <View style={s.toolbar}>
          <TouchableOpacity
            style={s.toolbarBtn}
            onPress={handleRetry}
            disabled={isFetching}
            accessibilityRole="button"
            testID="paired-devices-retry"
          >
            <ArrowsClockwise size={18} color={theme.text.accent} />
            <Text style={s.toolbarBtnText}>{t('pairedDevices.retry')}</Text>
          </TouchableOpacity>
        </View>

        {actionMsg ? (
          <Text style={s.actionMsg} testID="paired-devices-action-msg">
            {actionMsg}
          </Text>
        ) : null}

        {isLoading && !data ? (
          <View style={s.centeredInline}>
            <ActivityIndicator size="small" color={theme.text.accent} />
            <Text style={s.loadingText}>{t('pairedDevices.loading')}</Text>
          </View>
        ) : null}

        {error && !data ? (
          <View style={[s.card, isGlass && s.cardGlass]} testID="paired-devices-error">
            <GlassFill />
            <Text style={s.errorText}>
              {error instanceof Error ? error.message : t('pairedDevices.loadFailed')}
            </Text>
          </View>
        ) : null}

        {data && !data.available ? (
          <View style={[s.card, isGlass && s.cardGlass]} testID="paired-devices-unavailable">
            <GlassFill />
            <View style={s.warnRow}>
              <Warning size={18} color={theme.text.warning} />
              <Text style={s.warnText}>{t('pairedDevices.storeUnavailable')}</Text>
            </View>
          </View>
        ) : null}

        {data?.available && activeDevices.length === 0 && revokedDevices.length === 0 ? (
          <View style={[s.card, isGlass && s.cardGlass]}>
            <GlassFill />
            <Text style={s.cardBody}>{t('pairedDevices.noDevices')}</Text>
          </View>
        ) : null}

        {activeDevices.map((device) => (
          <DeviceCard
            key={device.deviceId}
            device={device}
            isThis={thisDeviceId != null && device.deviceId === thisDeviceId}
            isGlass={isGlass}
            s={s}
            onRevoke={() => confirmRevoke(device)}
            revoking={revoke.isPending}
          />
        ))}

        {revokedDevices.length > 0 ? (
          <>
            <Text style={s.sectionLabel}>{t('pairedDevices.revokedSection')}</Text>
            {revokedDevices.map((device) => (
              <DeviceCard
                key={device.deviceId}
                device={device}
                isThis={false}
                isGlass={isGlass}
                s={s}
                revoked
              />
            ))}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  )
}

function DeviceCard({
  device,
  isThis,
  isGlass,
  s,
  onRevoke,
  revoking,
  revoked,
}: {
  device: DeviceView
  isThis: boolean
  isGlass: boolean
  s: ReturnType<typeof styles>
  onRevoke?: () => void
  revoking?: boolean
  revoked?: boolean
}) {
  const { t } = useTranslation('settings')
  const canControl = deviceHasCapability(device.capabilities, 'session:control')
  const name =
    device.name?.trim() || t('pairedDevices.unnamed', { id: device.deviceId.slice(0, 8) })

  return (
    <View
      style={[s.card, isGlass && s.cardGlass, revoked && s.cardMuted]}
      testID={`paired-device-${device.deviceId}`}
    >
      <GlassFill />
      <View style={s.deviceHeader}>
        <Text style={s.deviceName} numberOfLines={2}>
          {name}
        </Text>
        {isThis ? (
          <View style={s.thisBadge}>
            <Text style={s.thisBadgeText}>{t('pairedDevices.thisDevice')}</Text>
          </View>
        ) : null}
      </View>

      {canControl && !revoked ? (
        <Text style={s.controlWarn}>{t('pairedDevices.hasControl')}</Text>
      ) : null}

      <View style={s.capRow}>
        {device.capabilities.map((cap) => (
          <View key={cap} style={s.capChip}>
            <Text style={s.capChipText}>{capabilityLabel(cap, t)}</Text>
          </View>
        ))}
        {device.capabilities.length === 0 ? (
          <Text style={s.meta}>{t('pairedDevices.noCapabilities')}</Text>
        ) : null}
      </View>

      <Text style={s.meta}>
        {t('pairedDevices.createdAt', { at: formatDeviceEpoch(device.createdAt) })}
      </Text>
      <Text style={s.meta}>
        {t('pairedDevices.lastSeen', { at: formatDeviceEpoch(device.lastSeenAt) })}
      </Text>
      {revoked && device.revokedAt != null ? (
        <Text style={s.meta}>
          {t('pairedDevices.revokedAt', { at: formatDeviceEpoch(device.revokedAt) })}
        </Text>
      ) : null}

      {!revoked && onRevoke ? (
        <TouchableOpacity
          style={s.revokeBtn}
          onPress={onRevoke}
          disabled={revoking}
          accessibilityRole="button"
          testID={`paired-device-revoke-${device.deviceId}`}
        >
          <Text style={s.revokeBtnText}>{t('pairedDevices.revoke')}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  )
}

function capabilityLabel(
  cap: DeviceCapability,
  t: ReturnType<typeof useTranslation<'settings'>>['t'],
): string {
  switch (cap) {
    case 'history:read':
      return t('pairedDevices.capability.historyRead')
    case 'session:control':
      return t('pairedDevices.capability.sessionControl')
    case 'fs:browse':
      return t('pairedDevices.capability.fsBrowse')
    case 'fs:upload':
      return t('pairedDevices.capability.fsUpload')
    case 'notifications':
      return t('pairedDevices.capability.notifications')
    case 'admin':
      return t('pairedDevices.capability.admin')
  }
}

function styles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg.primary },
    content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl * 2 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg, gap: spacing.sm },
    centeredInline: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
    emptyTitle: { color: theme.text.primary, fontSize: font.lg, fontWeight: '600', textAlign: 'center' },
    emptyBody: { color: theme.text.secondary, fontSize: font.sm, textAlign: 'center', lineHeight: 20 },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    heading: { color: theme.text.primary, fontSize: font.xl, fontWeight: '700' },
    subtitle: { color: theme.text.secondary, fontSize: font.sm, lineHeight: 20 },
    chips: { gap: spacing.sm, paddingVertical: spacing.xs },
    chip: {
      minHeight: MIN_TOUCH_TARGET,
      paddingHorizontal: spacing.md,
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
    toolbar: { flexDirection: 'row', gap: spacing.sm },
    toolbarBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      minHeight: MIN_TOUCH_TARGET,
      paddingHorizontal: spacing.md,
    },
    toolbarBtnText: { color: theme.text.accent, fontSize: font.sm, fontWeight: '600' },
    actionMsg: { color: theme.text.secondary, fontSize: font.sm },
    loadingText: { color: theme.text.secondary, fontSize: font.sm },
    card: {
      backgroundColor: theme.bg.card,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: theme.border,
      padding: spacing.md,
      gap: spacing.sm,
      overflow: 'hidden',
    },
    cardGlass: { backgroundColor: 'transparent' },
    cardMuted: { opacity: 0.65 },
    cardBody: { color: theme.text.secondary, fontSize: font.sm, lineHeight: 20 },
    errorText: { color: theme.text.danger, fontSize: font.sm, lineHeight: 20 },
    warnRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
    warnText: { flex: 1, color: theme.text.warning, fontSize: font.sm, lineHeight: 20 },
    sectionLabel: {
      color: theme.text.secondary,
      fontSize: font.xs,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginTop: spacing.sm,
    },
    deviceHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
    deviceName: { color: theme.text.primary, fontSize: font.base, fontWeight: '600', flexShrink: 1 },
    thisBadge: {
      backgroundColor: theme.bg.secondary,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderWidth: 1,
      borderColor: theme.text.accent,
    },
    thisBadgeText: { color: theme.text.accent, fontSize: font.xs, fontWeight: '700' },
    controlWarn: { color: theme.text.warning, fontSize: font.xs, lineHeight: 16 },
    capRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
    capChip: {
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
    },
    capChipText: { color: theme.text.secondary, fontSize: font.xs },
    meta: { color: theme.text.secondary, fontSize: font.xs },
    revokeBtn: {
      alignSelf: 'flex-start',
      minHeight: MIN_TOUCH_TARGET,
      justifyContent: 'center',
      paddingHorizontal: spacing.sm,
    },
    revokeBtnText: { color: theme.text.danger, fontSize: font.sm, fontWeight: '600' },
  })
}
