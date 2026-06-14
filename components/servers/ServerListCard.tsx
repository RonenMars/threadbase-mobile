import React, { useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert, Animated, Easing } from 'react-native'
import { Trash, PencilSimple, ArrowsClockwise, XCircle } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import i18n from '@/lib/i18n'
import { useTheme } from '@/contexts/ThemeContext'
import { type Theme, font, radius, spacing } from '@/constants/theme'
import type { ServerConfig } from '@/types/api'

interface Props {
  server: ServerConfig
  isRefreshing: boolean
  onRemove: (serverId: string) => void
  onEdit: (serverId: string) => void
  onRefresh: (serverId: string) => void
  onViewError: (serverId: string) => void
}

const REFRESH_TIMEOUT_MS = 12000

export function ServerListCard({ server, isRefreshing, onRemove, onEdit, onRefresh, onViewError }: Props) {
  const { t } = useTranslation('servers')
  const theme = useTheme()
  const progress = useMemo(() => new Animated.Value(1), [])
  const progressAnim = useRef<Animated.CompositeAnimation | null>(null)
  const resultOpacity = useMemo(() => new Animated.Value(0), [])
  const [resultColor, setResultColor] = useState<string>(theme.status.running)
  const [showBottomLine, setShowBottomLine] = useState(false)
  const prevRefreshing = useRef(false)
  const styles = makeStyles(theme)

  useEffect(() => {
    progressAnim.current?.stop()
    if (isRefreshing) {
      progress.setValue(1)
      progressAnim.current = Animated.timing(progress, {
        toValue: 0,
        duration: REFRESH_TIMEOUT_MS,
        easing: Easing.linear,
        useNativeDriver: false,
      })
      progressAnim.current.start()
    } else {
      progress.setValue(1)
      if (prevRefreshing.current) {
        const color = server.connectionError ? theme.status.failed : theme.status.running
        setResultColor(color)
        setShowBottomLine(true)
        resultOpacity.setValue(1)
        Animated.sequence([
          Animated.delay(2500),
          Animated.timing(resultOpacity, { toValue: 0, duration: 500, useNativeDriver: true }),
        ]).start(() => setShowBottomLine(false))
      }
    }
    prevRefreshing.current = isRefreshing
    // progress/resultOpacity are stable Animated.Value refs; server.connectionError
    // is intentionally read from the closure — effect must fire only on isRefreshing toggles.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRefreshing])

  const handleRemove = () => {
    Alert.alert(
      i18n.t('servers:dialog.removeTitle'),
      `Disconnect from ${server.label || server.url}?`,
      [
        { text: i18n.t('common:button.cancel'), style: 'cancel' },
        { text: i18n.t('servers:dialog.removeConfirm'), style: 'destructive', onPress: () => onRemove(server.id) },
      ]
    )
  }

  return (
    <View style={[styles.card, showBottomLine && styles.cardNoBottomPad]}>
      <View style={styles.header}>
        <View style={[styles.statusDot, server.isConnected ? styles.dotConnected : styles.dotDisconnected]} />
        <Text style={styles.label} numberOfLines={1}>
          {server.label || 'Server'}
        </Text>
        <View style={styles.iconGroup}>
          {server.connectionError ? (
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => onViewError(server.id)}
              hitSlop={4}
              accessibilityLabel="View connection error"
            >
              <XCircle size={20} color={theme.text.danger} weight="fill" />
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={handleRemove}
            hitSlop={4}
            accessibilityLabel="Delete server"
          >
            <Trash size={20} color={theme.text.danger} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => onEdit(server.id)}
            hitSlop={4}
            accessibilityLabel="Edit server"
          >
            <PencilSimple size={20} color={theme.text.accent} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconBtn, isRefreshing && styles.iconBtnDisabled]}
            onPress={() => !isRefreshing && onRefresh(server.id)}
            hitSlop={4}
            accessibilityLabel="Refresh server info"
          >
            <ArrowsClockwise size={20} color={theme.text.secondary} />
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.url} numberOfLines={1}>{server.url}</Text>

      {server.serverInfo ? (
        <Text style={styles.meta}>
          {/* eslint-disable-next-line i18next/no-literal-string */}
          {server.serverInfo.machineName} · {server.serverInfo.platform} · v{server.serverInfo.version}
        </Text>
      ) : (
        <Text style={styles.meta}>
          {server.isConnected ? t('status.connected') : t('status.disconnected')}
        </Text>
      )}

      {(isRefreshing || showBottomLine) ? (
        <View style={styles.bottomSlot}>
          {isRefreshing ? (
            <Animated.View
              style={[
                styles.progressFill,
                {
                  width: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          ) : (
            <Animated.View
              style={[styles.resultLine, { backgroundColor: resultColor, opacity: resultOpacity }]}
            />
          )}
        </View>
      ) : null}
    </View>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    card: {
      backgroundColor: theme.bg.card,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: 'hidden',
      marginBottom: spacing.sm,
      padding: spacing.md,
      paddingBottom: spacing.sm,
    },
    cardNoBottomPad: {
      paddingBottom: 0,
    },
    bottomSlot: {
      height: 4,
      marginTop: spacing.sm,
      marginHorizontal: -spacing.md,
      marginBottom: -spacing.sm,
    },
    progressFill: {
      position: 'absolute',
      left: 0,
      top: 0,
      height: 4,
      backgroundColor: theme.text.accent,
      shadowColor: theme.text.accent,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 1,
      shadowRadius: 6,
    },
    resultLine: {
      height: 4,
      width: '100%',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.xs,
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      flexShrink: 0,
    },
    dotConnected: { backgroundColor: theme.status.running },
    dotDisconnected: { backgroundColor: theme.status.failed },
    label: {
      color: theme.text.primary,
      fontSize: font.base,
      fontWeight: '600',
      flex: 1,
    },
    iconGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      flexShrink: 0,
    },
    iconBtn: {
      width: 32,
      height: 32,
      borderRadius: radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconBtnDisabled: {
      opacity: 0.4,
    },
    url: {
      color: theme.text.secondary,
      fontSize: font.xs,
      fontFamily: 'monospace',
      paddingLeft: 16,
      marginBottom: 2,
    },
    meta: {
      color: theme.text.secondary,
      fontSize: font.xs,
      paddingLeft: 16,
      paddingBottom: spacing.xs,
    },
  })
}
