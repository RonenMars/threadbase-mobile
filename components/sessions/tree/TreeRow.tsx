import { View, Text, TouchableOpacity, Pressable } from 'react-native'
import { CaretDown, CaretRight, ChatCircle } from 'phosphor-react-native'
import { spacing } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { ltrContentStyle, useAppDirection } from '@/lib/rtl'
import { activeSessionColor, hasLiveSession, latestActivityLabel } from './treeUtils'
import { LiveDot } from '@/components/sessions/LiveDot'
import { makeStyles } from './TreeRow.styles'
import type { TreeNode } from './types'

interface Props {
  node: TreeNode
  depth: number
  depthOffset: number
  isExpanded: boolean
  onToggle: (path: string) => void
  onSelectLeaf: (node: TreeNode) => void
}

export function TreeRow({ node, depth, depthOffset, isExpanded, onToggle, onSelectLeaf }: Props) {
  const theme = useTheme()
  const { isRTL } = useAppDirection()
  const styles = makeStyles(theme)
  const hasChildren = node.children.size > 0
  const hasItems = node.sessions.length + node.conversationCount > 0
  const isLeaf = !hasChildren
  const isMixed = hasChildren && hasItems
  const accentColor = activeSessionColor(node)
  const timeLabel = latestActivityLabel(node)
  const isLive = hasLiveSession(node)

  const handlePress = () => {
    if (isLeaf) {
      onSelectLeaf(node)
    } else {
      onToggle(node.fullPath)
    }
  }

  const indentLevels = Math.max(0, depth - depthOffset)

  return (
    <TouchableOpacity
      testID={`tree-row-${node.fullPath}`}
      style={[
        styles.row,
        { paddingStart: spacing.md + indentLevels * 16 },
      ]}
      onPress={handlePress}
      activeOpacity={0.65}
    >
      {/* Depth gutters — 1px hairlines per indent level. The blue-tinted tone
         makes the hierarchy traceable without adding chrome. */}
      {Array.from({ length: indentLevels }).map((_, i) => (
        <View
          key={`gutter-${i}`}
          style={[styles.gutter, { start: spacing.md + i * 16 + 8 }]}
        />
      ))}
      <View style={styles.iconSlot}>
        {hasChildren ? (
          isExpanded ? (
            <CaretDown size={14} color={theme.text.accent} weight="bold" />
          ) : (
            <CaretRight size={14} color={theme.text.secondary} weight="bold" mirrored={isRTL} />
          )
        ) : accentColor ? (
          // Pulsing brand dot when the leaf has any live session; static
          // otherwise. Matches SessionStatusBadge so a leaf in tree mode and
          // a row in classic/merged mode read identically.
          <LiveDot live={isLive} color={accentColor} size={6} />
        ) : (
          <View style={styles.leafDot} />
        )}
      </View>

      <Text
        style={[
          styles.label,
          ltrContentStyle,
          hasItems && styles.labelWithItems,
          isLeaf && accentColor ? { color: accentColor } : null,
        ]}
        numberOfLines={1}
      >
        {node.name}
      </Text>

      <View style={styles.meta}>
        {isMixed && (
          <Pressable
            onPress={(e) => {
              e.stopPropagation()
              onSelectLeaf(node)
            }}
            hitSlop={6}
            style={styles.chatIcon}
          >
            <ChatCircle
              size={14}
              weight="fill"
              color={`${theme.text.accent}cc`}
            />
          </Pressable>
        )}
        {node.totalCount > 0 && (
          <View style={[styles.badge, accentColor ? { backgroundColor: accentColor + '22' } : null]}>
            <Text style={[styles.badgeText, accentColor ? { color: accentColor } : null]}>
              {hasChildren && isExpanded
                ? `${node.directCount}/${node.totalCount}`
                : node.totalCount}
            </Text>
          </View>
        )}
        {timeLabel ? <Text style={styles.time}>{timeLabel}</Text> : null}
      </View>
    </TouchableOpacity>
  )
}
