import React from 'react'
import { View, Text, Pressable, Modal, StyleSheet } from 'react-native'
import { ArrowRight, FolderOpen, Star, X } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { font, spacing, type Theme } from '@/constants/theme'
import { useTheme, useIsGlass } from '@/contexts/ThemeContext'
import { GlassView } from '@/components/ui/GlassView'
import type { ChipItem } from './QuickAccessChip'
import { flexRow } from '@/lib/rtl'

interface Props {
  item: ChipItem | null
  isFavorite: boolean
  onClose: () => void
  onNewSession: () => void
  onBrowse: () => void
  onOpenSession: () => void
  onTogglePin: () => void
}

export function QuickAccessActionSheet({
  item, isFavorite, onClose, onNewSession, onBrowse, onOpenSession, onTogglePin,
}: Props) {
  const { t } = useTranslation('shared')
  const theme = useTheme()
  const isGlass = useIsGlass()
  const styles = makeStyles(theme)
  if (!item) return null

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, isGlass && styles.sheetGlass]}>
        {isGlass ? <GlassView style={styles.glassFill} pointerEvents="none" /> : null}
        <Text style={styles.title} numberOfLines={1}>{item.label}</Text>

        {item.type === 'dir' ? (
          <>
            <Pressable style={styles.row} onPress={onNewSession}>
              <ArrowRight size={18} color={theme.text.accent} />
              <Text style={[styles.rowText, styles.rowTextPrimary]}>{t('quickAccess.newSessionHere')}</Text>
            </Pressable>
            <Pressable style={styles.row} onPress={onBrowse}>
              <FolderOpen size={18} color={theme.text.secondary} />
              <Text style={styles.rowText}>{t('quickAccess.browseDirectory')}</Text>
            </Pressable>
          </>
        ) : (
          <Pressable style={styles.row} onPress={onOpenSession}>
            <ArrowRight size={18} color={theme.text.accent} />
            <Text style={[styles.rowText, styles.rowTextPrimary]}>{t('quickAccess.openSession')}</Text>
          </Pressable>
        )}

        <Pressable style={styles.row} onPress={onTogglePin}>
          <Star size={18} color={theme.text.secondary} weight={isFavorite ? 'fill' : 'regular'} />
          <Text style={styles.rowText}>{isFavorite ? t('quickAccess.unpinFromFavorites') : t('quickAccess.pinToFavorites')}</Text>
        </Pressable>

        <Pressable style={[styles.row, styles.rowCancel]} onPress={onClose}>
          <X size={18} color={theme.status.failed} />
          <Text style={[styles.rowText, styles.rowTextCancel]}>{t('quickAccess.cancel')}</Text>
        </Pressable>
      </View>
    </Modal>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
    sheet: {
      backgroundColor: theme.bg.card,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      paddingBottom: 28,
      borderTopWidth: 1,
      borderColor: theme.border,
    },
    sheetGlass: {
      backgroundColor: 'transparent',
      overflow: 'hidden',
    },
    glassFill: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    title: {
      color: theme.text.secondary,
      fontSize: font.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      borderBottomWidth: 1,
      borderColor: theme.border,
    },
    row: {
      flexDirection: flexRow(),
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderColor: theme.bg.secondary,
    },
    rowText: { color: theme.text.primary, fontSize: font.base },
    rowTextPrimary: { color: theme.text.accent },
    rowCancel: { borderBottomWidth: 0 },
    rowTextCancel: { color: theme.status.failed },
  })
}
