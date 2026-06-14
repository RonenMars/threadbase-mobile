import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { useTheme } from '@/contexts/ThemeContext'
import { makeStyles } from './ServerRootRow.styles'
import type { TreeNode } from './types'

interface Props {
  node: TreeNode
  serverLabel: string
  onSelectLeaf: (node: TreeNode) => void
}

export function ServerRootRow({ node, serverLabel, onSelectLeaf }: Props) {
  const theme = useTheme()
  const styles = makeStyles(theme)
  const hasDirectItems = (node.sessions.length + node.conversations.length) > 0

  return (
    <TouchableOpacity
      style={styles.drillRow}
      onPress={hasDirectItems ? () => onSelectLeaf(node) : undefined}
      activeOpacity={hasDirectItems ? 0.65 : 1}
    >
      <View style={[styles.statusDot, { backgroundColor: theme.text.secondary }]} />
      <View style={styles.drillContent}>
        <Text style={styles.drillLabel} numberOfLines={1}>{node.name}</Text>
        <Text style={styles.drillStatus}>{serverLabel}</Text>
      </View>
      {hasDirectItems ? (
        <Svg width={14} height={14} viewBox="0 0 16 16" fill="#2e7d4f">
          <Path d="M14 1H2C1.45 1 1 1.45 1 2v8c0 .55.45 1 1 1h2v3l3-3h7c.55 0 1-.45 1-1V2c0-.55-.45-1-1-1z" />
        </Svg>
      ) : null}
      {node.totalCount > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{node.totalCount}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  )
}
