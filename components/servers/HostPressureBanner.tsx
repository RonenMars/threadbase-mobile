import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { Warning } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { type Theme, font, radius, spacing } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { useServersStore } from '@/stores/servers'
import { GlassFill } from '@/components/ui/GlassFill'
import { parseHostPressureOs, type HostPressureLevel } from '@/types/api'
import {
  hostPressureBannerKey,
  hostPressureDetectedKeys,
  hostPressureServerName,
  hostPressureWhatToDoKey,
  hostPressureWhyFineKeys,
} from '@/utils/hostPressureCopy'

const DISMISS_DURATION = 220
const DOWN_MAX = 40
const DOWN_THRESHOLD = 20

export function HostPressureBanner() {
  const theme = useTheme()
  const styles = makeStyles(theme)
  const { t } = useTranslation('servers')
  const servers = useServersStore((s) => s.servers)
  const displayedServerIds = useServersStore((s) => s.displayedServerIds)
  const hostPressure = useServersStore((s) => s.hostPressure)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [dismissed, setDismissed] = useState<{
    serverId: string
    level: HostPressureLevel
  } | null>(null)

  const alertServerId = displayedServerIds.find((id) => hostPressure[id] != null)
  const pressure = alertServerId ? hostPressure[alertServerId] : null

  const translateY = useSharedValue(0)
  const opacity = useSharedValue(1)

  const resetAnimation = useCallback(() => {
    // eslint-disable-next-line react-hooks/immutability
    translateY.value = 0
    // eslint-disable-next-line react-hooks/immutability
    opacity.value = 1
    // translateY/opacity are stable Reanimated shared values
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    resetAnimation()
  }, [alertServerId, pressure?.level, resetAnimation])

  const handleDismiss = useCallback(() => {
    const state = useServersStore.getState()
    const serverId = state.displayedServerIds.find((id) => state.hostPressure[id] != null)
    const current = serverId ? state.hostPressure[serverId] : null
    if (serverId && current) setDismissed({ serverId, level: current.level })
    setSheetOpen(false)
  }, [])

  const pan = useMemo(() => Gesture.Pan()
    .activeOffsetY([-8, 8])
    .onUpdate((e) => {
      'worklet'
      if (e.translationY < 0) {
        // eslint-disable-next-line react-hooks/immutability
        translateY.value = e.translationY
        // eslint-disable-next-line react-hooks/immutability
        opacity.value = 1 + e.translationY / 60
      } else {
        const clamped = Math.min(e.translationY, DOWN_MAX)
        const overflow = Math.max(0, e.translationY - DOWN_MAX)
        // eslint-disable-next-line react-hooks/immutability
        translateY.value = clamped + overflow * 0.15
      }
    })
    .onEnd((e) => {
      'worklet'
      if (e.translationY < -40 || e.translationY >= DOWN_THRESHOLD) {
        // eslint-disable-next-line react-hooks/immutability
        translateY.value = withTiming(-80, { duration: DISMISS_DURATION, easing: Easing.out(Easing.quad) })
        // eslint-disable-next-line react-hooks/immutability
        opacity.value = withTiming(0, { duration: DISMISS_DURATION }, () => {
          runOnJS(handleDismiss)()
        })
      } else {
        // eslint-disable-next-line react-hooks/immutability
        translateY.value = withTiming(0, { duration: 150 })
        // eslint-disable-next-line react-hooks/immutability
        opacity.value = withTiming(1, { duration: 150 })
      }
    })
    .runOnJS(false),
  // translateY/opacity are stable Reanimated shared values
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [handleDismiss])

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }))

  const hiddenForLevel = Boolean(
    pressure
    && alertServerId
    && dismissed?.serverId === alertServerId
    && dismissed.level === pressure.level,
  )
  if (!pressure || !alertServerId || hiddenForLevel) return null

  const server = servers[alertServerId]
  const serverLabel = hostPressureServerName(server)
  const os = pressure.os ?? parseHostPressureOs(server?.serverInfo?.platform)
  const bannerKey = hostPressureBannerKey(pressure.level, pressure.reasons)
  const bannerText = t(bannerKey, { server: serverLabel ?? '' })
  const detailsLabel = t('action.details')
  const modalLead = t('hostPressure.modalLead')
  const detectedLines = hostPressureDetectedKeys(pressure.reasons).map((key) => t(key))
  const whyFineLines = hostPressureWhyFineKeys(pressure.reasons).map((key) => t(key))
  const showAgents = pressure.reasons.includes('agents')
  const agentsLine = showAgents
    ? t('hostPressure.detected.agents', { count: pressure.liveAgents })
    : ''
  const whatToDo = t(hostPressureWhatToDoKey(os))
  const accentColor = theme.status.waiting

  return (
    <>
      <View style={styles.clip}>
        <GestureDetector gesture={pan}>
          <Animated.View style={[styles.banner, animatedStyle]} testID="host-pressure-banner">
            <Warning size={16} color={accentColor} weight="regular" />
            <Text
              style={styles.title}
              numberOfLines={2}
              accessibilityRole="text"
            >
              {bannerText}
            </Text>
            <TouchableOpacity
              style={[styles.actionBtn, { borderColor: accentColor }]}
              onPress={() => setSheetOpen(true)}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              accessibilityRole="button"
              accessibilityLabel={detailsLabel}
              testID="host-pressure-details"
            >
              <Text style={[styles.actionText, { color: accentColor }]}>{detailsLabel}</Text>
            </TouchableOpacity>
          </Animated.View>
        </GestureDetector>
      </View>

      {sheetOpen ? (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setSheetOpen(false)}
          statusBarTranslucent
        >
          <Pressable style={styles.backdrop} onPress={() => setSheetOpen(false)}>
            <Pressable style={styles.sheet} onPress={() => {}} testID="host-pressure-sheet">
              <GlassFill />
              <View style={styles.header}>
                <Warning size={20} color={accentColor} weight="regular" />
                <Text style={styles.sheetTitle}>{bannerText}</Text>
              </View>
              <Text style={styles.body}>{modalLead}</Text>
              {detectedLines.map((line) => (
                <Text key={line} style={styles.body}>{line}</Text>
              ))}
              {whyFineLines.map((line) => (
                <Text key={line} style={styles.body}>{line}</Text>
              ))}
              {showAgents ? (
                <Text style={styles.body}>{agentsLine}</Text>
              ) : null}
              <Text style={styles.body}>{whatToDo}</Text>
              <TouchableOpacity
                style={styles.dismissBtn}
                onPress={() => {
                  setDismissed({ serverId: alertServerId, level: pressure.level })
                  setSheetOpen(false)
                }}
                accessibilityRole="button"
                testID="host-pressure-dismiss"
              >
                <Text style={styles.dismissText}>{t('hostPressure.dismiss')}</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    clip: {
      overflow: 'visible',
      zIndex: 10,
    },
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      backgroundColor: theme.bg.secondary,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    title: {
      flex: 1,
      color: theme.text.primary,
      fontSize: font.base,
      fontWeight: '500',
      lineHeight: 18,
    },
    actionBtn: {
      borderWidth: 1,
      borderRadius: 6,
      paddingVertical: 3,
      paddingHorizontal: spacing.sm,
    },
    actionText: {
      fontSize: font.xs,
      fontWeight: '600',
    },
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
    },
    sheet: {
      backgroundColor: theme.bg.secondary,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: theme.border,
      padding: spacing.md,
      gap: spacing.sm,
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
    },
    sheetTitle: {
      flex: 1,
      color: theme.text.primary,
      fontSize: font.base,
      fontWeight: '600',
      lineHeight: 20,
    },
    body: {
      color: theme.text.secondary,
      fontSize: font.sm,
      lineHeight: 18,
    },
    dismissBtn: {
      alignSelf: 'flex-end',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
    },
    dismissText: {
      color: theme.text.accent,
      fontSize: font.sm,
      fontWeight: '600',
    },
  })
}
