import { stripAnsi } from '@/utils/stripAnsi'

describe('stripAnsi', () => {
  it('strips CSI color codes', () => {
    expect(stripAnsi('\x1b[32mhi\x1b[0m')).toBe('hi')
  })
  it('strips OSC sequences terminated by BEL', () => {
    expect(stripAnsi('\x1b]0;title\x07rest')).toBe('rest')
  })
  it('strips OSC sequences terminated by ST (ESC backslash)', () => {
    expect(stripAnsi('\x1b]8;;http://x\x1b\\link')).toBe('link')
  })
  it('leaves plain text untouched', () => {
    expect(stripAnsi('plain ❯ text')).toBe('plain ❯ text')
  })
})
