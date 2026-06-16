import React, { useState, useEffect, useRef, useMemo } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
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
  onTapDetails: () => void
}

function serverLabel(id: string, servers: Record<string, ServerConfig>): string {
  const cfg = servers[id]
  if (cfg?.label) return cfg.label
  try { return new URL(cfg?.url ?? '').hostname } catch { return id }
}

type Severity = 'error' | 'warning' | 'info' | null

export function ServerStateMessage({ activeServerIds, servers, fetchStatuses, wsConnectedCount, onTapDetails }: Props) {
  const theme = useTheme()
  const styles = makeStyles(theme)
  const [showInfo, setShowInfo] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
            ? `Couldn't refresh sessions from ${label}. Tap for details.`
            : "Couldn't refresh sessions from any server. Tap for details.",
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
          ? `Couldn't refresh sessions from ${badLabel}. Tap for details.`
          : "Couldn't refresh sessions from some servers. Tap for details.",
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

  if (!severity || (severity === 'info' && !showInfo)) return null

  const accentColor =
    severity === 'error' ? theme.status.failed
    : severity === 'warning' ? theme.status.waiting
    : theme.text.secondary

  const Icon = severity === 'error' ? WarningCircle : severity === 'warning' ? Warning : Info
  const iconWeight = severity === 'error' ? 'fill' as const : 'regular' as const
  const tappable = message.includes('Tap for details')

  const inner = (
    <View style={[styles.banner, { borderLeftColor: accentColor }]}>
      <Icon size={16} color={accentColor} weight={iconWeight} />
      <Text
        style={[styles.text, { color: severity === 'info' ? theme.text.secondary : theme.text.primary }]}
        numberOfLines={2}
      >
        {message}
      </Text>
    </View>
  )

  if (tappable) {
    return (
      <TouchableOpacity onPress={onTapDetails} activeOpacity={0.7}>
        {inner}
      </TouchableOpacity>
    )
  }
  return inner
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginHorizontal: spacing.md,
      marginBottom: spacing.xs,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
      backgroundColor: theme.bg.card,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      borderLeftWidth: 3,
    },
    text: {
      flex: 1,
      fontSize: font.base,
      fontWeight: '500',
    },
  })
}
