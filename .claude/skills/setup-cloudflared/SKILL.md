---
name: setup-cloudflared
description: Set up a Cloudflare tunnel to expose Metro (port 8081) over HTTPS for remote React Native / Expo dev. Covers macOS/Linux (quick + named tunnels via npm scripts) and Windows (system service with SYSTEM profile config). Use when the user wants to connect a phone to Metro over a tunnel, configure a stable hostname, add Metro to an existing cloudflared service, or troubleshoot tunnel routing issues.
---

# setup-cloudflared

Sets up a Cloudflare tunnel to expose Metro bundler (port 8081) over HTTPS so
a physical device can connect without sharing the same Wi-Fi.

## How it works

`EXPO_PACKAGER_PROXY_URL` is set at Metro startup. Expo advertises that URL
to the app instead of the local LAN IP. The app fetches its JS bundle through
the tunnel — device and dev machine no longer need to share a network.

**Key constraint:** tunnel and Metro must run on the **same machine** (the
tunnel proxies `localhost:8081`).

## Project config files

- `.cloudflared/config.example.yml` — committed template (like `.env.example`)
- `.cloudflared/config.yml` — gitignored, real values for your machine

Copy the example, fill in tunnel ID and hostname, then follow the platform
steps below.

---

## macOS / Linux

### Quick tunnel (no account, temporary URL)

`npm run dev:tunnel` handles everything automatically:
1. Spins up a dummy HTTP listener on 8081 (so cloudflared doesn't exit).
2. Launches cloudflared, waits for the `*.trycloudflare.com` URL.
3. Kills the dummy listener.
4. Starts Metro with `EXPO_PACKAGER_PROXY_URL` set.

```bash
npm run dev:tunnel                           # JS-only
EXPO_PUBLIC_FEATURE_QUESTIONS=true npm run dev:tunnel   # with feature flags
npm run dev:tunnel -- -c                     # clear Metro cache
DEVICE_UDID=<udid> npm run dev:tunnel:native # full native rebuild
```

### Named tunnel (stable hostname)

```bash
CLOUDFLARED_TUNNEL_NAME=<name> npm run dev:tunnel
```

One-time DNS setup:
```bash
cloudflared tunnel create <name>
# Use the UUID returned, not the name, to avoid routing to the wrong tunnel:
cloudflared tunnel route dns <TUNNEL-ID> <your-hostname>
```

Place filled-in `config.yml` at `~/.cloudflared/config.yml`.

---

## Windows (PowerShell)

### The critical gotcha: SYSTEM profile config path

The cloudflared Windows service runs as **SYSTEM**. It reads its config from
the SYSTEM profile — **not** your user profile:

```
C:\Windows\system32\config\systemprofile\.cloudflared\config.yml
```

Editing `~\.cloudflared\config.yml` has **no effect** on the service.
Always edit the SYSTEM profile path above.

### Option A — add Metro to existing service (recommended)

Check if cloudflared is already running as a service:
```powershell
sc.exe query cloudflared
```

If it is, add Metro as an ingress route to the SYSTEM profile config:
```yaml
ingress:
  # ... existing routes ...
  - hostname: <your-metro-hostname>
    service: http://localhost:8081
  - service: http_status:404   # must stay last
```

Restart from **Administrator** PowerShell:
```powershell
Restart-Service cloudflared
```

Verify the tunnel reaches Metro:
```powershell
(Invoke-WebRequest -Uri "https://<your-metro-hostname>/status" -UseBasicParsing).Content
# Should return: packager-status:running
```

Start Metro:
```powershell
$env:EXPO_PACKAGER_PROXY_URL="https://<your-metro-hostname>"; npx expo start --lan
```

### Option B — install a dedicated service

From **Administrator** PowerShell:
```powershell
cloudflared --config "C:\path\to\repo\.cloudflared\config.example.yml" service install
```

### Option C — run manually (two terminals)

Terminal 1:
```powershell
cloudflared tunnel --config "$env:USERPROFILE\.cloudflared\config.yml" run
```

Terminal 2:
```powershell
$env:EXPO_PACKAGER_PROXY_URL="https://<your-metro-hostname>"; npx expo start --lan
```

### With feature flags (PowerShell)

All env var values must be quoted. Semicolons separate assignments:
```powershell
$env:EXPO_PUBLIC_FEATURE_QUESTIONS="true"; $env:EXPO_PACKAGER_PROXY_URL="https://<hostname>"; npx expo start --lan
```

Note: `$env:VAR=true` (unquoted) fails — PowerShell tries to execute `true` as a command.

### Kill Metro on Windows

`npm run kill:metro` uses a bash script and won't work on Windows:
```powershell
$pid = (netstat -ano | Select-String ":8081.*LISTENING" | ForEach-Object { ($_ -split '\s+')[-1] } | Select-Object -First 1)
if ($pid) { taskkill /PID $pid /F }
```

---

## Connecting from the dev-client app

Once Metro is running with `EXPO_PACKAGER_PROXY_URL` set, connect from the
Threadbase dev-client app using the deep link:

```
exp+threadbase://expo-development-client/?url=https%3A%2F%2F<your-hostname>
```

Or tap **Enter URL manually** and enter:
```
https://<your-hostname>
```

> **Note:** The scheme is `exp+threadbase` (from `scheme` in `app.json`), not
> `exp+threadbase-mobile` (the slug). Expo CLI may print the slug-based URL —
> if the app doesn't open, use the scheme-based URL above.

**Initial bundle timing:** the "Could not connect" error can appear if the
phone connects before Metro finishes its first bundle. Wait for Metro to print
`Bundled`, then tap **Reload JS**.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Tunnel returns 404 | Check you edited the SYSTEM profile config (not `~\.cloudflared\`), then `Restart-Service cloudflared` |
| `packager-status:running` locally but tunnel 404s | Service didn't restart after config change — run `Restart-Service cloudflared` as Administrator |
| `cloudflared` exits immediately (macOS/Linux) | Port 8081 not open yet; `npm run dev:tunnel` handles this automatically |
| "Failed to get tunnel URL after 30s" | Port 8081 in use — kill Metro first |
| Named tunnel routes to wrong tunnel | `route dns <name>` can silently pick up an existing CNAME; always use the UUID: `cloudflared tunnel route dns <TUNNEL-ID> <hostname>` |
| Service install fails silently | Requires Administrator — re-run from Admin terminal |
| `$env:VAR=true` gives error on PowerShell | Always quote values: `$env:VAR="true"` |
