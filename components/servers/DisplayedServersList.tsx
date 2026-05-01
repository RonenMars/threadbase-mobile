import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Switch } from 'react-native'
import type { ServerConfig } from '@/types/api'
import { dark, font, radius, spacing } from '@/constants/theme'

interface Props {
  activeServerIds: string[]
  servers: Record<string, ServerConfig>
  selectedServerIds: string[]
  onChange: (ids: string[]) => void
  showQuickActions?: boolean
}

function toggleServer(selectedServerIds: string[], serverId: string): string[] {
  if (selectedServerIds.includes(serverId)) {
    return selectedServerIds.filter((id) => id !== serverId)
  }
  return [...selectedServerIds, serverId]
}

export function DisplayedServersList({
  activeServerIds,
  servers,
  selectedServerIds,
  onChange,
  showQuickActions = true,
}: Props) {
  const latestServerId = activeServerIds[activeServerIds.length - 1]

  return (
    <View style={styles.container}>
      {showQuickActions ? (
        <View style={styles.quickRow}>
          <TouchableOpacity style={styles.quickButton} onPress={() => onChange(activeServerIds)}>
            <Text style={styles.quickButtonText}>All</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickButton}
            onPress={() => onChange(latestServerId ? [latestServerId] : [])}
          >
            <Text style={styles.quickButtonText}>Latest only</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickButton} onPress={() => onChange([])}>
            <Text style={styles.quickButtonText}>None</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {activeServerIds.map((id) => {
        const server = servers[id]
        if (!server) return null
        const selected = selectedServerIds.includes(id)
        return (
          <View key={id} style={styles.row}>
            <View style={styles.serverInfo}>
              <Text style={styles.serverLabel} numberOfLines={1}>
                {server.label || server.url}
              </Text>
              {server.label ? (
                <Text style={styles.serverUrl} numberOfLines={1}>
                  {server.url}
                </Text>
              ) : null}
            </View>
            <Switch
              value={selected}
              onValueChange={() => onChange(toggleServer(selectedServerIds, id))}
              trackColor={{ false: dark.border, true: dark.text.accent }}
              thumbColor="#fff"
              testID={`server-toggle-${id}`}
            />
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  quickRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  quickButton: {
    backgroundColor: dark.bg.card,
    borderColor: dark.border,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    minHeight: 38,
    justifyContent: 'center',
  },
  quickButtonText: {
    color: dark.text.secondary,
    fontSize: font.sm,
    fontWeight: '500',
  },
  row: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: dark.border,
    backgroundColor: dark.bg.card,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  serverInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  serverLabel: {
    color: dark.text.primary,
    fontSize: font.base,
    fontWeight: '500',
  },
  serverUrl: {
    color: dark.text.secondary,
    fontSize: font.xs,
  },
})
