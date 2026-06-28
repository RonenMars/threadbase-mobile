# Remote Dev with Metro Tunnels

When your device isn't on the same Wi-Fi as the machine running Metro, the app
can't reach the bundler over LAN. The fix: front Metro with an HTTPS tunnel and
tell Expo to use it via `EXPO_PACKAGER_PROXY_URL`.

---

## How it works

Expo reads `EXPO_PACKAGER_PROXY_URL` at startup and advertises that URL to the
app instead of the local LAN IP. The app fetches its JS bundle through the
tunnel, so device and dev machine no longer need to share a network.

**Key constraint:** The tunnel and Metro must run on the **same machine** —
the tunnel proxies `localhost:8081`, so Metro must be local to it.

**Ordering constraint:** `cloudflared` exits immediately if nothing is listening
on port 8081 yet. Metro, in turn, needs `EXPO_PACKAGER_PROXY_URL` at startup —
which requires knowing the tunnel URL first. The solutions differ by platform:

- **macOS/Linux:** `npm run dev:tunnel` uses `scripts/start-cloudflared.sh`,
  which spins up a temporary HTTP listener to get the URL, then hands off to Metro.
- **Windows:** Start the named tunnel first (it stays up regardless of Metro),
  then start Metro in a second terminal with the stable URL.

---

## How the Windows tunnel is set up

On Windows, Metro runs as an ingress route inside the **system cloudflared
service** (`~/.cloudflared/config.yml`) alongside other routes on the same
tunnel. There is no separate `threadbase-dev` tunnel — the Metro hostname is
just one more entry in the existing service config.

`.cloudflared/config.yml` in this repo is a reference template showing the
ingress block to add. The active config lives at `~/.cloudflared/config.yml`
and is not committed.

---

## Running on Windows (PowerShell)

### Option A — add Metro to the existing system service (recommended)

If cloudflared is already running as a Windows service (check with
`sc.exe query cloudflared`), add Metro as an ingress route to the system config
instead of installing a second service.

Edit `~/.cloudflared/config.yml` — add the Metro entry before the catch-all:

```yaml
ingress:
  # ... existing routes ...
  - hostname: <your-metro-hostname>
    service: http://localhost:8081
  - service: http_status:404   # must stay last
```

Then update the DNS CNAME for `<your-metro-hostname>` to point to the tunnel ID
already in that config file (`<TUNNEL-ID>.cfargotunnel.com`), and restart the
service from an **Administrator** PowerShell:

```powershell
Restart-Service cloudflared
```

The tunnel is now always-on — just start Metro:

```powershell
$env:EXPO_PACKAGER_PROXY_URL="https://<your-metro-hostname>"; npx expo start --lan
```

### Option B — install a dedicated service

If no cloudflared service exists yet, install one from an **Administrator**
PowerShell (right-click Start → Terminal (Admin)):

```powershell
cloudflared --config "C:\path\to\repo\.cloudflared\config.yml" service install
```

> See `.cloudflared/config.yml` in this repo for the ingress template and
> `.cloudflared/config.yml` setup steps in the one-time setup section below.

The service starts automatically on boot. Just start Metro:

```powershell
$env:EXPO_PACKAGER_PROXY_URL="https://<your-metro-hostname>"; npx expo start --lan
```

To manage the service (either option):

```powershell
Start-Service cloudflared    # start manually
Stop-Service cloudflared     # stop
Restart-Service cloudflared  # restart after config changes
sc.exe query cloudflared     # check status
```

### Option C — run the tunnel manually

Two terminals required — the tunnel must stay running while Metro is up.

**Terminal 1 — start the tunnel:**

```powershell
cloudflared tunnel --config "$env:USERPROFILE\.cloudflared\config.yml" run
```

**Terminal 2 — start Metro:**

```powershell
$env:EXPO_PACKAGER_PROXY_URL="https://<your-metro-hostname>"; npx expo start --lan
```

With feature flags:

```powershell
$env:EXPO_PUBLIC_FEATURE_QUESTIONS="true"; $env:EXPO_PACKAGER_PROXY_URL="https://<your-tunnel-hostname>"; npx expo start --lan
```

After **flipping a feature flag**, add `-c` to clear Metro's transform cache:

```powershell
$env:EXPO_PUBLIC_FEATURE_QUESTIONS="true"; $env:EXPO_PACKAGER_PROXY_URL="https://<your-tunnel-hostname>"; npx expo start --lan -c
```

---

## Running on macOS/Linux

### Quick tunnel (no account needed, temporary URL)

One-time install — see [install-cloudflared.md](install-cloudflared.md).

