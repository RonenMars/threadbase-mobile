# Agent tooling

Everything on this page is optional. None of it is needed to build, test, or contribute to Threadbase Mobile — it is the AI-assistant tooling this repo expects, declared in config so your agent can pick it up instead of you wiring it by hand.

## Claude Code

This repository enables no Claude plugins or third-party marketplaces by default. Project-specific skills under `.claude/skills/` load without installation (local iOS shipping, opt-in EAS shipping, the fastlane fallback, Cloudflare tunnel setup, and this repo's halves of the add-provider and integration-by-batches workflows). Expo framework guidance and UI design guidance belong in repository documentation or user-level tooling instead of the project skill catalog.

### Shared skills plugin (optional)

The cross-repo workflows are published once, by the `threadbase-skills` plugin in the [`RonenMars/threadbase`](https://github.com/RonenMars/threadbase) umbrella repo:

```
/plugin marketplace add RonenMars/threadbase
/plugin install threadbase-skills@threadbase
```

That gives `threadbase-skills:add-provider` and `threadbase-skills:integration-by-batches`. The repo-specific `add-provider-mobile` and `integration-by-batches-mobile` skills are named differently on purpose, so they never shadow the shared ones, and each tells the agent to read its shared counterpart first. If you change the add-provider steps, update the matching skills in `threadbase-streamer` and `threadbase-scanner` in the same change set.

Codex cannot install the plugin, so `.agents/skills/add-provider` and `.agents/skills/integration-by-batches` are a verbatim mirror of it, written by the umbrella's `scripts/sync-agents-skills.sh`. The `Skills mirror` workflow fails a PR if the mirror differs from the umbrella commit pinned in `.github/workflows/skills-mirror.yml`. Never hand-edit those two directories.

## Codex

`.codex/config.toml` declares MCP servers for this repo. Codex merges them once the project is trusted:

| Server | Purpose |
|---|---|
| `github` | GitHub API access, via the official GitHub MCP server in Docker |
| `playwright` | Browser automation |

Codex discovers the same four operational workflows from `.agents/skills/`. This repository does not require an Expo plugin or Expo MCP; native build, simulator, and release procedures use the checked-in scripts and documentation. Keep general-purpose plugins and skills at user scope so this repository does not enlarge every session's initial skill catalog.

## Other agents

Cursor, Copilot, and the rest read none of the files above — the formats are Claude Code's and Codex's own. This page is the whole handoff; equivalent optional tooling in another runtime is fine.

No marketplace or plugin is registered by this repository.
