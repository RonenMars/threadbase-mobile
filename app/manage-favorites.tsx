import React, { useMemo } from 'react'
import { View, Text, Pressable, FlatList, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { DotsSixVertical, Folder, Lightning, Trash } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { useQuickAccessStore } from '@/stores/quickAccess'
import { font, radius, spacing, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import type { MultiConversation } from '@/types/api'

export default function ManageFavoritesScreen() {
  const theme = useTheme()
  const styles = makeStyles(theme)
  const { t } = useTranslation('sessions')
  const router = useRouter()
  const { favorites, unpinItem } = useQuickAccessStore()
  const queryClient = useQueryClient()

  // Peek at the React Query cache populated by the Hub's useEagerConversations.
  // No network call: just read whatever is already there. If the Hub hasn't
  // been visited this session, the cache will be empty and we fall back to
  // the static "long-press a chip" copy — which is the right thing to show.
  const hasAnyConversations = useMemo(() => {
    const entries = queryClient.getQueriesData<MultiConversation[]>({
      queryKey: ['conversations-eager'],
    })
    return entries.some(([, data]) => Array.isArray(data) && data.length > 0)
  }, [queryClient])

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      {favorites.length === 0 ? (
        <View style={styles.empty}>
          {hasAnyConversations ? (
            <Pressable
              onPress={() => router.push('/')}
              style={({ pressed }) => [styles.primaryBtn, pressed && styles.primaryBtnPressed]}
            >
              <Text style={styles.primaryBtnText}>{t('manageFavorites.addToFavorites')}</Text>
            </Pressable>
          ) : (
            <>
              <Text style={styles.emptyText}>{t('manageFavorites.empty')}</Text>
              <Text style={styles.emptySubText}>{t('manageFavorites.emptySub')}</Text>
            </>
          )}
        </View>
      ) : (
        <FlatList
          data={favorites}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <DotsSixVertical size={18} color={theme.text.secondary} style={styles.drag} />
              {item.type === 'dir'
                ? <Folder size={16} color={theme.text.secondary} />
                : <Lightning size={16} color={theme.text.secondary} />
              }
              <Text style={styles.label} numberOfLines={1}>{item.label}</Text>
              <Pressable onPress={() => unpinItem(item.id)} hitSlop={8} style={styles.deleteBtn}>
                <Trash size={16} color={theme.status.failed} />
              </Pressable>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg.primary },
  list: { padding: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: theme.bg.card,
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: theme.border,
  },
  drag: { opacity: 0.4 },
  label: { flex: 1, color: theme.text.primary, fontSize: font.base },
  deleteBtn: { padding: 4 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emptyText: { color: theme.text.primary, fontSize: font.base, fontWeight: '600', marginBottom: spacing.xs },
  emptySubText: { color: theme.text.secondary, fontSize: font.sm, textAlign: 'center' },
  primaryBtn: {
    backgroundColor: theme.text.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  primaryBtnPressed: { opacity: 0.7 },
  primaryBtnText: { color: '#fff', fontSize: font.base, fontWeight: '700' },
})}

