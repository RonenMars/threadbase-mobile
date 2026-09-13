import AsyncStorage from '@react-native-async-storage/async-storage'

export const INTRO_SEEN_VERSION_KEY = 'threadbase_intro_seen_version'

export type IntroVariant = 'full' | 'fade'

export async function resolveIntroVariant(
  version: string,
  reduceMotion: boolean,
): Promise<IntroVariant> {
  if (reduceMotion) return 'fade'
  try {
    const seen = await AsyncStorage.getItem(INTRO_SEEN_VERSION_KEY)
    return seen === version ? 'fade' : 'full'
  } catch {
    // Unreadable storage would otherwise replay the full intro on every launch.
    return 'fade'
  }
}

export async function markIntroSeen(version: string): Promise<void> {
  await AsyncStorage.setItem(INTRO_SEEN_VERSION_KEY, version).catch(() => {})
}
