import React, { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable } from 'react-native'
import { Cloud, ListDashes } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { wsManager } from '@/services/ws-client'
import { useServersStore } from '@/stores/servers'
import { useServerFetchStatusStore, type ServerFetchStatusEntry } from '@/stores/serverFetchStatus'
import { ServersManageModal } from '@/components/servers/ServersManageModal'
import { type Theme, font, radius, spacing } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'

interface Props {
  visible: boolean
  onClose: () => void
}

type WSStatus = 'connecting' | 'connected' | 'disconnected'

function safeHostname(url: string): string {
  try { return new URL(url).hostname } catch { return url.replace(/^[a-z]+:\/\//i, '').split('/')[0] || url }
}

function useServerStatuses(serverIds: string[]) {
  const [statuses, setStatuses] = useState<Record<string, WSStatus>>(() => {
    const init: Record<string, WSStatus> = {}
    for (const id of serverIds) init[id] = wsManager.status(id)
    return init
  })

  useEffect(() => {
    // Sync current statuses on mount / when serverIds change
    queueMicrotask(() => {
      setStatuses((prev) => {
        const next = { ...prev }
        for (const id of serverIds) next[id] = wsManager.status(id)
        return next
      })
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
  fetchStatus,
  theme,
}: {
  label: string
  url: string
  status: WSStatus
  fetchStatus?: ServerFetchStatusEntry
  theme: Theme
}) {
  const styles = makeStyles(theme)
  const isConnected = status === 'connected'
  const isConnecting = status === 'connecting'
  // Fetch-status defaults to ok when we haven't seen a request yet — only flip
  // bad once a real failure has been recorded by useConversations.
  const fetchFailed = fetchStatus?.status === 'error'

  const healthy = isConnected && !fetchFailed
  const dotColor = healthy
    ? theme.status.running
    : isConnecting && !fetchFailed
      ? theme.status.waiting
      : theme.status.failed

  let statusLabel: string
  if (fetchFailed && !isConnected) statusLabel = 'Unreachable'
  else if (fetchFailed) statusLabel = 'Fetch failed'
  else if (isConnected) statusLabel = 'Connected'
  else if (isConnecting) statusLabel = 'Connecting…'
  else statusLabel = 'Disconnected'

  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <Text style={styles.serverLabel} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.serverUrl} numberOfLines={1}>
          {url}
        </Text>
        {fetchFailed && fetchStatus?.error ? (
          <Text style={styles.errorDetail} numberOfLines={2}>
            {fetchStatus.error}
          </Text>
        ) : null}
      </View>
      <View style={styles.rowRight}>
        <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
        <Text style={[styles.statusText, { color: dotColor }]}>{statusLabel}</Text>
      </View>
    </View>
  )
}

export function ServerStatusModal({ visible, onClose }: Props) {
  const { t } = useTranslation('servers')
  const theme = useTheme()
  const styles = makeStyles(theme)
  const activeServerIds = useServersStore((s) => s.activeServerIds)
  const servers = useServersStore((s) => s.servers)
  const statuses = useServerStatuses(activeServerIds)
  const fetchStatuses = useServerFetchStatusStore((s) => s.statuses)
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
            <Cloud size={18} color={theme.text.secondary} weight="regular" />
            <Text style={styles.title}>{t('statusModal.title')}</Text>
            <TouchableOpacity
              onPress={() => setManageOpen(true)}
              hitSlop={8}
              style={styles.iconBtn}
              accessibilityLabel="Manage servers"
            >
              <ListDashes size={18} color={theme.text.secondary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} hitSlop={8} style={styles.iconBtn}>
              <Text style={styles.closeText}>{t('statusModal.close')}</Text>
            </TouchableOpacity>
          </View>

          {activeServerIds.length === 0 ? (
            <Text style={styles.empty}>{t('manage.empty')}</Text>
          ) : (
            activeServerIds.map((id) => {
              const server = servers[id]
              if (!server) return null
              return (
                <StatusRow
                  key={id}
                  label={server.label || safeHostname(server.url)}
                  url={server.url}
                  status={statuses[id] ?? 'disconnected'}
                  fetchStatus={fetchStatuses[id]}
                  theme={theme}
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

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'flex-end',
      paddingBottom: 40,
      paddingHorizontal: spacing.md,
    },
    sheet: {
      backgroundColor: theme.bg.secondary,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: theme.border,
      padding: spacing.md,
      gap: spacing.sm,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingBottom: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    title: {
      flex: 1,
      color: theme.text.primary,
      fontSize: font.base,
      fontWeight: '600',
    },
    iconBtn: { padding: spacing.xs },
    closeText: { color: theme.text.secondary, fontSize: font.base },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.sm,
      gap: spacing.sm,
    },
    rowLeft: { flex: 1, gap: 2 },
    serverLabel: {
      color: theme.text.primary,
      fontSize: font.sm,
      fontWeight: '500',
    },
    serverUrl: {
      color: theme.text.secondary,
      fontSize: font.xs,
    },
    errorDetail: {
      color: theme.status.failed,
      fontSize: font.xs,
      marginTop: 2,
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
      color: theme.text.secondary,
      fontSize: font.sm,
      textAlign: 'center',
      paddingVertical: spacing.md,
    },
  })
}
