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
import {
  markNavigatedToSession,
  suppressAutoNavForBrowseStart,
  clearBrowseStartAutoNavSuppress,
} from '@/lib/sessionNavGuard'
import { clientLog } from '@/lib/clientLog'

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
  const route = `/session/${session.id}?${params.toString()}`
  clientLog.info('browse', 'buildSessionRoute', {
    sessionId: session.id,
    projectId: session.projectId,
    projectPath: session.projectPath,
    serverId,
    starting: opts?.starting,
    route,
  })
  return route
}

export default function BrowseScreen() {
  clientLog.info('browse', 'BrowseScreen render start')
  const theme = useTheme()
  clientLog.info('browse', 'resolved theme', { hasTheme: !!theme })
  const isGlass = useIsGlass()
  clientLog.info('browse', 'resolved isGlass', { isGlass })
  const styles = useMemo(() => {
    clientLog.info('browse', 'makeStyles useMemo compute', { themeKeys: Object.keys(theme ?? {}) })
    return makeStyles(theme)
  }, [theme])
  clientLog.info('browse', 'styles ready')
  const { t } = useTranslation(['browse', 'common'])
  clientLog.info('browse', 'i18n t ready')
  const router = useRouter()
  clientLog.info('browse', 'router ready', { hasRouter: !!router })
  const { server: serverId, path: initialPath } = useLocalSearchParams<{ server: string; path?: string }>()
  clientLog.info('browse', 'local search params', { serverId, initialPath })
  // Pre-fill cwd when the caller passes ?path=... (TreeView drill → FAB).
  // `useLocalSearchParams` always returns a string for declared keys, so an
  // omitted `path` arrives as undefined; we coalesce to '' (server default).
  const [currentPath, setCurrentPath] = useState(initialPath ?? '')
  clientLog.info('browse', 'currentPath state', { currentPath, initialFallback: initialPath ?? '' })
  const [newFolderName, setNewFolderName] = useState('')
  clientLog.info('browse', 'newFolderName state', { newFolderName })
  const [showNewFolder, setShowNewFolder] = useState(false)
  clientLog.info('browse', 'showNewFolder state', { showNewFolder })
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  clientLog.info('browse', 'keyboardHeight state', { keyboardHeight })
  const [isRecentsOpen, setIsRecentsOpen] = useState(true)
  clientLog.info('browse', 'isRecentsOpen state', { isRecentsOpen })
  const [selectedProvider, setSelectedProvider] = useState<ProviderName>(CLAUDE_CODE_PROVIDER)
  clientLog.info('browse', 'selectedProvider state', { selectedProvider })

  const { data: allSessions = [] } = useSessions()
  clientLog.info('browse', 'useSessions result', { allSessionsCount: allSessions.length })
  const recentDirs = useMemo<RecentDir[]>(() => {
    clientLog.info('browse', 'recentDirs useMemo start', { serverId, allSessionsCount: allSessions.length })
    if (!serverId) {
      clientLog.info('browse', 'recentDirs empty: no serverId')
      return []
    }
    const seen = new Set<string>()
    const dirs: RecentDir[] = []
    const sorted = [...allSessions]
      .filter((s) => s.serverId === serverId && s.projectPath)
      .sort((a, b) => (b.startedAt ?? '').localeCompare(a.startedAt ?? ''))
    clientLog.info('browse', 'recentDirs filtered+sorted', { sortedCount: sorted.length })
    for (const session of sorted) {
      const path = session.projectPath
      if (seen.has(path)) {
        clientLog.info('browse', 'recentDirs skip duplicate path', { path })
        continue
      }
      seen.add(path)
      const name = path.split('/').filter(Boolean).pop() ?? path
      dirs.push({
        path,
        name,
        lastUsedAt: session.startedAt,
      })
      clientLog.info('browse', 'recentDirs push', { path, name, lastUsedAt: session.startedAt, dirsLen: dirs.length })
      if (dirs.length >= MAX_RECENT_DIRS) {
        clientLog.info('browse', 'recentDirs hit MAX_RECENT_DIRS', { max: MAX_RECENT_DIRS })
        break
      }
    }
    clientLog.info('browse', 'recentDirs useMemo done', { dirsCount: dirs.length })
    return dirs
  }, [allSessions, serverId])
  clientLog.info('browse', 'recentDirs value', { recentDirsCount: recentDirs.length })

  useEffect(() => {
    clientLog.info('browse', 'keyboard effect mount: add listeners')
    const showSub = Keyboard.addListener('keyboardWillShow', (e) => {
      clientLog.info('browse', 'keyboardWillShow', { height: e.endCoordinates.height })
      setKeyboardHeight(e.endCoordinates.height)
    })
    const hideSub = Keyboard.addListener('keyboardWillHide', () => {
      clientLog.info('browse', 'keyboardWillHide: reset height to 0')
      setKeyboardHeight(0)
    })
    return () => {
      clientLog.info('browse', 'keyboard effect cleanup: remove listeners')
      showSub.remove()
      hideSub.remove()
    }
  }, [])

  const { data, isLoading, isError, error } = useBrowse(serverId ?? '', currentPath)
  clientLog.info('browse', 'useBrowse result', {
    serverId: serverId ?? '',
    currentPath,
    isLoading,
    isError,
    errorMessage: error?.message,
    dataDirsCount: data?.directories?.length,
  })
  const isBrowseSlow = useLoadingStateStore((s) => s.slowCounts.browse > 0)
  clientLog.info('browse', 'isBrowseSlow', { isBrowseSlow })

  // The TreeView drill prefill passes the session's absolute cwd, which may
  // live outside the server's configured browse root (adopted sessions, demo
  // seed data, root changed after the session ran). Such a path can neither
  // be listed nor started — fall back to the browse root instead of
  // dead-ending on it. setState is deferred to a microtask so the
  // `react-hooks/set-state-in-effect` rule is satisfied (same pattern as
  // app/session/[id].tsx).
  useEffect(() => {
    clientLog.info('browse', 'outside-root effect check', {
      isError,
      currentPath,
      errorMessage: error?.message,
    })
    if (isError && currentPath && error?.message?.includes('outside browse root')) {
      clientLog.info('browse', 'outside browse root: queueMicrotask setCurrentPath("")')
      queueMicrotask(() => {
        clientLog.info('browse', 'outside browse root: applying setCurrentPath("")')
        setCurrentPath('')
      })
    } else {
      clientLog.info('browse', 'outside-root effect: no fallback')
    }
  }, [isError, error, currentPath])
  const createDir = useCreateDirectory(serverId ?? '')
  clientLog.info('browse', 'useCreateDirectory ready', { serverId: serverId ?? '' })
  const startSession = useStartSession(serverId ?? '')
  clientLog.info('browse', 'useStartSession ready', { serverId: serverId ?? '' })

  const breadcrumbs = currentPath ? currentPath.split('/') : []
  clientLog.info('browse', 'breadcrumbs derived', { currentPath, breadcrumbs })
  const navigation = useNavigation()
  clientLog.info('browse', 'navigation ready', { hasNavigation: !!navigation })

  const goBack = useCallback(() => {
    clientLog.info('browse', 'goBack invoked', { currentPath })
    if (!currentPath) {
      clientLog.info('browse', 'goBack noop: already at root')
      return
    }
    const segments = currentPath.split('/')
    const nextPath = segments.slice(0, -1).join('/')
    clientLog.info('browse', 'goBack setCurrentPath', { segments, nextPath })
    setCurrentPath(nextPath)
    clientLog.info('browse', 'goBack setShowNewFolder(false)')
    setShowNewFolder(false)
  }, [currentPath])

  // Set header back button when inside a subdirectory
  useEffect(() => {
    clientLog.info('browse', 'headerLeft effect', { currentPath, hasPath: !!currentPath })
    navigation.setOptions({
      headerLeft: currentPath
        ? () => (
            <TouchableOpacity onPress={goBack} activeOpacity={1} style={{ marginLeft: 8, paddingRight: 16 }}>
              <Text style={{ color: theme.text.accent, fontSize: font.base }}>{t('nav.back')}</Text>
            </TouchableOpacity>
          )
        : undefined,
    })
    clientLog.info('browse', 'headerLeft options set', { mode: currentPath ? 'back-button' : 'undefined' })
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
  clientLog.info('browse', 'swipeBack gesture configured', { currentPath })

  const navigateTo = useCallback((path: string) => {
    clientLog.info('browse', 'navigateTo', { path })
    setCurrentPath(path)
    clientLog.info('browse', 'navigateTo setShowNewFolder(false)')
    setShowNewFolder(false)
  }, [])

  const navigateToBreadcrumb = useCallback((index: number) => {
    clientLog.info('browse', 'navigateToBreadcrumb', { index, currentPath })
    if (index < 0) {
      clientLog.info('browse', 'navigateToBreadcrumb root: setCurrentPath("")')
      setCurrentPath('')
    } else {
      const segments = currentPath.split('/')
      const nextPath = segments.slice(0, index + 1).join('/')
      clientLog.info('browse', 'navigateToBreadcrumb setCurrentPath', { segments, nextPath })
      setCurrentPath(nextPath)
    }
    clientLog.info('browse', 'navigateToBreadcrumb setShowNewFolder(false)')
    setShowNewFolder(false)
  }, [currentPath])

  const handleCreateFolder = useCallback(() => {
    const name = newFolderName.trim()
    clientLog.info('browse', 'handleCreateFolder', { raw: newFolderName, name, currentPath })
    if (!name) {
      clientLog.info('browse', 'handleCreateFolder noop: empty name')
      return
    }
    clientLog.info('browse', 'createDir.mutate start', { parentPath: currentPath, name })
    createDir.mutate(
      { parentPath: currentPath, name },
      {
        onSuccess: () => {
          clientLog.info('browse', 'createDir onSuccess: clear name + hide form')
          setNewFolderName('')
          setShowNewFolder(false)
        },
        onError: (err) => {
          clientLog.info('browse', 'createDir onError', { message: err.message })
          Alert.alert('Error', err.message)
        },
      },
    )
  }, [currentPath, newFolderName, createDir])

  // Bug 14 fix, take 2: browse is presented as a modal (Stack.Screen
  // presentation: 'modal'). Pushing the session route while the modal is
  // still in navigation state parks it UNDER the modal envelope (Bug 14),
  // but the original fix — dismiss, then push from a `transitionEnd`
  // listener — never fired for a programmatic router.back(): the pop
  // removes the route from navigation state synchronously, the screen
  // unmounts with it, and the listener dies before native-stack emits the
  // event (it only fires for gesture dismissals, where the route stays in
  // state until the gesture completes). So: pop the modal, then push one
  // frame later — the modal is already out of state, so the session lands
  // on the base stack and is revealed as the sheet animates away.
  const navigateToNewSession = useCallback(
    (
      session: { id: string; projectId?: string; projectPath?: string | null },
      opts?: { starting?: boolean },
    ) => {
      clientLog.info('browse', 'navigateToNewSession start', {
        sessionId: session.id,
        projectId: session.projectId,
        projectPath: session.projectPath,
        starting: opts?.starting,
        serverId: serverId ?? '',
      })
      const target = buildSessionRoute(session, serverId ?? '', opts)
      clientLog.info('startSession', 'C. navigateToNewSession — mark + back + rAF push', {
        sessionId: session.id,
        projectId: session.projectId,
        projectPath: session.projectPath,
        starting: opts?.starting,
        serverId: serverId ?? '',
        target,
      })
      clientLog.info('browse', 'navigateToNewSession built target', { target })
      // Guard the global session_ready listener BEFORE dismissing. session_ready
      // can arrive mid-dismiss (the PTY is already active — see "Active 1s" in
      // the new session header), and the global listener in app/_layout.tsx
      // would push /session/<id> underneath the still-open modal, stranding the
      // user on browse until they manually pull it down. Marking now (and the
      // earlier suppressAutoNavForBrowseStart on Start press) suppresses that
      // early push; our own next-frame push below is the only navigation.
      clientLog.info('browse', 'markNavigatedToSession before dismiss', { sessionId: session.id })
      markNavigatedToSession(session.id)
      clientLog.info('startSession', 'D. router.back() dismiss browse modal')
      clientLog.info('browse', 'router.back() dismiss modal')
      router.back()
      // One frame is enough: back() has already committed the pop, and the
      // rAF outlives this screen's unmount (router is the global ref, not
      // tied to the browse route).
      requestAnimationFrame(() => {
        clientLog.info('startSession', 'E. router.push session (frame after dismiss)', { target })
        clientLog.info('browse', 'push session after back()', { target })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        router.push(target as any)
      })
    },
    [router, serverId],
  )

  // 'pending' means the server's ready-wait timed out (PTY spawned but not yet
  // at its prompt — e.g. blocked on a Codex startup gate). Navigate to the
  // pending screen so the user sees progress/console access instead of
  // silently waiting on the still-open browse modal; app/_layout.tsx's global
  // session_ready listener would otherwise be the only way out. `starting: true`
  // carries the real id with the exact-id gate on, so a different session's
  // session_ready can't latch onto this pending screen.
  const handleStartResult = useCallback(
    (result: { kind: 'ready'; session: { id: string; projectId?: string; projectPath?: string | null } } | { kind: 'pending'; id: string }) => {
      clientLog.info('startSession', 'B. handleStartResult (HTTP success path)', {
        kind: result.kind,
        result,
      })
      clientLog.info('browse', 'handleStartResult', { kind: result.kind, result })
      if (result.kind === 'ready') {
        clientLog.info('browse', 'handleStartResult ready → navigateToNewSession', { sessionId: result.session.id })
        navigateToNewSession(result.session)
      } else {
        clientLog.info('browse', 'handleStartResult pending → navigateToNewSession starting', { id: result.id })
        navigateToNewSession({ id: result.id }, { starting: true })
      }
    },
    [navigateToNewSession],
  )

  const handleStartError = useCallback(
    (err: Error) => {
      clientLog.info('startSession', 'Berr. handleStartError', {
        message: err.message,
        code: err instanceof NetworkError ? err.code : undefined,
      })
      clearBrowseStartAutoNavSuppress()
      const isTimeout = err instanceof NetworkError && err.code === 'TIMEOUT'
      const message = isTimeout ? t('error.startTimeout') : err.message
      clientLog.info('browse', 'handleStartError', {
        isTimeout,
        code: err instanceof NetworkError ? err.code : undefined,
        message,
        rawMessage: err.message,
      })
      Alert.alert(t('error.startFailed'), message)
    },
    [t],
  )

  const handleStartSession = useCallback(() => {
    const displayName = currentPath ? currentPath.split('/').pop() : '~'
    const payload = {
      path: currentPath,
      projectName: displayName,
      ...(selectedProvider === CODEX_CLI_PROVIDER ? { provider: selectedProvider } : {}),
    }
    // session_ready can beat the start HTTP response — suppress global auto-nav
    // until we know the id and own dismiss→push navigation.
    clientLog.info('startSession', 'A. suppressAutoNavForBrowseStart + mutate', {
      currentPath,
      displayName,
      selectedProvider,
      payload,
      serverId,
      isPending: startSession.isPending,
    })
    suppressAutoNavForBrowseStart()
    clientLog.info('browse', 'handleStartSession mutate', {
      currentPath,
      displayName,
      selectedProvider,
      includeProvider: selectedProvider === CODEX_CLI_PROVIDER,
      payload,
    })
    startSession.mutate(
      payload,
      { onSuccess: handleStartResult, onError: handleStartError },
    )
  }, [currentPath, selectedProvider, startSession, handleStartResult, handleStartError, serverId])

  const handleStartFromRecent = useCallback(
    (dir: RecentDir) => {
      const payload = {
        path: dir.path,
        projectName: dir.name,
        ...(selectedProvider === CODEX_CLI_PROVIDER ? { provider: selectedProvider } : {}),
      }
      clientLog.info('startSession', 'A. Start from recent — suppress + mutate', {
        dir,
        selectedProvider,
        payload,
        serverId,
        isPending: startSession.isPending,
      })
      if (startSession.isPending) {
        clientLog.info('startSession', 'Start from recent ignored — already pending', { dir })
        return
      }
      suppressAutoNavForBrowseStart()
      clientLog.info('browse', 'handleStartFromRecent mutate', {
        dir,
        selectedProvider,
        includeProvider: selectedProvider === CODEX_CLI_PROVIDER,
        payload,
      })
      startSession.mutate(
        payload,
        { onSuccess: handleStartResult, onError: handleStartError },
      )
    },
    [selectedProvider, startSession, handleStartResult, handleStartError, serverId],
  )

  const renderItem = useCallback(
    ({ item, index }: { item: { name: string }; index: number }) => {
      const childPath = currentPath ? `${currentPath}/${item.name}` : item.name
      clientLog.info('browse', 'renderItem', { index, name: item.name, childPath, currentPath })
      return (
        <TouchableOpacity
          style={styles.row}
          onPress={() => {
            clientLog.info('browse', 'directory row press', { childPath, index })
            navigateTo(childPath)
          }}
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
  clientLog.info('browse', 'isBrowseNotConfigured derived', {
    isBrowseNotConfigured,
    isError,
    errorCode: error instanceof NetworkError ? error.code : undefined,
    errorMessage: error?.message,
  })
  clientLog.info('browse', 'BrowseScreen render end → return JSX')

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
            onPress={() => {
              clientLog.info('startSession', 'CLICK Start Session Here', {
                currentPath,
                selectedProvider,
                isPending: startSession.isPending,
                serverId,
              })
              clientLog.info('browse', 'Start Session Here pressed', {
                currentPath,
                selectedProvider,
                isPending: startSession.isPending,
              })
              if (startSession.isPending) {
                clientLog.info('startSession', 'CLICK ignored — start already pending', {
                  currentPath,
                  serverId,
                })
                return
              }
              handleStartSession()
            }}
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
