# Agent tooling

Everything on this page is optional. None of it is needed to build, test, or contribute to Threadbase Mobile — it is the AI-assistant tooling this repo expects, declared in config so your agent can pick it up instead of you wiring it by hand.

## Claude Code

This repository enables no Claude plugins or third-party marketplaces. Four project-specific operational skills under `.claude/skills/` load without installation: local iOS shipping, opt-in EAS shipping, the fastlane fallback, and Cloudflare tunnel setup. Expo framework guidance and UI design guidance belong in repository documentation or user-level tooling instead of the project skill catalog.

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
