import { isOpenableLinkUrl } from '@/lib/isOpenableLinkUrl'

describe('isOpenableLinkUrl', () => {
  it.each([
    'https://example.com/a?b=1',
    'http://example.com',
    'HTTPS://EXAMPLE.COM',
    'HtTp://example.com',
  ])('allows %s', (url) => {
    expect(isOpenableLinkUrl(url)).toBe(true)
  })

  it.each([
    'javascript:alert(1)',
    'tel:+15551234567',
    'sms:+15551234567',
    'mailto:a@b.com',
    'threadbase://pair?x=1',
    'intent://scan#Intent;scheme=zxing;end',
    'intent:#Intent;end',
    'not a url',
    '//example.com',
    '',
    ' https://example.com',
    'https://example.com ',
  ])('refuses %j', (url) => {
    expect(isOpenableLinkUrl(url)).toBe(false)
  })
})
