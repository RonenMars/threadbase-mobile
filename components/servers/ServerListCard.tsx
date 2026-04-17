import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { dark, font, radius, spacing } from '@/constants/theme'
import type { ServerConfig } from '@/types/api'

interface Props {
  server: ServerConfig
  onRemove: (serverId: string) => void
}

export function ServerListCard({ server, onRemove }: Props) {
  const handleRemove = () => {
    Alert.alert(
      'Remove Server',
      `Disconnect from ${server.label || server.url}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => onRemove(server.id),
        },
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

      <TouchableOpacity style={styles.removeBtn} onPress={handleRemove}>
        <Text style={styles.removeText}>Remove</Text>
      </TouchableOpacity>
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    paddingBottom: 0,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotConnected: {
    backgroundColor: dark.status.running,
  },
  dotDisconnected: {
    backgroundColor: dark.status.idle,
  },
  label: {
    color: dark.text.primary,
    fontSize: font.base,
    fontWeight: '600',
    flex: 1,
  },
  url: {
    color: dark.text.secondary,
    fontSize: font.xs,
    fontFamily: 'monospace',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
  },
  meta: {
    color: dark.text.secondary,
    fontSize: font.xs,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
  },
  removeBtn: {
    borderTopWidth: 1,
    borderTopColor: dark.border,
    padding: spacing.md,
    minHeight: 44,
    justifyContent: 'center',
  },
  removeText: {
    color: dark.status.failed,
    fontSize: font.base,
    fontWeight: '500',
  },
})