```bash
# JS-only (dev client already on device):
npm run dev:tunnel

# Full native rebuild + install over USB:
DEVICE_UDID=<your-device-udid> npm run dev:tunnel:native

# With feature flags:
EXPO_PUBLIC_FEATURE_QUESTIONS=true npm run dev:tunnel

# Feature flag + clear cache:
EXPO_PUBLIC_FEATURE_QUESTIONS=true npm run dev:tunnel -- -c
```

`npm run dev:tunnel` automatically:
1. Starts a temporary HTTP listener on port 8081.
2. Launches `cloudflared` and waits for the `*.trycloudflare.com` URL.
3. Kills the placeholder listener.
4. Starts Metro with `EXPO_PACKAGER_PROXY_URL` set.

### Named tunnel (stable URL)

```bash
CLOUDFLARED_TUNNEL_NAME=<your-tunnel-name> npm run dev:tunnel

# With native rebuild:
CLOUDFLARED_TUNNEL_NAME=<your-tunnel-name> DEVICE_UDID=<udid> npm run dev:tunnel:native
```

---

## Connecting from the dev-client app

Once Metro is running with the tunnel URL, open the **Threadbase** dev-client
app on your iOS or Android device and tap **Enter URL manually**. Enter:

```
exp://<your-tunnel-hostname>
```

The app will fetch the bundle through the tunnel. No shared Wi-Fi needed.

---

## Named tunnel — one-time setup

The tunnel for this project is already configured. These steps are only needed
when setting up on a new machine or creating a new tunnel.

### Install and authenticate

See [install-cloudflared.md](install-cloudflared.md) for platform-specific
install instructions.

```bash
# Skip if ~/.cloudflared/cert.pem already exists (already authenticated).
cloudflared tunnel login
```

### Create the tunnel and route DNS

```bash
# 1. Create the tunnel — prints a tunnel ID (UUID).
cloudflared tunnel create <your-tunnel-name>

# 2. Route DNS — always use the UUID, not the name, to avoid routing to
#    a wrong existing tunnel when multiple tunnels share an account.
cloudflared tunnel route dns <TUNNEL-ID> <your-tunnel-hostname>
```

> **Gotcha:** `cloudflared tunnel route dns <name> <hostname>` can silently
> route to an existing tunnel with a conflicting DNS record instead of the one
> you just created. Always verify with:
> ```bash
> cloudflared tunnel info <TUNNEL-ID>
> ```
> and confirm the CNAME in your Cloudflare DNS dashboard points to
> `<TUNNEL-ID>.cfargotunnel.com`.

### Configure the project

Edit `.cloudflared/config.yml`:

```yaml
tunnel: <TUNNEL-ID>
credentials-file: /Users/<your-username>/.cloudflared/<TUNNEL-ID>.json  # macOS/Linux
# credentials-file: C:\Users\<your-username>\.cloudflared\<TUNNEL-ID>.json  # Windows

ingress:
  - hostname: <your-tunnel-hostname>
    service: http://localhost:8081
  - service: http_status:404
```

The credentials file is gitignored — never commit it.

---

## Killing Metro

**macOS/Linux:**
```bash
npm run kill:metro
```

**Windows** (`npm run kill:metro` uses a bash script and won't work):
```powershell
# Find and kill the process on port 8081:
$pid = (netstat -ano | Select-String ":8081.*LISTENING" | ForEach-Object { ($_ -split '\s+')[-1] } | Select-Object -First 1)
if ($pid) { taskkill /PID $pid /F }
```

---

## Feature flags

`EXPO_PUBLIC_*` vars are inlined at bundle time. A bare `FEATURE_QUESTIONS=true`
(no `EXPO_PUBLIC_` prefix) is **not** read by the app — the flag stays off.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `cloudflared not found` | See [install-cloudflared.md](install-cloudflared.md) |
| `cloudflared` exits immediately (macOS) | Port 8081 not open yet; `npm run dev:tunnel` handles this automatically via a placeholder listener |
| "Failed to get tunnel URL after 30s" | Port 8081 may already be in use; run `npm run kill:metro` first |
| App shows "Could not connect to development server" | Confirm the cloudflared process is still running in its terminal |
| Bundle loads but feature flag not taking effect | Add `-c` to clear Metro's cache (see commands above) |
| Named tunnel routes to wrong tunnel | `route dns <name>` can pick up an existing record; re-route using the UUID: `cloudflared tunnel route dns <TUNNEL-ID> <hostname>` |
| Named tunnel: connection refused | Credentials file missing — re-run `cloudflared tunnel login` and `cloudflared tunnel create` |
| `npm run kill:metro` fails on Windows | Use the PowerShell `netstat`/`taskkill` one-liner above |
| `cloudflared service install` fails silently | Requires Administrator — open Terminal (Admin) and re-run |
| Service installed but tunnel not routing | Run `Restart-Service cloudflared` after editing `~/.cloudflared/config.yml` |
