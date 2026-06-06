import React from 'react'
import { StyleSheet, Text, View, type ViewStyle } from 'react-native'
import { colors, fonts } from '../theme'

interface Props {
  title?: string
  children: React.ReactNode
  style?: ViewStyle
}

// Reusable terminal-styled card: traffic-light header + monospace body.
export function TerminalCard({ title = '~/threadbase pair', children, style }: Props) {
  return (
    <View style={[styles.card, style]}>
      <View style={styles.header}>
        <View style={[styles.dot, { backgroundColor: colors.red400 }]} />
        <View style={[styles.dot, { backgroundColor: colors.amber400 }]} />
        <View style={[styles.dot, { backgroundColor: colors.green400 }]} />
        <View style={styles.spacer} />
        <Text style={styles.title}>{title}</Text>
      </View>
      <View>{children}</View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.ink0,
    borderWidth: 1,
    borderColor: colors.ink5,
    borderRadius: 12,
    padding: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.ink5,
    marginBottom: 8,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  spacer: { flex: 1 },
  title: {
    color: colors.fg4,
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '500',
  },
})
