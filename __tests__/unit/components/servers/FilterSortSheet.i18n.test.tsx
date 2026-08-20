import React from 'react'
import { cleanup } from '@testing-library/react-native'
import { FilterSortSheet, ALL_STATUSES } from '@/components/servers/FilterSortSheet'
import { useServersStore } from '@/stores/servers'
import { useSettingsStore } from '@/stores/settings'
import { renderWithI18n } from '@/test-utils/render'
import i18n from '@/test-utils/i18n-setup'

const noop = () => {}

async function renderSheet(locale: 'en' | 'he') {
  await i18n.changeLanguage(locale)
  return renderWithI18n(
    <FilterSortSheet
      visible
      onClose={noop}
      sortBy="lastActivity"
      sortOrder="desc"
      onChangeSortBy={noop}
      onChangeSortOrder={noop}
      selectedStatuses={ALL_STATUSES}
      onChangeStatuses={noop}
      providerFilter={undefined}
      onChangeProviderFilter={noop}
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
  useSettingsStore.setState({ sessionsLayout: 'classic' })
})

describe('FilterSortSheet localization and direction', () => {
  it('renders the live filter options in Hebrew without English fallbacks', async () => {
    const { getByText, getAllByText, queryByText } = await renderSheet('he')

    expect(getByText('קלאסי')).toBeTruthy()
    expect(getByText('הודעה אחרונה')).toBeTruthy()
    expect(getByText('שם הפרויקט')).toBeTruthy()
    expect(getByText('תאריך יצירה')).toBeTruthy()
    expect(getByText('מהחדש לישן')).toBeTruthy()
    expect(getByText('מהישן לחדש')).toBeTruthy()
    expect(getByText('רץ')).toBeTruthy()
    expect(getByText('פעיל')).toBeTruthy()
    expect(getByText('לא פעיל')).toBeTruthy()
    expect(getAllByText('הכל')).toHaveLength(2)

    expect(queryByText('Classic')).toBeNull()
    expect(queryByText('Last message')).toBeNull()
    expect(queryByText('Newest first')).toBeNull()
    expect(queryByText('Running')).toBeNull()
  })

  it('aligns standalone headings to the locale start edge', async () => {
    const rtl = await renderSheet('he')

    for (const label of ['תצוגה', 'מיין לפי', 'סדר', 'ספק']) {
      expect(rtl.getByText(label)).toHaveStyle({
        width: '100%',
        direction: 'rtl',
        writingDirection: 'rtl',
        textAlign: 'auto',
      })
    }

    await cleanup()
    const ltr = await renderSheet('en')
    for (const label of ['View', 'Sort by', 'Order', 'Provider']) {
      expect(ltr.getByText(label)).toHaveStyle({
        width: '100%',
        direction: 'ltr',
        writingDirection: 'ltr',
        textAlign: 'auto',
      })
    }
  })
})
