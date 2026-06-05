# Google Play MCP — per-developer setup

The `google-play-mcp` server in `.mcp.json` does NOT carry credentials. Each developer wires up their own Play Console service-account on their machine.

## One-time setup

1. Create a Play Console service account (or get one from the team) with the **minimum** roles needed — read-only release manager is sufficient for status checks; full release manager only if you ship from this machine.
2. Download the JSON key and store it **outside** the repo, e.g.:
   ```
   ~/.config/gcloud/play-console-sa.json
   chmod 600 ~/.config/gcloud/play-console-sa.json
   ```
3. Export the absolute path in your shell profile (`~/.zshrc` or `~/.bash_profile`):
   ```sh
   export GOOGLE_APPLICATION_CREDENTIALS="$HOME/.config/gcloud/play-console-sa.json"
   ```
   Use the absolute `$HOME` form — Google's auth libraries do NOT expand `~` from `env` strings.
4. Reload your shell, then restart Claude Code so the MCP child inherits the variable.

## Why not commit the env into `.mcp.json`?

- A repo-committed path means anyone with write access to the repo can silently redirect the MCP loader to read an arbitrary file on a teammate's machine.
- Different machines have different home layouts; `~` is not expanded by Google's auth client libraries when the value comes in via `env`.
- Service accounts should be per-developer / per-environment, not implicitly shared via the manifest.

## Rotation

If the key file is ever exposed (paste, screenshot, accidental commit), rotate via Play Console → Setup → API access → revoke the old key and download a new one. Update the local file; no repo change needed.

## Pinning the MCP server

`.mcp.json` runs `uvx google-play-mcp` unpinned. To pin to a known-good version, replace the args with:
```json
"args": ["--from", "google-play-mcp==<X.Y.Z>", "google-play-mcp"]
```
This is a per-team decision; pin once the upstream package settles on a stable release.
