import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  Alert,
  ScrollView,
  RefreshControl,
  Animated,
  Easing,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Cloud, DotsThreeVertical, Trash, PencilSimple, ArrowsClockwise } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import i18n from '@/lib/i18n'
import { wsManager } from '@/services/ws-client'
import { useServersStore } from '@/stores/servers'
import { useServerFetchStatusStore, type ServerFetchStatusEntry } from '@/stores/serverFetchStatus'
import { ServerEditModal } from '@/components/servers/ServerEditModal'
import { ServerErrorModal } from '@/components/servers/ServerErrorModal'
import { AddServerButton } from '@/components/servers/AddServerButton'
import { type Theme, font, radius, spacing } from '@/constants/theme'
import { useTheme, useIsGlass } from '@/contexts/ThemeContext'
import { GlassFill } from '@/components/ui/GlassFill'
import { useDirectionStyle } from '@/lib/rtl'

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
  isRefreshing,
  isMenuOpen,
  onRefresh,
  onOpenMenu,
  theme,
}: {
  label: string
  url: string
  status: WSStatus
  fetchStatus?: ServerFetchStatusEntry
  isRefreshing: boolean
  isMenuOpen: boolean
  onRefresh: () => void
  onOpenMenu: () => void
  theme: Theme
}) {
  const { t } = useTranslation('servers')
  const styles = makeStyles(theme)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const animValue = useMemo(() => new Animated.Value(0), [])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const rotate = useMemo(() => animValue.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }), [])
  const spinLoop = useRef<Animated.CompositeAnimation | null>(null)
  const [errorHeight, setErrorHeight] = useState<number | null>(null)
  const [statusWidth, setStatusWidth] = useState<number | null>(null)

  useEffect(() => {
    if (isRefreshing) {
      animValue.setValue(0)
      spinLoop.current = Animated.loop(
        Animated.timing(animValue, {
          toValue: 1,
          duration: 800,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      )
      spinLoop.current.start()
    } else {
      spinLoop.current?.stop()
      animValue.setValue(0)
    }
  }, [isRefreshing, animValue])

  const fetchFailed = fetchStatus?.status === 'error'

  const isConnected = status === 'connected'
  const isConnecting = status === 'connecting'

  const healthy = isConnected && !fetchFailed
  const dotColor = healthy
    ? theme.status.running
    : isConnecting && !fetchFailed
      ? theme.status.waiting
      : theme.status.failed

  let statusLabel: string
  if (fetchFailed && !isConnected) statusLabel = t('status.unreachable')
  else if (fetchFailed) statusLabel = t('status.fetchFailed')
  else if (isConnected) statusLabel = t('status.connected')
  else if (isConnecting) statusLabel = t('status.connecting')
  else statusLabel = t('status.disconnected')

  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <Text style={styles.serverLabel} numberOfLines={1}>{label}</Text>
        <Text style={styles.serverUrl} numberOfLines={1}>{url}</Text>
        {fetchFailed && fetchStatus?.error ? (
          isRefreshing
            ? <View style={[styles.skeletonBar, { width: '80%', marginTop: 2, height: errorHeight ?? 14 }]} />
            : (
              <Text
                style={styles.errorDetail}
                numberOfLines={2}
                onLayout={(e) => setErrorHeight(e.nativeEvent.layout.height)}
              >
                {fetchStatus.error}
              </Text>
            )
        ) : null}
      </View>
      <View style={styles.rowRight}>
        <TouchableOpacity onPress={onRefresh} disabled={isRefreshing} hitSlop={8} style={styles.refreshIcon}>
          <Animated.View style={[styles.refreshIconInner, { transform: [{ rotate }] }]}>
            <ArrowsClockwise size={14} color={theme.text.primary} />
          </Animated.View>
        </TouchableOpacity>
        {isRefreshing ? (
          <View style={[styles.skeletonBar, { width: statusWidth ?? 40 }]} />
        ) : (
          <View
            style={styles.statusGroup}
            onLayout={(e) => setStatusWidth(e.nativeEvent.layout.width)}
          >
            <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
            <Text style={[styles.statusText, { color: dotColor }]}>{statusLabel}</Text>
          </View>
        )}
        <TouchableOpacity
          onPress={onOpenMenu}
          hitSlop={8}
          style={[styles.dotsBtn, isMenuOpen && styles.dotsBtnActive]}
          accessibilityLabel={t('statusModal.optionsLabel')}
          testID="server-row-dots-btn"
        >
          <DotsThreeVertical size={18} color={theme.text.secondary} weight="bold" />
        </TouchableOpacity>
      </View>
    </View>
  )
}

