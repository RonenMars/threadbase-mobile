---
name: add-provider
description: Add a new agent CLI (Cursor, Codex, Gemini, Amp, Aider, OpenCode, Goose, Hermes, ...) as a provider across the Threadbase repos: the shared wire-name convention, vendor intake, iron rules and land order. Use when adding a provider, a new provider name, a start chip, or when the user says add a provider. The repo-specific steps live in each repo's own add-provider skill, see Companions.
---

# Add a provider (shared core)

A provider reaches users through three repos. Each declares its own `ProviderName`, and they are **not linked**: shipping one never updates the others.

| Half | Repo | What it adds |
|---|---|---|
| Live PTY | [`threadbase-streamer`](https://github.com/RonenMars/threadbase-streamer) | A `SessionRunner`, capabilities, binary resolution, health |
| Phone chips | [`threadbase-mobile`](https://github.com/RonenMars/threadbase-mobile) | Start chip, health parser entry, badges, filters, i18n |
| History index | [`threadbase-scanner`](https://github.com/RonenMars/threadbase-scanner) | Transcript discovery and parsing |

This skill holds the rules all three halves share. Each repo's own `.claude/skills/add-provider/` holds that repo's file-level steps and verify commands. Read both before changing anything.

## Wire name

- One **kebab-case** wire name across all three repos (`claude-code`, `codex-cli`, `cursor`, `aider`, `opencode`, `goose`).
- The product label (`Aider`, `OpenCode`) is separate from the wire name.
- The binary on PATH (argv[0]) may differ from both. The Cursor CLI is `agent`, not `cursor`.
- `cursor-cli` is a legacy alias: accept it, emit `cursor`.

## Vendor intake — stop or continue

Answer these **before** adding a name. Do not guess spawn flags.

| Ask | If no |
|---|---|
| Is there a spawnable **interactive CLI** (PTY, not an editor sidebar)? | **History-only.** No live runner and **no start chip** — a chip for an agent that cannot start is a lie. The name may still be added to badges, filters and health if the scanner will emit it. |
| Exact argv[0] on PATH? | Resolve it. Never assume it equals the product name. |
| Native resume from an id? | Declare resume unsupported. Do not reuse another provider's resume flag. |
| Documented transcript path? | Live still ships. Leave history to the scanner. |

## Iron rules

1. **Never default an unknown name to Claude.** A ternary such as `=== 'codex-cli' ? Codex : Claude` is the bug. Use the repo's label helper and the `PROVIDER_NAMES` list.
2. **The new id goes in `PROVIDER_NAMES` in every repo that has one.** Allowlists and parsers drop unknown names silently.
3. **Honest capabilities.** Claim only what the CLI's TUI has been parsed for. Unknown TUI: no structured questions, no permission gates, raw terminal. Inventing gates is worse than a raw terminal.
4. **Do not invent terminal chrome filters** until the TUI is captured.
5. **Do not watch or classify another provider's transcript files.** Each provider's layout is its own parser.
6. **Do not install the vendor CLI** unless the user explicitly asks. A missing CLI is reported as unavailable.
7. Replace leftover hardcoded two- or three-way provider unions with `ProviderName` and the label helper. Grep the **current** unions, not only `codex-cli`.

## Land order

1. **Streamer first** (live runner). A phone that sends a name the streamer does not know fails open on the chip and then errors on start. The exception is a badge-only name that history already returns.
2. **Mobile second** (chips).
3. **Scanner is its own slice.** History indexing and the scanner version bump are a **later** PR. Never mix the bump into the live-runner PR.

Work in a **sibling worktree** cut from `origin/main`. Never nest a worktree under the repo root.

## Companions

Changing this shared skill (wire-name convention, intake rules, iron rules, land order, out-of-scope) reaches every repo through the plugin. When a change also alters a repo's own steps, update that repo's `add-provider` skill in the same change set.

## Out of scope

Installing the vendor CLI. Scraping a TUI that has not been captured. Editor-only or protobuf-only agents with no CLI.
