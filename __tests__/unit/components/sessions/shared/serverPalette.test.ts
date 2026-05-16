import {
  SERVER_PALETTE,
  SERVER_COLOR_DEFAULT,
  pickNextServerColor,
  initialsFor,
} from '@/components/sessions/shared/serverPalette'

describe('pickNextServerColor', () => {
  it('returns the first palette entry when nothing is used', () => {
    expect(pickNextServerColor([])).toBe(SERVER_PALETTE[0])
    expect(SERVER_COLOR_DEFAULT).toBe(SERVER_PALETTE[0])
  })

  it('skips colors already in use', () => {
    expect(pickNextServerColor([SERVER_PALETTE[0]])).toBe(SERVER_PALETTE[1])
    expect(pickNextServerColor([SERVER_PALETTE[0], SERVER_PALETTE[2]])).toBe(SERVER_PALETTE[1])
  })

  it('handles undefined entries (servers without a color yet)', () => {
    expect(pickNextServerColor([undefined, undefined])).toBe(SERVER_PALETTE[0])
    expect(pickNextServerColor([SERVER_PALETTE[0], undefined])).toBe(SERVER_PALETTE[1])
  })

  it('wraps to index 0 once all eight are taken', () => {
    expect(pickNextServerColor(SERVER_PALETTE.slice())).toBe(SERVER_PALETTE[0])
  })

  it('places brand amber last in the palette (reserved for live)', () => {
    expect(SERVER_PALETTE[SERVER_PALETTE.length - 1]).toBe('#f08a24')
  })
})

describe('initialsFor', () => {
  it('takes first letters of two words', () => {
    expect(initialsFor('tb streamer')).toBe('TS')
  })

  it('handles hyphens / dots / underscores as word boundaries', () => {
    expect(initialsFor('tb-streamer')).toBe('TS')
    expect(initialsFor('tb.streamer')).toBe('TS')
    expect(initialsFor('tb_streamer')).toBe('TS')
  })

  it('falls back to the first two letters of a single word', () => {
    expect(initialsFor('streamer')).toBe('ST')
  })

  it('returns the fallback for empty input', () => {
    expect(initialsFor(undefined)).toBe('?')
    expect(initialsFor('')).toBe('?')
    expect(initialsFor('   ')).toBe('?')
  })

  it('uppercases the result', () => {
    expect(initialsFor('alpha-beta')).toBe('AB')
  })
})
