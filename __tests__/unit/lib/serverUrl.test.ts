import { isValidHttpServerUrl } from '@/lib/serverUrl'

describe('isValidHttpServerUrl', () => {
  it('accepts http and https hosts with optional ports', () => {
    expect(isValidHttpServerUrl('http://192.168.1.10:8766')).toBe(true)
    expect(isValidHttpServerUrl('https://streamer.example.com')).toBe(true)
  })

  it('rejects empty, schemeless, and non-http schemes', () => {
    expect(isValidHttpServerUrl('')).toBe(false)
    expect(isValidHttpServerUrl('  ')).toBe(false)
    expect(isValidHttpServerUrl('192.168.1.10:8766')).toBe(false)
    expect(isValidHttpServerUrl('ftp://example.com')).toBe(false)
    expect(isValidHttpServerUrl('not a url')).toBe(false)
  })
})
