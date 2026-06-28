# Running tb-mobile on a Physical iOS Device

Quick reference for the Mac → physical iPhone dev loop. Covers device setup,
daily commands, and common friction points.

---

## Device identity

Expo and `xcrun` use the **legacy UDID**, not the CoreDevice ID.

To find it:

```bash
xcrun xctrace list devices 2>&1 | grep -i "iPhone"
```

The legacy UDID format is **8 hex chars + dash + 16 hex chars** (25 chars total,
e.g. `XXXXXXXX-XXXXXXXXXXXXXXXX`). Simulators are classic UUIDs (8-4-4-4-12,
36 chars with four dashes) — don't confuse them.

The CoreDevice ID shown by `xcrun devicectl list devices` is a different
namespace and won't work with `expo run:ios --device`.

---

## One-time setup

1. Plug the iPhone into the Mac via USB-C and tap **Trust** on the device.
2. Enable Developer Mode: `Settings → Privacy & Security → Developer Mode → On` (reboots the phone).
3. Sign into Xcode with your Apple ID for code-signing.
4. The bundle id `com.ronenmars.threadbase` is shared between dev builds and
   TestFlight — installing the dev client over USB **replaces** any TestFlight
   install on the device.

---

## Daily commands

### First install (or after native changes)

Use this after `npm install`, a native module change, `app.json` change, or when
the dev client isn't on the device yet:

```bash
cd <repo-root>
npx expo run:ios --device "<your-device-udid>"
```

> If Watchman misbehaves (see friction table), prepend `EXPO_NO_WATCHMAN=1`.
> Leave it off by default — it's a workaround, not the norm.

What happens:

1. `pod install` if needed (~30s).
2. Xcode build (~3–5 min cold, faster on warm cache).
3. Install over USB.
4. Metro starts on port 8081.
5. App launches automatically.

### Reload after a JS-only change

Leave Metro running. Either:

- Shake the phone → tap **Reload**.
- Or press `r` in the Metro terminal.

### Restart Metro only (dev client already on device)

```bash
cd <repo-root>
npx expo start --dev-client
```

Open the Threadbase dev-client app on the phone and tap the LAN URL the terminal
prints. Both devices must be on the same Wi-Fi.

### Off-network / remote

When the device isn't on the same Wi-Fi as the Mac, use a tunnel.
See **[remote-dev-tunnel.md](remote-dev-tunnel.md)** for setup (cloudflared or ngrok)
and the full `EXPO_PACKAGER_PROXY_URL` command variants.

---

## Known friction (and fixes)

| Symptom | Cause | Fix |
|---|---|---|
| First launch: **"Untrusted Developer"** alert | iOS doesn't yet trust the signing cert | `Settings → General → VPN & Device Management → Apple Development: <Apple ID> → Trust` |
| Metro warns `Recrawled this watch N times` or fails on path resolution | Watchman TCC bug (surfaces after `npm ci`, branch switch, or big rebase) | Prepend `EXPO_NO_WATCHMAN=1` and add `-c` to clear the poisoned cache |
| `Could not find device with UDID` | Phone unplugged / locked / not trusted | Plug back in, unlock, tap "Trust this computer" if prompted |
| Bundle fails on different file names every run | Watchman cache out of sync | `watchman watch-del "$PWD" && rm -rf $TMPDIR/metro-*` |
| Build phase missing after `node_modules` refresh | Pods drift | `cd ios && pod install && cd ..` |
| Node version "incompatible with Expo SDK X" | Node version mismatch | SDK 54+ needs Node ≥22.13 or ≥24. Check `node -v`. |
| Hermes crashes on iOS 26 | Old Hermes (0.12.x) | We're on SDK 55+ (Hermes 0.14+). Don't downgrade. |
| App stays on splash screen | Device + Mac on different Wi-Fi | Use the tunnel flow — see [remote-dev-tunnel.md](remote-dev-tunnel.md) |

---

## Coexistence with TestFlight Threadbase

The dev client and the TestFlight build **share `com.ronenmars.threadbase`** —
they cannot coexist on the device. Installing one replaces the other.

What survives a swap (same bundle id):

- **API keys** — stored in iOS Keychain via `SecureStore`; persists across reinstalls of the same bundle id by the same signing team.

What's wiped:

- **Server URLs and labels** — `AsyncStorage` (`stores/servers`); re-add after a swap.
- **Favorites, settings, session names** — `AsyncStorage` (`threadbase_settings`, `threadbase_quick_access`, `threadbase_session_names`); wiped on reinstall.

To go back to TestFlight: open the TestFlight app on the phone and reinstall
Threadbase from there.

> If you need both side-by-side, change `bundleIdentifier` in `app.json` to
> `com.ronenmars.threadbase.dev` for local dev only (don't commit), then
> `npx expo prebuild --clean` and re-run `expo run:ios`.

---

## Stopping cleanly

`Ctrl+C` in the Metro terminal kills the dev server but leaves the dev-client
app installed. Tapping the icon shows "Could not connect to development server"
until Metro is back. To remove the app: long-press the icon → **Remove App**.
