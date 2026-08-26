import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { CaretDown, CaretRight } from 'phosphor-react-native'
import { useTheme } from '@/contexts/ThemeContext'
import { KnightRiderScanner } from '@/components/sessions/KnightRiderScanner'
import { ltrContentStyle, useAppDirection } from '@/lib/rtl'
import { makeStyles } from './ServerHeaderRow.styles'

interface Props {
  serverId: string
  serverLabel: string
  totalCount: number
  collapsible?: boolean
  isExpanded?: boolean
  onToggle?: () => void
  isRefreshing?: boolean
}

export function ServerHeaderRow({ serverId, serverLabel, totalCount, collapsible, isExpanded, onToggle, isRefreshing }: Props) {
  const theme = useTheme()
  const { isRTL } = useAppDirection()
  const styles = makeStyles(theme)

  const scanner = isRefreshing ? (
    <KnightRiderScanner testID={`server-header-refreshing-${serverId}`} />
  ) : null

  const chevron = collapsible ? (
    isExpanded ? (
      <CaretDown size={14} color={theme.text.accent} weight="bold" />
    ) : (
      <CaretRight size={14} color={theme.text.secondary} weight="bold" mirrored={isRTL} />
    )
  ) : null

  const inner = (
    <>
      <Text style={[styles.label, ltrContentStyle]} numberOfLines={1}>{serverLabel}</Text>
      {scanner}
      <Text style={[styles.count, ltrContentStyle]}>{totalCount}</Text>
      {chevron}
    </>
  )

  if (collapsible) {
    return (
      <TouchableOpacity style={styles.row} testID={`server-header-${serverId}`} onPress={onToggle} activeOpacity={0.65}>
        {inner}
      </TouchableOpacity>
    )
  }

  return (
    <View style={styles.row} testID={`server-header-${serverId}`}>
      {inner}
    </View>
  )
}
