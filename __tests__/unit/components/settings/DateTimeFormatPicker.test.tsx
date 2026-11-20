import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react-native'
import { DateTimeFormatPicker } from '@/components/settings/DateTimeFormatPicker'
import type { DateFormat, TimeFormat } from '@/lib/dateTimeFormat'

const setup = (dateFormat: DateFormat = 'auto', timeFormat: TimeFormat = '24h') => {
  const onChangeDate = jest.fn()
  const onChangeTime = jest.fn()
  return { onChangeDate, onChangeTime, ...{ props: { dateFormat, timeFormat, onChangeDate, onChangeTime } } }
}

describe('DateTimeFormatPicker', () => {
  it('marks only the active date and time option as checked', async () => {
    const { props } = setup('mdy', '12h')
    await render(<DateTimeFormatPicker {...props} />)
    expect(screen.getByTestId('settings-date-format-mdy').props.accessibilityState).toEqual({ checked: true })
    expect(screen.getByTestId('settings-date-format-dmy').props.accessibilityState).toEqual({ checked: false })
    expect(screen.getByTestId('settings-time-format-12h').props.accessibilityState).toEqual({ checked: true })
    expect(screen.getByTestId('settings-time-format-24h').props.accessibilityState).toEqual({ checked: false })
  })

  it('reports the chosen format', async () => {
    const { props, onChangeDate, onChangeTime } = setup()
    await render(<DateTimeFormatPicker {...props} />)
    await fireEvent.press(screen.getByTestId('settings-date-format-ymd'))
    await fireEvent.press(screen.getByTestId('settings-time-format-12h'))
    expect(onChangeDate).toHaveBeenCalledWith('ymd')
    expect(onChangeTime).toHaveBeenCalledWith('12h')
  })

  it('shows each option as the same sample moment written that way', async () => {
    const { props } = setup()
    await render(<DateTimeFormatPicker {...props} />)
    expect(screen.getByTestId('settings-date-format-ymd').props.accessibilityLabel).toContain('2026-11-20')
    expect(screen.getByTestId('settings-time-format-24h').props.accessibilityLabel).toContain('15:07')
  })
})
