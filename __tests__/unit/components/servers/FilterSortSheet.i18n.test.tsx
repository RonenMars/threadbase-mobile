import React from 'react'
import { cleanup, fireEvent } from '@testing-library/react-native'
import { FilterSortSheet } from '@/components/servers/FilterSortSheet'
import { DEFAULT_FILTERS, type ListFilters } from '@/lib/sessionFilters'
import { useServersStore } from '@/stores/servers'
import { renderWithI18n } from '@/test-utils/render'
import i18n from '@/test-utils/i18n-setup'

const noop = () => {}
const COUNTS = { needsYou: 1, working: 2, resumable: 41, cantResume: 3, observed: 2 }
const PROVIDERS = { 'claude-code': 38, 'codex-cli': 11, 'cursor-cli': 2 }

async function renderSheet(locale: 'en' | 'he', overrides: { filters?: ListFilters; resultCount?: number; onChangeFilters?: (f: ListFilters) => void } = {}) {
  await i18n.changeLanguage(locale)
  return renderWithI18n(
    <FilterSortSheet
      visible
      onClose={noop}
      order="state"
      onChangeOrder={noop}
      direction="desc"
      onChangeDirection={noop}
      filters={overrides.filters ?? DEFAULT_FILTERS}
      onChangeFilters={overrides.onChangeFilters ?? noop}
      tierCounts={COUNTS}
      providerCounts={PROVIDERS}
      resultCount={overrides.resultCount ?? 44}
    />,
  )
}

beforeEach(async () => {
  await cleanup()
  useServersStore.setState({
    activeServerIds: [],
    displayedServerIds: [],
    servers: {},
  })
})

describe('FilterSortSheet localization and direction', () => {
  it('renders the filter options in Hebrew without English fallbacks', async () => {
    const { getByText, queryByText } = await renderSheet('he')

    expect(getByText('רק מה שצריך אותי')).toBeTruthy()
    expect(getByText('הכל')).toBeTruthy()
    expect(getByText('צריך אותך')).toBeTruthy()
    expect(getByText('עובד')).toBeTruthy()
    expect(getByText('לפי מצב, ואז לפי זמן')).toBeTruthy()
    expect(getByText('מהחדש לישן')).toBeTruthy()
    expect(getByText('הצג 44 תוצאות')).toBeTruthy()

    expect(queryByText('Only what needs me')).toBeNull()
    expect(queryByText('Needs you')).toBeNull()
    expect(queryByText('Newest first')).toBeNull()
    expect(queryByText('View')).toBeNull()
  })

  it('aligns standalone headings to the locale start edge', async () => {
    const rtl = await renderSheet('he')

    for (const label of ['הצג', 'סוכן', 'פעיל במהלך', 'סדר']) {
      expect(rtl.getByText(label)).toHaveStyle({
        width: '100%',
        direction: 'rtl',
        writingDirection: 'rtl',
        textAlign: 'auto',
      })
    }

    await cleanup()
    const ltr = await renderSheet('en')
    for (const label of ['SHOW', 'AGENT', 'ACTIVE WITHIN', 'ORDER']) {
      expect(ltr.getByText(label)).toHaveStyle({
        width: '100%',
        direction: 'ltr',
        writingDirection: 'ltr',
        textAlign: 'auto',
      })
    }
  })
})

describe('FilterSortSheet selection model', () => {
  it('shows a live count on every tier chip and the result count on the primary action', async () => {
    const { getByTestId, getByText } = await renderSheet('en')
    expect(getByTestId('tier-toggle-resumable')).toHaveTextContent('Resumable41')
    expect(getByTestId('agent-toggle-codex-cli')).toHaveTextContent('Codex11')
    expect(getByText('Show 44 results')).toBeTruthy()
  })

  it('never leaves the user on an empty list: zero results disables the action and says why', async () => {
    const { getByTestId, getByText } = await renderSheet('en', { resultCount: 0 })
    expect(getByText('No sessions match — loosen a filter')).toBeTruthy()
    expect(getByTestId('filter-apply')).toBeDisabled()
  })

  it('toggles a tier off with the same mechanics as every other chip', async () => {
    const onChangeFilters = jest.fn()
    const { getByTestId } = await renderSheet('en', { onChangeFilters })
    fireEvent.press(getByTestId('tier-toggle-working'))
    expect(onChangeFilters).toHaveBeenCalledWith({
      ...DEFAULT_FILTERS,
      tiers: ['needsYou', 'resumable', 'cantResume', 'observed'],
    })
  })

  it('the needs-me preset narrows to the Needs-you tier only', async () => {
    const onChangeFilters = jest.fn()
    const { getByTestId } = await renderSheet('en', { onChangeFilters })
    fireEvent.press(getByTestId('preset-needs-me'))
    expect(onChangeFilters).toHaveBeenCalledWith({ ...DEFAULT_FILTERS, tiers: ['needsYou'] })
  })
})
