import { act } from 'react'
import renderer from 'react-test-renderer'
import {
  TimeBucketPills,
  bucketTimestamps,
  filterByBucket,
} from '@/components/sessions/shared/TimeBucketPills'

const NOW = new Date(2026, 4, 15, 14, 35, 0).getTime()

type Json = null | string | { type?: string; props?: Record<string, unknown>; children?: Json[] | null }

function collectText(node: Json): string {
  if (node == null) return ''
  if (typeof node === 'string') return node
  if (Array.isArray(node)) return node.map(collectText).join('')
  if (!node.children) return ''
  return node.children.map(collectText).join('')
}

function render(element: React.ReactElement) {
  let r: renderer.ReactTestRenderer | null = null
  act(() => {
    r = renderer.create(element)
  })
  return r!
}

describe('TimeBucketPills component', () => {
  it('renders all five buckets by default', () => {
    const tree = render(<TimeBucketPills active="all" onChange={() => {}} />)
    const text = collectText(tree.toJSON() as unknown as Json)
    expect(text).toContain('All')
    expect(text).toContain('Today')
    expect(text).toContain('7d')
    expect(text).toContain('30d')
    expect(text).toContain('Custom')
  })

  it('omits Custom when showCustom=false', () => {
    const tree = render(
      <TimeBucketPills active="all" onChange={() => {}} showCustom={false} />,
    )
    const text = collectText(tree.toJSON() as unknown as Json)
    expect(text).not.toContain('Custom')
  })

  it('renders counts on each pill when provided', () => {
    const tree = render(
      <TimeBucketPills
        active="all"
        counts={{ all: 142, today: 3, '7d': 18, '30d': 47 }}
        onChange={() => {}}
      />,
    )
    const text = collectText(tree.toJSON() as unknown as Json)
    expect(text).toContain('142')
    expect(text).toContain('3')
    expect(text).toContain('18')
    expect(text).toContain('47')
  })

  it('abbreviates thousands as Nk', () => {
    const tree = render(
      <TimeBucketPills active="all" counts={{ all: 1450 }} onChange={() => {}} />,
    )
    const text = collectText(tree.toJSON() as unknown as Json)
    expect(text).toContain('1.4k')
  })
})

describe('bucketTimestamps helper', () => {
  it('counts items into the correct buckets', () => {
    const items = [
      { t: NOW - 30 * 60 * 1000 }, // today
      { t: NOW - 12 * 3600 * 1000 }, // today
      { t: NOW - 2 * 86_400_000 }, // 7d
      { t: NOW - 8 * 86_400_000 }, // 30d (not 7d)
      { t: NOW - 60 * 86_400_000 }, // beyond 30d
    ]
    const counts = bucketTimestamps(items, (i) => i.t, NOW)
    expect(counts.all).toBe(5)
    expect(counts.today).toBe(2)
    expect(counts['7d']).toBe(3)
    expect(counts['30d']).toBe(4)
  })

  it('skips null and unparseable timestamps', () => {
    const items = [{ t: null }, { t: 'not-a-date' }, { t: NOW - 60_000 }]
    const counts = bucketTimestamps(items, (i) => i.t as never, NOW)
    expect(counts.all).toBe(1)
  })
})

describe('filterByBucket helper', () => {
  const items = [
    { id: 'today-1', t: NOW - 60 * 60 * 1000 },
    { id: 'today-2', t: NOW - 12 * 3600 * 1000 },
    { id: 'week', t: NOW - 3 * 86_400_000 },
    { id: 'month', t: NOW - 10 * 86_400_000 },
    { id: 'older', t: NOW - 60 * 86_400_000 },
  ]

  it('returns all when bucket=all', () => {
    expect(filterByBucket(items, 'all', (i) => i.t, NOW).map((x) => x.id)).toEqual([
      'today-1',
      'today-2',
      'week',
      'month',
      'older',
    ])
  })

  it('today bucket only includes today items', () => {
    expect(filterByBucket(items, 'today', (i) => i.t, NOW).map((x) => x.id)).toEqual([
      'today-1',
      'today-2',
    ])
  })

  it('7d bucket includes today + within last 6 days', () => {
    expect(filterByBucket(items, '7d', (i) => i.t, NOW).map((x) => x.id)).toEqual([
      'today-1',
      'today-2',
      'week',
    ])
  })

  it('30d bucket includes today + within last 29 days', () => {
    expect(filterByBucket(items, '30d', (i) => i.t, NOW).map((x) => x.id)).toEqual([
      'today-1',
      'today-2',
      'week',
      'month',
    ])
  })

  it('custom bucket returns all (range picker not yet implemented)', () => {
    expect(filterByBucket(items, 'custom', (i) => i.t, NOW).length).toBe(5)
  })
})
