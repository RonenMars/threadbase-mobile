# Remote Dev with Metro Tunnels

When your iOS device isn't on the same Wi-Fi as your Mac, Metro can't serve the
bundle over LAN. The fix: front Metro with an HTTPS tunnel and tell Expo to use
it via `EXPO_PACKAGER_PROXY_URL`.

---

## How it works

Expo reads `EXPO_PACKAGER_PROXY_URL` at startup and advertises that URL to the
app instead of the local LAN IP. The app fetches its JS bundle through the
tunnel, so device and Mac no longer need to share a network.

---

## Setting up the tunnel

### Option A — cloudflared (recommended)

Cloudflare Tunnel is free, no account required for a temporary hostname, and
stable enough for dev use.

```bash
# one-time install
brew install cloudflare/cloudflare/cloudflared

# start a quick tunnel pointing at Metro's port
cloudflared tunnel --url http://localhost:8081
```

`cloudflared` prints a `https://*.trycloudflare.com` URL — copy it.

> For a **stable hostname** across restarts, configure a named tunnel:
> `cloudflared tunnel create <name>`, add a `config.yml` ingress rule pointing
> `localhost:8081`, then run `cloudflared tunnel run <name>`. See
> <https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/>.

### Option B — ngrok

```bash
# one-time install
brew install ngrok/ngrok/ngrok

# authenticate (free account at ngrok.com — one-time)
ngrok config add-authtoken <your-token>

# expose Metro
ngrok http 8081
```

ngrok prints a `https://<id>.ngrok-free.app` URL — copy it.

> **Free-tier caveat:** ngrok tunnels expire after ~2 hours. Restart ngrok and
> update `EXPO_PACKAGER_PROXY_URL` when it does.

---

## Running with the tunnel

Start your tunnel first (above), then substitute its URL in the commands below.

### JS-only reload (dev client already installed, no native changes)

```bash
cd <repo-root>
EXPO_PACKAGER_PROXY_URL=https://<tunnel-hostname> \
  npx expo start --lan
```

Open the Threadbase dev-client app on the device and connect to the tunnel URL
the terminal prints.

### Full native rebuild + install over USB

Use this after native module changes, `npm install`, or `app.json` changes, or
when the dev client isn't on the device yet:

```bash
cd <repo-root>
EXPO_PACKAGER_PROXY_URL=https://<tunnel-hostname> \
  npx expo run:ios --device "<your-device-udid>"
```

See [dev-on-physical-device-ios.md](dev-on-physical-device-ios.md) for how to
find your device's UDID.

---

## Feature flags

`EXPO_PUBLIC_*` vars are inlined at bundle time. To enable in-chat question
cards alongside the tunnel:

```bash
EXPO_PUBLIC_FEATURE_QUESTIONS=true \
EXPO_PACKAGER_PROXY_URL=https://<tunnel-hostname> \
  npx expo run:ios --device "<your-device-udid>"
```

After **flipping a flag**, add `-c` to clear Metro's transform cache so the new
value is rebuilt into the bundle:

```bash
EXPO_PUBLIC_FEATURE_QUESTIONS=true \
EXPO_PACKAGER_PROXY_URL=https://<tunnel-hostname> \
  npx expo start --lan -c
```

A bare `FEATURE_QUESTIONS=true` (no `EXPO_PUBLIC_` prefix) is **not** read by
the app — the flag stays off.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| App shows "Could not connect to development server" | Confirm the tunnel is running and Metro is up on port 8081 |
| ngrok URL stopped working mid-session | Free tunnel expired (~2 h); restart ngrok, copy new URL, restart Metro with the new `EXPO_PACKAGER_PROXY_URL` |
| Bundle loads but feature flag not taking effect | You didn't pass `-c`; Metro served a cached bundle with the old value baked in |
| `cloudflared` exits immediately | Port 8081 not open yet; start Metro first, then run `cloudflared tunnel --url ...` |
