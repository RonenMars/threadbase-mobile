import React, { useCallback, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet'
import { NestableScrollContainer } from 'react-native-draggable-flatlist'
import { Tree, SquaresFour, List, LockSimple, LockSimpleOpen, Gear, ArrowDown, ArrowUp } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'expo-router'
import { DisplayedServersList } from '@/components/servers/DisplayedServersList'
import { useServersStore } from '@/stores/servers'
import { useSettingsStore } from '@/stores/settings'
import { brand, type Theme, font, radius, spacing } from '@/constants/theme'
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
  // Filter (conversations)
  providerFilter: 'claude-code' | 'codex-cli' | undefined
  onChangeProviderFilter: (v: 'claude-code' | 'codex-cli' | undefined) => void
}

const SNAP_POINTS = ['65%', '90%']

const LAYOUT_OPTIONS = [
  { value: 'tree', labelKey: 'settings:appearance.layoutTree', Icon: Tree },
  { value: 'hub', labelKey: 'settings:appearance.layoutHub', Icon: SquaresFour },
  { value: 'classic', labelKey: 'settings:appearance.layoutClassic', Icon: List },
] as const satisfies readonly {
  value: SessionsLayout
  labelKey: string
  Icon: React.ComponentType<{ size: number; color: string }>
}[]

const SORT_BY_OPTIONS = [
  { value: 'lastActivity', labelKey: 'filter.sortLastMessage' },
  { value: 'projectName', labelKey: 'filter.sortProjectName' },
  { value: 'startedAt', labelKey: 'filter.sortCreatedDate' },
  { value: 'status', labelKey: 'filter.status' },
] as const satisfies readonly { value: SortBy; labelKey: string }[]

const SORT_ORDER_OPTIONS = [
  { value: 'desc', labelKey: 'filter.newestFirst', Icon: ArrowDown },
  { value: 'asc', labelKey: 'filter.oldestFirst', Icon: ArrowUp },
] as const satisfies readonly {
  value: SortOrder
  labelKey: string
  Icon: React.ComponentType<{ size: number; color: string }>
}[]

export const ALL_STATUSES: SessionStatus[] = ['running', 'waiting_input', 'idle']

const DEFAULT_SORT_BY: SortBy = 'lastActivity'
const DEFAULT_SORT_ORDER: SortOrder = 'desc'

const DEFAULT_SESSIONS_LAYOUT: SessionsLayout = 'classic'

