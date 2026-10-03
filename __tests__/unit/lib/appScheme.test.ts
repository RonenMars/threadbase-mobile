describe('APP_SCHEME', () => {
  function schemeFor(applicationId: string | null): string {
    let scheme = ''
    jest.isolateModules(() => {
      jest.doMock('expo-application', () => ({ applicationId }))
      scheme = require('@/lib/appScheme').APP_SCHEME
    })
    return scheme
  }

  it('is threadbase for the store build', () => {
    expect(schemeFor('com.ronenmars.threadbase')).toBe('threadbase')
  })

  it('is threadbase-dev for TbDev', () => {
    expect(schemeFor('com.ronenmars.threadbase.dev')).toBe('threadbase-dev')
  })

  it('falls back to threadbase where there is no application id', () => {
    expect(schemeFor(null)).toBe('threadbase')
  })
})
