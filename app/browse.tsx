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
import { CaretDown, CaretRight, ClockCounterClockwise, File, Folder } from 'phosphor-react-native'
import { useBrowse, useCreateDirectory } from '@/hooks/useBrowse'
import { useSessions } from '@/hooks/useSession'
import { SkeletonBox } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { NetworkError } from '@/services/api-client'
import { BrowseSlowBanner } from '@/components/browse/BrowseSlowBanner'
import { RecentDirsModal, type RecentDir } from '@/components/browse/RecentDirsModal'
import { useLoadingStateStore } from '@/stores/loading-state'
import { font, radius, spacing, brand, type Theme } from '@/constants/theme'
import { useTheme, useIsGlass } from '@/contexts/ThemeContext'
import { GlassFill } from '@/components/ui/GlassFill'
import { CLAUDE_CODE_PROVIDER, CODEX_CLI_PROVIDER, type ProviderName } from '@/constants/providers'
import { clientLog } from '@/lib/clientLog'
import { useProviderHealth } from '@/hooks/useProviderHealth'
import { useViewPrefsStore } from '@/stores/viewPrefs'
import { findProviderHealth } from '@/types/provider-health'

const MAX_RECENT_DIRS = 8
const PREVIEW_RECENT_DIRS = 3

type BrowseRow = { kind: 'dir' | 'file'; name: string }

