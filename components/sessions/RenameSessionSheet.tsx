import React, { useRef, useState, useCallback, useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import BottomSheet, { BottomSheetTextInput } from '@gorhom/bottom-sheet'
import { dark, font, radius, spacing } from '@/constants/theme'

interface Props {
  currentName: string
  onSave: (name: string) => void
  onClose: () => void
}

export function RenameSessionSheet({ currentName, onSave, onClose }: Props) {
  const sheetRef = useRef<BottomSheet>(null)
  const [name, setName] = useState(currentName)

  useEffect(() => {
    setName(currentName)
  }, [currentName])

  const handleSave = useCallback(() => {
    const trimmed = name.trim()
    if (trimmed) onSave(trimmed)
    sheetRef.current?.close()
  }, [name, onSave])

  return (
    <BottomSheet
      ref={sheetRef}
      snapPoints={['35%']}
      enablePanDownToClose
      onClose={onClose}
      backgroundStyle={{ backgroundColor: dark.bg.card }}
      handleIndicatorStyle={{ backgroundColor: dark.border }}
      keyboardBehavior="interactive"
    >
      <View style={styles.container}>
        <Text style={styles.title}>Rename session</Text>
        <BottomSheetTextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Session name"
          placeholderTextColor={dark.text.secondary}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={handleSave}
        />
        <View style={styles.row}>
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.75}>
            <Text style={styles.cancelLabel}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.75}>
            <Text style={styles.saveLabel}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  title: {
    color: dark.text.primary,
    fontSize: font.lg,
    fontWeight: '600',
  },
  input: {
    backgroundColor: dark.bg.secondary,
    borderWidth: 1,
    borderColor: dark.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: dark.text.primary,
    fontSize: font.base,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: dark.border,
    alignItems: 'center',
  },
  cancelLabel: {
    color: dark.text.secondary,
    fontSize: font.base,
    fontWeight: '500',
  },
  saveBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: dark.text.accent,
    alignItems: 'center',
  },
  saveLabel: {
    color: dark.bg.primary,
    fontSize: font.base,
    fontWeight: '600',
  },
})
