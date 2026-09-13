import AsyncStorage from '@react-native-async-storage/async-storage'

import { INTRO_SEEN_VERSION_KEY, markIntroSeen, resolveIntroVariant } from '@/services/intro-splash'

const getItem = AsyncStorage.getItem as jest.Mock
const setItem = AsyncStorage.setItem as jest.Mock

describe('resolveIntroVariant', () => {
  beforeEach(() => {
    getItem.mockReset()
    setItem.mockReset().mockResolvedValue(undefined)
  })

  it('plays the full intro when this version has never shown it', async () => {
    getItem.mockResolvedValue(null)
    await expect(resolveIntroVariant('1.0.0 (233)', false)).resolves.toBe('full')
  })

  it('plays the full intro again after an update', async () => {
    getItem.mockResolvedValue('1.0.0 (232)')
    await expect(resolveIntroVariant('1.0.0 (233)', false)).resolves.toBe('full')
  })

  it('only fades once this version has shown it', async () => {
    getItem.mockResolvedValue('1.0.0 (233)')
    await expect(resolveIntroVariant('1.0.0 (233)', false)).resolves.toBe('fade')
  })

  it('only fades under Reduce Motion, even on a new version', async () => {
    getItem.mockResolvedValue(null)
    await expect(resolveIntroVariant('1.0.0 (233)', true)).resolves.toBe('fade')
  })

  it('fades rather than failing when storage is unreadable', async () => {
    getItem.mockRejectedValue(new Error('storage unavailable'))
    await expect(resolveIntroVariant('1.0.0 (233)', false)).resolves.toBe('fade')
  })

  it('records the version under its storage key', async () => {
    await markIntroSeen('1.0.0 (233)')
    expect(setItem).toHaveBeenCalledWith(INTRO_SEEN_VERSION_KEY, '1.0.0 (233)')
  })
})
