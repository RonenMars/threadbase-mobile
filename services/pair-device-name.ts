import { Platform } from 'react-native'
import * as Device from 'expo-device'

/** Human-readable name sent on `/api/pair/exchange` as `deviceName`. */
export function defaultPairDeviceName(): string {
  const model = Device.modelName?.trim()
  if (model) return model.slice(0, 100)
  return `Threadbase Mobile (${Platform.OS})`.slice(0, 100)
}
