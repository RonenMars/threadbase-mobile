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

The app did not declare cleartext permission for release builds, so the platform blocked the request before it left the process.

- `android/app/src/debug/AndroidManifest.xml` and `src/debugOptimized/AndroidManifest.xml` set `android:usesCleartextTraffic="true"`, but both are **build-type source sets** and neither merges into a release build.
- `src/main/AndroidManifest.xml` set neither `usesCleartextTraffic` nor `networkSecurityConfig`.
- At `targetSdkVersion` 28 and above, the platform default is cleartext **denied**.

Every developer build permits cleartext, which is why this survived development entirely.

**How to tell it apart from a real network problem**

They look identical from the app: no server-side trace, and a generic unreachable error. Two checks separate them.

1. Open the same URL in the phone's **browser**. A browser is not subject to the app's network security config, so if it loads and the app cannot, the network is fine and the platform is blocking the app.
2. Try the same server over `https://`. If that works, the difference is the scheme, not the route.

Worth knowing that a genuine network failure has its own trap on the server side: a Mac with two active interfaces on the same subnet advertises the wrong one in its pairing QR, and the phone times out against an address nothing answers on. That is RonenMars/threadbase-streamer#604, and it produces the same empty log. Both can be true at once; check the browser before concluding either.

**Fix**

Fixed for local-network addresses — `app.json` now sets `usesCleartextTraffic` under `expo-build-properties`, so the release manifest permits cleartext, and `services/cleartext-policy.ts` keeps it to the local network the way iOS already does. The reasoning is in `docs/adr/0002-android-cleartext-policy.md`. A build predating that carries the defect; `versionCode 54` on the Play alpha track is one.

**If it still happens after that fix**

The address is plain HTTP and is **not** on your local network, so the app refuses it deliberately rather than the platform blocking it. The message says so, and names the remedy: use an `https://` address, or `tb serve --tunnel`. `tb-streamer pair` embeds whatever `public_url` is set to in `~/.threadbase/server.yaml`, so pointing that at the tunnel and re-running produces a QR the app can use.

The permitted set is loopback, `10.x`, `192.168.x`, `172.16–31.x`, Tailscale's `100.64–127.x`, `169.254.x`, IPv6 loopback / link-local / unique-local, `*.local`, and unqualified hostnames. Anything else over `http://` or `ws://` is refused before a socket is opened.

**Write addresses out in full.** Abbreviated and non-decimal forms are refused even when they name a local address — `127.1`, `192.168.1`, `0x7f000001` and `010.0.0.1` are all rejected, so use `127.0.0.1` and `192.168.0.1`. This is deliberate: those forms mean one thing to the platform's resolver and another to a plain reading, and a public address can be written to look local in exactly that gap (`134744072` is 8.8.8.8). The policy denies anything the two could read differently rather than trying to match the resolver form for form.
