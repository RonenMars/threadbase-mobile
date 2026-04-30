import React, { useState } from 'react'
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Pressable,
} from 'react-native'
import { X, Copy, Check } from 'phosphor-react-native'
import * as Clipboard from 'expo-clipboard'
import { dark, font, spacing } from '@/constants/theme'

export interface InfoField {
  label: string
  value: string | null | undefined
}

interface Props {
  visible: boolean
  onClose: () => void
  title: string
  fields: InfoField[]
}

export function InfoModal({ visible, onClose, title, fields }: Props) {
  const [copiedLabel, setCopiedLabel] = useState<string | null>(null)

  const handleCopy = async (label: string, value: string) => {
    await Clipboard.setStringAsync(value)
    setCopiedLabel(label)
    setTimeout(() => setCopiedLabel(null), 1500)
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{title}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={8} accessibilityLabel="Close">
            <X size={22} color={dark.text.secondary} />
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {fields.map(({ label, value }) => {
            if (value == null || value === '') return null
            const isCopied = copiedLabel === label
            return (
              <View key={label} style={styles.row}>
                <View style={styles.rowLeft}>
                  <Text style={styles.label}>{label}</Text>
                  <Text style={styles.value} selectable>
                    {value}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.copyBtn}
                  onPress={() => handleCopy(label, value)}
                  accessibilityLabel={`Copy ${label}`}
                  hitSlop={8}
                >
                  {isCopied
                    ? <Check size={16} color={dark.text.success} />
                    : <Copy size={16} color={dark.text.secondary} />}
                </TouchableOpacity>
              </View>
            )
          })}
        </ScrollView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: dark.bg.secondary,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '70%',
    borderTopWidth: 1,
    borderColor: dark.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: dark.border,
  },
  headerTitle: {
    color: dark.text.primary,
    fontSize: font.base,
    fontWeight: '600',
  },
  scroll: { flexGrow: 0 },
  scrollContent: { paddingBottom: spacing.xl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: dark.border,
    gap: spacing.sm,
  },
  rowLeft: { flex: 1, gap: 2 },
  label: {
    color: dark.text.secondary,
    fontSize: font.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: {
    color: dark.text.primary,
    fontSize: font.sm,
    fontFamily: 'monospace',
  },
  copyBtn: {
    padding: spacing.xs,
  },
})
