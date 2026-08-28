// Item 6 of #698: the web build refuses an encrypted pairing rather than
// putting this device's static key somewhere a script can read.
//
// Why this file exists at all, and why it imports by explicit path:
// `package.json`'s jest preset is the root `jest-expo`, whose haste block is
// `{ defaultPlatform: 'ios', platforms: ['android', 'ios', 'native'] }`. There
// is no `web`, so nothing in the suite ever resolved `secure-store.web.ts` —
// Metro swaps it in for the web bundle by platform extension, and jest simply
// never sees that file. `pair-exchange.test.ts` covers the *branch* by mocking
// the module and answering `HAS_SECURE_KEYCHAIN` itself, which proves
// `exchangeToken` reacts correctly but proves nothing about what the web build
// actually reports. Flipping `secure-store.web.ts`'s constant to `true` left
// the entire suite green while the web build would write `D_priv` to
// `localStorage`.
//
// Importing the platform file by its full name bypasses the haste resolution
// rather than changing it: the preset stays as the app ships. `moduleNameMapper`
// rewrites `@/services/secure-store.web` to a real path and `moduleFileExtensions`
// appends `.ts`; `haste.platforms` only governs bare specifiers, so it is never
// consulted.
//
// What this file does NOT prove, deliberately stated so a green run is not read
// as more than it is: it pins the CONSTANT, not the WIRING. `pair-exchange.ts:6`
// imports the bare `@/services/secure-store`, and under this preset that
// specifier resolves to the NATIVE module in every test, permanently — `web` is
// not in `haste.platforms`. Metro is what selects `.web.ts` for the web bundle,
// and no test here can see that choice. So this catches someone editing the
// constant, and would not catch `secure-store.web.ts` being renamed or deleted,
// or Metro ceasing to select it — in which case web silently gets
// `HAS_SECURE_KEYCHAIN === true` and this suite still passes.
//
// Adding `web` to `haste.platforms` would close that, and would also change
// module resolution for every existing test in the repo, so it is not done here.
import { HAS_SECURE_KEYCHAIN, WHEN_UNLOCKED_THIS_DEVICE_ONLY } from '@/services/secure-store.web'
// Static, never `await import()`: jest runs without `--experimental-vm-modules`,
// so a dynamic import throws here regardless of what the mock says.
import { exchangeToken, PairExchangeError } from '@/services/pair-exchange'

const localStorageBacking = new Map<string, string>()

// `exchangeToken` reads the platform-neutral module; point it at the web one so
// the refusal under test is driven by the value the web build really carries.
jest.mock('@/services/secure-store', () =>
  jest.requireActual('@/services/secure-store.web'),
)

const SPK = 'D'.repeat(43)
const SERVER_URL = 'https://web.test'

beforeAll(() => {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => localStorageBacking.get(k) ?? null,
      setItem: (k: string, v: string) => localStorageBacking.set(k, v),
      removeItem: (k: string) => localStorageBacking.delete(k),
    },
  })
})

beforeEach(() => {
  localStorageBacking.clear()
  global.fetch = jest.fn()
})

describe('the web secure-store shim', () => {
  it('reports that it is not a keychain', () => {
    // The constant `exchangeToken` gates on. Asserted against the real web
    // module, which is the half nothing covered.
    expect(HAS_SECURE_KEYCHAIN).toBe(false)
  })

  it('has no keychain accessibility class to offer', () => {
    // `undefined` rather than a native constant, so a caller cannot believe it
    // asked for device-only storage and got it.
    expect(WHEN_UNLOCKED_THIS_DEVICE_ONLY).toBeUndefined()
  })
})

describe('exchangeToken on web', () => {
  it('refuses an encrypted pairing and writes no device key', async () => {
    await expect(
      exchangeToken({ url: SERVER_URL, token: 'pt_x', serverPublicKey: SPK }),
    ).rejects.toMatchObject({ kind: 'e2ee-web-unsupported' })

    // The refusal has to come before anything is stored, not after: the whole
    // point is that no `D_priv` ever reaches `localStorage`.
    expect([...localStorageBacking.keys()]).toEqual([])
    // And before the request, so the pair token is not spent on a pairing this
    // platform was never going to complete.
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('still pairs a legacy QR that offered no server key', async () => {
    // The negative control. Without it, "web refuses" cannot tell a targeted
    // refusal from a build that cannot pair at all, and the legacy and manual
    // API-key paths on web must keep working — neither mints a device key.
    global.fetch = jest.fn(async () => ({
      status: 200,
      ok: true,
      json: async () => ({ error: 'nope' }),
    })) as unknown as typeof fetch

    const failure = await exchangeToken({ url: SERVER_URL, token: 'pt_x' }).catch(
      (err: unknown) => err,
    )

    // It gets as far as the network and fails on the response, rather than
    // being refused for the platform.
    expect(global.fetch).toHaveBeenCalled()
    expect(failure).toBeInstanceOf(PairExchangeError)
    expect((failure as PairExchangeError).kind).not.toBe('e2ee-web-unsupported')
    expect([...localStorageBacking.keys()]).toEqual([])
  })
})
