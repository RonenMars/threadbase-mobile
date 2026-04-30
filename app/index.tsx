import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  AppState,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useEagerSessions } from '@/hooks/useSession'
import { useEagerConversations } from '@/hooks/useConversations'
import { useServersStore } from '@/stores/servers'
import { useSettingsStore } from '@/stores/settings'
import { wsManager } from '@/services/ws-client'
import { ProjectHubList } from '@/components/sessions/hub/ProjectHubList'
import { ConversationList } from '@/components/conversation/ConversationList'
import { ClassicSessionsList } from '@/components/sessions/ClassicSessionsList'
import { ServerFilterSheet, type SortType } from '@/components/servers/ServerFilterSheet'
import { SortSheet } from '@/components/servers/SortSheet'
import { FAB } from '@/components/ui/FAB'
import { AvatarMenu } from '@/components/ui/AvatarMenu'
import { NewSessionServerPicker } from '@/components/servers/NewSessionServerPicker'
import { dark, font, spacing } from '@/constants/theme'
import type { MultiSession, SessionStatus } from '@/types/api'
import type { SortBy, SortOrder } from '@/types/ui'

const ALL_STATUSES: SessionStatus[] = ['running', 'waiting_input', 'completed', 'failed', 'idle']

type ClassicTab = 'sessions' | 'history'

function lastActivityMs(s: MultiSession): number {
  if (s.completedAt) return Date.parse(s.completedAt)
  return Date.parse(s.startedAt) + (s.elapsedMs ?? 0)
}

