import React, { useCallback, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet'
import { NestableScrollContainer } from 'react-native-draggable-flatlist'
import { Check, LockSimple, LockSimpleOpen, Gear } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { TFunction } from 'i18next'
import { DisplayedServersList } from '@/components/servers/DisplayedServersList'
import { colorForToken } from '@/components/sessions/SessionStatusBadge'
import { getSessionTierLabel } from '@/components/sessions/StateBadge'
import { useServersStore } from '@/stores/servers'
import { type ProviderName, providerLabelKey } from '@/constants/providers'
import { type Theme, font, radius, spacing } from '@/constants/theme'
import { MONO_FONT } from '@/constants/mono'
import { useTheme, useIsGlass } from '@/contexts/ThemeContext'
import { useGlassSheetBackground } from '@/components/ui/GlassSheet'
import { tierColorToken, type SessionTier } from '@/lib/sessionPresentation'
import {
  ALL_PROVIDERS,
  ALL_TIERS,
  DEFAULT_FILTERS,
  isDefaultFilters,
  isNeedsMePreset,
  type ActiveWithin,
  type ListFilters,
} from '@/lib/sessionFilters'
import type { SortBy, SortOrder } from '@/types/ui'
import { useAppDirection } from '@/lib/rtl'
import { getActiveWithinLabel, getSortByLabel, getSortOrderLabel } from './filterSortLabels'

interface Props {
  visible: boolean
  onClose: () => void
  order: SortBy
  onChangeOrder: (v: SortBy) => void
  direction: SortOrder
  onChangeDirection: (v: SortOrder) => void
  filters: ListFilters
  onChangeFilters: (v: ListFilters) => void
  /** Live counts on the unfiltered rows, so a chip says what it would keep. */
  tierCounts: Record<SessionTier, number>
  providerCounts: Record<ProviderName, number>
  /** Rows the current filters keep; drives the primary button. */
  resultCount: number
}

const SNAP_POINTS = ['65%', '90%']
const ORDER_OPTIONS: readonly SortBy[] = ['state', 'lastActivity', 'projectName']
const WITHIN_OPTIONS: readonly ActiveWithin[] = ['any', 'today', '7d', '30d']
const DEFAULT_ORDER: SortBy = 'state'
const DEFAULT_DIRECTION: SortOrder = 'desc'

function getProviderLabel(provider: ProviderName, t: TFunction<['servers', 'settings', 'sessions']>): string {
  switch (providerLabelKey(provider)) {
    case 'claude':
      return t('sessions:provider.claude')
    case 'codex':
      return t('sessions:provider.codex')
    case 'cursor':
      return t('sessions:provider.cursor')
  }
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value]
}

/**
 * Filter & sort for the session list. Navigation (the view switch) lives on the
 * list itself, not here; every control uses one selection model — a chip is on
 * or off — and the footer always says what the choice leaves behind.
 */
