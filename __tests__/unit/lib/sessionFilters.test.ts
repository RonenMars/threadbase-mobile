import {
  ALL_TIERS,
  DEFAULT_FILTERS,
  applyListFilters,
  countByProvider,
  countByTier,
  isDefaultFilters,
  isNeedsMePreset,
} from '@/lib/sessionFilters'
import type { MergedItem } from '@/components/sessions/now/mergedItems'
import type { MultiConversation, MultiSession } from '@/types/api'

const NOW = Date.parse('2026-09-13T12:00:00.000Z')
const HOUR = 3_600_000
const DAY = 24 * HOUR

function session(overrides: Partial<MultiSession>, ms: number): MergedItem {
  return {
    kind: 'session',
    ms,
    item: {
      id: 's',
      serverId: 'srv',
      status: 'idle',
      ptyAttached: false,
      subStatus: null,
      projectPath: '/p',
      projectName: 'p',
      lastOutput: '',
      elapsedMs: 0,
      promptCount: 0,
      startedAt: new Date(ms).toISOString(),
      ...overrides,
    },
  }
}

function conversation(overrides: Partial<MultiConversation>, ms: number): MergedItem {
  return {
    kind: 'conversation',
    ms,
    item: { id: 'c', serverId: 'srv', title: 'c', projectPath: '/p', messageCount: 1, lastActivity: new Date(ms).toISOString(), ...overrides },
  }
}

const waiting = session({ id: 'w', status: 'waiting_input', ptyAttached: true, lifecycle: 'attached', provider: 'codex-cli' }, NOW - HOUR)
const running = session({ id: 'r', status: 'running', ptyAttached: true, lifecycle: 'attached' }, NOW - 2 * HOUR)
const held = session({ id: 'h', status: 'waiting_input', ptyAttached: false, lifecycle: 'resumable' }, NOW - 3 * DAY)
const failed = session({ id: 'f', status: 'idle', lifecycle: 'failed', provider: 'cursor-cli' }, NOW - 10 * DAY)
const old = conversation({ id: 'old', provider: 'codex-cli' }, NOW - 40 * DAY)

const items = [waiting, running, held, failed, old]

describe('applyListFilters', () => {
  it('passes everything through at the defaults', () => {
    expect(applyListFilters(items, DEFAULT_FILTERS, NOW).map((i) => i.item.id)).toEqual(['w', 'r', 'h', 'f', 'old'])
  })

  it('keeps only the Needs-you tier for the needs-me preset', () => {
    const out = applyListFilters(items, { ...DEFAULT_FILTERS, tiers: ['needsYou'] }, NOW)
    expect(out.map((i) => i.item.id)).toEqual(['w'])
  })

  it('files a held session and every conversation under Resumable', () => {
    const out = applyListFilters(items, { ...DEFAULT_FILTERS, tiers: ['resumable'] }, NOW)
    expect(out.map((i) => i.item.id)).toEqual(['h', 'old'])
  })

  it('filters by agent, reading an unknown provider as Claude', () => {
    expect(applyListFilters(items, { ...DEFAULT_FILTERS, providers: ['claude-code'] }, NOW).map((i) => i.item.id)).toEqual(['r', 'h'])
    expect(applyListFilters(items, { ...DEFAULT_FILTERS, providers: ['codex-cli'] }, NOW).map((i) => i.item.id)).toEqual(['w', 'old'])
  })

  it('applies the recency window to every row', () => {
    expect(applyListFilters(items, { ...DEFAULT_FILTERS, activeWithin: 'today' }, NOW).map((i) => i.item.id)).toEqual(['w', 'r'])
    expect(applyListFilters(items, { ...DEFAULT_FILTERS, activeWithin: '7d' }, NOW).map((i) => i.item.id)).toEqual(['w', 'r', 'h'])
    expect(applyListFilters(items, { ...DEFAULT_FILTERS, activeWithin: '30d' }, NOW).map((i) => i.item.id)).toEqual(['w', 'r', 'h', 'f'])
  })

  it('returns nothing when every tier is off, never everything', () => {
    expect(applyListFilters(items, { ...DEFAULT_FILTERS, tiers: [] }, NOW)).toEqual([])
  })
})

describe('counts and presets', () => {
  it('counts live rows per tier on the unfiltered set', () => {
    expect(countByTier(items)).toEqual({ needsYou: 1, working: 1, resumable: 2, cantResume: 1, observed: 0 })
  })

  it('counts rows per agent', () => {
    expect(countByProvider(items)).toEqual({ 'claude-code': 2, 'codex-cli': 2, 'cursor-cli': 1 })
  })

  it('recognises the defaults regardless of tier order', () => {
    expect(isDefaultFilters(DEFAULT_FILTERS)).toBe(true)
    expect(isDefaultFilters({ ...DEFAULT_FILTERS, tiers: [...ALL_TIERS].reverse() })).toBe(true)
    expect(isDefaultFilters({ ...DEFAULT_FILTERS, activeWithin: 'today' })).toBe(false)
  })

  it('recognises the needs-me preset only when nothing else is narrowed', () => {
    expect(isNeedsMePreset({ ...DEFAULT_FILTERS, tiers: ['needsYou'] })).toBe(true)
    expect(isNeedsMePreset({ ...DEFAULT_FILTERS, tiers: ['needsYou'], providers: ['codex-cli'] })).toBe(false)
  })
})
