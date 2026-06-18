import React, { useCallback, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet'
import { NestableScrollContainer } from 'react-native-draggable-flatlist'
import { Tree, SquaresFour, List, LockSimple, LockSimpleOpen } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { DisplayedServersList } from '@/components/servers/DisplayedServersList'
import { useServersStore } from '@/stores/servers'
import { useSettingsStore } from '@/stores/settings'
import { type Theme, font, radius, spacing } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { useGlassSheetBackground } from '@/components/ui/GlassSheet'
import type { SessionStatus } from '@/types/api'
import type { SortBy, SortOrder, SessionsLayout } from '@/types/ui'

interface Props {
  visible: boolean
  onClose: () => void
  // Sort (hub mode)
  sortBy: SortBy
  sortOrder: SortOrder
  onChangeSortBy: (v: SortBy) => void
  onChangeSortOrder: (v: SortOrder) => void
  // Filter (sessions)
  selectedStatuses: SessionStatus[]
  onChangeStatuses: (v: SessionStatus[]) => void
}

const SNAP_POINTS = ['65%', '90%']

const LAYOUT_OPTIONS: { value: SessionsLayout; label: string; Icon: React.ComponentType<{ size: number; color: string }> }[] = [
  { value: 'tree', label: 'Tree', Icon: Tree },
  { value: 'hub', label: 'Hub', Icon: SquaresFour },
  { value: 'classic', label: 'Classic', Icon: List },
]

const SORT_BY_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'lastActivity', label: 'Last message' },
  { value: 'projectName', label: 'Project name' },
  { value: 'startedAt', label: 'Created date' },
  { value: 'status', label: 'Status' },
]

const SORT_ORDER_OPTIONS: { value: SortOrder; label: string }[] = [
  { value: 'desc', label: '↓ Newest first' },
  { value: 'asc', label: '↑ Oldest first' },
]

const ALL_STATUSES: SessionStatus[] = ['running', 'idle']

const DEFAULT_SORT_BY: SortBy = 'lastActivity'
const DEFAULT_SORT_ORDER: SortOrder = 'desc'

function isDefault(
  sortBy: SortBy,
  sortOrder: SortOrder,
  selectedStatuses: SessionStatus[],
  displayedServerIds: string[],
  activeServerIds: string[],
  sessionsLayout: SessionsLayout,
): boolean {
  return (
    sortBy === DEFAULT_SORT_BY &&
    sortOrder === DEFAULT_SORT_ORDER &&
    selectedStatuses.length === ALL_STATUSES.length &&
    displayedServerIds.length === activeServerIds.length &&
    sessionsLayout === 'tree'
  )
}

function toggleStatus(selected: SessionStatus[], status: SessionStatus): SessionStatus[] {
  if (selected.includes(status)) return selected.filter((s) => s !== status)
  return [...selected, status]
}

