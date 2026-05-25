import React, { useCallback, useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet'
import { useTranslation } from 'react-i18next'
import { dark, font, radius, spacing } from '@/constants/theme'
import type { SortBy, SortOrder } from '@/types/ui'

interface Props {
  visible: boolean
  onClose: () => void
  sortBy: SortBy
  sortOrder: SortOrder
  onChangeSortBy: (v: SortBy) => void
  onChangeSortOrder: (v: SortOrder) => void
}

const SNAP_POINTS = ['40%', '70%']

const SORT_BY_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'projectName', label: 'Project name' },
  { value: 'lastActivity', label: 'Last message' },
  { value: 'startedAt', label: 'Created date' },
  { value: 'status', label: 'Status' },
]

const SORT_ORDER_OPTIONS: { value: SortOrder; label: string }[] = [
  { value: 'asc', label: '↑ Ascending' },
  { value: 'desc', label: '↓ Descending' },
]

export function SortSheet({
  visible,
  onClose,
  sortBy,
  sortOrder,
  onChangeSortBy,
  onChangeSortOrder,
}: Props) {
  const { t } = useTranslation(['servers', 'common'])
  const [draftBy, setDraftBy] = useState<SortBy>(sortBy)
  const [draftOrder, setDraftOrder] = useState<SortOrder>(sortOrder)

  useEffect(() => {
    queueMicrotask(() => {
      setDraftBy(sortBy)
      setDraftOrder(sortOrder)
    })
  }, [sortBy, sortOrder, visible])

  const renderBackdrop = useCallback(
    (props: React.ComponentProps<typeof BottomSheetBackdrop>) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} pressBehavior="close" />
    ),
    [],
  )

  if (!visible) return null

  return (
    <BottomSheet
      snapPoints={SNAP_POINTS}
      index={0}
      enablePanDownToClose
      onClose={onClose}
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.sheetBg}
      handleIndicatorStyle={styles.handle}
    >
      <BottomSheetView style={styles.content}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{t('filter.sortTitle')}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton} hitSlop={8}>
            <Text style={styles.closeButtonText}>{t('filter.close')}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('filter.sortBy')}</Text>
          <View style={styles.chipRow}>
            {SORT_BY_OPTIONS.map((opt) => {
              const selected = draftBy === opt.value
              return (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => setDraftBy(opt.value)}
                  style={[styles.chip, selected && styles.chipSelected]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('filter.order')}</Text>
          <View style={styles.chipRow}>
            {SORT_ORDER_OPTIONS.map((opt) => {
              const selected = draftOrder === opt.value
              return (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => setDraftOrder(opt.value)}
                  style={[styles.chip, selected && styles.chipSelected]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelText}>{t('common:button.cancel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.applyButton}
            onPress={() => {
              onChangeSortBy(draftBy)
              onChangeSortOrder(draftOrder)
              onClose()
            }}
          >
            <Text style={styles.applyText}>{t('common:button.apply')}</Text>
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
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: dark.text.primary, fontSize: font.lg, fontWeight: '600' },
  closeButton: { padding: spacing.xs },
  closeButtonText: { color: dark.text.secondary, fontSize: font.lg, lineHeight: font.lg },
  section: { gap: spacing.sm },
  sectionTitle: {
    color: dark.text.primary,
    fontSize: font.base,
    fontWeight: '600',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: dark.border,
    backgroundColor: dark.bg.card,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    minHeight: 36,
  },
  chipSelected: {
    borderColor: dark.text.accent,
    backgroundColor: dark.bg.primary,
  },
  chipText: {
    color: dark.text.secondary,
    fontSize: font.sm,
    fontWeight: '500',
  },
  chipTextSelected: {
    color: dark.text.primary,
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
