import React, { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable } from 'react-native'
import { Cloud, ListDashes } from 'phosphor-react-native'
import { wsManager } from '@/services/ws-client'
import { useServersStore } from '@/stores/servers'
import { ServersManageModal } from '@/components/servers/ServersManageModal'
import { dark, font, radius, spacing } from '@/constants/theme'

interface Props {
  visible: boolean
  onClose: () => void
}

type WSStatus = 'connecting' | 'connected' | 'disconnected'

function useServerStatuses(serverIds: string[]) {
  const [statuses, setStatuses] = useState<Record<string, WSStatus>>(() => {
    const init: Record<string, WSStatus> = {}
    for (const id of serverIds) init[id] = wsManager.status(id)
    return init
  })

  useEffect(() => {
    // Sync current statuses on mount / when serverIds change
    setStatuses((prev) => {
      const next = { ...prev }
      for (const id of serverIds) next[id] = wsManager.status(id)
      return next
    })

    const unsub = wsManager.onAnyStatusChange((serverId, s) => {
      setStatuses((prev) => ({ ...prev, [serverId]: s }))
    })
    return unsub
  }, [serverIds])

  return statuses
}

function StatusRow({
  label,
  url,
  status,
}: {
  label: string
  url: string
  status: WSStatus
}) {
  const isConnected = status === 'connected'
  const isConnecting = status === 'connecting'

  const dotColor = isConnected
    ? dark.status.running
    : isConnecting
      ? dark.status.waiting
      : dark.status.failed

  const statusLabel = isConnected ? 'Connected' : isConnecting ? 'Connecting…' : 'Disconnected'

  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <Text style={styles.serverLabel} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.serverUrl} numberOfLines={1}>
          {url}
        </Text>
      </View>
      <View style={styles.rowRight}>
        <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
        <Text style={[styles.statusText, { color: dotColor }]}>{statusLabel}</Text>
      </View>
    </View>
  )
}

export function ServerStatusModal({ visible, onClose }: Props) {
  const activeServerIds = useServersStore((s) => s.activeServerIds)
  const servers = useServersStore((s) => s.servers)
  const statuses = useServerStatuses(activeServerIds)
  const [manageOpen, setManageOpen] = useState(false)

  if (!visible) return null

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.header}>
            <Cloud size={18} color={dark.text.secondary} weight="regular" />
            <Text style={styles.title}>Server Status</Text>
            <TouchableOpacity
              onPress={() => setManageOpen(true)}
              hitSlop={8}
              style={styles.iconBtn}
              accessibilityLabel="Manage servers"
            >
              <ListDashes size={18} color={dark.text.secondary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} hitSlop={8} style={styles.iconBtn}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          {activeServerIds.length === 0 ? (
            <Text style={styles.empty}>No servers added yet.</Text>
          ) : (
            activeServerIds.map((id) => {
              const server = servers[id]
              if (!server) return null
              return (
                <StatusRow
                  key={id}
                  label={server.label || new URL(server.url).hostname}
                  url={server.url}
                  status={statuses[id] ?? 'disconnected'}
                />
              )
            })
          )}
        </Pressable>
      </Pressable>

      <ServersManageModal
        visible={manageOpen}
        onClose={() => setManageOpen(false)}
      />
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
    paddingBottom: 40,
    paddingHorizontal: spacing.md,
  },
  sheet: {
    backgroundColor: dark.bg.secondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: dark.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: dark.border,
  },
  title: {
    flex: 1,
    color: dark.text.primary,
    fontSize: font.base,
    fontWeight: '600',
  },
  iconBtn: { padding: spacing.xs },
  closeText: { color: dark.text.secondary, fontSize: font.base },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  rowLeft: { flex: 1, gap: 2 },
  serverLabel: {
    color: dark.text.primary,
    fontSize: font.sm,
    fontWeight: '500',
  },
  serverUrl: {
    color: dark.text.secondary,
    fontSize: font.xs,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusText: {
    fontSize: font.xs,
    fontWeight: '500',
  },
  empty: {
    color: dark.text.secondary,
    fontSize: font.sm,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
})
