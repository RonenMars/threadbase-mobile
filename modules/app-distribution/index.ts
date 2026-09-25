import { Platform } from 'react-native'
import { requireOptionalNativeModule } from 'expo'

export type Distribution = 'development' | 'staging' | 'production'

// eslint-disable-next-line i18next/no-literal-string -- native module name, not copy
const MODULE_NAME = 'AppDistribution'
const native = requireOptionalNativeModule<{ getDistribution(): Distribution }>(MODULE_NAME)

/**
 * Where this binary was installed from. iOS asks the native module (TestFlight is
 * staging); Android reads the Play track `ship-android.sh` baked in. Anything
 * unrecognised is production, the environment that holds builds to the strictest rules.
 */
export function getDistribution(): Distribution {
  if (Platform.OS === 'ios') return native?.getDistribution() ?? 'production'
  const track = process.env.EXPO_PUBLIC_ANDROID_PLAY_TRACK
  if (track && track !== 'production') return 'staging'
  return 'production'
}
