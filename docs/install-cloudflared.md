# Installing cloudflared

Platform-specific instructions for installing the `cloudflared` CLI.

---

## macOS

```bash
brew install cloudflare/cloudflare/cloudflared
```

---

## Linux

```bash
# Debian / Ubuntu
curl -L https://pkg.cloudflare.com/cloudflare-main.gpg | sudo gpg --dearmor -o /usr/share/keyrings/cloudflare-main.gpg
echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main" | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt update && sudo apt install cloudflared

# Or download the binary directly:
# https://github.com/cloudflare/cloudflared/releases/latest → cloudflared-linux-amd64
```

---

## Windows

```powershell
winget install Cloudflare.cloudflared
```

Or download the MSI installer from
<https://github.com/cloudflare/cloudflared/releases/latest> →
`cloudflared-windows-amd64.msi`.

After install, open a new terminal so `cloudflared` is on your `PATH`, then
verify:

```powershell
cloudflared --version
```

> **Note:** The tunnel scripts in this repo (`scripts/start-cloudflared.sh`,
> `scripts/dev-device.sh`, etc.) are bash scripts and run on macOS only. On
> Windows, use the PowerShell commands shown in the
> [Windows section of remote-dev-tunnel.md](remote-dev-tunnel.md#running-on-windows-powershell).

---

## Verify installation (all platforms)

```bash
cloudflared --version
```
