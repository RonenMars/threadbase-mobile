// ponytail: web has no secure enclave; localStorage is the closest native equivalent Expo itself recommends for web SecureStore

/**
 * There is no keychain accessibility class on web, so this is inert. It exists
 * because the native side names one and a caller must not need a platform
 * branch to say so — but nothing here makes localStorage device-only, and
 * pretending otherwise is the claim mobile-design §5.2 forbids.
 */
export const WHEN_UNLOCKED_THIS_DEVICE_ONLY = undefined

export async function getItemAsync(key: string): Promise<string | null> {
  return localStorage.getItem(key)
}

export async function setItemAsync(
  key: string,
  value: string,
  _options?: { keychainAccessible?: number },
): Promise<void> {
  localStorage.setItem(key, value)
}

export async function deleteItemAsync(key: string): Promise<void> {
  localStorage.removeItem(key)
}
