# Running tb-mobile on a Physical Android Device

Quick reference for the Mac → physical Android phone dev loop. Covers device
setup, the build/install/reload cycle, wireless adb, and the friction points that
actually bite (especially on Xiaomi/MIUI/HyperOS).

Companion to **[dev-on-physical-device-ios.md](dev-on-physical-device-ios.md)** and
**[remote-dev-tunnel.md](remote-dev-tunnel.md)**.

---

## The one mental model that saves you hours

An Expo dev build has **two independent halves**, delivered by two different paths:

| Half | What's in it | How it reaches the phone |
|---|---|---|
| **Native APK** | Compiled Java/Kotlin + `.so` libs — every native module (`netinfo`, `reanimated`, camera, secure-store…) | `adb install` from a **local `.apk` file** |
| **JS bundle** | Your TypeScript/React code | Metro over the network — LAN or the `metro.rbv1000.win` **tunnel** |

The tunnel (and Cloudflare) **only ever serve the JS bundle**. The native module
code travels over adb, never over the tunnel.

**Corollary — the classic trap:** if you add or upgrade a *native* dependency and
only restart Metro, the phone gets fresh JS that calls a native module its **old
APK doesn't contain**. You get:

```
ERROR  @react-native-community/netinfo: NativeModule.RNCNetInfo is null.
```

This is **not** a Metro cache issue and **not** a Cloudflare cache issue — it's a
native/JS version mismatch on the device. The fix is always **rebuild the APK and
reinstall it on the phone** (below), not clearing a bundle cache.

> Rule of thumb: **JS-only change → just reload. Native change (new dep, `app.json`,
> `expo install`, pod/gradle) → rebuild + reinstall the APK.**

---

## One-time device setup (Xiaomi / MIUI / HyperOS)

Stock Android needs only steps 1–2. Xiaomi's HyperOS adds the rest — and each one
has burned us, so don't skip.

1. **Unlock Developer options:** `Settings → About phone` → tap the
   **HyperOS/MIUI version** row 7 times.
2. **USB debugging:** `Settings → Additional settings → Developer options → USB debugging` → ON.
3. **Install via USB:** ON. ⚠️ **HyperOS won't let you enable this without a SIM
   card inserted** and usually a signed-in Mi account. Pop *any* SIM in (an old,
   inactive one is fine) to flip the toggle, then you can proceed.
4. **USB debugging (Security settings):** ON if present — this separate toggle is
   what actually authorizes `adb install`/`shell` grants on Xiaomi.
5. **Default USB configuration:** set to **File Transfer (MTP)**, not "Charging
   only". Charging-only mode hides adb from the Mac entirely.
6. Plug in → on the phone, tap **Allow** on the *"Allow USB debugging?"* RSA prompt
   (check "Always allow from this computer").

---

## Verifying the connection

```bash
adb devices -l
```

You want a line in **`device`** state, e.g.:

```
eb57e2b6   device usb:0-1 product:lisa_global model:2109119DG device:lisa
```

(`lisa` is the Mi 11 Lite 5G NE codename.) States that aren't `device`:

| Shows as | Meaning | Fix |
|---|---|---|
| _(nothing at all)_ | Mac doesn't see the USB device | Data cable (not charge-only), plug direct (no hub), set USB mode to **File Transfer** |
| `unauthorized` | RSA prompt not accepted | Unlock phone, tap **Allow** on the debugging dialog |
| `offline` | adb handshake stuck | `adb reconnect offline`, or `adb kill-server && adb start-server` |

> If multiple devices are attached (e.g. an emulator too), target the phone
> explicitly with `-s <serial>` on **every** adb command — e.g. `-s eb57e2b6`.

---

## Daily commands

### First install / after any native change

Run this after `npm install`, a native-module change, an `app.json` change, or
when the dev client isn't on the phone yet:

```bash
cd <repo-root>
npx expo run:android
```

