# Troubleshooting

## `npm install` fails on Windows with "The system cannot find the path specified"

**Symptom**

```
npm ERR! code 1
npm ERR! command failed
npm ERR! command C:\Windows\system32\cmd.exe /d /s /c git config core.hooksPath scripts/git-hooks 2>/dev/null || true
```

**Cause**

The `prepare` script in `package.json` originally used Unix shell syntax (`2>/dev/null || true`) which `cmd.exe` on Windows does not understand.

**Fix (already applied)**

The script was replaced with a cross-platform Node.js one-liner:

```json
"prepare": "node -e \"const {execSync}=require('child_process');try{execSync('git config core.hooksPath scripts/git-hooks',{stdio:'ignore'})}catch(e){}\""
```

If you see this error again, check that the `prepare` entry in `package.json` still uses the Node.js form and has not been reverted to the bash form.

## Android: "Could not reach that server" on an `http://` address, while the browser reaches it fine

**Symptom**

Pairing or connecting to a plain-HTTP server from an Android **release** build fails with *"Could not reach that server. Check that the streamer is running and your phone is on the same network."*

Nothing arrives at the server — its request log stays empty for the attempt. Meanwhile the phone's browser opens the same URL successfully, and the app itself works fine against an `https://` address in the same minute.

**Cause**

The app does not declare cleartext permission for release builds, so the platform blocks the request before it leaves the process.

- `android/app/src/debug/AndroidManifest.xml` and `src/debugOptimized/AndroidManifest.xml` set `android:usesCleartextTraffic="true"`, but both are **build-type source sets** and neither merges into a release build.
- `src/main/AndroidManifest.xml` sets neither `usesCleartextTraffic` nor `networkSecurityConfig`.
- At `targetSdkVersion` 28 and above, the platform default is cleartext **denied**.

Every developer build permits cleartext, which is why this survives development entirely.

**How to tell it apart from a real network problem**

They look identical from the app: no server-side trace, and a generic unreachable error. Two checks separate them.

1. Open the same URL in the phone's **browser**. A browser is not subject to the app's network security config, so if it loads and the app cannot, the network is fine and the platform is blocking the app.
2. Try the same server over `https://`. If that works, the difference is the scheme, not the route.

Worth knowing that a genuine network failure has its own trap on the server side: a Mac with two active interfaces on the same subnet advertises the wrong one in its pairing QR, and the phone times out against an address nothing answers on. That is RonenMars/threadbase-streamer#604, and it produces the same empty log. Both can be true at once; check the browser before concluding either.

**Fix**

Not fixed yet — tracked as #727, which is a policy decision rather than a one-line manifest change. The app exists to reach servers the user runs themselves on their own network, so permitting cleartext, denying it, or permitting it narrowly are genuinely different products.

**Until then**

Use `https://` — a tunnel address works. `tb-streamer pair` embeds whatever `public_url` is set to in `~/.threadbase/server.yaml`, so pointing that at the tunnel and re-running produces a QR the app can use.

**Related**

A blocked cleartext request should report itself distinctly rather than as a generic unreachable error. Android raises `java.io.IOException: Cleartext HTTP traffic to <host> not permitted`, which is detectable in one place — `services/authed-fetch.ts` — since #701. Covered in #727.
