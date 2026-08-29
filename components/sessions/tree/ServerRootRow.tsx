import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { CaretDown, CaretRight } from 'phosphor-react-native'
import Svg, { Path } from 'react-native-svg'
import { useTheme } from '@/contexts/ThemeContext'
import { KnightRiderScanner } from '@/components/sessions/KnightRiderScanner'
import { ltrContentStyle, useAppDirection } from '@/lib/rtl'
import { makeStyles } from './ServerRootRow.styles'
import type { TreeNode } from './types'

interface Props {
  node: TreeNode
  serverLabel: string
  collapsible: boolean
  isExpanded: boolean
  onToggle: () => void
  onSelectLeaf: (node: TreeNode) => void
  isRefreshing?: boolean
}

export function ServerRootRow({ node, serverLabel, collapsible, isExpanded, onToggle, onSelectLeaf, isRefreshing }: Props) {
  const theme = useTheme()
  const { isRTL } = useAppDirection()
  const styles = makeStyles(theme)
  const hasDirectItems = (node.sessions.length + node.conversationCount) > 0

  const handlePress = () => {
    if (collapsible) {
      onToggle()
    } else if (hasDirectItems) {
      onSelectLeaf(node)
    }
  }

  return (
    <TouchableOpacity
      style={styles.drillRow}
      onPress={handlePress}
      activeOpacity={0.65}
    >
      {collapsible ? (
        isExpanded ? (
          <CaretDown size={14} color={theme.text.accent} weight="bold" />
        ) : (
          <CaretRight size={14} color={theme.text.secondary} weight="bold" mirrored={isRTL} />
        )
      ) : (
        <View style={[styles.statusDot, { backgroundColor: theme.text.secondary }]} />
      )}
      <View style={styles.drillContent}>
        <Text style={[styles.drillLabel, ltrContentStyle]} numberOfLines={1}>{serverLabel}</Text>
        {!collapsible ? (
          <Text style={[styles.drillStatus, ltrContentStyle]}>{node.name}</Text>
        ) : null}
      </View>
      {isRefreshing ? (
        <KnightRiderScanner testID="server-root-refreshing" />
      ) : null}
      {!collapsible && hasDirectItems ? (
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