What happens: Gradle build → installs the APK over adb → starts Metro on 8081 →
launches the app.

> ⚠️ **A "BUILD SUCCESSFUL in 7s" with everything `UP-TO-DATE` did NOT recompile
> native code.** If you expected a native change to land and the build was that
> fast, Gradle reused a cached APK. Force a real rebuild:
> ```bash
> cd android && ./gradlew clean && cd .. && npx expo run:android
> ```

### Manual reinstall of an already-built APK

When the APK on disk is already correct and you just need it on the phone:

```bash
adb -s <serial> install -r android/app/build/outputs/apk/debug/app-debug.apk
```

### Reload after a JS-only change

Leave Metro running. Either shake the phone → **Reload**, or press `r` in the
Metro terminal, or trigger the dev menu:

```bash
adb -s <serial> shell input keyevent 82
```

### Restart Metro only (dev client already installed)

```bash
cd <repo-root>
npx expo start --dev-client
```

### Off-network / remote — the tunnel

When the phone isn't on the same Wi-Fi as the Mac (or you just want a stable URL):

```bash
npm run dev:tunnel
```

This owns Metro on 8081 and advertises the cloudflared `https://metro.rbv1000.win`
host via `EXPO_PACKAGER_PROXY_URL`, so the phone loads JS over the tunnel and
hot-reload works even over cellular. Full setup:
**[remote-dev-tunnel.md](remote-dev-tunnel.md)**.

> `dev:tunnel` starts its **own** Metro. If another Metro already holds 8081 (e.g. a
> stray `expo run:android`), it can't bind and bails after 5 retries with
> *"Port 8081 is running this app in another window."* Free the port first:
> `kill $(lsof -ti:8081)`.

---

## Wireless adb — debug with the cable unplugged

JS hot-reload already works cable-free over the tunnel. To also keep **logcat,
the dev menu, and reinstalls** without USB, switch adb to TCP/IP.

**Set it up while USB is still connected:**

```bash
# 1. get the phone's Wi-Fi IP
adb -s <serial> shell ip route | awk '/wlan0/ {print $9}'
#   e.g. 192.168.68.112

# 2. put adb into TCP/IP mode (over the USB link)
adb -s <serial> tcpip 5555

# 3. connect over Wi-Fi
adb connect 192.168.68.112:5555

# 4. verify the wireless link works on its own
adb -s 192.168.68.112:5555 shell pm list packages | grep threadbase
```

Once step 4 prints the package, **you can unplug the cable.** The USB serial drops
off `adb devices`; the `192.168.68.112:5555` entry stays.

**Caveats:**
- Phone and Mac must be on the **same Wi-Fi**.
- A phone **reboot** reverts it to USB-only — replug once and redo `adb tcpip 5555`.
- If Wi-Fi drops mid-session, reconnect with `adb connect 192.168.68.112:5555`.

---

## Watching logs

```bash
# JS console.log + RN warnings + hard crashes only (quietest, most useful)
adb -s <serial> logcat -v time ReactNativeJS:V ReactHost:W AndroidRuntime:E "*:S"

# just your console.log
adb -s <serial> logcat -s ReactNativeJS:V

# everything from the app's process (verbose)
adb -s <serial> logcat --pid=$(adb -s <serial> shell pidof com.ronenmars.threadbase)
```

`adb -s <serial> logcat -c` clears the buffer — do this right before reproducing a
bug so the output is only the run you care about.

### Log noise that is NOT a bug

| Log line | Verdict |
|---|---|
| `ReactNoCrashSoftException: … onWindowFocusChange while context is not ready` | Harmless RN New-Arch cold-start race. Soft (non-crashing) by design. Ignore. |
| `setLayoutAnimationEnabledExperimental is currently a no-op in the New Architecture` | Informational. Ignore. |
| `Route "./_layout.tsx" is missing the required default export` | Expo Router noise during fast-refresh churn; benign if the app renders. |
| `hiddenapi: Accessing hidden field … allowed` | Android greylist notice from RN internals. Ignore. |

