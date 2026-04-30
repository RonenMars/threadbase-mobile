import React, { useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  Pressable,
  RefreshControl,
} from 'react-native'
import { useRouter } from 'expo-router'
import { X } from 'phosphor-react-native'
import { useServersStore } from '@/stores/servers'
import { ServerListCard } from '@/components/servers/ServerListCard'
import { ServerErrorModal } from '@/components/servers/ServerErrorModal'
import { ServerEditModal } from '@/components/servers/ServerEditModal'
import { dark, font, radius, spacing } from '@/constants/theme'

interface Props {
  visible: boolean
  onClose: () => void
}

export function ServersManageModal({ visible, onClose }: Props) {
  const router = useRouter()
  const { servers, activeServerIds, removeServer, refreshServerInfo } = useServersStore()
  const [refreshingServerIds, setRefreshingServerIds] = useState<Set<string>>(new Set())
  const [isPullRefreshing, setIsPullRefreshing] = useState(false)
  const [errorServerId, setErrorServerId] = useState<string | null>(null)
  const [editServerId, setEditServerId] = useState<string | null | 'new'>(null)

  const handleRemoveServer = async (serverId: string) => {
    await removeServer(serverId)
    if (activeServerIds.length <= 1) {
      onClose()
      router.replace('/onboarding')
    }
  }

  const handleRefreshServer = async (serverId: string) => {
    setRefreshingServerIds((prev) => new Set(prev).add(serverId))
    await refreshServerInfo(serverId)
    setRefreshingServerIds((prev) => {
      const next = new Set(prev)
      next.delete(serverId)
      return next
    })
  }

  const handlePullRefresh = async () => {
    setIsPullRefreshing(true)
    await Promise.all(activeServerIds.map((id) => refreshServerInfo(id)))
    setIsPullRefreshing(false)
  }

  if (!visible) return null

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.header}>
          <Text style={styles.title}>Servers</Text>
          <TouchableOpacity onPress={onClose} hitSlop={8} style={styles.closeBtn}>
            <X size={20} color={dark.text.secondary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={isPullRefreshing}
              onRefresh={handlePullRefresh}
              tintColor={dark.text.secondary}
            />
          }
        >
          {activeServerIds.map((id) => {
            const server = servers[id]
            if (!server) return null
            return (
              <ServerListCard
                key={id}
                server={server}
                isRefreshing={refreshingServerIds.has(id)}
                onRemove={handleRemoveServer}
                onEdit={(sid) => setEditServerId(sid)}
                onRefresh={handleRefreshServer}
                onViewError={(sid) => setErrorServerId(sid)}
              />
            )
          })}
          <TouchableOpacity
            style={styles.addServerBtn}
            onPress={() => setEditServerId('new')}
          >
            <Text style={styles.addServerText}>+ Add Server</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <ServerErrorModal
        visible={errorServerId !== null}
        server={errorServerId ? servers[errorServerId] ?? null : null}
        onClose={() => setErrorServerId(null)}
      />
      <ServerEditModal
        visible={editServerId !== null}
        serverId={editServerId === 'new' ? null : editServerId}
        onClose={() => setEditServerId(null)}
      />
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '85%',
    backgroundColor: dark.bg.primary,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: dark.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: dark.border,
  },
  title: {
    flex: 1,
    color: dark.text.primary,
    fontSize: font.lg,
    fontWeight: '600',
  },
  closeBtn: { padding: spacing.xs },
  content: {
    padding: spacing.md,
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  addServerBtn: {
    backgroundColor: dark.bg.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: dark.border,
    borderStyle: 'dashed',
    padding: spacing.md,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  addServerText: {
    color: dark.text.accent,
    fontSize: font.base,
    fontWeight: '500',
  },
})
