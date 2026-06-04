import { serverDisplayName } from '@/components/sessions/shared/serverDisplayName'

describe('serverDisplayName', () => {
  it('returns the label when present and non-empty', () => {
    expect(serverDisplayName({ label: 'Work Mac', url: 'http://192.168.1.10:7070' })).toBe('Work Mac')
  })

  it('trims whitespace-only labels and falls back to host:port', () => {
    expect(serverDisplayName({ label: '   ', url: 'http://192.168.1.10:7070' })).toBe('192.168.1.10:7070')
  })

  it('falls back to host:port when label is undefined', () => {
    expect(serverDisplayName({ url: 'http://192.168.1.42:7071' })).toBe('192.168.1.42:7071')
  })

  it('uses 443 as the default port for https URLs without explicit port', () => {
    expect(serverDisplayName({ url: 'https://threadbase.example' })).toBe('threadbase.example:443')
  })

  it('uses 80 as the default port for http URLs without explicit port', () => {
    expect(serverDisplayName({ url: 'http://threadbase.local' })).toBe('threadbase.local:80')
  })

  it('handles malformed URLs without throwing', () => {
    expect(serverDisplayName({ url: '192.168.1.10:7070' })).toBe('192.168.1.10:7070')
  })

  it('returns empty string for null/undefined server', () => {
    expect(serverDisplayName(null)).toBe('')
    expect(serverDisplayName(undefined)).toBe('')
  })
})
