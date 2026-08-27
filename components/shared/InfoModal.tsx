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
import { X, Copy, Check, type IconProps } from 'phosphor-react-native'
import * as Clipboard from 'expo-clipboard'
import { useTranslation } from 'react-i18next'
import { font, spacing, type Theme } from '@/constants/theme'
import { useTheme, useIsGlass } from '@/contexts/ThemeContext'
import { GlassFill } from '@/components/ui/GlassFill'
import { ltrContentStyle, textDirectionStyle, useAppDirection, useDirectionStyle } from '@/lib/rtl'

export interface InfoField {
  label: string
  value: string | null | undefined
}

export interface InfoModalAction {
  icon: React.ComponentType<IconProps>
  accessibilityLabel: string
  onPress: () => void
  testID?: string
}

interface Props {
  visible: boolean
  onClose: () => void
  title: string
  fields: InfoField[]
  action?: InfoModalAction
}

export function InfoModal({ visible, onClose, title, fields, action }: Props) {
  const { t } = useTranslation('common')
  const theme = useTheme()
  const isGlass = useIsGlass()
  const styles = makeStyles(theme)
  const directionStyle = useDirectionStyle()
  const { direction } = useAppDirection()
  const copyStyle = textDirectionStyle(direction)
  const [copiedLabel, setCopiedLabel] = useState<string | null>(null)

  const handleCopy = async (label: string, value: string) => {
    await Clipboard.setStringAsync(value)
    setCopiedLabel(label)
    setTimeout(() => setCopiedLabel(null), 1500)
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, isGlass && styles.sheetGlass, directionStyle]}>
        <GlassFill />
        <View style={styles.header}>
          <Text style={[styles.headerTitle, copyStyle]}>{title}</Text>
          <View style={styles.headerActions}>
            {action ? (
              <TouchableOpacity
                onPress={action.onPress}
                hitSlop={8}
                accessibilityLabel={action.accessibilityLabel}
                testID={action.testID}
              >
                <action.icon size={22} color={theme.text.secondary} />
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity testID="info-modal-close-button" onPress={onClose} hitSlop={8} accessibilityLabel={t('button.close')}>
              <X size={22} color={theme.text.secondary} />
            </TouchableOpacity>
          </View>
        </View>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {fields.map(({ label, value }) => {
            if (value == null || value === '') return null
            const isCopied = copiedLabel === label
            return (
              <View key={label} style={styles.row}>
                <View style={styles.rowLeft}>
                  <Text style={[styles.label, copyStyle]}>{label}</Text>
                  <Text style={[styles.value, ltrContentStyle]} selectable>
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
                    ? <Check size={16} color={theme.text.success} />
                    : <Copy size={16} color={theme.text.secondary} />}
                </TouchableOpacity>
              </View>
            )
          })}
        </ScrollView>
      </View>
    </Modal>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    sheet: {
      backgroundColor: theme.bg.secondary,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      maxHeight: '70%',
      borderTopWidth: 1,
      borderColor: theme.border,
    },
    sheetGlass: {
      backgroundColor: 'transparent',
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    headerTitle: {
      color: theme.text.primary,
      fontSize: font.base,
      fontWeight: '600',
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    scroll: { flexGrow: 0 },
    scrollContent: { paddingBottom: spacing.xl },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      gap: spacing.sm,
    },
    rowLeft: { flex: 1, gap: 2 },
    label: {
      color: theme.text.secondary,
      fontSize: font.xs,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    value: {
      color: theme.text.primary,
      fontSize: font.sm,
      fontFamily: 'monospace',
    },
    copyBtn: {
      padding: spacing.xs,
    },
  })
}
