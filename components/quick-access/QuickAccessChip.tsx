import React from 'react'
import { Platform, Pressable, Text, StyleSheet } from 'react-native'
import { Folder, Lightning, X } from 'phosphor-react-native'
import { dark, font } from '@/constants/theme'

export type QuickAccessTab = 'favorites' | 'recents' | 'popular'

export type ChipItemType = 'dir' | 'session' | 'conversation' | 'project-chat'

export interface ChipItem {
  type: ChipItemType
  id: string
  label: string
  serverId?: string
  sessionCount?: number
}

interface Props {
  item: ChipItem
  tab: QuickAccessTab
  editMode: boolean
  onPress: () => void
  onDelete: () => void
}

export function QuickAccessChip({ item, tab, editMode, onPress, onDelete }: Props) {
  const isPinned = tab === 'favorites'

  return (
    <Pressable
      style={({ pressed }) => [
        styles.chip,
        isPinned && styles.chipPinned,
        pressed && !editMode && styles.chipPressed,
      ]}
      onPress={onPress}
      accessibilityLabel={item.label}
    >
      {item.type === 'dir' ? (
        <Folder size={13} color={isPinned ? dark.text.accent : dark.text.secondary} />
      ) : (
        // session, conversation, and project-chat all visually represent a chat;
        // use the same lightning icon to match SessionCard branding.
        <Lightning size={13} color={isPinned ? dark.text.accent : dark.text.secondary} />
      )}
      <Text
        style={[
          styles.label,
          item.type === 'dir' && styles.labelMono,
          isPinned && styles.labelPinned,
        ]}
        numberOfLines={1}
      >
        {item.label}
      </Text>
      {item.sessionCount !== undefined && (
        <Text style={styles.count}>{item.sessionCount}</Text>
      )}
      {editMode && (
        <Pressable style={styles.deleteBadge} onPress={onDelete} hitSlop={6}>
          <X size={9} color="#fff" weight="bold" />
        </Pressable>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    minHeight: 28,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(99,179,255,0.18)',
    backgroundColor: dark.bg.card,
  },
  chipPinned: {
    borderColor: dark.text.accent,
    backgroundColor: 'rgba(99,179,255,0.10)',
  },
  chipPressed: { opacity: 0.65 },
  label: {
    color: dark.text.secondary,
    fontSize: font.xs,
    maxWidth: 140,
  },
  labelMono: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: font.xs - 1,
  },
  labelPinned: { color: dark.text.accent },
  count: {
    color: dark.text.secondary,
    fontSize: 10,
    marginLeft: 2,
  },
  deleteBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#e55',
    alignItems: 'center',
    justifyContent: 'center',
  },
})
