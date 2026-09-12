---
name: add-provider
description: Add a new agent CLI start provider in threadbase-mobile (browse chips, health parser, badges, filters, i18n). Use when adding Cursor, Codex, Gemini, Amp, cursor-cli, start chips, provider badges, or when the user says add a provider. Live PTY and history indexing are other repos — see Companions.
---

# Add a provider (mobile)

This repo is the **phone chips** half. Without it, a streamer that accepts the new `provider` is unused: browse only sends Claude (default) or Codex.

Scanner, streamer, and mobile each declare `ProviderName`. They are not linked.

Canonical wire name: kebab, matching `claude-code` / `codex-cli` (e.g. `cursor-cli`). Product label is separate (`Cursor`).

## Companions

| Half | Repo | Skill |
|---|---|---|
| Live PTY | [`threadbase-streamer`](https://github.com/RonenMars/threadbase-streamer) | [`.claude/skills/add-provider/SKILL.md`](https://github.com/RonenMars/threadbase-streamer/blob/HEAD/.claude/skills/add-provider/SKILL.md) |
| Phone chips | `threadbase-mobile` (this repo) | `.claude/skills/add-provider/` |
| History index | [`threadbase-scanner`](https://github.com/RonenMars/threadbase-scanner) | [`.claude/skills/add-provider/SKILL.md`](https://github.com/RonenMars/threadbase-scanner/blob/HEAD/.claude/skills/add-provider/SKILL.md) |

Mobile-only against an old streamer fail-opens the chip and then 501s on start. **Merge the streamer PR first.**

Work on a **sibling worktree** from `origin/main` (`git worktree add ../tb-mobile-worktrees/<slug> -b feat/<slug> origin/main`). Never nest under the repo root — Jest/ESLint/Metro will walk the copy. After `worktree add`, `move_agent_to_root`. A fresh worktree has no `node_modules`: symlink from the main checkout when lockfiles match, else `npm ci`.

## Iron rules

1. **Never default unknown names to Claude.** Badges, chips, filters, health titles, and `ConversationBusyError.provider` must use `providerLabelKey`, not `=== 'codex-cli' ? Codex : Claude`.
2. **Parser allowlists drop unknown names.** `types/provider-health.ts` `NAMES` must include the new id or `/api/providers` is silently ignored.
3. **Send `provider` for any non-Claude.** Browse used to special-case only Codex.
4. **Do not invent terminal chrome filters** until the TUI is captured. Unknown providers already passthrough.
5. Keep semantic state; resolve `t('sessions:provider.<label>')` at the presentation boundary. No `labelKey` in data.

## 1. Name + label helper

`constants/providers.ts`: constant, `PROVIDER_NAMES`, `isProviderName`, `providerLabelKey` → `'claude' | 'codex' | '<product>'`.

Use `providerLabelKey` everywhere a badge or chip used to be the Codex/Claude ternary.

## 2. Health parser

`types/provider-health.ts` `NAMES` must include the new id. Unknown names are **dropped**, not shown as unavailable.

## 3. Start path

- `app/browse.tsx`: skeleton `PROVIDER_NAMES`; nth chip; `params.set('provider', …)` for **any non-Claude**.
- `app/session/new.tsx`: include `provider` on POST when `isProviderName` and not Claude.

Three `flex: 1` chips is acceptable; do not skip the chip to save space.

## 4. Chrome that still assumed two providers

Grep `'claude-code' | 'codex-cli'` and `=== 'codex-cli'` and replace with `ProviderName` / `providerLabelKey`:

- `app/index.tsx` filter state + conversation badges + `brand.<key>` styles
- `app/session/[id].tsx` provider chip
- `app/conversation/[id].tsx` provider dot color
- `components/servers/FilterSortSheet.tsx`
- `components/sessions/shared/ConversationListItem.tsx` (+ badge styles)
- `components/sessions/tree/types.ts`, `hooks/useConversations.ts`, `types/projectChat.ts`
- `services/api-client.ts` `ConversationBusyError` — `isProviderName(payload.provider)`
- `app/server-health.tsx` `provider:<wire-name>` title
- `lib/modelEffortSupport.ts` — effort is Claude-only; treat the new CLI like Codex (`false`) unless the streamer actually emits `effort`

`constants/theme.ts` `brand.<key>`: a color distinct from Claude `#E8622A` and Codex `#7B5EA7`.

Story coverage **warns** on modified `components/**/*.tsx`; it does not block. Skip new stories for a small badge/filter edit.

## 5. i18n

- `locales/{en,he,ar,ru}/sessions.json` → `provider.<label>`
- `locales/{en,he,ar,ru}/servers.json` → `health.checks.provider<Product>`
- `locales/.identical-ok.json` for product names that stay English
- `npm run i18n:bless`

## 6. Mock + tests

`e2e/mock-server.js` `GET /api/providers`: add an honest capabilities payload (copy streamer declarations).

Tests to extend:

- `__tests__/e2e/browse-provider-flow.test.tsx` — query param + skeleton id
- `__tests__/integration/components/BrowseRecents.test.tsx`
- `__tests__/integration/components/BrowseDisabledOnError.test.tsx`
- `__tests__/unit/types/provider-health.test.ts`
- `__tests__/unit/lib/modelEffortSupport.test.ts`

Empty-list copy ("Claude Code or Codex") can stay unless the user wants it updated.

## 7. Verify

```bash
npx tsc --noEmit
npx jest --ci --runInBand --testPathPattern 'browse-provider-flow|BrowseRecents|BrowseDisabledOnError|provider-health|modelEffortSupport|constants/providers'
```

## Out of scope here

Live PTY — [streamer skill](https://github.com/RonenMars/threadbase-streamer/blob/HEAD/.claude/skills/add-provider/SKILL.md). History list — [scanner skill](https://github.com/RonenMars/threadbase-scanner/blob/HEAD/.claude/skills/add-provider/SKILL.md). Installing the vendor CLI on the host.

Worked example: `cursor-cli` in PR #1055.