interface ServerMenuModalProps {
  visible: boolean
  serverLabel: string
  onClose: () => void
  onRefresh: () => void
  onEdit: () => void
  onDelete: () => void
}

function ServerMenuModal({ visible, serverLabel, onClose, onRefresh, onEdit, onDelete }: ServerMenuModalProps) {
  const theme = useTheme()
  const styles = makeStyles(theme)
  const directionStyle = useDirectionStyle()
  const { t } = useTranslation('servers')

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={[styles.dropBackdrop, directionStyle]} onPress={onClose}>
        <Pressable style={styles.dropSheet} onPress={() => {}}>
          <Text style={styles.dropTitle} numberOfLines={1}>{serverLabel}</Text>
          <View style={styles.dropDivider} />
          <TouchableOpacity style={styles.dropItem} onPress={onEdit}>
            <PencilSimple size={16} color={theme.text.accent} />
            <Text style={[styles.dropItemText, { color: theme.text.accent }]}>{t('statusModal.menuEdit')}</Text>
          </TouchableOpacity>
          <View style={styles.dropDivider} />
          <TouchableOpacity style={styles.dropItem} onPress={onRefresh}>
            <ArrowsClockwise size={16} color={theme.text.secondary} />
            <Text style={styles.dropItemText}>{t('statusModal.menuRefresh')}</Text>
          </TouchableOpacity>
          <View style={styles.dropDivider} />
          <TouchableOpacity style={styles.dropItem} onPress={onDelete}>
            <Trash size={16} color={theme.text.danger} />
            <Text style={[styles.dropItemText, { color: theme.text.danger }]}>{t('statusModal.menuDelete')}</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

export function ServersStatusModal({ visible, onClose }: Props) {
  const { t } = useTranslation('servers')
  const theme = useTheme()
  const isGlass = useIsGlass()
  const styles = makeStyles(theme)
  const directionStyle = useDirectionStyle()
  const router = useRouter()
  const { servers, activeServerIds, removeServer, refreshServerInfo } = useServersStore()
  const statuses = useServerStatuses(activeServerIds)
  const fetchStatuses = useServerFetchStatusStore((s) => s.statuses)
  const [editServerId, setEditServerId] = useState<string | null | 'new'>(null)
  const [errorServerId, setErrorServerId] = useState<string | null>(null)
  const [refreshingIds, setRefreshingIds] = useState<Set<string>>(new Set())
  const [isPullRefreshing, setIsPullRefreshing] = useState(false)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  const menuServer = openMenuId ? servers[openMenuId] : null
  const modalTitle = activeServerIds.length === 1 ? t('statusModal.titleSingle') : t('statusModal.titleMultiple')

  const handleRemove = (serverId: string) => {
    const server = servers[serverId]
    Alert.alert(
      i18n.t('servers:dialog.removeTitle'),
      i18n.t('servers:dialog.removeMessage', { server: server?.label || server?.url }),
      [
        { text: i18n.t('common:button.cancel'), style: 'cancel' },
        {
          text: i18n.t('servers:dialog.removeConfirm'),
          style: 'destructive',
          onPress: async () => {
            await removeServer(serverId)
            if (activeServerIds.length <= 1) {
              onClose()
              router.replace('/onboarding')
            }
          },
        },
      ]
    )
  }

  const handleRefresh = async (serverId: string) => {
    setRefreshingIds((prev) => new Set(prev).add(serverId))
    await refreshServerInfo(serverId)
    setRefreshingIds((prev) => { const n = new Set(prev); n.delete(serverId); return n })
  }

  const handlePullRefresh = async () => {
    setIsPullRefreshing(true)
    await Promise.all(activeServerIds.map((id) => refreshServerInfo(id)))
    setIsPullRefreshing(false)
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={[styles.backdrop, directionStyle]} onPress={onClose}>
        <Pressable style={[styles.sheet, isGlass && styles.sheetGlass]} onPress={() => {}}>
          <GlassFill />
          <View style={styles.header}>
            <Cloud size={18} color={theme.text.secondary} weight="regular" />
            <Text style={styles.title}>
              {modalTitle}
            </Text>
            {activeServerIds.length > 3 ? (
              <View style={styles.counterBadge}>
                <Text style={styles.counterText}>{activeServerIds.length}</Text>
              </View>
            ) : null}
            <TouchableOpacity onPress={onClose} hitSlop={8} style={styles.iconBtn}>
              <Text style={styles.closeText}>{t('statusModal.close')}</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl
                refreshing={isPullRefreshing}
                onRefresh={handlePullRefresh}
                tintColor={theme.text.secondary}
              />
            }
          >
            {activeServerIds.length === 0 ? (
              <AddServerButton onPress={() => { onClose(); router.push('/settings') }} />
            ) : (
              <>
                {activeServerIds.map((id) => {
                  const server = servers[id]
                  if (!server) return null
                  return (
                    <StatusRow
                      key={id}
                      label={server.label || safeHostname(server.url)}
                      url={server.url}
                      status={statuses[id] ?? 'disconnected'}
                      fetchStatus={fetchStatuses[id]}
                      isRefreshing={refreshingIds.has(id)}
                      isMenuOpen={openMenuId === id}
                      onRefresh={() => handleRefresh(id)}
                      onOpenMenu={() => setOpenMenuId(id)}
                      theme={theme}
                    />
                  )
                })}
                <AddServerButton onPress={() => setEditServerId('new')} />
              </>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>

      {/* Nested inside this Modal so it layers on top on iOS */}
      <ServerMenuModal
        visible={openMenuId !== null}
        serverLabel={menuServer ? (menuServer.label || safeHostname(menuServer.url)) : ''}
        onClose={() => setOpenMenuId(null)}
        onRefresh={() => { const id = openMenuId!; setOpenMenuId(null); handleRefresh(id) }}
        onEdit={() => { const id = openMenuId!; setOpenMenuId(null); setEditServerId(id) }}
        onDelete={() => { const id = openMenuId!; setOpenMenuId(null); handleRemove(id) }}
      />
      <ServerEditModal
        visible={editServerId !== null}
        serverId={editServerId === 'new' ? null : editServerId}
        onClose={() => setEditServerId(null)}
      />
      <ServerErrorModal
        visible={errorServerId !== null}
        server={errorServerId ? servers[errorServerId] ?? null : null}
        onClose={() => setErrorServerId(null)}
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
      maxHeight: '75%',
    },
    sheetGlass: {
      backgroundColor: 'transparent',
      overflow: 'hidden',
    },
    scrollView: {
      flexGrow: 0,
    },
    scrollContent: {
      gap: spacing.sm,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
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
      fontSize: font.base,
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
    refreshIcon: {
      width: 14,
      height: 14,
      marginEnd: spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    refreshIconInner: {
      width: 14,
      height: 14,
      alignItems: 'center',
      justifyContent: 'center',
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
    dotsBtn: {
      width: 28,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.sm,
    },
    dotsBtnActive: {
      backgroundColor: theme.bg.card,
    },
    statusGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    skeletonBar: {
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.border,
      opacity: 0.6,
    },
    counterBadge: {
      backgroundColor: theme.bg.card,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: spacing.xs,
      paddingVertical: 2,
    },
    counterText: {
      color: theme.text.secondary,
      fontSize: font.xs,
      fontWeight: '600',
    },
    dropBackdrop: {
      flex: 1,
      // Stronger scrim under glass so the modal beneath is occluded and the
      // stacked menu stays readable.
      backgroundColor: theme.glass ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.45)',
      justifyContent: 'flex-end',
      paddingBottom: 40,
      paddingHorizontal: spacing.md,
    },
    dropSheet: {
      // A stacked popup must be opaque — a translucent menu over the (also
      // translucent) Servers Status modal lets text bleed through. Use a solid
      // dark surface under glass instead of the see-through bg.card token.
      backgroundColor: theme.glass?.opaqueSurface ?? theme.bg.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: 'hidden',
    },
    dropTitle: {
      color: theme.text.secondary,
      fontSize: font.sm,
      fontWeight: '500',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
    },
    dropDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.border,
    },
    dropItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
    },
    dropItemText: {
      color: theme.text.primary,
      fontSize: font.base,
      fontWeight: '500',
    },
  })
}
