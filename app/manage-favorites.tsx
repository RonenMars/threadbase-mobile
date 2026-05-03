import React from 'react'
import { View, Text, Pressable, FlatList, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { ArrowLeft, DotsSixVertical, Folder, Lightning, Trash } from 'phosphor-react-native'
import { useQuickAccessStore } from '@/stores/quickAccess'
import { dark, font, spacing } from '@/constants/theme'

export default function ManageFavoritesScreen() {
  const router = useRouter()
  const { favorites, unpinItem } = useQuickAccessStore()

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <ArrowLeft size={20} color={dark.text.accent} />
          <Text style={styles.backLabel}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Manage Favorites</Text>
      </View>

      {favorites.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No favorites pinned yet.</Text>
          <Text style={styles.emptySubText}>Tap a chip in the strip and choose "Pin to Favorites".</Text>
        </View>
      ) : (
        <FlatList
          data={favorites}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <DotsSixVertical size={18} color={dark.text.secondary} style={styles.drag} />
              {item.type === 'dir'
                ? <Folder size={16} color={dark.text.secondary} />
                : <Lightning size={16} color={dark.text.secondary} />
              }
              <Text style={styles.label} numberOfLines={1}>{item.label}</Text>
              <Pressable onPress={() => unpinItem(item.id)} hitSlop={8} style={styles.deleteBtn}>
                <Trash size={16} color={dark.status.failed} />
              </Pressable>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: dark.bg.primary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderColor: dark.border,
    gap: spacing.sm,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backLabel: { color: dark.text.accent, fontSize: font.base },
  title: { color: dark.text.primary, fontSize: font.lg, fontWeight: '700', flex: 1 },
  list: { padding: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: dark.bg.card,
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: dark.border,
  },
  drag: { opacity: 0.4 },
  label: { flex: 1, color: dark.text.primary, fontSize: font.base },
  deleteBtn: { padding: 4 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emptyText: { color: dark.text.primary, fontSize: font.base, fontWeight: '600', marginBottom: spacing.xs },
  emptySubText: { color: dark.text.secondary, fontSize: font.sm, textAlign: 'center' },
})
