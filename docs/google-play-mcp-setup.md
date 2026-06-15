# Google Play MCP — per-developer setup

The repo ships **`.mcp.example.json`** as a template. Your real **`.mcp.json`** is gitignored and contains the absolute path to your local copy of the Play Console service-account JSON. The credential is materialized on demand via `scripts/fetch-play-credentials.sh`.

## One-time setup

### Prerequisites

- `jq` installed (used by the fetch script to validate the JSON):
  ```sh
  brew install jq
  ```
- The team's Play Console service-account JSON available as base64 in `PLAY_SA_JSON_B64`.

### Steps

1. Export the service-account JSON in your shell profile (`~/.zshrc` or `~/.bash_profile`):
   ```sh
   export PLAY_SA_JSON_B64="<base64-service-account-json>"
   ```

   Encode the JSON with `base64 -i play-console-sa.json`.
2. Reload your shell and run the fetch script:
   ```sh
   ./scripts/fetch-play-credentials.sh
   ```
   It will print the absolute path it wrote, e.g. `/Users/you/.config/threadbase/play-console-sa.json` (mode 600).
3. Copy the template to your real config and paste that path in:
   ```sh
   cp .mcp.example.json .mcp.json
   # edit .mcp.json — replace <absolute-path-to-play-console-sa.json>
   # with the path the script printed
   ```
4. Restart Claude Code so the MCP child picks up the new config.

## Rotation

When the key rotates, update `PLAY_SA_JSON_B64` and re-run the fetch script — it overwrites the cached file in place. No edit to `.mcp.json` is needed because the path doesn't change.

```sh
./scripts/fetch-play-credentials.sh
```

If the key has been exposed (paste, screenshot, accidental commit), rotate via Play Console → Setup → API access → revoke the old key and generate a new one.

## Why this design

- **Credential never lives in git** — `.mcp.json` is gitignored; only `.mcp.example.json` is tracked.
- **No repo write means no credential-path hijack** — a malicious PR cannot redirect your MCP loader to read an arbitrary file, because the path is in your local `.mcp.json`, not the committed template.
- **`~` is not expanded** by Google's auth libraries when the path comes through MCP `env`. The fetch script always writes to an absolute path under `$HOME/.config/threadbase/` so the value pasted into `.mcp.json` Just Works.

## Pinning the MCP server

`.mcp.example.json` runs `uvx google-play-mcp` unpinned. To pin to a known-good version, replace the args with:

```json
"args": ["--from", "google-play-mcp==<X.Y.Z>", "google-play-mcp"]
```

This is a per-team decision; pin once the upstream package settles on a stable release.
