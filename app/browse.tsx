import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
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
import { BrowseSlowBanner } from '@/components/browse/BrowseSlowBanner'
import { useLoadingStateStore } from '@/stores/loading-state'
import { font, radius, spacing, brand, type Theme } from '@/constants/theme'
import { useTheme, useIsGlass } from '@/contexts/ThemeContext'
import { GlassFill } from '@/components/ui/GlassFill'
import { CLAUDE_CODE_PROVIDER, CODEX_CLI_PROVIDER, type ProviderName } from '@/constants/providers'
import { markNavigatedToSession } from '@/lib/sessionNavGuard'

const MAX_RECENT_DIRS = 8

interface RecentDir {
  path: string
  name: string
  lastUsedAt: string
}

/**
 * Build the chat-screen URL for a freshly-created session, including the
 * `projectId` (when known) and `projectPath` (display/debug only) so the
 * downstream screen can render before the next ProjectChat refetch lands.
 */
function buildSessionRoute(
  session: { id: string; projectId?: string; projectPath?: string | null },
  serverId: string,
  opts?: { starting?: boolean },
): string {
  const params = new URLSearchParams({ server: serverId })
  if (session.projectId) params.set('projectId', session.projectId)
  if (session.projectPath) params.set('projectPath', session.projectPath)
  if (opts?.starting) params.set('starting', '1')
  return `/session/${session.id}?${params.toString()}`
}

