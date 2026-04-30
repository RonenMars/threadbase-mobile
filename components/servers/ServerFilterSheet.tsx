import React, { useCallback, useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet'
import { DisplayedServersList } from '@/components/servers/DisplayedServersList'
import { useServersStore } from '@/stores/servers'
import { dark, font, radius, spacing } from '@/constants/theme'
import type { SessionStatus } from '@/types/api'

export type SortType = 'lastActivity' | 'startedAt'

interface Props {
  visible: boolean
  onClose: () => void
  selectedStatuses?: SessionStatus[]
  onChangeStatuses?: (statuses: SessionStatus[]) => void
  sortType?: SortType
  onChangeSortType?: (sort: SortType) => void
}

const SNAP_POINTS = ['50%', '85%']

const STATUS_OPTIONS: { value: SessionStatus; label: string; color: string }[] = [
  { value: 'running', label: 'Running', color: dark.status.running },
  { value: 'idle', label: 'Idle', color: dark.status.idle },
]

const SORT_OPTIONS: { value: SortType; label: string }[] = [
  { value: 'lastActivity', label: 'Last activity' },
  { value: 'startedAt', label: 'Started' },
]

const ALL_STATUSES: SessionStatus[] = STATUS_OPTIONS.map((s) => s.value)

function toggleStatus(selected: SessionStatus[], status: SessionStatus): SessionStatus[] {
  if (selected.includes(status)) return selected.filter((s) => s !== status)
  return [...selected, status]
}

export function ServerFilterSheet({
  visible,
  onClose,
  selectedStatuses,
  onChangeStatuses,
  sortType,
  onChangeSortType,
}: Props) {
  const activeServerIds = useServersStore((s) => s.activeServerIds)
  const displayedServerIds = useServersStore((s) => s.displayedServerIds)
  const servers = useServersStore((s) => s.servers)
  const setDisplayedServerIds = useServersStore((s) => s.setDisplayedServerIds)
  const [draftIds, setDraftIds] = useState<string[]>(displayedServerIds)
  const [draftStatuses, setDraftStatuses] = useState<SessionStatus[]>(
    selectedStatuses ?? ALL_STATUSES,
  )
  const [draftSort, setDraftSort] = useState<SortType>(sortType ?? 'lastActivity')

  useEffect(() => {
    setDraftIds(displayedServerIds)
  }, [displayedServerIds, visible])

  useEffect(() => {
    if (selectedStatuses) setDraftStatuses(selectedStatuses)
  }, [selectedStatuses, visible])

  useEffect(() => {
    if (sortType) setDraftSort(sortType)
  }, [sortType, visible])

  const renderBackdrop = useCallback(
    (props: React.ComponentProps<typeof BottomSheetBackdrop>) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} pressBehavior="close" />
    ),
    [],
  )

  if (!visible) return null

  const showStatusFilter = Boolean(onChangeStatuses)
  const showSortFilter = Boolean(onChangeSortType)
  const showServerFilter = activeServerIds.length > 1

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
          <Text style={styles.title}>Filters</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton} hitSlop={8}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        {showSortFilter ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Sort by</Text>
            <View style={styles.chipRow}>
              {SORT_OPTIONS.map((opt) => {
                const selected = draftSort === opt.value
                return (
                  <TouchableOpacity
                    key={opt.value}
                    onPress={() => setDraftSort(opt.value)}
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
        ) : null}

        {showStatusFilter ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Status</Text>
              <View style={styles.quickRow}>
                <TouchableOpacity
                  style={styles.quickButton}
                  onPress={() => setDraftStatuses(ALL_STATUSES)}
                >
                  <Text style={styles.quickButtonText}>All</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.quickButton}
                  onPress={() => setDraftStatuses([])}
                >
                  <Text style={styles.quickButtonText}>None</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.chipRow}>
              {STATUS_OPTIONS.map((opt) => {
                const selected = draftStatuses.includes(opt.value)
                return (
                  <TouchableOpacity
                    key={opt.value}
                    onPress={() => setDraftStatuses(toggleStatus(draftStatuses, opt.value))}
                    style={[styles.chip, selected && styles.chipSelected]}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                  >
                    <View style={[styles.chipDot, { backgroundColor: opt.color }]} />
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          </View>
        ) : null}

        {showServerFilter ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Servers</Text>
            <DisplayedServersList
              activeServerIds={activeServerIds}
              servers={servers}
              selectedServerIds={draftIds}
              onChange={setDraftIds}
            />
          </View>
        ) : null}

        <View style={styles.actions}>
          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.applyButton}
            onPress={() => {
              setDisplayedServerIds(draftIds)
              onChangeStatuses?.(draftStatuses)
              onChangeSortType?.(draftSort)
              onClose()
            }}
          >
            <Text style={styles.applyText}>Apply</Text>
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
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
  chipDot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
  },
  chipText: {
    color: dark.text.secondary,
    fontSize: font.sm,
    fontWeight: '500',
  },
  chipTextSelected: {
    color: dark.text.primary,
  },
  quickRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  quickButton: {
    backgroundColor: dark.bg.card,
    borderColor: dark.border,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    minHeight: 32,
    justifyContent: 'center',
  },
  quickButtonText: {
    color: dark.text.secondary,
    fontSize: font.xs,
    fontWeight: '500',
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