export default function BrowseScreen() {
  const theme = useTheme()
  const isGlass = useIsGlass()
  const styles = useMemo(() => {
    return makeStyles(theme)
  }, [theme])
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
  const isRecentsOpen = useViewPrefsStore((s) => s.recentsOpen)
  const setRecentsOpen = useViewPrefsStore((s) => s.setRecentsOpen)
  const [showAllRecents, setShowAllRecents] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<ProviderName>(CLAUDE_CODE_PROVIDER)
  const { data: providerHealth } = useProviderHealth(serverId)
  const selectedHealth = findProviderHealth(providerHealth?.providers, selectedProvider)
  const selectedUnavailable = selectedHealth?.available === false
  const selectedWarnings = selectedHealth?.warnings ?? []
  const showProviderNotes =
    selectedUnavailable ||
    selectedWarnings.length > 0 ||
    selectedHealth?.capabilities.structuredQuestions === false ||
    selectedHealth?.capabilities.liveControl === false

  const { data: allSessions = [] } = useSessions()
  // Newest → oldest by last session start; first hit wins for path dedupe.
  const recentDirs = useMemo<RecentDir[]>(() => {
    if (!serverId) {
      return []
    }
    const seen = new Set<string>()
    const dirs: RecentDir[] = []
    const sorted = [...allSessions]
      .filter((s) => s.serverId === serverId && s.projectPath)
      .sort((a, b) => (b.startedAt ?? '').localeCompare(a.startedAt ?? ''))
    for (const session of sorted) {
      const path = session.projectPath
      if (seen.has(path)) {
        continue
      }
      seen.add(path)
      const name = path.split('/').filter(Boolean).pop() ?? path
      dirs.push({
        path,
        name,
        lastUsedAt: session.startedAt,
      })
      if (dirs.length >= MAX_RECENT_DIRS) {
        break
      }
    }
    return dirs
  }, [allSessions, serverId])
  const previewRecentDirs = recentDirs.slice(0, PREVIEW_RECENT_DIRS)
  const hasMoreRecents = recentDirs.length > PREVIEW_RECENT_DIRS

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
      queueMicrotask(() => {
        setCurrentPath('')
      })
    }
  }, [isError, error, currentPath])
  const createDir = useCreateDirectory(serverId ?? '')
  // True once a start navigation kicked off; guards double-taps in the one
  // frame before this screen dismisses.
  const [isStarting, setIsStarting] = useState(false)

  const breadcrumbs = currentPath ? currentPath.split('/') : []
  const navigation = useNavigation()

  const goBack = useCallback(() => {
    if (!currentPath) {
      return
    }
    const segments = currentPath.split('/')
    const nextPath = segments.slice(0, -1).join('/')
    setCurrentPath(nextPath)
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
      const nextPath = segments.slice(0, index + 1).join('/')
      setCurrentPath(nextPath)
    }
    setShowNewFolder(false)
  }, [currentPath])

  const handleCreateFolder = useCallback(() => {
    const name = newFolderName.trim()
    if (!name) {
      return
    }
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

  // Bug 14 fix, take 3: browse is presented as a modal (Stack.Screen
  // presentation: 'modal'). Pushing a route while the modal is still in
  // navigation state parks it UNDER the modal envelope (Bug 14), and a
  // `transitionEnd` listener never fires for a programmatic router.back()
  // (the pop removes the route from state synchronously and the listener
  // dies with the unmounting screen — it only fires for gesture
  // dismissals). So: pop the modal, then push one frame later — the modal
  // is already out of state, so the route lands on the base stack and is
  // revealed as the sheet animates away. The start POST itself lives in
  // /session/new: browse unmounts immediately, and React Query drops
  // mutate() callbacks when their component unmounts.
  const navigateToStartScreen = useCallback(
    (path: string, projectName: string) => {
      const params = new URLSearchParams({ server: serverId ?? '', path, projectName })
      if (selectedProvider === CODEX_CLI_PROVIDER) params.set('provider', selectedProvider)
      const target = `/session/new?${params.toString()}`
      clientLog.info('browse', 'dismiss modal + push /session/new', { target })
      router.back()
      // One frame is enough: back() has already committed the pop, and the
      // rAF outlives this screen's unmount (router is the global ref, not
      // tied to the browse route).
      requestAnimationFrame(() => {
        clientLog.info('browse', 'push /session/new after dismiss', { target })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        router.push(target as any)
      })
    },
    [router, serverId, selectedProvider],
  )

  const handleStartSession = useCallback(() => {
    if (isStarting) return
    setIsStarting(true)
    const displayName = (currentPath ? currentPath.split('/').pop() : '~') ?? '~'
    clientLog.info('browse', 'start session pressed', { currentPath, selectedProvider, serverId })
    navigateToStartScreen(currentPath, displayName)
  }, [currentPath, selectedProvider, serverId, isStarting, navigateToStartScreen])

  const handleStartFromRecent = useCallback(
    (dir: RecentDir) => {
      if (isStarting) return
      setIsStarting(true)
      setShowAllRecents(false)
      clientLog.info('browse', 'start from recent pressed', { path: dir.path, serverId })
      navigateToStartScreen(dir.path, dir.name)
    },
    [serverId, isStarting, navigateToStartScreen],
  )

  const renderItem = useCallback(
    ({ item, index }: { item: BrowseRow; index: number }) => {
      // Files are view-only: a plain row with no press handler and no chevron.
      if (item.kind === 'file') {
        return (
          <View style={styles.row} testID={`browse-file-${item.name}`}>
            <File size={20} color={theme.text.secondary} style={styles.rowIcon} />
            <Text style={[styles.dirName, styles.fileName]} numberOfLines={1}>
              {item.name}
            </Text>
          </View>
        )
      }
      const childPath = currentPath ? `${currentPath}/${item.name}` : item.name
      return (
        <TouchableOpacity
          style={styles.row}
          onPress={() => {
            navigateTo(childPath)
          }}
          testID={index === 0 ? "browse-first-directory" : undefined}
        >
          <Folder size={20} color={theme.text.accent} weight="fill" style={styles.rowIcon} />
          <Text style={styles.dirName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      )
    },
    [currentPath, navigateTo, styles, theme],
  )

  // Directories first (navigable), then files (view-only). Both arrive
  // server-sorted; older servers omit `files`, so it coalesces to empty.
  const rows = useMemo<BrowseRow[]>(() => {
    const dirs = (data?.directories ?? []).map((d) => ({ kind: 'dir' as const, name: d.name }))
    const files = (data?.files ?? []).map((f) => ({ kind: 'file' as const, name: f.name }))
    return [...dirs, ...files]
  }, [data])

  const isBrowseNotConfigured = isError && (
    (error instanceof NetworkError && error.code === 'BROWSE_ROOT_NOT_SET') ||
    error?.message?.includes('not configured')
  )

  return (
    <GestureDetector gesture={swipeBack}>
    <SafeAreaView style={styles.container} edges={['bottom']} testID="browse-screen">
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
            onPress={() => setRecentsOpen(!isRecentsOpen)}
            accessibilityRole="button"
            accessibilityLabel={
              isRecentsOpen ? 'Hide recent directories' : 'Show recent directories'
            }
          >
            <GlassFill />
            <Text style={styles.recentsHeaderText}>
              {t('nav.recentDirs', { count: recentDirs.length })}
            </Text>
            {isRecentsOpen ? (
              <CaretDown size={14} color={theme.text.secondary} weight="bold" />
            ) : (
              <CaretRight size={14} color={theme.text.secondary} weight="bold" />
            )}
          </TouchableOpacity>
          {isRecentsOpen ? (
            <View style={styles.recentsList}>
              {previewRecentDirs.map((dir) => (
                <TouchableOpacity
                  key={dir.path}
                  style={styles.recentRow}
                  onPress={() => handleStartFromRecent(dir)}
                  disabled={isStarting}
                  testID={`recent-dir-preview-${dir.path}`}
                >
                  <ClockCounterClockwise size={18} color={theme.text.secondary} />
                  <View style={styles.recentTextWrap}>
                    <Text style={styles.recentName} numberOfLines={1}>
                      {dir.name}
                    </Text>
                    <Text style={styles.recentPath} numberOfLines={1}>
                      {dir.path}
                    </Text>
                  </View>
                  <CaretRight size={16} color={theme.text.secondary} />
                </TouchableOpacity>
              ))}
              {hasMoreRecents ? (
                <TouchableOpacity
                  style={styles.displayAllBtn}
                  onPress={() => setShowAllRecents(true)}
                  accessibilityRole="button"
                  testID="recent-dirs-display-all"
                >
                  <Text style={styles.displayAllText}>{t('nav.displayAll')}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}

      <RecentDirsModal
        visible={showAllRecents}
        dirs={recentDirs}
        onClose={() => setShowAllRecents(false)}
        onSelect={handleStartFromRecent}
        disabled={isStarting}
      />

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
        ) : rows.length === 0 ? (
          <EmptyState title="Empty directory" subtitle="No files or folders here." />
        ) : (
          <FlashList
            data={rows}
            renderItem={renderItem}
            keyExtractor={(item) => `${item.kind}:${item.name}`}
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
            const health = findProviderHealth(providerHealth?.providers, option.value)
            const unavailable = health?.available === false
            return (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.providerOption,
                  selected && styles.providerOptionSelected,
                  selected ? { borderColor: option.color } : null,
                  unavailable && styles.providerOptionDisabled,
                ]}
                onPress={() => setSelectedProvider(option.value)}
                accessibilityRole="button"
                accessibilityState={{ selected, disabled: unavailable }}
                testID={`start-provider-${option.value}`}
              >
                <View style={[styles.providerDot, { backgroundColor: option.color }]} />
                <Text
                  style={[
                    styles.providerOptionText,
                    selected && styles.providerOptionTextSelected,
                    selected ? { color: option.color } : null,
                    unavailable && styles.providerOptionTextDisabled,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>
        {showProviderNotes ? (
          <View style={styles.providerWarning} testID="browse-provider-warning">
            {selectedUnavailable ? (
              <Text style={styles.providerWarningText}>{t('provider.unavailable')}</Text>
            ) : null}
            {selectedWarnings.map((w) => {
              let warningLabel = t('provider.warning.version_unverified')
              if (w.code === 'provider_not_found') warningLabel = t('provider.warning.provider_not_found')
              else if (w.code === 'version_undetectable') {
                warningLabel = t('provider.warning.version_undetectable')
              }
              return (
                <Text key={w.code} style={styles.providerWarningText}>
                  {warningLabel}
                </Text>
              )
            })}
            {selectedHealth && !selectedHealth.capabilities.structuredQuestions ? (
              <Text style={styles.providerWarningText}>{t('provider.noStructuredQuestions')}</Text>
            ) : null}
            {selectedHealth && !selectedHealth.capabilities.liveControl ? (
              <Text style={styles.providerWarningText}>{t('provider.observeOnly')}</Text>
            ) : null}
          </View>
        ) : null}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.newFolderToggle}
            onPress={() => setShowNewFolder(true)}
          >
            <Text style={styles.newFolderToggleText}>{t('nav.newFolder')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.startBtn,
              (isStarting || selectedUnavailable) && styles.startBtnDisabled,
            ]}
            onPress={handleStartSession}
            disabled={isStarting || selectedUnavailable}
            testID="browse-start-session"
          >
            {isStarting ? (
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
  recentsList: {
    paddingVertical: spacing.xs,
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  recentTextWrap: {
    flex: 1,
    marginLeft: spacing.md,
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
  displayAllBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  displayAllText: {
    color: theme.text.accent,
    fontSize: font.sm,
    fontWeight: '600',
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
  providerOptionDisabled: {
    opacity: 0.55,
  },
  providerOptionTextDisabled: {
    color: theme.text.secondary,
  },
  providerWarning: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.bg.secondary,
    gap: 4,
  },
  providerWarningText: {
    color: theme.text.warning,
    fontSize: font.xs,
    lineHeight: 16,
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
  rowIcon: {
    marginRight: spacing.md,
  },
  dirName: {
    flex: 1,
    color: theme.text.primary,
    fontSize: font.base,
  },
  fileName: {
    color: theme.text.secondary,
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
