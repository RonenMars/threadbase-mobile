# Agent tooling

Everything on this page is optional. None of it is needed to build, test, or contribute to Threadbase Mobile — it is the AI-assistant tooling this repo expects, declared in config so your agent can pick it up instead of you wiring it by hand.

## Claude Code

`.claude/settings.json` enables these plugins for anyone working in this repo:

| Plugin | Marketplace | What it adds |
|---|---|---|
| `expo` | `claude-plugins-official` | Expo and React Native build, deploy, and upgrade skills |
| `frontend-design` | `claude-plugins-official` | UI implementation guidance |
| `ui-design` | `claude-code-workflows` | Design-system, accessibility, and mobile UI skills |

Plugins from `claude-plugins-official` need no setup: Claude Code registers that marketplace itself on first interactive start, so they resolve on any machine.

`claude-code-workflows` is a third-party marketplace. Claude Code registers it from this repo's settings once you trust the folder, then reports the plugin as not installed and prints the command to run:

```bash
claude plugin install ui-design@claude-code-workflows
```

External-source plugins are never installed silently — plugins execute code with your privileges, so the install stays a deliberate step.

Project skills committed under `.claude/skills/` load with no install at all.

## Codex

`.codex/config.toml` declares MCP servers for this repo. Codex merges them once the project is trusted:

| Server | Purpose |
|---|---|
| `github` | GitHub API access, via the official GitHub MCP server in Docker |
| `playwright` | Browser automation |

Codex ignores `[marketplaces.*]` and `[plugins.*]` in a project-level `.codex/config.toml` — verified on `codex-cli 0.149.0` by declaring a marketplace in a trusted project's config and confirming `codex plugin marketplace list` never picked it up, while an `[mcp_servers.*]` entry in the same file was honored. Codex plugins are therefore a one-time global install. Each `marketplace add` is a no-op if you already have that marketplace:

```bash
codex plugin marketplace add anthropics/claude-plugins-official
codex plugin marketplace add wshobson/agents
codex plugin add expo@claude-plugins-official
codex plugin add frontend-design@claude-plugins-official
codex plugin add ui-design@claude-code-workflows
```

## Other agents

Cursor, Copilot, and the rest read none of the files above — the formats are Claude Code's and Codex's own. This page is the whole handoff: the plugin table says what capability the repo expects, and any equivalent in your own tooling is fine.

## What gets registered, and by whom

Trusting this folder lets a marketplace this repo names be registered in your Claude Code install. Marketplaces run code, so here is exactly what is named and who owns it:

| Marketplace | Source | Owner |
|---|---|---|
| `claude-code-workflows` | [wshobson/agents](https://github.com/wshobson/agents) | wshobson |

Nothing from it is installed until you run the install command above. To skip the whole thing, disable the plugins in your own `.claude/settings.local.json`, which is gitignored — the repo works exactly the same without them.

