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
DEVICE_UDID="<your-device-udid>" npm run dev:device
```

> **Use `dev:device`, not a bare `npx expo run:ios --device`.** The bare command uses
> Xcode's automatic signing, whose generated profile carries no App Groups — and both
> `Threadbase` and `ExpoWidgetsTarget` declare `group.com.ronenmars.threadbase`. It fails
> to sign with six errors and `xcodebuild` exits 65. `scripts/dev-device.sh` discovers a
> development provisioning profile per target and passes them through
> `XCODE_XCCONFIG_FILE`. See [troubleshooting.md](troubleshooting.md).
>
> Add `TUNNEL_URL=<https-url>` when the phone is not on the same Wi-Fi, or use
> `npm run dev:tunnel:native`, which delegates here.

> If Watchman misbehaves (see friction table), prepend `EXPO_NO_WATCHMAN=1`.
> Leave it off by default — it's a workaround, not the norm.

What happens:

1. `bundle exec pod install` if needed (~30s) — `bundle exec` keeps CocoaPods on the Gemfile-pinned 1.16.2.
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
| Build phase missing after `node_modules` refresh | Pods drift | `cd ios && bundle exec pod install && cd ..` |
| Node version "incompatible with Expo SDK X" | Node version mismatch | SDK 54+ needs Node ≥22.13 or ≥24. Check `node -v`. |
| Hermes crashes on iOS 26 | Old Hermes (0.12.x) | We're on SDK 55+ (Hermes 0.14+). Don't downgrade. |
| App stays on splash screen | Device + Mac on different Wi-Fi | Use the tunnel flow — see [remote-dev-tunnel.md](remote-dev-tunnel.md) |
| `Loading from Metro…` forever (device on cellular) | QR encodes a LAN/CGNAT IP the device can't route to over cellular | Put device on the same Wi-Fi, or use the tunnel — see "Picking the right Metro address" below |
| `Failed to load app … App Transport Security policy requires a secure connection` | Metro advertised a `100.x` (Tailscale) or other non-LAN `http://` host; iOS ATS blocks plaintext to it | Force Metro onto the LAN/hotspot IP, or use the `https` tunnel — see "Picking the right Metro address" below |

---

## Picking the right Metro address

When you `expo start` and scan the QR, Metro bakes **one** host into the URL the
device loads. Two things break it:

1. **Wrong interface.** If Tailscale (or any VPN) is up, Metro often picks the
   `100.x` CGNAT address (`100.64.0.0/10`) instead of your real LAN/hotspot IP.
2. **iOS ATS.** iOS blocks plaintext `http://` loads except to recognised private
   ranges (`10.x`, `172.16–31.x`, `192.168.x`) covered by `NSAllowsLocalNetworking`.
   The Tailscale `100.x` range is **not** covered, so the dev client throws
   *"App Transport Security policy requires the use of a secure connection."*

A phone hotspot hands out `172.20.10.x` (a real private range that passes ATS), so
the fix when sharing a hotspot is usually just to point Metro at that IP instead of
the Tailscale one.

### Two knobs

| | `REACT_NATIVE_PACKAGER_HOSTNAME` | `EXPO_PACKAGER_PROXY_URL` |
|---|---|---|
| Changes | the **host** in the URL (scheme stays `http`, port stays `8081`) | the **entire** URL Expo advertises |
| Path to Metro | device → Metro **directly** | device → proxy/tunnel → Metro |
| Scheme | `http` | usually `https` |
| Needs same network | yes | no (works over cellular) |
| Solves ATS error? | only if host is `10/172.16–31/192.168.x` | yes — `https` satisfies ATS |
| Speed | fastest (no extra hop) | slower (extra hop) |
| Set by | you, manually | `npm run dev:tunnel` |

### Same Wi-Fi / hotspot — force the LAN IP (fastest)

Find the interface the device can reach (hotspot is usually `172.20.10.x`):

```bash
ipconfig getifaddr en0   # try en1 if empty; or: ifconfig | grep "inet 172.20.10"
```

Start Metro bound to it:

```bash
REACT_NATIVE_PACKAGER_HOSTNAME=172.20.10.x npx expo start -c
```

The QR now encodes `http://172.20.10.x:8081`, which the device can route to and
iOS allows. Use this whenever Metro keeps grabbing the Tailscale `100.x` interface.

### Different network / cellular — use the tunnel

When the device can't reach the Mac directly, or you want `https` to sidestep ATS
entirely, use the proxy URL via the tunnel:

```bash
npm run dev:tunnel -- -c
```

This sets `EXPO_PACKAGER_PROXY_URL` to the cloudflared `https://…` hostname. Full
setup and command variants: **[remote-dev-tunnel.md](remote-dev-tunnel.md)**.

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
