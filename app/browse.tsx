import React, { useState, useCallback, useEffect, useMemo } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Alert,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
} from 'react-native'
import { useRouter, useLocalSearchParams, useNavigation } from 'expo-router'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { runOnJS } from 'react-native-reanimated'
import { FlashList } from '@shopify/flash-list'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useBrowse, useCreateDirectory, useStartSession } from '@/hooks/useBrowse'
import { useSessions } from '@/hooks/useSession'
import { SkeletonBox } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { NetworkError } from '@/services/api-client'
import { dark, font, radius, spacing } from '@/constants/theme'

const MAX_RECENT_DIRS = 8

interface RecentDir {
  path: string
  name: string
  lastUsedAt: string
}

export default function BrowseScreen() {
  const router = useRouter()
  const { server: serverId } = useLocalSearchParams<{ server: string }>()
  const [currentPath, setCurrentPath] = useState('')
  const [newFolderName, setNewFolderName] = useState('')
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const [isRecentsOpen, setIsRecentsOpen] = useState(true)

  const { data: allSessions = [] } = useSessions()
  const recentDirs = useMemo<RecentDir[]>(() => {
    if (!serverId) return []
    const seen = new Set<string>()
    const dirs: RecentDir[] = []
    const sorted = [...allSessions]
      .filter((s) => s.serverId === serverId && s.projectPath)
      .sort((a, b) => (b.startedAt ?? '').localeCompare(a.startedAt ?? ''))
    for (const session of sorted) {
      const path = session.projectPath
      if (seen.has(path)) continue
      seen.add(path)
      dirs.push({
        path,
        name: path.split('/').filter(Boolean).pop() ?? path,
        lastUsedAt: session.startedAt,
      })
      if (dirs.length >= MAX_RECENT_DIRS) break
    }
    return dirs
  }, [allSessions, serverId])

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardWillShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height)
    })
    const hideSub = Keyboard.addListener('keyboardWillHide', () => {
      setKeyboardHeight(0)
    })
    return () => {
      showSub.remove()
      hideSub.remove()
    }
  }, [])

  const { data, isLoading, isError, error } = useBrowse(serverId ?? '', currentPath)
  const createDir = useCreateDirectory(serverId ?? '')
  const startSession = useStartSession(serverId ?? '')

  const breadcrumbs = currentPath ? currentPath.split('/') : []
  const navigation = useNavigation()

  const goBack = useCallback(() => {
    if (!currentPath) return
    const segments = currentPath.split('/')
    setCurrentPath(segments.slice(0, -1).join('/'))
    setShowNewFolder(false)
  }, [currentPath])

  // Set header back button when inside a subdirectory
  useEffect(() => {
    navigation.setOptions({
      headerLeft: currentPath
        ? () => (
            <TouchableOpacity onPress={goBack} activeOpacity={1} style={{ marginLeft: 8, paddingRight: 16 }}>
              <Text style={{ color: dark.text.accent, fontSize: font.base }}>‹ Back</Text>
            </TouchableOpacity>
          )
        : undefined,
    })
  }, [currentPath, navigation, goBack])

  // Swipe from left edge to go back
  const swipeBack = Gesture.Pan()
    .activeOffsetX(30)
    .failOffsetY([-20, 20])
    .hitSlop({ left: 0, width: 40 })
    .onEnd((e) => {
      if (e.translationX > 80 && currentPath) {
        runOnJS(goBack)()
      }
    })

  const navigateTo = useCallback((path: string) => {
    setCurrentPath(path)
    setShowNewFolder(false)
  }, [])

  const navigateToBreadcrumb = useCallback((index: number) => {
    if (index < 0) {
      setCurrentPath('')
    } else {
      const segments = currentPath.split('/')
      setCurrentPath(segments.slice(0, index + 1).join('/'))
    }
    setShowNewFolder(false)
  }, [currentPath])

  const handleCreateFolder = useCallback(() => {
    const name = newFolderName.trim()
    if (!name) return
    createDir.mutate(
      { parentPath: currentPath, name },
      {
        onSuccess: () => {
          setNewFolderName('')
          setShowNewFolder(false)
        },
        onError: (err) => {
          Alert.alert('Error', err.message)
        },
      },
    )
  }, [currentPath, newFolderName, createDir])

  const handleStartSession = useCallback(() => {
    const displayName = currentPath ? currentPath.split('/').pop() : '~'
    startSession.mutate(
      { path: currentPath, projectName: displayName },
      {
        onSuccess: (session) => {
          router.dismiss()
          router.push(`/session/${session.id}?server=${serverId}`)
        },
        onError: (err) => {
          Alert.alert('Failed to start session', err.message)
        },
      },
    )
  }, [currentPath, serverId, startSession, router])

  const handleStartFromRecent = useCallback(
    (dir: RecentDir) => {
      startSession.mutate(
        { path: dir.path, projectName: dir.name },
        {
          onSuccess: (session) => {
            router.dismiss()
            router.push(`/session/${session.id}?server=${serverId}`)
          },
          onError: (err) => {
            Alert.alert('Failed to start session', err.message)
          },
        },
      )
    },
    [serverId, startSession, router],
  )

  const renderItem = useCallback(
    ({ item }: { item: { name: string } }) => {
      const childPath = currentPath ? `${currentPath}/${item.name}` : item.name
      return (
        <TouchableOpacity style={styles.row} onPress={() => navigateTo(childPath)}>
          <Text style={styles.folderIcon}>📁</Text>
          <Text style={styles.dirName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      )
    },
    [currentPath, navigateTo],
  )

  const isBrowseNotConfigured = isError && (
    (error instanceof NetworkError && error.code === 'BROWSE_ROOT_NOT_SET') ||
    error?.message?.includes('not configured')
  )

  return (
    <GestureDetector gesture={swipeBack}>
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Breadcrumbs */}
      <View style={styles.breadcrumbs}>
        <TouchableOpacity onPress={() => navigateToBreadcrumb(-1)}>
          <Text style={[styles.crumb, currentPath === '' && styles.crumbActive]}>~</Text>
        </TouchableOpacity>
        {breadcrumbs.map((segment, i) => (
          <React.Fragment key={i}>
            <Text style={styles.crumbSeparator}>/</Text>
            <TouchableOpacity onPress={() => navigateToBreadcrumb(i)}>
              <Text style={[styles.crumb, i === breadcrumbs.length - 1 && styles.crumbActive]}>
                {segment}
              </Text>
            </TouchableOpacity>
          </React.Fragment>
        ))}
      </View>

      {/* Recent directories accordion (only when this server has prior sessions) */}
      {recentDirs.length > 0 ? (
        <View style={styles.recents}>
          <TouchableOpacity
            style={styles.recentsHeader}
            onPress={() => setIsRecentsOpen((open) => !open)}
            accessibilityRole="button"
            accessibilityLabel={
              isRecentsOpen ? 'Hide recent directories' : 'Show recent directories'
            }
          >
            <Text style={styles.recentsHeaderText}>
              Recent directories ({recentDirs.length})
            </Text>
            <Text style={styles.recentsChevron}>{isRecentsOpen ? '▾' : '▸'}</Text>
          </TouchableOpacity>
          {isRecentsOpen ? (
            <View style={styles.recentsList}>
              {recentDirs.map((dir) => (
                <TouchableOpacity
                  key={dir.path}
                  style={styles.recentRow}
                  onPress={() => handleStartFromRecent(dir)}
                  disabled={startSession.isPending}
                >
                  <Text style={styles.recentIcon}>🕘</Text>
                  <View style={styles.recentTextWrap}>
                    <Text style={styles.recentName} numberOfLines={1}>
                      {dir.name}
                    </Text>
                    <Text style={styles.recentPath} numberOfLines={1}>
                      {dir.path}
                    </Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Directory list */}
      <View style={styles.listContainer}>
        {isLoading ? (
          <View style={styles.skeletons}>
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonBox key={i} height={44} style={{ marginBottom: spacing.sm }} />
            ))}
          </View>
        ) : isBrowseNotConfigured ? (
          <EmptyState
            title="Browsing not configured"
            subtitle="Set browseRoot on your server to enable file browsing."
          />
        ) : isError ? (
          <EmptyState title="Unable to load directories" subtitle="Check that the server is running and reachable." />
        ) : data?.directories.length === 0 ? (
          <EmptyState title="Empty directory" subtitle="No subdirectories here." />
        ) : (
          <FlashList
            data={data?.directories ?? []}
            renderItem={renderItem}
            keyExtractor={(item) => item.name}
          />
        )}
      </View>

      {/* Footer: toggles between normal mode and new-folder mode */}
      {showNewFolder ? (
        <View style={[styles.footer, keyboardHeight > 0 && { paddingBottom: keyboardHeight }]}>
          <TouchableOpacity
            style={styles.newFolderToggle}
            onPress={() => setShowNewFolder(false)}
          >
            <Text style={styles.newFolderToggleText}>Cancel</Text>
          </TouchableOpacity>
          <TextInput
            style={[styles.newFolderInput, { flex: 1 }]}
            value={newFolderName}
            onChangeText={setNewFolderName}
            placeholder="Folder name"
            placeholderTextColor={dark.text.secondary}
            autoFocus
            onSubmitEditing={handleCreateFolder}
          />
          <TouchableOpacity style={styles.newFolderBtn} onPress={handleCreateFolder}>
            {createDir.isPending ? (
              <ActivityIndicator size="small" color={dark.text.accent} />
            ) : (
              <Text style={styles.newFolderBtnText}>Create</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.newFolderToggle}
            onPress={() => setShowNewFolder(true)}
          >
            <Text style={styles.newFolderToggleText}>New Folder</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.startBtn, startSession.isPending && styles.startBtnDisabled]}
            onPress={handleStartSession}
            disabled={startSession.isPending}
          >
            {startSession.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.startBtnText}>
                Start Session Here
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
    </GestureDetector>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: dark.bg.primary,
  },
  breadcrumbs: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: dark.border,
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  crumb: {
    color: dark.text.accent,
    fontSize: font.sm,
  },
  crumbActive: {
    color: dark.text.primary,
    fontWeight: '600',
  },
  crumbSeparator: {
    color: dark.text.secondary,
    fontSize: font.sm,
  },
  listContainer: {
    flex: 1,
  },
  recents: {
    borderBottomWidth: 1,
    borderBottomColor: dark.border,
  },
  recentsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: dark.bg.secondary,
  },
  recentsHeaderText: {
    color: dark.text.secondary,
    fontSize: font.xs,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  recentsChevron: {
    color: dark.text.secondary,
    fontSize: font.sm,
  },
  recentsList: {
    paddingVertical: spacing.xs,
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  recentIcon: {
    fontSize: 16,
    marginRight: spacing.md,
  },
  recentTextWrap: {
    flex: 1,
  },
  recentName: {
    color: dark.text.primary,
    fontSize: font.base,
  },
  recentPath: {
    color: dark.text.secondary,
    fontSize: font.xs,
    marginTop: 2,
  },
  skeletons: {
    padding: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: dark.border,
  },
  folderIcon: {
    fontSize: 20,
    marginRight: spacing.md,
  },
  dirName: {
    flex: 1,
    color: dark.text.primary,
    fontSize: font.base,
  },
  chevron: {
    color: dark.text.secondary,
    fontSize: font.xl,
    marginLeft: spacing.sm,
  },
  newFolderInput: {
    flex: 1,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: dark.bg.card,
    paddingHorizontal: spacing.md,
    color: dark.text.primary,
    fontSize: font.base,
  },
  newFolderBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: dark.bg.card,
    height: 40,
    justifyContent: 'center',
  },
  newFolderBtnText: {
    color: dark.text.accent,
    fontSize: font.sm,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: dark.border,
    gap: spacing.md,
  },
  newFolderToggle: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  newFolderToggleText: {
    color: dark.text.accent,
    fontSize: font.sm,
  },
  startBtn: {
    flex: 1,
    backgroundColor: dark.text.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  startBtnDisabled: {
    opacity: 0.6,
  },
  startBtnText: {
    color: '#fff',
    fontSize: font.base,
    fontWeight: '600',
  },
})
