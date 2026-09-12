---
name: add-provider
description: Add a new agent CLI start provider in threadbase-mobile (browse chips, health parser, badges, filters, i18n). Use when adding Cursor, Codex, Gemini, Amp, Aider, OpenCode, Goose, ClawCode, Hermes, cursor-cli, start chips, provider badges, or when the user says add a provider. Live PTY and history indexing are other repos — see Companions.
---

# Add a provider (mobile)

This repo is the **phone chips** half. Without it, a streamer that accepts the new `provider` is unused: browse will not send that name.

Scanner, streamer, and mobile each declare `ProviderName`. They are not linked. Use the **same kebab wire name** as the streamer (`aider`, `opencode`, `goose`, `cursor-cli`, …). Product label is separate (`Aider`, `OpenCode`).

## Companions

| Half | Repo | Skill |
|---|---|---|
| Live PTY | [`threadbase-streamer`](https://github.com/RonenMars/threadbase-streamer) | [`.claude/skills/add-provider/SKILL.md`](https://github.com/RonenMars/threadbase-streamer/blob/HEAD/.claude/skills/add-provider/SKILL.md) |
| Phone chips | `threadbase-mobile` (this repo) | `.claude/skills/add-provider/` |
| History index | [`threadbase-scanner`](https://github.com/RonenMars/threadbase-scanner) | [`.claude/skills/add-provider/SKILL.md`](https://github.com/RonenMars/threadbase-scanner/blob/HEAD/.claude/skills/add-provider/SKILL.md) |

Mobile-only against an old streamer fail-opens the chip and then 501s on start. **Merge the streamer PR first** unless this is a badge-only name that history already returns.

Work on a **sibling worktree** from `origin/main` (`git worktree add ../tb-mobile-worktrees/<slug> -b feat/<slug> origin/main`). Never nest under the repo root. After `worktree add`, `move_agent_to_root`. No `node_modules` in a fresh worktree: symlink from the main checkout when lockfiles match, else `npm ci`.

## 0. Vendor intake

| Ask | This repo |
|---|---|
| Streamer already has the wire name in `PROVIDER_NAMES`? | If live start is in scope, wait or land streamer first. |
| History-only (no CLI, SQLite store, editor chat)? | Still add the name to badges/filters/health if the scanner will emit it. **No** browse start chip until a runner exists. |
| Fourth+ start chip? | Keep the chip. Wrap the selector (`flexWrap`) rather than hiding providers. Do not collapse into a menu unless the user asked. |

Grep the **current** two-way unions, not only `codex-cli`. After Cursor, leftovers look like `'claude-code' \| 'codex-cli' \| 'cursor-cli'` and `=== 'cursor-cli' ? … : Claude`.

## Iron rules

1. **Never default unknown names to Claude.** Use `providerLabelKey` (extend its return union). Not `=== 'codex-cli' ? Codex : Claude`.
2. **Parser allowlists drop unknown names.** `types/provider-health.ts` `NAMES` must include the id or `/api/providers` is ignored.
3. **Send `provider` for any non-Claude** start. Do not special-case one extra name.
4. **Do not invent terminal chrome filters** until the TUI is captured.
5. Semantic state; `t('sessions:provider.<label>')` at the presentation boundary. No `labelKey` in data.

## 1. Name + label helper

`constants/providers.ts`: constant, `PROVIDER_NAMES`, `isProviderName`, `providerLabelKey`.

## 2. Health parser

`types/provider-health.ts` `NAMES`. Unknown names are **dropped**, not shown as unavailable.

## 3. Start path

Only if live start is in scope:

- `app/browse.tsx`: skeleton `PROVIDER_NAMES`; nth chip; `params.set('provider', …)` for **any non-Claude**.
- `app/session/new.tsx`: POST `provider` when `isProviderName` and not Claude.

A start chip for a history-only agent is a lie — omit it.

## 4. Chrome

Replace remaining hardcoded provider unions with `ProviderName` / `providerLabelKey`:

- `app/index.tsx`, `app/session/[id].tsx`, `app/conversation/[id].tsx`
- `components/servers/FilterSortSheet.tsx` (filter chips wrap; do not cap at three)
- `components/sessions/shared/ConversationListItem.tsx`
- `components/sessions/tree/types.ts`, `hooks/useConversations.ts`, `types/projectChat.ts`
- `services/api-client.ts` `ConversationBusyError` — `isProviderName`
- `app/server-health.tsx` `provider:<wire-name>`
- `lib/modelEffortSupport.ts` — effort is Claude-only unless the streamer emits `effort` for this CLI

`constants/theme.ts` `brand.<key>`: distinct from Claude `#E8622A`, Codex `#7B5EA7`, Cursor `#3D8BFF`.

Story coverage **warns** on modified `components/**/*.tsx`; skip new stories for a small badge/filter edit.

## 5. i18n

- `locales/{en,he,ar,ru}/sessions.json` → `provider.<label>`
- `locales/{en,he,ar,ru}/servers.json` → `health.checks.provider<Product>`
- `locales/.identical-ok.json` for product names that stay English
- `npm run i18n:bless`

## 6. Mock + tests

`e2e/mock-server.js` `GET /api/providers`: honest capabilities (copy streamer). History-only names can be absent from that stub.

Extend `browse-provider-flow`, `BrowseRecents`, `BrowseDisabledOnError`, `provider-health`, `modelEffortSupport`, `constants/providers`.

Empty-list copy can stay unless the user wants the new product named.

## 7. Verify

```bash
npx tsc --noEmit
npx jest --ci --runInBand --testPathPattern 'browse-provider-flow|BrowseRecents|BrowseDisabledOnError|provider-health|modelEffortSupport|constants/providers'
```

## Out of scope here

Live PTY — [streamer skill](https://github.com/RonenMars/threadbase-streamer/blob/HEAD/.claude/skills/add-provider/SKILL.md). History — [scanner skill](https://github.com/RonenMars/threadbase-scanner/blob/HEAD/.claude/skills/add-provider/SKILL.md). Installing the host CLI.

Worked example: `cursor-cli` in PR #1055.
