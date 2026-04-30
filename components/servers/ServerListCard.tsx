import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { Trash, PencilSimple, ArrowsClockwise, XCircle } from 'phosphor-react-native'
import { dark, font, radius, spacing } from '@/constants/theme'
import type { ServerConfig } from '@/types/api'

interface Props {
  server: ServerConfig
  isRefreshing: boolean
  onRemove: (serverId: string) => void
  onEdit: (serverId: string) => void
  onRefresh: (serverId: string) => void
  onViewError: (serverId: string) => void
}

export function ServerListCard({ server, isRefreshing, onRemove, onEdit, onRefresh, onViewError }: Props) {
  const handleRemove = () => {
    Alert.alert(
      'Remove Server',
      `Disconnect from ${server.label || server.url}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => onRemove(server.id) },
      ]
    )
  }

  return (
    <View style={styles.card}>
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
              <XCircle size={20} color={dark.text.danger} weight="fill" />
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={handleRemove}
            hitSlop={4}
            accessibilityLabel="Delete server"
          >
            <Trash size={20} color={dark.text.danger} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => onEdit(server.id)}
            hitSlop={4}
            accessibilityLabel="Edit server"
          >
            <PencilSimple size={20} color={dark.text.accent} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconBtn, isRefreshing && styles.iconBtnDisabled]}
            onPress={() => !isRefreshing && onRefresh(server.id)}
            hitSlop={4}
            accessibilityLabel="Refresh server info"
          >
            <ArrowsClockwise size={20} color={dark.text.secondary} />
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.url} numberOfLines={1}>{server.url}</Text>

      {server.serverInfo ? (
        <Text style={styles.meta}>
          {server.serverInfo.machineName} · {server.serverInfo.platform} · v{server.serverInfo.version}
        </Text>
      ) : (
        <Text style={styles.meta}>
          {server.isConnected ? 'Connected' : 'Disconnected'}
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: dark.bg.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: dark.border,
    overflow: 'hidden',
    marginBottom: spacing.sm,
    padding: spacing.md,
    paddingBottom: spacing.sm,
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
  dotConnected: { backgroundColor: dark.status.running },
  dotDisconnected: { backgroundColor: dark.status.failed },
  label: {
    color: dark.text.primary,
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
    color: dark.text.secondary,
    fontSize: font.xs,
    fontFamily: 'monospace',
    paddingLeft: 16,
    marginBottom: 2,
  },
  meta: {
    color: dark.text.secondary,
    fontSize: font.xs,
    paddingLeft: 16,
    paddingBottom: spacing.xs,
  },
})
