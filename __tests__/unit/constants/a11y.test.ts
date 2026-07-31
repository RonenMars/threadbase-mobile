import {
  MAX_FONT_SIZE_MULTIPLIER_MONO,
  MAX_FONT_SIZE_MULTIPLIER_UI,
  MIN_TOUCH_TARGET,
} from '@/constants/a11y'

describe('a11y constants', () => {
  it('keeps touch targets at least 44pt', () => {
    expect(MIN_TOUCH_TARGET).toBeGreaterThanOrEqual(44)
  })

  it('caps mono Dynamic Type below general UI', () => {
    expect(MAX_FONT_SIZE_MULTIPLIER_MONO).toBeLessThan(MAX_FONT_SIZE_MULTIPLIER_UI)
    expect(MAX_FONT_SIZE_MULTIPLIER_MONO).toBeGreaterThan(1)
  })
})
