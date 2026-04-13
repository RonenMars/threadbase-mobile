import React, { useState, useCallback } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native'
import { FlashList } from '@shopify/flash-list'
import { useRouter } from 'expo-router'
import { dark, font, radius, spacing } from '@/constants/theme'
import type { Conversation } from '@/types/api'

function formatDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  return d.toLocaleDateString()
}

interface RowProps {
  conversation: Conversation
}

function ConversationRow({ conversation: c }: RowProps) {
  const router = useRouter()
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={() => router.push(`/conversation/${c.id}`)}
      accessibilityLabel={`Conversation: ${c.title}`}
      accessibilityRole="button"
    >
      <View style={styles.rowMain}>
        <Text style={styles.title} numberOfLines={1}>{c.title}</Text>
        <View style={styles.meta}>
          <Text style={styles.metaText}>{c.projectPath.split('/').pop()}</Text>
          {c.branch ? (
            <View style={styles.branchBadge}>
              <Text style={styles.branchText}>{c.branch}</Text>
            </View>
          ) : null}
        </View>
      </View>
      <View style={styles.rowRight}>
        <Text style={styles.date}>{formatDate(c.lastActivity)}</Text>
        <Text style={styles.metaText}>{c.messageCount} msgs</Text>
        {c.totalTokens ? (
          <Text style={styles.metaText}>{(c.totalTokens / 1000).toFixed(1)}k tokens</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  )
}

interface Props {
  conversations: Conversation[]
  onRefresh: () => void
  refreshing: boolean
  onEndReached: () => void
  searchQuery: string
  onSearchChange: (q: string) => void
}

export function ConversationList({
  conversations,
  onRefresh,
  refreshing,
  onEndReached,
  searchQuery,
  onSearchChange,
}: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={onSearchChange}
          placeholder="Search conversations..."
          placeholderTextColor={dark.text.secondary}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

      <FlashList
        data={conversations.filter(Boolean)}
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => <ConversationRow conversation={item} />}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.3}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={dark.text.secondary}
          />
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: dark.bg.card,
    borderRadius: radius.md,
    margin: spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: dark.border,
    minHeight: 44,
  },
  searchIcon: { fontSize: font.sm, marginRight: spacing.sm },
  searchInput: {
    flex: 1,
    color: dark.text.primary,
    fontSize: font.base,
    paddingVertical: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 44,
    gap: spacing.md,
  },
  rowMain: { flex: 1, gap: spacing.xs },
  title: {
    color: dark.text.primary,
    fontSize: font.base,
    fontWeight: '500',
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  metaText: {
    color: dark.text.secondary,
    fontSize: font.xs,
  },
  branchBadge: {
    backgroundColor: dark.bg.card,
    borderRadius: radius.full,
    paddingHorizontal: spacing.xs,
    borderWidth: 1,
    borderColor: dark.border,
  },
  branchText: {
    color: dark.text.secondary,
    fontSize: 10,
  },
  rowRight: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  date: {
    color: dark.text.secondary,
    fontSize: font.xs,
  },
  separator: {
    height: 1,
    backgroundColor: dark.border,
    marginHorizontal: spacing.md,
  },
})
