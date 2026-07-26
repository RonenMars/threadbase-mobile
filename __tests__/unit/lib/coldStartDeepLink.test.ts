import {
  resolveColdStartRoute,
  sessionRouteFromNotificationData,
  sessionRouteFromUrl,
} from '@/lib/coldStartDeepLink'

describe('sessionRouteFromUrl', () => {
  it('parses the shape the live activity and notifications emit', () => {
    expect(sessionRouteFromUrl('threadbase://session/abc?server=srv-1')).toEqual({
      sessionId: 'abc',
      path: '/session/abc?server=srv-1',
    })
  })

  it('keeps a session without a server rather than dropping the link', () => {
    expect(sessionRouteFromUrl('threadbase://session/abc')).toEqual({
      sessionId: 'abc',
      path: '/session/abc',
    })
  })

  it('decodes an escaped session id', () => {
    expect(sessionRouteFromUrl('threadbase://session/a%2Fb?server=s')?.sessionId).toBe('a/b')
  })

  it('ignores unrelated urls and empty input', () => {
    expect(sessionRouteFromUrl(null)).toBeNull()
    expect(sessionRouteFromUrl(undefined)).toBeNull()
    expect(sessionRouteFromUrl('')).toBeNull()
    expect(sessionRouteFromUrl('threadbase://settings')).toBeNull()
    expect(sessionRouteFromUrl('https://threadbase.sh/session/abc')).toBeNull()
    expect(sessionRouteFromUrl('threadbase://session/')).toBeNull()
  })

  it('ignores a server param that is present but empty', () => {
    expect(sessionRouteFromUrl('threadbase://session/abc?server=')?.path).toBe('/session/abc')
  })
})

describe('sessionRouteFromNotificationData', () => {
  it('builds the same route from payload fields', () => {
    expect(sessionRouteFromNotificationData({ sessionId: 'abc', serverId: 'srv-1' })).toEqual({
      sessionId: 'abc',
      path: '/session/abc?server=srv-1',
    })
  })

  it('returns null without a session id', () => {
    expect(sessionRouteFromNotificationData({})).toBeNull()
    expect(sessionRouteFromNotificationData({ serverId: 'srv-1' })).toBeNull()
  })
})

describe('resolveColdStartRoute', () => {
  it('routes a launch url — the live activity tap path', () => {
    expect(
      resolveColdStartRoute({
        url: 'threadbase://session/abc?server=srv-1',
        notificationData: null,
      })?.path,
    ).toBe('/session/abc?server=srv-1')
  })

  it('routes a launch notification when there is no url', () => {
    expect(
      resolveColdStartRoute({
        url: null,
        notificationData: { sessionId: 'abc', serverId: 'srv-1' },
      })?.path,
    ).toBe('/session/abc?server=srv-1')
  })

  it('prefers the url when both are present', () => {
    expect(
      resolveColdStartRoute({
        url: 'threadbase://session/from-url?server=s1',
        notificationData: { sessionId: 'from-notification', serverId: 's2' },
      })?.sessionId,
    ).toBe('from-url')
  })

  it('stays put on an ordinary launch, leaving the app on its default route', () => {
    expect(resolveColdStartRoute({ url: null, notificationData: null })).toBeNull()
  })

  it('falls through to the notification when the url is not a session link', () => {
    expect(
      resolveColdStartRoute({
        url: 'threadbase://settings',
        notificationData: { sessionId: 'abc' },
      })?.path,
    ).toBe('/session/abc')
  })
})
