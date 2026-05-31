# Running tb-mobile on the physical iPhone 17 Pro

Quick reference for the Mac → iPhone 17 Pro dev loop. Captures the actual UDID, the everyday command, and the gotchas that have bitten us before.

---

## Device identity

| Phone | iOS | Legacy UDID (use this with Expo / Xcode) | CoreDevice ID (`devicectl`) |
|---|---|---|---|
| Ronen Mars's iPhone 17 Pro | 26.5 | `00008150-00115DEA1A40401C` | `187F0489-0B16-585E-B41E-B98CAE88BC47` |

**Expo / `xcrun` use the legacy UDID.** The CoreDevice ID is what `xcrun devicectl list devices` shows but is a different namespace and won't work with `expo run:ios --device`.

To re-confirm at any time:

```bash
xcrun xctrace list devices 2>&1 | grep -i "iPhone 17"
```

The format is the giveaway — the legacy UDID is **8 hex chars + dash + 16 hex chars** (25 chars total). Simulators are classic UUIDs (8-4-4-4-12, 36 chars with four dashes).

---

## One-time setup (already done — listed for posterity)

1. iPhone is plugged into the Mac via USB-C and trusts the computer.
2. iOS Developer Mode enabled: `Settings → Privacy & Security → Developer Mode → On` (reboots the phone).
3. Apple ID signed in to Xcode for code-signing.
4. The bundle id `com.ronenmars.threadbase` is shared between dev builds and TestFlight builds — installing the dev client over USB **replaces** any TestFlight install of Threadbase on the device.

---

## Daily commands

### First install of a session (or after `npm install`, native module change, or `app.json` change)

```bash
cd <repo-root> && \
  EXPO_NO_WATCHMAN=1 npx expo run:ios --device "<your-iphone-udid>"
```

What happens:

1. `pod install` if needed (~30s).
2. Xcode build (~3–5 min cold, faster on warm cache).
3. Install over USB.
4. Metro starts on port 8081.
5. App launches automatically.

### Reload after a JS-only code change

Leave Metro running. Either:

- Shake the phone → tap **Reload**.
- Or press `r` in the Metro terminal.

### Restart Metro only (after stopping it)

If the dev client is still on the phone:

```bash
cd <repo-root> && \
  EXPO_NO_WATCHMAN=1 npx expo start --dev-client
```

Open the Threadbase dev-client app on the phone and tap the LAN URL the terminal prints. Both devices must be on the same Wi-Fi.

---

## Known friction (and fixes)

| Symptom | Cause | Fix |
|---|---|---|
| First launch: **"Untrusted Developer"** alert | iOS doesn't yet trust the signing cert | `Settings → General → VPN & Device Management → Apple Development: <Apple ID> → Trust` |
| Metro complains about path resolution / fresh node_modules | Watchman TCC bug on this Mac | `EXPO_NO_WATCHMAN=1` (already on the command). Don't drop it. |
| `Could not find device with UDID` | Phone unplugged / locked / not trusted | Plug back in, unlock, tap "Trust this computer" if prompted |
| Bundle fails on different file names every run | Watchman cache out of sync | `watchman watch-del "$PWD" && rm -rf $TMPDIR/metro-*` |
| Build phase missing after `node_modules` refresh | Pods drift | `cd ios && pod install && cd ..` |
| Node version "incompatible with Expo SDK X" | Brew/asdf node version mismatch | Project Node engines need ≥22.13 or ≥24 for SDK 54+. Check `node -v`. |
| Hermes crashes on iOS 26 | Old Hermes (0.12.x) | We're on SDK 55+ already (Hermes 0.14+). Don't downgrade. |
| App stays on splash screen | iPhone + Mac on different Wi-Fi | Same Wi-Fi network required. Metro serves from your Mac's LAN IP, not localhost. |

---

## Coexistence with TestFlight Threadbase

The dev client and the TestFlight build **share `com.ronenmars.threadbase`** — they cannot coexist on the device. Installing one replaces the other.

What survives a swap (same bundle id):

- **API keys** — `SecureStore` writes to the iOS Keychain, which persists across reinstalls of the same bundle id by the same signing team.

What's wiped:

- **Server URLs and labels** — they live in `AsyncStorage` (Zustand `stores/servers`), and `AsyncStorage` is per-install. Expect to re-add each server after a swap.
- **Favorites, settings, session names** — all live in `AsyncStorage` (`threadbase_settings`, `threadbase_quick_access`, `threadbase_session_names`). Wiped on reinstall.

To go back to TestFlight: open the TestFlight app on the phone and reinstall Threadbase from there. The dev client overwrite is removed automatically.

If you ever want both side-by-side (dev client + TestFlight), change `bundleIdentifier` in `app.json` to `com.ronenmars.threadbase.dev` for local dev only — don't commit. You'd then `npx expo prebuild --clean` and re-run `expo run:ios`. Heavier path, only worth it if you're actively comparing the two builds in parallel.

---

## Stopping cleanly

`Ctrl+C` in the Metro terminal kills the dev server but leaves the dev-client app installed on the phone. The app icon stays put; tapping it shows "Could not connect to development server" until Metro is back. To delete the dev-client app, long-press the icon → Remove App.