export function FilterSortSheet({
  visible,
  onClose,
  sortBy,
  sortOrder,
  onChangeSortBy,
  onChangeSortOrder,
  selectedStatuses,
  onChangeStatuses,
}: Props) {
  const activeServerIds = useServersStore((s) => s.activeServerIds)
  const displayedServerIds = useServersStore((s) => s.displayedServerIds)
  const servers = useServersStore((s) => s.servers)
  const setDisplayedServerIds = useServersStore((s) => s.setDisplayedServerIds)
  const reorderServers = useServersStore((s) => s.reorderServers)
  const [isEditingOrder, setIsEditingOrder] = useState(false)
  const sessionsLayout = useSettingsStore((s) => s.sessionsLayout)
  const setSessionsLayout = useSettingsStore((s) => s.setSessionsLayout)
  const theme = useTheme()
  const glassBackground = useGlassSheetBackground()
  const styles = makeStyles(theme)

  const STATUS_OPTIONS: { value: SessionStatus; label: string; color: string }[] = [
    { value: 'running', label: 'Running', color: theme.status.running },
    { value: 'idle', label: 'Idle', color: theme.status.idle },
  ]

  const { t } = useTranslation('servers')
  const showServerFilter = activeServerIds.length > 1

  const atDefault = isDefault(sortBy, sortOrder, selectedStatuses, displayedServerIds, activeServerIds, sessionsLayout)

  const handleReset = () => {
    onChangeSortBy(DEFAULT_SORT_BY)
    onChangeSortOrder(DEFAULT_SORT_ORDER)
    onChangeStatuses(ALL_STATUSES)
    setSessionsLayout('tree')
    if (showServerFilter) setDisplayedServerIds(activeServerIds)
  }

  const renderBackdrop = useCallback(
    (props: React.ComponentProps<typeof BottomSheetBackdrop>) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} pressBehavior="close" />
    ),
    [],
  )

  if (!visible) return null

  const sheetContent = (
    <>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{t('filter.filterSort')}</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton} hitSlop={8}>
          <Text style={styles.closeButtonText}>{t('filter.close')}</Text>
        </TouchableOpacity>
      </View>

      {/* View */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('filter.view')}</Text>
        <View style={styles.chipRow}>
          {LAYOUT_OPTIONS.map(({ value, label, Icon }) => {
            const selected = sessionsLayout === value
            return (
              <TouchableOpacity
                key={value}
                onPress={() => setSessionsLayout(value)}
                style={[styles.chip, selected && styles.chipSelected]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <Icon size={14} color={selected ? theme.text.primary : theme.text.secondary} />
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                  {label}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>
      </View>

      {/* Sort by — hidden for Tree layout (sort doesn't apply to folder hierarchy) */}
      {sessionsLayout !== 'tree' ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('filter.sortBy')}</Text>
          <View style={styles.chipRow}>
            {SORT_BY_OPTIONS.map((opt) => {
              const selected = sortBy === opt.value
              return (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => onChangeSortBy(opt.value)}
                  style={[styles.chip, selected && styles.chipSelected]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  testID={`sort-option-${opt.value}`}
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

      {/* Order — hidden for Tree layout */}
      {sessionsLayout !== 'tree' ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('filter.order')}</Text>
          <View style={styles.chipRow}>
            {SORT_ORDER_OPTIONS.map((opt) => {
              const selected = sortOrder === opt.value
              return (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => onChangeSortOrder(opt.value)}
                  style={[styles.chip, selected && styles.chipSelected]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  testID={`sort-order-${opt.value}`}
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

      {/* Status */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('filter.status')}</Text>
          <View style={styles.quickRow}>
            <TouchableOpacity style={styles.quickButton} onPress={() => onChangeStatuses(ALL_STATUSES)}>
              <Text style={styles.quickButtonText}>{t('filter.all')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickButton} onPress={() => onChangeStatuses([])}>
              <Text style={styles.quickButtonText}>{t('filter.none')}</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.chipRow}>
          {STATUS_OPTIONS.map((opt) => {
            const selected = selectedStatuses.includes(opt.value)
            return (
              <TouchableOpacity
                key={opt.value}
                onPress={() => onChangeStatuses(toggleStatus(selectedStatuses, opt.value))}
                style={[styles.chip, selected && styles.chipSelected]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                testID={`status-toggle-${opt.value}`}
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

      {/* Servers */}
      {showServerFilter ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('filter.servers')}</Text>
            {activeServerIds.length >= 2 ? (
              <TouchableOpacity
                onPress={() => setIsEditingOrder((v) => !v)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={isEditingOrder ? t('filter.lockOrder') : t('filter.editOrder')}
                accessibilityState={{ selected: isEditingOrder }}
                testID="server-order-toggle"
              >
                {isEditingOrder
                  ? <LockSimpleOpen size={18} color={theme.text.accent} />
                  : <LockSimple size={18} color={theme.text.secondary} />
                }
              </TouchableOpacity>
            ) : null}
          </View>
          <DisplayedServersList
            activeServerIds={activeServerIds}
            servers={servers}
            selectedServerIds={displayedServerIds}
            onChange={setDisplayedServerIds}
            isEditingOrder={isEditingOrder}
            onReorder={reorderServers}
          />
        </View>
      ) : null}

      {/* Reset */}
      <TouchableOpacity
        style={[styles.resetButton, atDefault && styles.resetButtonDisabled]}
        onPress={handleReset}
        disabled={atDefault}
      >
        <Text style={[styles.resetText, atDefault && styles.resetTextDisabled]}>
          {t('filter.resetDefaults')}
        </Text>
      </TouchableOpacity>
    </>
  )

  return (
    <BottomSheet
      snapPoints={SNAP_POINTS}
      index={0}
      enablePanDownToClose={!isEditingOrder}
      onClose={onClose}
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.sheetBg}
      backgroundComponent={glassBackground}
      handleIndicatorStyle={styles.handle}
    >
      {isEditingOrder ? (
        <NestableScrollContainer contentContainerStyle={styles.content} testID="filter-sort-sheet">
          {sheetContent}
        </NestableScrollContainer>
      ) : (
        <BottomSheetScrollView contentContainerStyle={styles.content} testID="filter-sort-sheet">
          {sheetContent}
        </BottomSheetScrollView>
      )}
    </BottomSheet>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    sheetBg: { backgroundColor: theme.bg.secondary },
    handle: { backgroundColor: theme.border },
    content: { padding: spacing.md, gap: spacing.lg, paddingBottom: spacing.xl },
    titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    title: { color: theme.text.primary, fontSize: font.lg, fontWeight: '600' },
    closeButton: { padding: spacing.xs },
    closeButtonText: { color: theme.text.secondary, fontSize: font.lg, lineHeight: font.lg },
    section: { gap: spacing.sm },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    sectionTitle: { color: theme.text.primary, fontSize: font.base, fontWeight: '600' },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.bg.card,
      borderRadius: radius.full,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      minHeight: 36,
    },
    chipSelected: { borderColor: theme.text.accent, backgroundColor: theme.bg.primary },
    chipDot: { width: 8, height: 8, borderRadius: radius.full },
    chipText: { color: theme.text.secondary, fontSize: font.base, fontWeight: '500' },
    chipTextSelected: { color: theme.text.primary },
    quickRow: { flexDirection: 'row', gap: spacing.sm },
    quickButton: {
      backgroundColor: theme.bg.card,
      borderColor: theme.border,
      borderWidth: 1,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      minHeight: 32,
      justifyContent: 'center',
    },
    quickButtonText: { color: theme.text.secondary, fontSize: font.xs, fontWeight: '500' },
    resetButton: {
      marginTop: spacing.sm,
      alignItems: 'center',
      paddingVertical: spacing.sm,
      minHeight: 44,
      justifyContent: 'center',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.border,
    },
    resetButtonDisabled: { opacity: 0.35 },
    resetText: { color: theme.text.accent, fontSize: font.base, fontWeight: '500' },
    resetTextDisabled: { color: theme.text.secondary },
  })
}
