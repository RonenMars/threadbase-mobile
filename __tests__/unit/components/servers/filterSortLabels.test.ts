import i18n from '@/test-utils/i18n-setup'
import {
  getSessionsLayoutLabel,
  getSortByLabel,
  getSortOrderLabel,
} from '@/components/servers/filterSortLabels'

describe('filter and sort labels', () => {
  const t = i18n.getFixedT('en', ['servers', 'settings', 'sessions'] as const)

  it('translates every sessions layout semantic value', () => {
    expect(getSessionsLayoutLabel('tree', t)).toBe('Tree')
    expect(getSessionsLayoutLabel('hub', t)).toBe('Hub')
    expect(getSessionsLayoutLabel('classic', t)).toBe('Classic')
  })

  it('translates every sort field semantic value', () => {
    expect(getSortByLabel('lastActivity', t)).toBe('Last message')
    expect(getSortByLabel('projectName', t)).toBe('Project name')
    expect(getSortByLabel('startedAt', t)).toBe('Created date')
    expect(getSortByLabel('status', t)).toBe('Status')
  })

  it('translates every sort order semantic value', () => {
    expect(getSortOrderLabel('desc', t)).toBe('Newest first')
    expect(getSortOrderLabel('asc', t)).toBe('Oldest first')
  })
})
