import i18n from '@/test-utils/i18n-setup'
import {
  getActiveWithinLabel,
  getSortByLabel,
  getSortOrderLabel,
} from '@/components/servers/filterSortLabels'

describe('filter and sort labels', () => {
  const t = i18n.getFixedT('en', ['servers', 'settings', 'sessions'] as const)

  it('translates every order semantic value', () => {
    expect(getSortByLabel('state', t)).toBe('State, then recent')
    expect(getSortByLabel('lastActivity', t)).toBe('Recent')
    expect(getSortByLabel('projectName', t)).toBe('Project')
  })

  it('translates every direction semantic value', () => {
    expect(getSortOrderLabel('desc', t)).toBe('Newest first')
    expect(getSortOrderLabel('asc', t)).toBe('Oldest first')
  })

  it('translates every recency window', () => {
    expect(getActiveWithinLabel('any', t)).toBe('Any time')
    expect(getActiveWithinLabel('today', t)).toBe('Today')
    expect(getActiveWithinLabel('7d', t)).toBe('7 days')
    expect(getActiveWithinLabel('30d', t)).toBe('30 days')
  })
})
