import React from 'react'
import { Pressable, Text, View, StyleSheet } from 'react-native'
import { Folder, Lightning, X } from 'phosphor-react-native'
import { dark, font, spacing } from '@/constants/theme'

export type QuickAccessTab = 'favorites' | 'recents' | 'popular'

export interface ChipItem {
  type: 'dir' | 'session'
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
      {item.type === 'dir'
        ? <Folder size={13} color={isPinned ? dark.text.accent : dark.text.secondary} />
        : <Lightning size={13} color={isPinned ? dark.text.accent : dark.text.secondary} />
      }
      <Text style={[styles.label, isPinned && styles.labelPinned]} numberOfLines={1}>
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
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: dark.border,
    backgroundColor: dark.bg.card,
  },
  chipPinned: {
    borderColor: dark.text.accent,
    backgroundColor: 'rgba(28,100,242,0.08)',
  },
  chipPressed: { opacity: 0.65 },
  label: {
    color: dark.text.secondary,
    fontSize: font.xs,
    maxWidth: 120,
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
