import { conversationHref } from '@/lib/conversationHref'

describe('conversationHref', () => {
  it('builds the plain URL when no search is active', () => {
    expect(conversationHref('c1', 'srv_a')).toBe('/conversation/c1?server=srv_a')
  })

  it('builds the plain URL for an empty search string', () => {
    expect(conversationHref('c1', 'srv_a', '')).toBe('/conversation/c1?server=srv_a')
  })

  it('builds the plain URL for a whitespace-only search string', () => {
    expect(conversationHref('c1', 'srv_a', '   ')).toBe('/conversation/c1?server=srv_a')
  })

  it('appends the trimmed, encoded search query when active', () => {
    expect(conversationHref('c1', 'srv_a', '  wombat  ')).toBe(
      '/conversation/c1?server=srv_a&search=wombat',
    )
  })

  it('URL-encodes spaces, ampersands, and unicode in the query', () => {
    expect(conversationHref('c1', 'srv_a', 'a & b café')).toBe(
      '/conversation/c1?server=srv_a&search=a%20%26%20b%20caf%C3%A9',
    )
  })

  it('appends fromSession when returning from a live session', () => {
    expect(conversationHref('c1', 'srv_a', undefined, { fromSession: 'sess-9' })).toBe(
      '/conversation/c1?server=srv_a&fromSession=sess-9',
    )
  })

  it('combines search and fromSession', () => {
    expect(conversationHref('c1', 'srv_a', 'wombat', { fromSession: 'sess-9' })).toBe(
      '/conversation/c1?server=srv_a&search=wombat&fromSession=sess-9',
    )
  })

  it('ignores blank fromSession', () => {
    expect(conversationHref('c1', 'srv_a', undefined, { fromSession: '  ' })).toBe(
      '/conversation/c1?server=srv_a',
    )
  })
})