export default function BrowseScreen() {
  const theme = useTheme()
  const isGlass = useIsGlass()
  const styles = useMemo(() => makeStyles(theme), [theme])
  const { t } = useTranslation(['browse', 'common'])
  const router = useRouter()
  const { server: serverId, path: initialPath } = useLocalSearchParams<{ server: string; path?: string }>()
  // Pre-fill cwd when the caller passes ?path=... (TreeView drill → FAB).
  // `useLocalSearchParams` always returns a string for declared keys, so an
  // omitted `path` arrives as undefined; we coalesce to '' (server default).
  const [currentPath, setCurrentPath] = useState(initialPath ?? '')
  const [newFolderName, setNewFolderName] = useState('')
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const [isRecentsOpen, setIsRecentsOpen] = useState(true)
  const [selectedProvider, setSelectedProvider] = useState<ProviderName>(CLAUDE_CODE_PROVIDER)

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
  const isBrowseSlow = useLoadingStateStore((s) => s.slowCounts.browse > 0)

  // The TreeView drill prefill passes the session's absolute cwd, which may
  // live outside the server's configured browse root (adopted sessions, demo
  // seed data, root changed after the session ran). Such a path can neither
  // be listed nor started — fall back to the browse root instead of
  // dead-ending on it. setState is deferred to a microtask so the
  // `react-hooks/set-state-in-effect` rule is satisfied (same pattern as
  // app/session/[id].tsx).
  useEffect(() => {
    if (isError && currentPath && error?.message?.includes('outside browse root')) {
      queueMicrotask(() => setCurrentPath(''))
    }
  }, [isError, error, currentPath])
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
              <Text style={{ color: theme.text.accent, fontSize: font.base }}>{t('nav.back')}</Text>
            </TouchableOpacity>
          )
        : undefined,
    })
  }, [currentPath, navigation, goBack, t, theme.text.accent])

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

  // Bug 14 fix: browse is presented as a modal (Stack.Screen
  // presentation: 'modal'). Navigating from inside the still-presented
  // modal — whether via push, replace, or dismissTo — leaves the modal
  // envelope mounted underneath, so pulling down the new session screen
  // reveals browse behind it. The framework-correct sequence is: dismiss
  // the modal, wait for the dismiss animation to fully complete, then push
  // the session route on the parent stack. native-stack emits
  // `transitionEnd` with `data.closing === true` exactly when the modal
  // teardown finishes — we listen for that one event and push then.
  const navigateToNewSession = useCallback(
    (
      session: { id: string; projectId?: string; projectPath?: string | null },
      opts?: { starting?: boolean },
    ) => {
      const target = buildSessionRoute(session, serverId ?? '', opts)
      // `transitionEnd` is a native-stack event; expo-router's useNavigation()
      // returns a base navigation type that doesn't include it in its event
      // map, hence the casts.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const unsubscribe = (navigation as any).addListener('transitionEnd', (e: { data: { closing: boolean } }) => {
        if (!e.data.closing) return
        unsubscribe()
        markNavigatedToSession(session.id)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        router.push(target as any)
      })
      router.back()
    },
    [router, navigation, serverId],
  )

  const handleStartSession = useCallback(() => {
    const displayName = currentPath ? currentPath.split('/').pop() : '~'
    startSession.mutate(
      {
        path: currentPath,
        projectName: displayName,
        ...(selectedProvider === CODEX_CLI_PROVIDER ? { provider: selectedProvider } : {}),
      },
      {
        onSuccess: (result) => {
          if (result.kind === 'ready') {
            navigateToNewSession(result.session)
            return
          }
          // Server timed out waiting for PTY readiness — dismiss browse and
          // open the session route in a loading state until session_ready.
          navigateToNewSession({ id: result.id }, { starting: true })
        },
        onError: (err) => {
          Alert.alert('Failed to start session', err.message)
        },
      },
    )
  }, [currentPath, selectedProvider, startSession, navigateToNewSession])

  const handleStartFromRecent = useCallback(
    (dir: RecentDir) => {
      startSession.mutate(
        {
          path: dir.path,
          projectName: dir.name,
          ...(selectedProvider === CODEX_CLI_PROVIDER ? { provider: selectedProvider } : {}),
        },
        {
          onSuccess: (result) => {
            if (result.kind === 'ready') {
              navigateToNewSession(result.session)
              return
            }
            navigateToNewSession({ id: result.id }, { starting: true })
          },
          onError: (err) => {
            Alert.alert('Failed to start session', err.message)
          },
        },
      )
    },
    [selectedProvider, startSession, navigateToNewSession],
  )

  const renderItem = useCallback(
    ({ item, index }: { item: { name: string }; index: number }) => {
      const childPath = currentPath ? `${currentPath}/${item.name}` : item.name
      return (
        <TouchableOpacity
          style={styles.row}
          onPress={() => navigateTo(childPath)}
          testID={index === 0 ? "browse-first-directory" : undefined}
        >
          <Text style={styles.folderIcon}>📁</Text>
          <Text style={styles.dirName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      )
    },
    [currentPath, navigateTo, styles],
  )

  const isBrowseNotConfigured = isError && (
    (error instanceof NetworkError && error.code === 'BROWSE_ROOT_NOT_SET') ||
    error?.message?.includes('not configured')
  )

  return (
    <GestureDetector gesture={swipeBack}>
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Breadcrumbs */}
      <View style={styles.breadcrumbs} testID={`browse-cwd-${currentPath || '~'}`}>
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
            style={[styles.recentsHeader, isGlass && styles.recentsHeaderGlass]}
            onPress={() => setIsRecentsOpen((open) => !open)}
            accessibilityRole="button"
            accessibilityLabel={
              isRecentsOpen ? 'Hide recent directories' : 'Show recent directories'
            }
          >
            <GlassFill />
            <Text style={styles.recentsHeaderText}>
              {t('nav.recentDirs', { count: recentDirs.length })}
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
          // Bug 23 — surface the actual failure (server name, status code,
          // or network error) instead of the misleading generic
          // "server unreachable" copy, which also fires when the request
          // was routed to the wrong server.
          <EmptyState
            title="Unable to load directories"
            subtitle={error instanceof Error && error.message ? error.message : 'Unknown error'}
          />
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
            <Text style={styles.newFolderToggleText}>{t('common:button.cancel')}</Text>
          </TouchableOpacity>
          <TextInput
            style={[styles.newFolderInput, { flex: 1 }]}
            value={newFolderName}
            onChangeText={setNewFolderName}
            placeholder="Folder name"
            placeholderTextColor={theme.text.secondary}
            autoFocus
            onSubmitEditing={handleCreateFolder}
          />
          <TouchableOpacity style={[styles.newFolderBtn, isGlass && styles.cardGlass]} onPress={handleCreateFolder}>
            <GlassFill />
            {createDir.isPending ? (
              <ActivityIndicator size="small" color={theme.text.accent} />
            ) : (
              <Text style={styles.newFolderBtnText}>{t('nav.create')}</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <>
        <View style={styles.providerSelector}>
          {([
            { value: CLAUDE_CODE_PROVIDER, label: 'Claude', color: brand.claude },
            { value: CODEX_CLI_PROVIDER, label: 'Codex', color: brand.codex },
          ]).map((option) => {
            const selected = selectedProvider === option.value
            return (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.providerOption,
                  selected && styles.providerOptionSelected,
                  selected ? { borderColor: option.color } : null,
                ]}
                onPress={() => setSelectedProvider(option.value)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                testID={`start-provider-${option.value}`}
              >
                <View style={[styles.providerDot, { backgroundColor: option.color }]} />
                <Text
                  style={[
                    styles.providerOptionText,
                    selected && styles.providerOptionTextSelected,
                    selected ? { color: option.color } : null,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.newFolderToggle}
            onPress={() => setShowNewFolder(true)}
          >
            <Text style={styles.newFolderToggleText}>{t('nav.newFolder')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.startBtn, startSession.isPending && styles.startBtnDisabled]}
            onPress={handleStartSession}
            disabled={startSession.isPending}
          >
            {startSession.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.startBtnText}>{t('nav.startSession')}</Text>
            )}
          </TouchableOpacity>
        </View>
        </>
      )}
      {isBrowseSlow ? <BrowseSlowBanner onAbort={() => router.back()} /> : null}
    </SafeAreaView>
    </GestureDetector>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.bg.primary,
  },
  breadcrumbs: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  crumb: {
    color: theme.text.accent,
    fontSize: font.sm,
  },
  crumbActive: {
    color: theme.text.primary,
    fontWeight: '600',
  },
  crumbSeparator: {
    color: theme.text.secondary,
    fontSize: font.sm,
  },
  listContainer: {
    flex: 1,
  },
  recents: {
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  recentsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: theme.bg.secondary,
    overflow: 'hidden',
  },
  recentsHeaderGlass: {
    backgroundColor: 'transparent',
  },
  recentsHeaderText: {
    color: theme.text.secondary,
    fontSize: font.xs,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  recentsChevron: {
    color: theme.text.secondary,
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
    color: theme.text.primary,
    fontSize: font.base,
  },
  recentPath: {
    color: theme.text.secondary,
    fontSize: font.xs,
    marginTop: 2,
  },
  skeletons: {
    padding: spacing.lg,
  },
  providerSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  providerOption: {
    flex: 1,
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.bg.secondary,
    gap: spacing.xs,
  },
  providerOptionSelected: {
    backgroundColor: theme.bg.card,
  },
  providerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  providerOptionText: {
    color: theme.text.secondary,
    fontSize: font.sm,
    fontWeight: '600',
  },
  providerOptionTextSelected: {
    color: theme.text.primary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  folderIcon: {
    fontSize: 20,
    marginRight: spacing.md,
  },
  dirName: {
    flex: 1,
    color: theme.text.primary,
    fontSize: font.base,
  },
  chevron: {
    color: theme.text.secondary,
    fontSize: font.xl,
    marginLeft: spacing.sm,
  },
  newFolderInput: {
    flex: 1,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: theme.bg.card,
    paddingHorizontal: spacing.md,
    color: theme.text.primary,
    fontSize: font.base,
  },
  newFolderBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: theme.bg.card,
    height: 40,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cardGlass: {
    backgroundColor: 'transparent',
  },
  newFolderBtnText: {
    color: theme.text.accent,
    fontSize: font.sm,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  newFolderToggle: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  newFolderToggleText: {
    color: theme.text.accent,
    fontSize: font.sm,
  },
  startBtn: {
    flex: 1,
    backgroundColor: theme.text.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  startBtnDisabled: {
    opacity: 0.6,
  },
  startBtnText: {
    color: theme.text.onAccent,
    fontSize: font.base,
    fontWeight: '600',
  },
})}
