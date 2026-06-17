import React, { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Switch } from 'react-native'
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet'
import { useTranslation } from 'react-i18next'
import type { AddServerAction } from '@/stores/settings'
import { type Theme, font, radius, spacing } from '@/constants/theme'
import { useTheme, useIsGlass } from '@/contexts/ThemeContext'
import { GlassSheet } from '@/components/ui/GlassSheet'

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
  const { t } = useTranslation(['servers', 'common'])
  const theme = useTheme()
  const isGlass = useIsGlass()
  const styles = makeStyles(theme)
  const [choice, setChoice] = useState<Choice>('add')
  const [rememberChoice, setRememberChoice] = useState(false)

  if (!visible) return null

  return (
    <BottomSheet
      snapPoints={SNAP_POINTS}
      index={0}
      enablePanDownToClose={false}
      backgroundStyle={styles.sheetBg}
      backgroundComponent={isGlass ? GlassSheet : undefined}
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
            trackColor={{ false: theme.border, true: theme.text.accent }}
            thumbColor={theme.colorMode === 'light' ? theme.bg.card : '#fff'}
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

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    sheetBg: { backgroundColor: theme.bg.secondary },
    handle: { backgroundColor: theme.border },
    content: { flex: 1, padding: spacing.md, gap: spacing.md },
    title: { color: theme.text.primary, fontSize: font.lg, fontWeight: '600' },
    subtitle: { color: theme.text.secondary, fontSize: font.base },
    options: { gap: spacing.sm },
    option: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: radius.md,
      backgroundColor: theme.bg.card,
      padding: spacing.md,
      gap: spacing.xs,
      minHeight: 44,
    },
    optionActive: {
      borderColor: theme.text.accent,
    },
    optionLabel: {
      color: theme.text.primary,
      fontSize: font.base,
      fontWeight: '500',
    },
    optionLabelActive: { color: theme.text.accent },
    optionDescription: {
      color: theme.text.secondary,
      fontSize: font.base,
    },
    rememberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    rememberLabel: {
      color: theme.text.primary,
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
      color: theme.text.secondary,
      fontSize: font.base,
    },
    applyButton: {
      minHeight: 44,
      justifyContent: 'center',
      paddingHorizontal: spacing.md,
    },
    applyText: {
      color: theme.text.accent,
      fontSize: font.base,
      fontWeight: '600',
    },
  })
}
