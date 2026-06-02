# Threadbase demo server

The container behind [`https://threadbase-demo.fly.dev`](https://threadbase-demo.fly.dev) — what Apple App Review and curious visitors pair against. Used to be a hand-rolled mock; as of 2026-06-01 it runs the **real** `@threadbase/streamer` release against a curated seed corpus, so the iOS app sees identical contracts to a user-hosted streamer on macOS.

## Architecture

```
Fly machine (1gb, shared-cpu-1x, /data volume)
├── /opt/tb-streamer/                     real streamer release (Linux x64 tarball pinned in Dockerfile)
├── /opt/claude-code-stub/claude.js            scripted PTY shim — no Anthropic API calls
├── /usr/local/bin/claude → claude-code-stub/  the binary tb-streamer spawns per session
├── /seed/                                JSONL conversation corpus baked into the image
└── /data/                                Fly volume, persists across deploys
    ├── .claude/projects/                 seeded from /seed at boot
    └── .threadbase/server.yaml           apiKey, publicUrl, browseRoot
```

### Why a real streamer?

The previous hand-rolled mock stubbed enough endpoints to pair, but it diverged from the real `SessionResponse` shape, never broadcast `session_list` / `session_update` / `terminal_output` over WS, and didn't emit the `❯` ready marker. The app's wake-up overlay never cleared. Running the real streamer eliminates those gaps — every endpoint, every WS message, every status transition matches a user's local install.

### Why a fake `claude` binary?

`tb-streamer`'s `PTYManager` spawns `claude` per session. Running the real Claude CLI would require an Anthropic API key on a public-internet machine — rejected (token spend, credential exposure, no rate limit per reviewer). The shim at `claude-code-stub/claude.js` prints the welcome banner + `❯` prompt + scripted replies on stdin. Reviewers see a live-looking terminal; typed input gets canned answers. No model is hit.

## Seed corpus

Three multi-turn conversations across three project directories under `seed/`:

| Project | What's in it |
|---|---|
| `-home-demo-projects-threadbase-mobile` | Adding pull-to-refresh on a FlatList |
| `-home-demo-projects-personal-website` | Hero redesign with animated conic gradient |
| `-home-demo-projects-experiments` | Debugging a slow pandas groupby |

Zero real history. All file paths, project names, and code samples are fabricated. The directory names follow Claude Code's `<absolute-path-with-slashes-as-dashes>` convention.

## Deploy

```bash
cd demo-server
fly deploy
```

First time only (one-shot per app):

```bash
fly volumes create demo_data --region iad --size 1
fly deploy
```

The Dockerfile downloads `threadbase-streamer-${TB_STREAMER_VERSION}-linux-x64.tgz` from the GitHub release. Bump `ARG TB_STREAMER_VERSION` in the Dockerfile to upgrade.

## Pair the iOS app against it

In tb-mobile onboarding:

1. Tap **Enter URL manually**
2. URL: `https://threadbase-demo.fly.dev`
3. API key: anything non-empty (e.g. `demo-12345678`). The streamer accepts any Bearer for parity with the prior mock — documented in App Review notes.
4. Tap **Open handshake**

## Reset the demo

The Fly volume persists state, so reviewer pokes (renames, new sessions, etc.) carry across deploys. To wipe everything back to seed:

```bash
fly volumes destroy demo_data
fly volumes create demo_data --region iad --size 1
fly deploy
```

## What reviewers can and can't do

| Capability | Works |
|---|---|
| Browse 3 seeded conversations | yes |
| Open a session and see terminal output | yes (scripted) |
| Resume a session from a conversation | yes |
| Rename a session (persists for the life of the volume) | yes |
| Send arbitrary input to a session | partial — gets scripted replies, not real Claude |
| Pair multiple servers | yes, but only this one is real |
| Run real Claude Code | no — fake binary |

## Troubleshooting

### Session screen shows `chdir(2) failed.: No such file or directory`

**When:** A reviewer (or Maestro flow) resumes a seeded conversation, the session screen loads, but the terminal pane shows only one line:

```
1  chdir(2) failed.: No such file or directory
```

Status reads `Idle  0s  0 prompts` instead of `● Active`.

**Cause:** Every JSONL in `seed/` carries a `cwd` field — the absolute path of the project the conversation was recorded in (e.g. `/home/demo/projects/threadbase-mobile`). When the streamer's `PTYManager` spawns `claude` for a resumed session, it passes that path as the child process's working directory. If the directory does not exist on the container, the spawn fails immediately, the PTY exits, and the streamer broadcasts the chdir error as the session's terminal output.

The directory must exist; it does not need to contain anything. `claude-code-stub` never reads from it.

**Fix:** Add the new project path to the `mkdir -p` block in `entrypoint.sh`. Every `cwd` value referenced in `seed/*/*.jsonl` needs a matching `mkdir -p` line:

```bash
mkdir -p \
    /home/demo/projects/threadbase-mobile \
    /home/demo/projects/experiments \
    /home/demo/projects/personal-website
    # ← add your new path here
```

Redeploy with `fly deploy --remote-only` and the next session resume will succeed. The directories are persisted on the Fly volume after first boot, so this only matters when a new seed conversation is introduced.

**How to find every cwd in the corpus:**

```sh
jq -r 'select(.cwd) | .cwd' seed/*/*.jsonl | sort -u
```