export function FilterSortSheet({
  visible,
  onClose,
  order,
  onChangeOrder,
  direction,
  onChangeDirection,
  filters,
  onChangeFilters,
  tierCounts,
  providerCounts,
  resultCount,
}: Props) {
  const activeServerIds = useServersStore((s) => s.activeServerIds)
  const displayedServerIds = useServersStore((s) => s.displayedServerIds)
  const servers = useServersStore((s) => s.servers)
  const setDisplayedServerIds = useServersStore((s) => s.setDisplayedServerIds)
  const reorderServers = useServersStore((s) => s.reorderServers)
  const [isEditingOrder, setIsEditingOrder] = useState(false)
  const theme = useTheme()
  const isGlass = useIsGlass()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const glassBackground = useGlassSheetBackground()
  const { t, i18n } = useTranslation(['servers', 'settings', 'sessions'])
  const { t: tSessions } = useTranslation('sessions')
  // Same i18next-derived direction as the rest of the app; this sheet renders
  // inline (not in an RN Modal), so it also inherits the app root's direction.
  const { direction: localeDirection } = useAppDirection()
  const styles = makeStyles(theme, localeDirection)

  const openSettings = () => {
    onClose()
    router.push('/settings')
  }

  const showServerFilter = activeServerIds.length > 1
  const atDefault =
    order === DEFAULT_ORDER &&
    direction === DEFAULT_DIRECTION &&
    isDefaultFilters(filters) &&
    displayedServerIds.length === activeServerIds.length
  const needsMe = isNeedsMePreset(filters)
  const everything = isDefaultFilters(filters)
  const noResults = resultCount === 0

  const handleReset = () => {
    onChangeOrder(DEFAULT_ORDER)
    onChangeDirection(DEFAULT_DIRECTION)
    onChangeFilters(DEFAULT_FILTERS)
    if (showServerFilter) setDisplayedServerIds(activeServerIds)
  }

  const renderBackdrop = useCallback(
    (props: React.ComponentProps<typeof BottomSheetBackdrop>) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} pressBehavior="close" />
    ),
    [],
  )

  if (!visible) return null

  const eyebrow = (text: string) => text.toLocaleUpperCase(i18n.language)
  const primaryLabel = noResults ? t('servers:filter.noResults') : t('servers:filter.showResults', { count: resultCount })

  const sheetContent = (
    <>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{t('servers:filter.filterSort')}</Text>
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
            accessibilityLabel={t('servers:filter.close')}
            testID="filter-sort-close-btn"
          >
            <Text style={styles.closeButtonText}>{t('servers:filter.close')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Presets */}
      <View style={styles.presetRow}>
        <TouchableOpacity
          onPress={() => onChangeFilters({ ...DEFAULT_FILTERS, tiers: ['needsYou'] })}
          style={[styles.preset, styles.presetNeedsMe, needsMe && styles.presetNeedsMeOn]}
          accessibilityRole="button"
          accessibilityState={{ selected: needsMe }}
          testID="preset-needs-me"
        >
          <View style={[styles.chipDot, { backgroundColor: theme.status.waiting }]} />
          <Text style={[styles.presetText, { color: theme.status.waiting }]}>{t('servers:filter.presetNeedsMe')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => onChangeFilters(DEFAULT_FILTERS)}
          style={[styles.preset, everything && styles.presetOn]}
          accessibilityRole="button"
          accessibilityState={{ selected: everything }}
          testID="preset-everything"
        >
          <Text style={[styles.presetText, everything && styles.presetTextOn]}>{t('servers:filter.presetEverything')}</Text>
        </TouchableOpacity>
      </View>

      {/* Show — the five tiers, multi-select with live counts */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, styles.standaloneSectionTitle]}>{eyebrow(t('servers:filter.show'))}</Text>
        <View style={styles.chipRow}>
          {ALL_TIERS.map((tier) => {
            const selected = filters.tiers.includes(tier)
            const color = colorForToken(theme, tierColorToken(tier))
            return (
              <TouchableOpacity
                key={tier}
                onPress={() => onChangeFilters({ ...filters, tiers: toggle(filters.tiers, tier) })}
                style={[styles.chip, selected && styles.chipSelected]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                testID={`tier-toggle-${tier}`}
              >
                {selected ? <Check size={12} color={theme.text.accent} weight="bold" /> : null}
                <View style={[styles.chipDot, { backgroundColor: color }]} />
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{getSessionTierLabel(tier, tSessions)}</Text>
                <Text style={styles.chipCount}>{tierCounts[tier]}</Text>
              </TouchableOpacity>
            )
          })}
        </View>
      </View>

      {/* Agent — same chip mechanics */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, styles.standaloneSectionTitle]}>{eyebrow(t('servers:filter.agent'))}</Text>
        <View style={styles.chipRow}>
          {ALL_PROVIDERS.map((provider) => {
            const selected = filters.providers.includes(provider)
            return (
              <TouchableOpacity
                key={provider}
                onPress={() => onChangeFilters({ ...filters, providers: toggle(filters.providers, provider) })}
                style={[styles.chip, selected && styles.chipSelected]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                testID={`agent-toggle-${provider}`}
              >
                {selected ? <Check size={12} color={theme.text.accent} weight="bold" /> : null}
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{getProviderLabel(provider, t)}</Text>
                <Text style={styles.chipCount}>{providerCounts[provider]}</Text>
              </TouchableOpacity>
            )
          })}
        </View>
      </View>

      {/* Active within */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, styles.standaloneSectionTitle]}>{eyebrow(t('servers:filter.activeWithin'))}</Text>
        <View style={styles.chipRow}>
          {WITHIN_OPTIONS.map((within) => {
            const selected = filters.activeWithin === within
            return (
              <TouchableOpacity
                key={within}
                onPress={() => onChangeFilters({ ...filters, activeWithin: within })}
                style={[styles.chip, selected && styles.chipSelected]}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                testID={`within-${within}`}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{getActiveWithinLabel(within, t)}</Text>
              </TouchableOpacity>
            )
          })}
        </View>
      </View>

      {/* Order */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, styles.standaloneSectionTitle]}>{eyebrow(t('servers:filter.order'))}</Text>
        <View style={styles.segmented}>
          {ORDER_OPTIONS.map((option) => {
            const selected = order === option
            return (
              <TouchableOpacity
                key={option}
                onPress={() => onChangeOrder(option)}
                style={[styles.segment, selected && styles.segmentSelected]}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                testID={`order-${option}`}
              >
                <Text style={[styles.segmentText, selected && styles.segmentTextSelected]} numberOfLines={1}>
                  {getSortByLabel(option, t)}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>
        <View style={styles.directionRow}>
          <Text style={styles.directionLabel}>{t('servers:filter.withinEachGroup')}</Text>
          <View style={styles.segmentedSmall}>
            {(['desc', 'asc'] as const).map((value) => {
              const selected = direction === value
              return (
                <TouchableOpacity
                  key={value}
                  onPress={() => onChangeDirection(value)}
                  style={[styles.segmentSmall, selected && styles.segmentSelected]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  testID={`direction-${value}`}
                >
                  <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>{getSortOrderLabel(value, t)}</Text>
                </TouchableOpacity>
              )
            })}
          </View>
        </View>
      </View>

      {/* Servers */}
      {showServerFilter ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{eyebrow(t('servers:filter.servers'))}</Text>
            {activeServerIds.length >= 2 ? (
              <TouchableOpacity
                onPress={() => setIsEditingOrder((v) => !v)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={isEditingOrder ? t('servers:filter.lockOrder') : t('servers:filter.editOrder')}
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
    </>
  )

  return (
    <BottomSheet
      snapPoints={SNAP_POINTS}
      index={0}
      enablePanDownToClose={!isEditingOrder}
      onClose={onClose}
      backdropComponent={renderBackdrop}
      backgroundStyle={[styles.sheetBg, isGlass && styles.sheetBgGlass]}
      backgroundComponent={glassBackground}
      handleIndicatorStyle={styles.handle}
    >
      <View style={styles.flex}>
        {isEditingOrder ? (
          <NestableScrollContainer contentContainerStyle={styles.content} testID="filter-sort-sheet">
            {sheetContent}
          </NestableScrollContainer>
        ) : (
          <BottomSheetScrollView contentContainerStyle={styles.content} testID="filter-sort-sheet">
            {sheetContent}
          </BottomSheetScrollView>
        )}
        {/* Sticky footer: a peer Reset and one primary action that always says what it keeps. */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          <TouchableOpacity
            style={[styles.resetButton, atDefault && styles.resetButtonDisabled]}
            onPress={handleReset}
            disabled={atDefault}
            accessibilityRole="button"
            testID="filter-reset"
          >
            <Text style={styles.resetText}>{t('servers:filter.resetDefaults')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.applyButton, noResults && styles.applyButtonDisabled]}
            onPress={onClose}
            disabled={noResults}
            accessibilityRole="button"
            accessibilityState={{ disabled: noResults }}
            testID="filter-apply"
          >
            <Text style={[styles.applyText, noResults && styles.applyTextDisabled]} numberOfLines={1}>{primaryLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </BottomSheet>
  )
}

function makeStyles(theme: Theme, localeDirection: 'ltr' | 'rtl') {
  return StyleSheet.create({
    flex: { flex: 1 },
    sheetBg: { backgroundColor: theme.bg.secondary },
    sheetBgGlass: { backgroundColor: 'transparent' },
    handle: { backgroundColor: theme.border },
    content: { padding: spacing.md, gap: spacing.lg, paddingBottom: spacing.xl },
    titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    title: { color: theme.text.primary, fontSize: font.lg, fontWeight: '600' },
    titleActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    settingsButton: { padding: spacing.xs },
    closeButton: { padding: spacing.xs },
    closeButtonText: { color: theme.text.secondary, fontSize: font.lg, lineHeight: font.lg },
    presetRow: { flexDirection: 'row', gap: spacing.sm },
    preset: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs + 3,
      height: 42,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.bg.card,
    },
    presetNeedsMe: { flex: 1, borderColor: `${theme.status.waiting}80` },
    presetNeedsMeOn: { backgroundColor: `${theme.status.waiting}29`, borderColor: theme.status.waiting },
    presetOn: { borderColor: theme.text.accent, backgroundColor: theme.bg.primary },
    presetText: { color: theme.text.secondary, fontSize: font.sm + 1, fontWeight: '600' },
    presetTextOn: { color: theme.text.primary },
    section: { gap: spacing.sm },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    sectionTitle: {
      color: theme.text.secondary,
      fontFamily: MONO_FONT,
      fontSize: font.xs,
      fontWeight: '600',
      letterSpacing: 1.5,
    },
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
      gap: spacing.xs + 2,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.bg.card,
      borderRadius: radius.full,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      minHeight: 36,
    },
    chipSelected: { borderColor: theme.text.accent, backgroundColor: `${theme.text.accent}1f` },
    chipDot: { width: 8, height: 8, borderRadius: radius.full },
    chipText: { color: theme.text.secondary, fontSize: font.base, fontWeight: '500' },
    chipTextSelected: { color: theme.text.primary },
    chipCount: { color: theme.text.secondary, fontSize: font.sm, fontVariant: ['tabular-nums'] },
    segmented: {
      flexDirection: 'row',
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: radius.md,
      overflow: 'hidden',
      backgroundColor: theme.bg.primary,
    },
    segment: { flex: 1, paddingVertical: spacing.sm + 2, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xs },
    segmentSelected: { backgroundColor: theme.bg.card },
    segmentText: { color: theme.text.secondary, fontSize: font.sm, fontWeight: '500' },
    segmentTextSelected: { color: theme.text.primary, fontWeight: '600' },
    directionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
    directionLabel: { color: theme.text.secondary, fontSize: font.sm, flexShrink: 1 },
    segmentedSmall: {
      flexDirection: 'row',
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: radius.sm + 2,
      overflow: 'hidden',
      backgroundColor: theme.bg.primary,
    },
    segmentSmall: { paddingVertical: spacing.xs + 2, paddingHorizontal: spacing.md },
    footer: {
      flexDirection: 'row',
      gap: spacing.sm + 2,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.border,
    },
    resetButton: {
      minHeight: 48,
      paddingHorizontal: spacing.lg,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: theme.border,
    },
    resetButtonDisabled: { opacity: 0.35 },
    resetText: { color: theme.text.accent, fontSize: font.base, fontWeight: '600' },
    applyButton: {
      flex: 1,
      minHeight: 48,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.md,
      backgroundColor: theme.text.accent,
      paddingHorizontal: spacing.md,
    },
    applyButtonDisabled: { backgroundColor: theme.bg.card },
    applyText: { color: theme.bg.primary, fontSize: font.base, fontWeight: '600' },
    applyTextDisabled: { color: theme.text.secondary },
  })
}
