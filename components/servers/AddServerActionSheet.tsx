import React, { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Switch } from 'react-native'
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet'
import { useTranslation } from 'react-i18next'
import type { AddServerAction } from '@/stores/settings'
import { dark, font, radius, spacing } from '@/constants/theme'

type Choice = Exclude<AddServerAction, 'ask'>

interface Props {
  visible: boolean
  onClose: () => void
  onConfirm: (choice: Choice, rememberChoice: boolean) => void
}

const SNAP_POINTS = ['55%']

const OPTIONS: { id: Choice; label: string; description: string }[] = [
  {
    id: 'add',
    label: 'Add to displayed',
    description: 'Keep the current selection and include the new server.',
  },
  {
    id: 'replace',
    label: 'Display only the new server',
    description: 'Replace displayed servers with the newly added one.',
  },
  {
    id: 'keep',
    label: 'Change nothing',
    description: 'Keep current displayed servers unchanged.',
  },
]

export function AddServerActionSheet({ visible, onClose, onConfirm }: Props) {
  const { t } = useTranslation('servers')
  const [choice, setChoice] = useState<Choice>('add')
  const [rememberChoice, setRememberChoice] = useState(false)

  if (!visible) return null

  return (
    <BottomSheet
      snapPoints={SNAP_POINTS}
      index={0}
      enablePanDownToClose={false}
      backgroundStyle={styles.sheetBg}
      handleIndicatorStyle={styles.handle}
    >
      <BottomSheetView style={styles.content}>
        <Text style={styles.title}>{t('addAction.title')}</Text>
        <Text style={styles.subtitle}>{t('addAction.subtitle')}</Text>

        <View style={styles.options}>
          {OPTIONS.map((option) => {
            const selected = choice === option.id
            return (
              <TouchableOpacity
                key={option.id}
                style={[styles.option, selected && styles.optionActive]}
                onPress={() => setChoice(option.id)}
              >
                <Text style={[styles.optionLabel, selected && styles.optionLabelActive]}>
                  {option.label}
                </Text>
                <Text style={styles.optionDescription}>{option.description}</Text>
              </TouchableOpacity>
            )
          })}
        </View>

        <View style={styles.rememberRow}>
          <Text style={styles.rememberLabel}>{t('addAction.rememberChoice')}</Text>
          <Switch
            value={rememberChoice}
            onValueChange={setRememberChoice}
            trackColor={{ false: dark.border, true: dark.text.accent }}
            thumbColor="#fff"
          />
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelText}>{t('common:button.cancel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.applyButton}
            onPress={() => onConfirm(choice, rememberChoice)}
          >
            <Text style={styles.applyText}>{t('common:button.confirm')}</Text>
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
  subtitle: { color: dark.text.secondary, fontSize: font.sm },
  options: { gap: spacing.sm },
  option: {
    borderWidth: 1,
    borderColor: dark.border,
    borderRadius: radius.md,
    backgroundColor: dark.bg.card,
    padding: spacing.md,
    gap: spacing.xs,
    minHeight: 44,
  },
  optionActive: {
    borderColor: dark.text.accent,
  },
  optionLabel: {
    color: dark.text.primary,
    fontSize: font.base,
    fontWeight: '500',
  },
  optionLabelActive: { color: dark.text.accent },
  optionDescription: {
    color: dark.text.secondary,
    fontSize: font.sm,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rememberLabel: {
    color: dark.text.primary,
    fontSize: font.base,
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
  applyButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  applyText: {
    color: dark.text.accent,
    fontSize: font.base,
    fontWeight: '600',
  },
})