function isDefault(
  sortBy: SortBy,
  sortOrder: SortOrder,
  selectedStatuses: SessionStatus[],
  displayedServerIds: string[],
  activeServerIds: string[],
  sessionsLayout: SessionsLayout,
  providerFilter: 'claude-code' | 'codex-cli' | undefined,
): boolean {
  return (
    sortBy === DEFAULT_SORT_BY &&
    sortOrder === DEFAULT_SORT_ORDER &&
    selectedStatuses.length === ALL_STATUSES.length &&
    displayedServerIds.length === activeServerIds.length &&
    sessionsLayout === DEFAULT_SESSIONS_LAYOUT &&
    providerFilter === undefined
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
  providerFilter,
  onChangeProviderFilter,
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
  const router = useRouter()
  const glassBackground = useGlassSheetBackground()
  const { t, i18n } = useTranslation(['servers', 'settings'])
  const localeDirection = i18n.dir()
  const styles = makeStyles(theme, localeDirection)

  const openSettings = () => {
    onClose()
    router.push('/settings')
  }

  const STATUS_OPTIONS: { value: SessionStatus; label: string; color: string }[] = [
    { value: 'running', label: t('filter.statusRunning'), color: theme.status.running },
    { value: 'waiting_input', label: t('filter.statusActive'), color: theme.status.waiting },
    { value: 'idle', label: t('filter.statusIdle'), color: theme.status.idle },
  ]

  const showServerFilter = activeServerIds.length > 1

  const atDefault = isDefault(sortBy, sortOrder, selectedStatuses, displayedServerIds, activeServerIds, sessionsLayout, providerFilter)

  const handleReset = () => {
    onChangeSortBy(DEFAULT_SORT_BY)
    onChangeSortOrder(DEFAULT_SORT_ORDER)
    onChangeStatuses(ALL_STATUSES)
    onChangeProviderFilter(undefined)
    setSessionsLayout(DEFAULT_SESSIONS_LAYOUT)
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
        <View style={styles.titleActions}>
          <TouchableOpacity
            onPress={openSettings}
            style={styles.settingsButton}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('settings:header.title')}
            testID="filter-sort-settings-btn"
          >
            <Gear size={20} color={theme.text.secondary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeButton}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('filter.close')}
            testID="filter-sort-close-btn"
          >
            <Text style={styles.closeButtonText}>{t('filter.close')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* View */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, styles.standaloneSectionTitle]}>{t('filter.view')}</Text>
        <View style={styles.chipRow}>
          {LAYOUT_OPTIONS.map(({ value, labelKey, Icon }) => {
            const selected = sessionsLayout === value
            const label = t(labelKey)
            return (
              <TouchableOpacity
                key={value}
                onPress={() => setSessionsLayout(value)}
                style={[styles.chip, selected && styles.chipSelected]}
                accessibilityRole="button"
                accessibilityLabel={label}
                accessibilityState={{ selected }}
                testID={`layout-option-${value}`}
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
          <Text style={[styles.sectionTitle, styles.standaloneSectionTitle]}>{t('filter.sortBy')}</Text>
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
                    {t(opt.labelKey)}
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
          <Text style={[styles.sectionTitle, styles.standaloneSectionTitle]}>{t('filter.order')}</Text>
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
                  <opt.Icon size={14} color={selected ? theme.text.primary : theme.text.secondary} />
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                    {t(opt.labelKey)}
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

      {/* Provider */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, styles.standaloneSectionTitle]}>{t('filter.provider')}</Text>
        <View style={styles.chipRow}>
          {([
            { value: undefined, label: t('filter.all') },
            { value: 'claude-code' as const, label: 'Claude', color: brand.claude },
            { value: 'codex-cli' as const, label: 'Codex', color: brand.codex },
          ]).map((opt) => {
            const selected = providerFilter === opt.value
            return (
              <TouchableOpacity
                key={opt.label}
                onPress={() => onChangeProviderFilter(selected ? undefined : opt.value)}
                style={[styles.chip, selected && styles.chipSelected, opt.color && selected ? { borderColor: opt.color } : null]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                testID={`provider-filter-${opt.value ?? 'all'}`}
              >
                {opt.color ? <View style={[styles.chipDot, { backgroundColor: opt.color }]} /> : null}
                <Text style={[styles.chipText, selected && styles.chipTextSelected, opt.color && selected ? { color: opt.color } : null]}>
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

function makeStyles(theme: Theme, localeDirection: 'ltr' | 'rtl') {
  return StyleSheet.create({
    sheetBg: { backgroundColor: theme.bg.secondary },
    handle: { backgroundColor: theme.border },
    content: { padding: spacing.md, gap: spacing.lg, paddingBottom: spacing.xl },
    titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    title: { color: theme.text.primary, fontSize: font.lg, fontWeight: '600' },
    titleActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    settingsButton: { padding: spacing.xs },
    closeButton: { padding: spacing.xs },
    closeButtonText: { color: theme.text.secondary, fontSize: font.lg, lineHeight: font.lg },
    section: { gap: spacing.sm },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    sectionTitle: { color: theme.text.primary, fontSize: font.base, fontWeight: '600' },
    standaloneSectionTitle: {
      width: '100%',
      direction: localeDirection,
      writingDirection: localeDirection,
      textAlign: 'auto',
    },
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
