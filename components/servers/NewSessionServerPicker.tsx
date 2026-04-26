import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet'
import type { ServerConfig } from '@/types/api'
import { dark, font, radius, spacing } from '@/constants/theme'

interface Props {
  visible: boolean
  serverIds: string[]
  servers: Record<string, ServerConfig>
  onPick: (serverId: string) => void
  onClose: () => void
}

const SNAP_POINTS = ['40%', '70%']

export function NewSessionServerPicker({ visible, serverIds, servers, onPick, onClose }: Props) {
  if (!visible) return null

  return (
    <BottomSheet
      snapPoints={SNAP_POINTS}
      index={0}
      enablePanDownToClose
      onClose={onClose}
      backgroundStyle={styles.sheetBg}
      handleIndicatorStyle={styles.handle}
    >
      <BottomSheetView style={styles.content}>
        <Text style={styles.title}>Start session on</Text>
        <View style={styles.list}>
          {serverIds.map((id) => {
            const server = servers[id]
            if (!server) return null
            return (
              <TouchableOpacity key={id} style={styles.row} onPress={() => onPick(id)}>
                <View style={styles.serverInfo}>
                  <Text style={styles.serverLabel} numberOfLines={1}>
                    {server.label || server.url}
                  </Text>
                  {server.label ? (
                    <Text style={styles.serverUrl} numberOfLines={1}>
                      {server.url}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            )
          })}
        </View>
        <View style={styles.actions}>
          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </BottomSheetView>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  sheetBg: { backgroundColor: dark.bg.secondary },
  handle: { backgroundColor: dark.border },
  content: { flex: 1, padding: spacing.md, gap: spacing.md },
  title: { color: dark.text.primary, fontSize: font.lg, fontWeight: '600' },
  list: { gap: spacing.sm },
  row: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: dark.border,
    backgroundColor: dark.bg.card,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  serverInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  serverLabel: {
    color: dark.text.primary,
    fontSize: font.base,
    fontWeight: '500',
  },
  serverUrl: {
    color: dark.text.secondary,
    fontSize: font.xs,
  },
  chevron: {
    color: dark.text.secondary,
    fontSize: font.xl,
    fontWeight: '300',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: 'auto',
    paddingTop: spacing.sm,
  },
  cancelButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  cancelText: {
    color: dark.text.secondary,
    fontSize: font.base,
  },
})
