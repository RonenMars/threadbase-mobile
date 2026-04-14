import { isInQuietHours, requestPermissions } from '@/services/push'
import * as Notifications from 'expo-notifications'

beforeEach(() => {
  jest.useFakeTimers()
  jest.clearAllMocks()
})

afterEach(() => {
  jest.useRealTimers()
})

// ── isInQuietHours ────────────────────────────────────────────────────────────

describe('isInQuietHours – overnight range (22:00–08:00)', () => {
  it('returns true at 23:00', () => {
    jest.setSystemTime(new Date('2024-01-01T23:00:00'))
    expect(isInQuietHours('22:00', '08:00')).toBe(true)
  })

  it('returns true at midnight (00:30)', () => {
    jest.setSystemTime(new Date('2024-01-01T00:30:00'))
    expect(isInQuietHours('22:00', '08:00')).toBe(true)
  })

  it('returns true at 07:59', () => {
    jest.setSystemTime(new Date('2024-01-01T07:59:00'))
    expect(isInQuietHours('22:00', '08:00')).toBe(true)
  })

  it('returns false at 08:00 (boundary excluded)', () => {
    jest.setSystemTime(new Date('2024-01-01T08:00:00'))
    expect(isInQuietHours('22:00', '08:00')).toBe(false)
  })

  it('returns false at noon', () => {
    jest.setSystemTime(new Date('2024-01-01T12:00:00'))
    expect(isInQuietHours('22:00', '08:00')).toBe(false)
  })

  it('returns false at 21:59 (just before start)', () => {
    jest.setSystemTime(new Date('2024-01-01T21:59:00'))
    expect(isInQuietHours('22:00', '08:00')).toBe(false)
  })

  it('returns true at 22:00 (boundary included)', () => {
    jest.setSystemTime(new Date('2024-01-01T22:00:00'))
    expect(isInQuietHours('22:00', '08:00')).toBe(true)
  })
})

describe('isInQuietHours – same-day range (12:00–14:00)', () => {
  it('returns true at 13:00', () => {
    jest.setSystemTime(new Date('2024-01-01T13:00:00'))
    expect(isInQuietHours('12:00', '14:00')).toBe(true)
  })

  it('returns false at 11:59', () => {
    jest.setSystemTime(new Date('2024-01-01T11:59:00'))
    expect(isInQuietHours('12:00', '14:00')).toBe(false)
  })

  it('returns false at 14:00 (boundary excluded)', () => {
    jest.setSystemTime(new Date('2024-01-01T14:00:00'))
    expect(isInQuietHours('12:00', '14:00')).toBe(false)
  })

  it('returns false at 09:00', () => {
    jest.setSystemTime(new Date('2024-01-01T09:00:00'))
    expect(isInQuietHours('12:00', '14:00')).toBe(false)
  })
})

// ── requestPermissions ────────────────────────────────────────────────────────

describe('requestPermissions', () => {
  it('returns true when permissions already granted', async () => {
    ;(Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'granted' })
    const result = await requestPermissions()
    expect(result).toBe(true)
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled()
  })

  it('requests permissions when not granted and returns true on grant', async () => {
    ;(Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'undetermined' })
    ;(Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'granted' })
    const result = await requestPermissions()
    expect(result).toBe(true)
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalled()
  })

  it('returns false when permissions denied', async () => {
    ;(Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'denied' })
    ;(Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'denied' })
    const result = await requestPermissions()
    expect(result).toBe(false)
  })
})
