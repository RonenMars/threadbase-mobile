import React, { useState, useEffect, useRef, useMemo } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  Easing,
} from 'react-native-reanimated'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { WarningCircle, Warning, Info } from 'phosphor-react-native'
import { type Theme, spacing, font } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { wsManager } from '@/services/ws-client'
import type { ServerFetchStatusEntry } from '@/stores/serverFetchStatus'
import type { ServerConfig } from '@/types/api'

type Props = {
  activeServerIds: string[]
  servers: Record<string, ServerConfig>
  fetchStatuses: Record<string, ServerFetchStatusEntry>
  wsConnectedCount: number
  onViewDetails: () => void
}

function serverLabel(id: string, servers: Record<string, ServerConfig>): string {
  const cfg = servers[id]
  if (cfg?.label) return cfg.label
  try { return new URL(cfg?.url ?? '').hostname } catch { return id }
}

type Severity = 'error' | 'warning' | 'info' | null

const DISMISS_DURATION = 220
const DOWN_MAX = 40    // px the user can pull down before it commits
const DOWN_THRESHOLD = 20  // how far down triggers commit on release

export function ServerStateMessage({ activeServerIds, servers, fetchStatuses, wsConnectedCount, onViewDetails }: Props) {
  const theme = useTheme()
  const styles = makeStyles(theme)
  const [showInfo, setShowInfo] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Track which severity the user dismissed so a new severity re-shows the banner
  const [dismissedSeverity, setDismissedSeverity] = useState<Severity>(null)

  const translateY = useSharedValue(0)
  const opacity = useSharedValue(1)

  const { severity, message } = useMemo((): { severity: Severity; message: string } => {
    if (activeServerIds.length === 0) return { severity: null, message: '' }

    const healthy: string[] = []
    const unreachable: string[] = []
    const fetchFailed: string[] = []
    const disconnected: string[] = []
    const connecting: string[] = []

    for (const id of activeServerIds) {
      const wsStatus = wsManager.status(id)
      const fetchOk = (fetchStatuses[id]?.status ?? 'ok') === 'ok'
      if (wsStatus === 'connected' && fetchOk) healthy.push(id)
      else if (wsStatus === 'disconnected' && !fetchOk) unreachable.push(id)
      else if (wsStatus === 'connected' && !fetchOk) fetchFailed.push(id)
      else if (wsStatus === 'disconnected' && fetchOk) disconnected.push(id)
      else if (wsStatus === 'connecting') connecting.push(id)
    }

    const single = activeServerIds.length === 1
    const label = single ? serverLabel(activeServerIds[0], servers) : ''

    // All servers unhealthy
    if (healthy.length === 0) {
      if (unreachable.length > 0) {
        return {
          severity: 'error',
          message: single
            ? `Can't reach ${label}. Check your connection or server address.`
            : "Can't reach any server. Check your connection or server address.",
        }
      }
      if (fetchFailed.length > 0) {
        return {
          severity: 'error',
          message: single
            ? `Couldn't refresh sessions from ${label}.`
            : "Couldn't refresh sessions from any server.",
        }
      }
      if (disconnected.length > 0) {
        return {
          severity: 'warning',
          message: single
            ? `Disconnected from ${label}. Showing cached sessions.`
            : 'Disconnected from all servers. Showing cached sessions.',
        }
      }
      if (connecting.length > 0) {
        return {
          severity: 'info',
          message: single ? `Connecting to ${label}…` : 'Connecting to servers…',
        }
      }
      return { severity: null, message: '' }
    }

    // Some healthy, some degraded
    const bad = [...unreachable, ...fetchFailed, ...disconnected]
    if (unreachable.length > 0) {
      const badLabel = unreachable.length === 1 ? serverLabel(unreachable[0], servers) : null
      return {
        severity: 'warning',
        message: badLabel
          ? `${badLabel} is unreachable. Some sessions may be missing.`
          : 'Some servers are unreachable. Some sessions may be missing.',
      }
    }
    if (fetchFailed.length > 0) {
      const badLabel = fetchFailed.length === 1 ? serverLabel(fetchFailed[0], servers) : null
      return {
        severity: 'warning',
        message: badLabel
          ? `Couldn't refresh sessions from ${badLabel}.`
          : "Couldn't refresh sessions from some servers.",
      }
    }
    if (disconnected.length > 0) {
      const badLabel = bad.length === 1 ? serverLabel(bad[0], servers) : null
      return {
        severity: 'warning',
        message: badLabel
          ? `Disconnected from ${badLabel}. Showing cached sessions.`
          : 'Disconnected from some servers. Showing cached sessions.',
      }
    }
    if (connecting.length > 0) {
      const connectingLabel = connecting.length === 1 ? serverLabel(connecting[0], servers) : null
      return {
        severity: 'info',
        message: connectingLabel ? `Connecting to ${connectingLabel}…` : 'Connecting to servers…',
      }
    }

    return { severity: null, message: '' }
    // wsConnectedCount triggers recompute when WS state flips
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeServerIds, fetchStatuses, wsConnectedCount, servers])

  // Reset dismiss when severity changes (e.g. reconnect → new error)
  useEffect(() => {
    if (severity !== dismissedSeverity) {
      setDismissedSeverity(null)
      translateY.value = 0
      opacity.value = 1
    }
  }, [severity])

  useEffect(() => {
    if (severity === 'info') {
      timerRef.current = setTimeout(() => setShowInfo(true), 2000)
    } else {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setShowInfo(false), 0)
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [severity])

  function handleDismiss() {
    setDismissedSeverity(severity)
  }

  const pan = Gesture.Pan()
    .activeOffsetY([-8, 8])
    .onUpdate((e) => {
      'worklet'
      if (e.translationY < 0) {
        // Drag up: follow freely, fade proportionally
        translateY.value = e.translationY
        opacity.value = 1 + e.translationY / 60
      } else {
        // Drag down: clamp to DOWN_MAX with rubber-band resistance past that
        const clamped = Math.min(e.translationY, DOWN_MAX)
        const overflow = Math.max(0, e.translationY - DOWN_MAX)
        translateY.value = clamped + overflow * 0.15
      }
    })
    .onEnd((e) => {
      'worklet'
      if (e.translationY < -40) {
        // Swipe up commit: slide off top
        translateY.value = withTiming(-80, { duration: DISMISS_DURATION, easing: Easing.out(Easing.quad) })
        opacity.value = withTiming(0, { duration: DISMISS_DURATION }, () => {
          runOnJS(handleDismiss)()
        })
      } else if (e.translationY >= DOWN_THRESHOLD) {
        // Drag down commit: snap back up to top and exit
        translateY.value = withTiming(-80, { duration: DISMISS_DURATION, easing: Easing.out(Easing.quad) })
        opacity.value = withTiming(0, { duration: DISMISS_DURATION }, () => {
          runOnJS(handleDismiss)()
        })
      } else {
        // Not far enough either way: snap back
        translateY.value = withTiming(0, { duration: 150 })
        opacity.value = withTiming(1, { duration: 150 })
      }
    })
    .runOnJS(false)

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }))

  if (!severity || (severity === 'info' && !showInfo)) return null
  if (dismissedSeverity === severity) return null

  const accentColor =
    severity === 'error' ? theme.status.failed
    : severity === 'warning' ? theme.status.waiting
    : theme.text.secondary

  const Icon = severity === 'error' ? WarningCircle : severity === 'warning' ? Warning : Info
  const iconWeight = severity === 'error' ? 'fill' as const : 'regular' as const
  const showAction = severity === 'error' || severity === 'warning'

  return (
    <View style={styles.clip}>
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.banner, animatedStyle]}>
          <Icon size={16} color={accentColor} weight={iconWeight} />
          <Text
            style={[styles.text, { color: severity === 'info' ? theme.text.secondary : theme.text.primary }]}
            numberOfLines={2}
          >
            {message}
          </Text>
          {showAction && (
            <TouchableOpacity
              style={[styles.actionBtn, { borderColor: accentColor }]}
              onPress={onViewDetails}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            >
              <Text style={[styles.actionText, { color: accentColor }]}>Details</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      </GestureDetector>
    </View>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    clip: {
      overflow: 'visible',
      // Reserve space so the banner can travel DOWN_MAX px downward
      // without being clipped by the parent SafeAreaView
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
    text: {
      flex: 1,
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
  })
}
