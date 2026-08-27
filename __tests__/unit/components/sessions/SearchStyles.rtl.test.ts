import { makeStyles } from '@/components/sessions/SearchStyles'
import { dark } from '@/constants/theme'

describe('SearchStyles input direction', () => {
  it('applies runtime writing direction and automatic alignment', () => {
    expect(makeStyles(dark, 'ltr').searchInput).toEqual(
      expect.objectContaining({
        direction: 'ltr',
        writingDirection: 'ltr',
        textAlign: 'auto',
      }),
    )
    expect(makeStyles(dark, 'rtl').searchInput).toEqual(
      expect.objectContaining({
        direction: 'rtl',
        writingDirection: 'rtl',
        textAlign: 'auto',
      }),
    )
  })
})
