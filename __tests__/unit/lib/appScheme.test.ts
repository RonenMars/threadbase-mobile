describe('APP_SCHEME', () => {
  function load(applicationId: string | null): { scheme: string; qa: boolean } {
    let scheme = ''
    let qa = false
    jest.isolateModules(() => {
      jest.doMock('expo-application', () => ({ applicationId }))
      const mod = require('@/lib/appScheme')
      scheme = mod.APP_SCHEME
      qa = mod.IS_QA_APP
    })
    return { scheme, qa }
  }

  function schemeFor(applicationId: string | null): string {
    return load(applicationId).scheme
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

  it('marks only TbDev as the QA app', () => {
    expect(load('com.ronenmars.threadbase.dev').qa).toBe(true)
    expect(load('com.ronenmars.threadbase').qa).toBe(false)
    expect(load(null).qa).toBe(false)
  })
})
