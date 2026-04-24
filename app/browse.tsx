import React, { useState, useCallback } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Alert,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { FlashList } from '@shopify/flash-list'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useBrowse, useCreateDirectory, useStartSession } from '@/hooks/useBrowse'
import { SkeletonBox } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { dark, font, radius, spacing } from '@/constants/theme'

export default function BrowseScreen() {
  const router = useRouter()
  const { server: serverId } = useLocalSearchParams<{ server: string }>()
  const [currentPath, setCurrentPath] = useState('')
  const [newFolderName, setNewFolderName] = useState('')
  const [showNewFolder, setShowNewFolder] = useState(false)

  const { data, isLoading, isError, error } = useBrowse(serverId ?? '', currentPath)
  const createDir = useCreateDirectory(serverId ?? '')
  const startSession = useStartSession(serverId ?? '')

  const breadcrumbs = currentPath ? currentPath.split('/') : []

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

  const is403 = isError && error?.message?.includes('403')

  return (
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

      {/* Directory list */}
      <View style={styles.listContainer}>
        {isLoading ? (
          <View style={styles.skeletons}>
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonBox key={i} height={44} style={{ marginBottom: spacing.sm }} />
            ))}
          </View>
        ) : is403 ? (
          <EmptyState
            title="Browsing not configured"
            subtitle="Set browseRoot on your server to enable file browsing."
          />
        ) : isError ? (
          <EmptyState title="Error" subtitle={error?.message ?? 'Failed to load directories'} />
        ) : data?.directories.length === 0 ? (
          <EmptyState title="Empty directory" subtitle="No subdirectories here." />
        ) : (
          <FlashList
            data={data?.directories ?? []}
            renderItem={renderItem}
            estimatedItemSize={52}
            keyExtractor={(item) => item.name}
          />
        )}
      </View>

      {/* New folder inline input */}
      {showNewFolder && (
        <View style={styles.newFolderRow}>
          <TextInput
            style={styles.newFolderInput}
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
      )}

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.newFolderToggle}
          onPress={() => setShowNewFolder((v) => !v)}
        >
          <Text style={styles.newFolderToggleText}>
            {showNewFolder ? 'Cancel' : 'New Folder'}
          </Text>
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
    </SafeAreaView>
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
  newFolderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: dark.border,
    gap: spacing.sm,
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