export default function ProjectsHub() {
  const router = useRouter()
  const sessionsLayout = useSettingsStore((s) => s.sessionsLayout)
  const activeServerIds = useServersStore((s) => s.activeServerIds)
  const displayedServerIds = useServersStore((s) => s.displayedServerIds)
  const servers = useServersStore((s) => s.servers)

  // Connection status
  const [connectedCount, setConnectedCount] = useState(0)
  useEffect(() => {
    const updateCount = () => {
      let count = 0
      for (const id of activeServerIds) {
        if (wsManager.status(id) === 'connected') count++
      }
      setConnectedCount(count)
    }
    updateCount()
    const unsub = wsManager.onAnyStatusChange(() => updateCount())
    return unsub
  }, [activeServerIds])

  const serverCount = activeServerIds.length
  const allConnected = connectedCount === serverCount && serverCount > 0
  const someConnected = connectedCount > 0
  const connectionDotColor = allConnected
    ? dark.status.running
    : someConnected
      ? dark.status.waiting
      : dark.status.failed

  // Header controls
  const [searchOpen, setSearchOpen] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [sortOpen, setSortOpen] = useState(false)
  const [pickerVisible, setPickerVisible] = useState(false)

  // Sort state (hub mode)
  const [sortBy, setSortBy] = useState<SortBy>('lastActivity')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const isSortActive = sortBy !== 'lastActivity' || sortOrder !== 'desc'

  // Filter state (sessions)
  const [selectedStatuses, setSelectedStatuses] = useState<SessionStatus[]>(ALL_STATUSES)
  const [sortType, setSortType] = useState<SortType>('lastActivity')
  const isFilterActive =
    selectedStatuses.length < ALL_STATUSES.length ||
    (activeServerIds.length > 1 && displayedServerIds.length < activeServerIds.length)

  // Classic tab
  const [classicTab, setClassicTab] = useState<ClassicTab>('sessions')

  // Sessions data
  const { sessions, isDone: sessionsDone, isCounting, refetch: refetchSessions } = useEagerSessions()
  const [manualRefreshing, setManualRefreshing] = useState(false)

  const handleSessionsRefresh = async () => {
    setManualRefreshing(true)
    await refetchSessions()
    setManualRefreshing(false)
  }

  const visibleSessions = useMemo(() => {
    const filtered = sessions.filter(
      (session) =>
        session.source !== 'discovered' &&
        displayedServerIds.includes(session.serverId) &&
        selectedStatuses.includes(session.status),
    )
    if (sortType === 'lastActivity') {
      return filtered.sort((a, b) => lastActivityMs(b) - lastActivityMs(a))
    }
    return filtered.sort((a, b) => (b.startedAt ?? '').localeCompare(a.startedAt ?? ''))
  }, [sessions, displayedServerIds, selectedStatuses, sortType])

  // Conversations data
  const [refreshEpoch, setRefreshEpoch] = useState(0)
  const [convLoaderMode, setConvLoaderMode] = useState<'full' | 'minimal'>('full')
  const nextLoaderModeRef = useRef<'full' | 'minimal'>('minimal')

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        nextLoaderModeRef.current = 'full'
      }
    })
    return () => sub.remove()
  }, [])

  const handleConvRefresh = useCallback(() => {
    setConvLoaderMode('full')
    setRefreshEpoch((e) => e + 1)
  }, [])

  const { conversations, loaded: convLoaded, total: convTotal, isDone: convDone, isCounting: convCounting } =
    useEagerConversations(undefined, refreshEpoch)

  const showConvProgress = !convDone && convLoaderMode === 'full'

  // FAB
  const handleFABPress = () => {
    if (activeServerIds.length === 0) return
    if (activeServerIds.length === 1) {
      router.push(`/browse?server=${activeServerIds[0]}`)
      return
    }
    setPickerVisible(true)
  }

  const startSessionOn = (serverId: string) => {
    setPickerVisible(false)
    router.push(`/browse?server=${serverId}`)
  }

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      {/* Header */}
      <View style={styles.header}>
        <AvatarMenu onOpenServerFilter={() => setFilterOpen(true)} />
        <Text style={styles.headerTitle}>Projects</Text>
        <View style={styles.headerRight}>
          <View style={[styles.connectionDot, { backgroundColor: connectionDotColor }]} />
          <TouchableOpacity
            onPress={() => setSearchOpen((v) => !v)}
            hitSlop={8}
            style={[styles.headerButton, searchOpen && styles.headerButtonActive]}
          >
            <Text style={[styles.headerButtonText, searchOpen && styles.headerButtonTextActive]}>
              🔍
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setFilterOpen(true)}
            hitSlop={8}
            style={[styles.headerButton, isFilterActive && styles.headerButtonActive]}
          >
            <Text style={[styles.headerButtonText, isFilterActive && styles.headerButtonTextActive]}>
              {isFilterActive ? '⫡●' : '⫡'}
            </Text>
            {isFilterActive ? <View style={styles.activeDot} /> : null}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setSortOpen(true)}
            hitSlop={8}
            style={[styles.headerButton, isSortActive && styles.headerButtonActive]}
          >
            <Text style={[styles.headerButtonText, isSortActive && styles.headerButtonTextActive]}>
              ↕
            </Text>
            {isSortActive ? <View style={styles.activeDot} /> : null}
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      {sessionsLayout === 'hub' ? (
        <ProjectHubList
          sessions={sessions}
          conversations={conversations}
          sortBy={sortBy}
          sortOrder={sortOrder}
          refreshing={manualRefreshing}
          onRefresh={handleSessionsRefresh}
          searchOpen={searchOpen}
        />
      ) : (
        <View style={styles.classicContainer}>
          {/* Segmented control */}
          <View style={styles.segmentRow}>
            <TouchableOpacity
              style={[styles.segmentTab, classicTab === 'sessions' && styles.segmentTabActive]}
              onPress={() => setClassicTab('sessions')}
            >
              <Text style={[styles.segmentText, classicTab === 'sessions' && styles.segmentTextActive]}>
                ⚡ Sessions
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.segmentTab, classicTab === 'history' && styles.segmentTabActive]}
              onPress={() => setClassicTab('history')}
            >
              <Text style={[styles.segmentText, classicTab === 'history' && styles.segmentTextActive]}>
                📚 History
              </Text>
            </TouchableOpacity>
          </View>

          {/* Classic sessions */}
          {classicTab === 'sessions' ? (
            <ClassicSessionsList
              sessions={visibleSessions}
              refreshing={manualRefreshing}
              onRefresh={handleSessionsRefresh}
            />
          ) : (
            /* Classic history */
            <ConversationList
              conversations={conversations}
              onRefresh={handleConvRefresh}
              refreshing={showConvProgress}
              onEndReached={() => {}}
              searchQuery=""
              onSearchChange={() => {}}
              isLoadingInitial={false}
              isFetchingNextPage={false}
              loadingProgress={
                showConvProgress ? { loaded: convLoaded, total: convTotal, isCounting: convCounting } : null
              }
            />
          )}
        </View>
      )}

      {/* FAB */}
      <FAB onPress={handleFABPress} />

      {/* Sheets */}
      <ServerFilterSheet
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        selectedStatuses={selectedStatuses}
        onChangeStatuses={setSelectedStatuses}
        sortType={sortType}
        onChangeSortType={setSortType}
      />
      <SortSheet
        visible={sortOpen}
        onClose={() => setSortOpen(false)}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onChangeSortBy={setSortBy}
        onChangeSortOrder={setSortOrder}
      />
      <NewSessionServerPicker
        visible={pickerVisible}
        serverIds={activeServerIds}
        servers={servers}
        onPick={startSessionOn}
        onClose={() => setPickerVisible(false)}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: dark.bg.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  headerTitle: {
    flex: 1,
    color: dark.text.primary,
    fontSize: font.lg,
    fontWeight: '600',
    textAlign: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  connectionDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: spacing.xs,
  },
  headerButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  headerButtonActive: {
    backgroundColor: 'rgba(88,166,255,0.12)',
  },
  headerButtonText: {
    fontSize: font.base,
    color: dark.text.secondary,
  },
  headerButtonTextActive: {
    color: dark.text.accent,
  },
  activeDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: dark.text.accent,
  },
  classicContainer: {
    flex: 1,
  },
  segmentRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: dark.bg.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: dark.border,
    overflow: 'hidden',
  },
  segmentTab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
  },
  segmentTabActive: {
    backgroundColor: dark.bg.secondary,
  },
  segmentText: {
    color: dark.text.secondary,
    fontSize: font.sm,
    fontWeight: '500',
  },
  segmentTextActive: {
    color: dark.text.primary,
    fontWeight: '600',
  },
})
