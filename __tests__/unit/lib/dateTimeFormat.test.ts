import {
  coerceDateFormat,
  coerceTimeFormat,
  DEFAULT_DATE_TIME_FORMAT,
  formatDatePart,
  formatTimeOfDay,
} from '@/lib/dateTimeFormat'

const AFTERNOON = new Date(2026, 10, 20, 15, 7)
const LAST_YEAR = new Date(2025, 11, 31, 9, 5)

describe('DEFAULT_DATE_TIME_FORMAT', () => {
  it('keeps the pre-picker behaviour: device date order, 24-hour clock', () => {
    expect(DEFAULT_DATE_TIME_FORMAT).toEqual({ date: 'auto', time: '24h' })
  })
})

describe('formatTimeOfDay', () => {
  it('24h pads the hour', () => {
    expect(formatTimeOfDay(LAST_YEAR, '24h', 'en-US')).toBe('09:05')
    expect(formatTimeOfDay(AFTERNOON, '24h', 'en-US')).toBe('15:07')
  })

  it('12h drops the padding and adds the meridiem', () => {
    expect(formatTimeOfDay(AFTERNOON, '12h', 'en-US')).toMatch(/^3:07\s?PM$/)
    expect(formatTimeOfDay(LAST_YEAR, '12h', 'en-US')).toMatch(/^9:05\s?AM$/)
  })

  it('auto follows the locale clock', () => {
    expect(formatTimeOfDay(AFTERNOON, 'auto', 'en-GB')).toBe('15:07')
    expect(formatTimeOfDay(AFTERNOON, 'auto', 'en-US')).toMatch(/PM/)
  })
})

describe('formatDatePart', () => {
  it('dmy puts the day first', () => {
    expect(formatDatePart(AFTERNOON, 'dmy', false, 'en-US')).toBe('20 Nov')
    expect(formatDatePart(LAST_YEAR, 'dmy', true, 'en-US')).toBe('31 Dec 25')
  })

  it('mdy puts the month first', () => {
    expect(formatDatePart(AFTERNOON, 'mdy', false, 'en-GB')).toBe('Nov 20')
    expect(formatDatePart(LAST_YEAR, 'mdy', true, 'en-GB')).toBe('Dec 31, 25')
  })

  it('ymd is numeric and ignores the locale and withYear', () => {
    expect(formatDatePart(LAST_YEAR, 'ymd', false, 'he')).toBe('2025-12-31')
    expect(formatDatePart(AFTERNOON, 'ymd', true, 'en-GB')).toBe('2026-11-20')
  })

  it('auto keeps the locale order', () => {
    expect(formatDatePart(AFTERNOON, 'auto', false, 'en-GB')).toBe('20 Nov')
    expect(formatDatePart(AFTERNOON, 'auto', false, 'en-US')).toBe('Nov 20')
  })
})

describe('coerce', () => {
  it('passes known values through', () => {
    expect(coerceDateFormat('ymd')).toBe('ymd')
    expect(coerceTimeFormat('12h')).toBe('12h')
  })

  it('falls back to the default for anything else', () => {
    expect(coerceDateFormat('iso')).toBe('auto')
    expect(coerceDateFormat(undefined)).toBe('auto')
    expect(coerceTimeFormat(24)).toBe('24h')
    expect(coerceTimeFormat(null)).toBe('24h')
  })
})
