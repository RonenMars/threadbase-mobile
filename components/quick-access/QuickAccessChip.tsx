import React from 'react'
import { Platform, Pressable, Text, StyleSheet } from 'react-native'
import { Folder, Lightning, X } from 'phosphor-react-native'
import { font, type Theme } from '@/constants/theme'
import { useTheme, useIsGlass } from '@/contexts/ThemeContext'
import { GlassFill } from '@/components/ui/GlassFill'

export type QuickAccessTab = 'favorites' | 'recents' | 'popular'

export type ChipItemType = 'dir' | 'session' | 'conversation' | 'project-chat'

export interface ChipItem {
  type: ChipItemType
  id: string
  label: string
  serverId?: string
  conversationId?: string
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
  const theme = useTheme()
  const isGlass = useIsGlass()
  const styles = makeStyles(theme)
  const isPinned = tab === 'favorites'

  return (
    <Pressable
      style={({ pressed }) => [
        styles.chip,
        isPinned && styles.chipPinned,
        isGlass && styles.chipGlass,
        pressed && !editMode && styles.chipPressed,
      ]}
      onPress={onPress}
      accessibilityLabel={item.label}
    >
      <GlassFill />
      {item.type === 'dir' ? (
        <Folder size={13} color={isPinned ? theme.text.accent : theme.text.secondary} />
      ) : (
        // session, conversation, and project-chat all visually represent a chat;
        // use the same lightning icon to match SessionCard branding.
        <Lightning size={13} color={isPinned ? theme.text.accent : theme.text.secondary} />
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

function makeStyles(theme: Theme) {
  return StyleSheet.create({
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
      backgroundColor: theme.bg.card,
      overflow: 'hidden',
    },
    chipPinned: {
      borderColor: theme.text.accent,
      backgroundColor: 'rgba(99,179,255,0.10)',
    },
    chipGlass: {
      backgroundColor: 'transparent',
    },
    chipPressed: { opacity: 0.65 },
    label: {
      color: theme.text.secondary,
      fontSize: font.xs,
      maxWidth: 140,
    },
    labelMono: {
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      fontSize: font.xs - 1,
    },
    labelPinned: { color: theme.text.accent },
    count: {
      color: theme.text.secondary,
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
}
