import { PROVIDER_NAMES, type ProviderName } from '@/constants/providers'
import type { MergedItem } from '@/components/sessions/now/mergedItems'
import { deriveSessionPresentation, type SessionTier } from '@/lib/sessionPresentation'

export type ActiveWithin = 'any' | 'today' | '7d' | '30d'

export interface ListFilters {
  tiers: SessionTier[]
  providers: ProviderName[]
  activeWithin: ActiveWithin
}

export const ALL_TIERS: SessionTier[] = ['needsYou', 'working', 'resumable', 'cantResume', 'observed']
export const ALL_PROVIDERS: ProviderName[] = [...PROVIDER_NAMES]

export const DEFAULT_FILTERS: ListFilters = {
  tiers: ALL_TIERS,
  providers: ALL_PROVIDERS,
  activeWithin: 'any',
}

const DAY_MS = 86_400_000

/** A history conversation has no live process, so it always files under Resumable. */
export function itemTier(item: MergedItem): SessionTier {
  return item.kind === 'session' ? deriveSessionPresentation(item.item).tier : 'resumable'
}

/** Unknown providers read as Claude, matching `providerLabelKey`. */
export function itemProvider(item: MergedItem): ProviderName {
  return item.item.provider ?? 'claude-code'
}

function startOfToday(now: number): number {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function withinFloor(within: ActiveWithin, now: number): number {
  switch (within) {
    case 'any':
      return 0
    case 'today':
      return startOfToday(now)
    case '7d':
      return now - 7 * DAY_MS
    case '30d':
      return now - 30 * DAY_MS
  }
}

/**
 * The wire only knows three statuses, so tier, agent and recency filters run
 * here on the rows the screen already holds. `now` is injectable for tests.
 */
export function applyListFilters(items: MergedItem[], filters: ListFilters, now: number = Date.now()): MergedItem[] {
  const floor = withinFloor(filters.activeWithin, now)
  const tiers = new Set(filters.tiers)
  const providers = new Set(filters.providers)
  return items.filter(
    (item) => tiers.has(itemTier(item)) && providers.has(itemProvider(item)) && item.ms >= floor,
  )
}

export function countByTier(items: MergedItem[]): Record<SessionTier, number> {
  const counts: Record<SessionTier, number> = { needsYou: 0, working: 0, resumable: 0, cantResume: 0, observed: 0 }
  for (const item of items) counts[itemTier(item)] += 1
  return counts
}

export function countByProvider(items: MergedItem[]): Record<ProviderName, number> {
  const counts: Record<ProviderName, number> = { 'claude-code': 0, 'codex-cli': 0, 'cursor-cli': 0 }
  for (const item of items) counts[itemProvider(item)] += 1
  return counts
}

function sameSet<T>(a: readonly T[], b: readonly T[]): boolean {
  return a.length === b.length && a.every((x) => b.includes(x))
}

export function isDefaultFilters(filters: ListFilters): boolean {
  return (
    sameSet(filters.tiers, ALL_TIERS) &&
    sameSet(filters.providers, ALL_PROVIDERS) &&
    filters.activeWithin === 'any'
  )
}

/** The "Only what needs me" preset: exactly the Needs-you tier, nothing else narrowed. */
export function isNeedsMePreset(filters: ListFilters): boolean {
  return sameSet(filters.tiers, ['needsYou']) && sameSet(filters.providers, ALL_PROVIDERS) && filters.activeWithin === 'any'
}
