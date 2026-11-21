import { StyleSheet } from 'react-native'
import { enlarge } from '../../../services/dev-big-text/enlarge'

const flat = (style: Parameters<typeof enlarge>[0], isRoot = true) => StyleSheet.flatten(enlarge(style, isRoot))

describe('enlarge', () => {
  it('adds 3pt and steps each weight up', () => {
    expect(flat({ fontSize: 13, fontWeight: '400' })).toMatchObject({ fontSize: 16, fontWeight: '600' })
    expect(flat({ fontSize: 13, fontWeight: '500' })).toMatchObject({ fontWeight: '700' })
    expect(flat({ fontSize: 13, fontWeight: '600' })).toMatchObject({ fontWeight: '700' })
    expect(flat({ fontSize: 13, fontWeight: '700' })).toMatchObject({ fontWeight: '700' })
  })

  it('gives a bare root Text the default size plus 3 and 600', () => {
    expect(flat(undefined)).toEqual({ fontSize: 17, fontWeight: '600' })
  })

  it('leaves what a nested Text inherits alone', () => {
    expect(flat({ color: 'red' }, false)).toEqual({ color: 'red' })
    expect(flat({ fontSize: 13 }, false)).toEqual({ fontSize: 16 })
  })

  it('keeps the lineHeight ratio with a 1.2 floor', () => {
    expect(flat({ fontSize: 10, lineHeight: 20 })?.lineHeight).toBe(26)
    expect(flat({ fontSize: 15, lineHeight: 15 })?.lineHeight).toBe(22)
  })

  it('reads arrays and falsy entries', () => {
    expect(flat([{ fontSize: 11 }, false, { fontWeight: '500' }])).toMatchObject({ fontSize: 14, fontWeight: '700' })
  })
})
