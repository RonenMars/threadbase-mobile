function load(os: 'ios' | 'android', native: { getDistribution(): string } | null, track?: string) {
  if (track === undefined) delete process.env.EXPO_PUBLIC_ANDROID_PLAY_TRACK
  else process.env.EXPO_PUBLIC_ANDROID_PLAY_TRACK = track
  let mod: typeof import('../../../modules/app-distribution') | undefined
  jest.isolateModules(() => {
    jest.doMock('react-native', () => ({ Platform: { OS: os } }))
    jest.doMock('expo', () => ({ requireOptionalNativeModule: () => native }))
    mod = require('../../../modules/app-distribution')
  })
  return mod!.getDistribution()
}

describe('getDistribution', () => {
  afterEach(() => delete process.env.EXPO_PUBLIC_ANDROID_PLAY_TRACK)

  it('asks the native module on iOS', () => {
    expect(load('ios', { getDistribution: () => 'staging' })).toBe('staging')
  })

  it('treats iOS without the native module as production', () => {
    expect(load('ios', null)).toBe('production')
  })

  it('maps every Play testing track to staging', () => {
    for (const track of ['internal', 'alpha', 'beta']) expect(load('android', null, track)).toBe('staging')
  })

  it('treats the Play production track, or no track, as production', () => {
    expect(load('android', null, 'production')).toBe('production')
    expect(load('android', null)).toBe('production')
  })
})
