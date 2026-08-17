export {
  getItemAsync,
  setItemAsync,
  deleteItemAsync,
  WHEN_UNLOCKED_THIS_DEVICE_ONLY,
} from 'expo-secure-store'

/**
 * True where the backing store is the OS keychain rather than a shim.
 *
 * Read by the pairing handshake: `D_priv` is this device's identity, and the
 * web shim below is `localStorage`, which any script that achieves XSS on the
 * origin can read. Refusing there is mobile-design §5.2 — a value that cannot
 * be held under the guarantee is not stored under a weaker one.
 */
export const HAS_SECURE_KEYCHAIN = true