---

## Known friction (and fixes)

| Symptom | Cause | Fix |
|---|---|---|
| `NativeModule.RNCNetInfo is null` (or any `NativeModule.X is null`) | Phone's APK is older than the JS — native module not compiled in | Rebuild + reinstall the APK (see "First install"). Not a cache issue. |
| Native change didn't take, build was ~7s all `UP-TO-DATE` | Gradle reused a cached APK | `cd android && ./gradlew clean && cd .. && npx expo run:android` |
| `INSTALL_FAILED_USER_RESTRICTED: Install canceled by user` | HyperOS blocked the adb install | Enable **Install via USB** *and* **USB debugging (Security settings)**; accept the on-screen install prompt. A SIM must be inserted for the toggle. |
| Phone absent from `adb devices`, nothing on USB bus | Charge-only cable / hub / wrong USB mode | Use a **data** cable, plug **direct**, set USB mode to **File Transfer** |
| Device shows `unauthorized` | RSA prompt not accepted | Unlock phone, tap **Allow**, re-run |
| `dev:tunnel` exits after 5 retries, "Port 8081 … another window" | Another Metro owns 8081 | `kill $(lsof -ti:8081)` then re-run |
| Wireless adb dead after phone reboot | `tcpip` mode resets on reboot | Replug USB, `adb tcpip 5555`, `adb connect <ip>:5555` |
| App stuck on splash / "Could not connect to development server" | Metro down, or phone can't reach the advertised host | Restart Metro; if off-LAN use `npm run dev:tunnel` |
| Metro fails on different missing files each run | Watchman cache out of sync | `watchman watch-del "$PWD" && rm -rf $TMPDIR/metro-*` |
| Build phase missing / codegen gone after `node_modules` refresh | Autolinking artifacts stale | `cd android && ./gradlew clean`, then rebuild |
| Node version "incompatible with Expo SDK X" | Node mismatch | SDK 54+ needs Node ≥22.13 or ≥24. Check `node -v`. |

---

## Confirming a native module is actually in the APK

When you're not sure whether the on-disk APK contains a native module, check its
dex directly (no need to install first):

```bash
cd /tmp && rm -rf apk_check && mkdir apk_check && cd apk_check
unzip -q <repo-root>/android/app/build/outputs/apk/debug/app-debug.apk 'classes*.dex'
strings classes*.dex | grep -i netinfo | sort -u
```

Hits like `com.reactnativecommunity.netinfo.NetInfoModule` mean the native module
**is** compiled in. Zero hits means the APK is stale — rebuild before chasing a JS
bug that's really a native mismatch.

You can also confirm autolinking generated the registration:

```bash
grep -i netinfo android/app/build/generated/autolinking/src/main/java/com/facebook/react/PackageList.java
# → new com.reactnativecommunity.netinfo.NetInfoPackage(),
```

---

## Coexistence with the Play Store / TestFlight-equivalent build

The dev build and any store build **share `com.ronenmars.threadbase`** — installing
the dev client over adb replaces a store install of the same signing identity, and
vice versa (signature-mismatch installs are rejected; uninstall first with
`adb uninstall com.ronenmars.threadbase`).

Persistence across a same-bundle-id reinstall mirrors iOS: `SecureStore` keys tend
to survive; `AsyncStorage` (server URLs, favorites, settings, session names) is
wiped. Re-add servers after a swap.

---

## Stopping cleanly

`Ctrl+C` in the Metro terminal stops the dev server but leaves the app installed.
To disconnect wireless adb without uninstalling:

```bash
adb disconnect 192.168.68.112:5555
```

To remove the app entirely: `adb -s <serial> uninstall com.ronenmars.threadbase`,
or long-press the icon on the phone → **Uninstall**.
