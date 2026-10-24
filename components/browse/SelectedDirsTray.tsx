import React, { useMemo } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { FolderPlus, X } from 'phosphor-react-native'
import { basename } from '@/components/sessions/shared/pathTail'
import { font, radius, spacing, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { MAX_ADDITIONAL_PATHS } from '@/lib/additionalPaths'
import { ltrContentStyle, textDirectionStyle, useAppDirection } from '@/lib/rtl'

interface Props {
  /** Extra directories picked so far, relative to the browse root. */
  paths: string[]
  /** Whether the folder currently open can be added (not already picked, list not full). */
  canAdd: boolean
  disabled?: boolean
  onAdd: () => void
  onRemove: (path: string) => void
}

// The browse root is `''`; label it the way the breadcrumbs do.
function dirLabel(path: string): string {
  return path === '' ? '~' : (basename(path) ?? path)
}

export function SelectedDirsTray({ paths, canAdd, disabled = false, onAdd, onRemove }: Props) {
  const theme = useTheme()
  const styles = useMemo(() => makeStyles(theme), [theme])
  const { t } = useTranslation('browse')
  const { direction } = useAppDirection()
  const copyStyle = textDirectionStyle(direction)
  const addDisabled = disabled || !canAdd

  return (
    <View style={styles.container} testID="browse-extra-dirs">
      <View style={styles.header}>
        <Text style={[styles.title, copyStyle]}>
          {t('nav.extraDirsTitle', { selected: paths.length, max: MAX_ADDITIONAL_PATHS })}
        </Text>
        <TouchableOpacity
          style={[styles.addBtn, addDisabled && styles.disabled]}
          onPress={() => {
            if (!addDisabled) onAdd()
          }}
          accessibilityRole="button"
          accessibilityState={{ disabled: addDisabled }}
          testID="browse-add-directory"
        >
          <FolderPlus size={16} color={theme.text.accent} />
          <Text style={styles.addText}>{t('nav.addDirectory')}</Text>
        </TouchableOpacity>
      </View>
      {paths.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {paths.map((path) => {
            const label = dirLabel(path)
            return (
              <View key={path} style={styles.chip} testID={`browse-extra-dir-${path || '~'}`}>
                <Text style={[styles.chipText, ltrContentStyle]} numberOfLines={1}>
                  {label}
                </Text>
                <TouchableOpacity
                  onPress={() => onRemove(path)}
                  disabled={disabled}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={t('nav.removeDirectory', { name: label })}
                  testID={`browse-remove-extra-dir-${path || '~'}`}
                >
                  <X size={14} color={theme.text.secondary} />
                </TouchableOpacity>
              </View>
            )
          })}
        </ScrollView>
      ) : (
        <Text style={[styles.hint, copyStyle]}>{t('nav.extraDirsHint')}</Text>
      )}
    </View>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      marginHorizontal: spacing.xl,
      marginBottom: spacing.sm,
      gap: spacing.xs,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    title: {
      flex: 1,
      color: theme.text.secondary,
      fontSize: font.xs,
      fontWeight: '600',
    },
    addBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: theme.border,
    },
    addText: {
      color: theme.text.accent,
      fontSize: font.sm,
      fontWeight: '600',
    },
    disabled: {
      opacity: 0.4,
    },
    chips: {
      gap: spacing.xs,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      maxWidth: 200,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.md,
      backgroundColor: theme.bg.secondary,
      borderWidth: 1,
      borderColor: theme.border,
    },
    chipText: {
      flexShrink: 1,
      color: theme.text.primary,
      fontSize: font.sm,
    },
    hint: {
      color: theme.text.secondary,
      fontSize: font.xs,
      lineHeight: 16,
    },
  })
}
