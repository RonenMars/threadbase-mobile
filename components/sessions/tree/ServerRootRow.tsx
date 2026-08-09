import React from 'react'
import { ActivityIndicator, View, Text, TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'
import Svg, { Path } from 'react-native-svg'
import { useTheme } from '@/contexts/ThemeContext'
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
  const styles = makeStyles(theme)
  const { t } = useTranslation('sessions')
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
        <Text style={[styles.chevron, isExpanded && styles.chevronOpen]}>›</Text>
      ) : (
        <View style={[styles.statusDot, { backgroundColor: theme.text.secondary }]} />
      )}
      <View style={styles.drillContent}>
        <Text style={styles.drillLabel} numberOfLines={1}>{serverLabel}</Text>
        {!collapsible ? (
          <Text style={styles.drillStatus}>{node.name}</Text>
        ) : null}
      </View>
      {isRefreshing ? (
        <>
          {/* single-server Tree shows the cached-data banner above the list instead */}
          {collapsible ? (
            <Text style={styles.syncChip} numberOfLines={1}>{t('sync.cachedData')}</Text>
          ) : null}
          <ActivityIndicator size="small" color={theme.text.secondary} testID="server-root-refreshing" />
        </>
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
