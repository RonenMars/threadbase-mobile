import {
  resolveColdStartRoute,
  resolveTapRoute,
  sessionRouteFromNotificationData,
  sessionRouteFromUrl,
} from '@/lib/coldStartDeepLink'

describe('sessionRouteFromUrl', () => {
  it('parses the shape the live activity and notifications emit', () => {
    expect(sessionRouteFromUrl('threadbase://session/abc?server=srv-1')).toEqual({
      sessionId: 'abc',
      serverId: 'srv-1',
      path: '/session/abc?server=srv-1',
    })
  })

  it('parses the TbDev scheme', () => {
    expect(sessionRouteFromUrl('threadbase-dev://session/abc?server=srv-1')).toEqual({
      sessionId: 'abc',
      serverId: 'srv-1',
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
      serverId: 'srv-1',
      path: '/session/abc?server=srv-1',
    })
  })

  // A streamer that predates the id echo sends its own hostname. The app keys
  // servers by a hash of the URL and cannot resolve it: `Unknown server`, which
  // the session screen renders as "Session not found".
  it('drops a server id this app has no entry for, so the default server is used', () => {
    expect(
      sessionRouteFromNotificationData(
        { sessionId: 'abc', serverId: 'my-host.local' },
        (id) => id === 'srv_known',
      ),
    ).toEqual({ sessionId: 'abc', path: '/session/abc' })
  })

  it('keeps a server id the app does know', () => {
    expect(
      sessionRouteFromNotificationData(
        { sessionId: 'abc', serverId: 'srv_known' },
        (id) => id === 'srv_known',
      )?.path,
    ).toBe('/session/abc?server=srv_known')
  })

  it('applies the same check on a cold start', () => {
    expect(
      resolveColdStartRoute(
        { url: null, notificationData: { sessionId: 'abc', serverId: 'my-host.local' } },
        () => false,
      )?.path,
    ).toBe('/session/abc')
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

describe('resolveTapRoute', () => {
  const ID = 'e0049db9-ac52-40b3-bf43-a44ef604db00'
  const target = { sessionId: ID, serverId: 'srv-1', path: `/session/${ID}?server=srv-1` as const }

  it('opens an external session as its conversation', async () => {
    const fetchSession = jest.fn().mockResolvedValue({
      id: ID,
      status: 'idle',
      ptyAttached: false,
      ownership: 'external',
      lifecycle: 'detached',
    })
    const resolved = await resolveTapRoute(target, fetchSession)
    expect(fetchSession).toHaveBeenCalledWith(ID, 'srv-1')
    expect(resolved.path).toBe(`/conversation/${ID}?server=srv-1`)
  })

  it('keeps a live managed session on the session screen', async () => {
    const resolved = await resolveTapRoute(
      target,
      jest.fn().mockResolvedValue({ id: ID, status: 'waiting_input', ptyAttached: true, lifecycle: 'attached' }),
    )
    expect(resolved.path).toBe(target.path)
  })

  it('falls back to the session screen when the request fails', async () => {
    const resolved = await resolveTapRoute(target, jest.fn().mockRejectedValue(new Error('404')))
    expect(resolved.path).toBe(target.path)
  })

  it('falls back to the session screen when the request outlasts the timeout', async () => {
    const resolved = await resolveTapRoute(target, () => new Promise(() => {}), 10)
    expect(resolved.path).toBe(target.path)
  })

  it('skips the request without a known server', async () => {
    const fetchSession = jest.fn()
    const noServer = { sessionId: ID, path: `/session/${ID}` as const }
    expect(await resolveTapRoute(noServer, fetchSession)).toBe(noServer)
    expect(fetchSession).not.toHaveBeenCalled()
  })
})
