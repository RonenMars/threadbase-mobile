import * as SecureStore from 'expo-secure-store'

const KEY = 'threadbase_device_client_id'

let cached: string | null = null

export async function getDeviceClientId(): Promise<string> {
  if (cached) return cached
  const stored = await SecureStore.getItemAsync(KEY)
  if (stored) {
    cached = stored
    return stored
  }
  const id = crypto.randomUUID()
  await SecureStore.setItemAsync(KEY, id)
  cached = id
  return id
}
