import * as SecureStore from 'expo-secure-store'
import { randomBytes } from 'tweetnacl'

const KEY = 'threadbase_device_client_id'

let cached: string | null = null

function generateUUID(): string {
  const b = randomBytes(16)
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const hex = Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export async function getDeviceClientId(): Promise<string> {
  if (cached) return cached
  const stored = await SecureStore.getItemAsync(KEY)
  if (stored) {
    cached = stored
    return stored
  }
  const id = generateUUID()
  await SecureStore.setItemAsync(KEY, id)
  cached = id
  return id
}
