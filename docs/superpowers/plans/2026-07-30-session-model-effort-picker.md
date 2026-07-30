# Model & effort picker — model catalog + mobile UI

Status: planned, 2026-07-30
Streamer prerequisite: [tb-streamer#306](https://github.com/RonenMars/threadbase-streamer/pull/306) (merged/open — endpoints shipped)
Mobile worktree: `tb-mobile-worktrees/feat-session-model-effort` on `feat/session-model-effort-picker`, based on `26-07-2026.18-44-integration`

## Context

tb-streamer #306 shipped the write side of model/effort control:

- **Server default** — `model` and `effort` are now `claudeFlags` registry entries, so `PUT /api/config/claude-flags` sets them and mobile's existing `ServerClaudeFlagsSection` renders them generically from the returned `registry`.
- **Live session** — `PATCH /api/sessions/:id/model` and `PATCH /api/sessions/:id/effort` type Claude's `/model <x>` / `/effort <y>` slash command into the PTY. `202` on success; `409 SESSION_BUSY` mid-turn, `409 SESSION_IDLE` with no live PTY, `501 UNSUPPORTED_PROVIDER` for Codex, `400` on a value outside the accepted set.

What's missing is the **read** side: nothing tells a client *which models exist*. `effort` is a closed enum the streamer already publishes (`low|medium|high|xhigh|max`), but `model` ships as a free-text `string` flag, so mobile has no list to render chips from. Today `session.model` is only a scraped display string (`'Opus 4.8 (1M context)'`), which can't drive selection state either.

Hardcoding a model list in the app is the one thing `src/claude-flags.ts` explicitly warns against — only the server knows which CLI is installed locally, and a client-side copy drifts silently the moment it's upgraded. So the catalog belongs on the server, sourced from the web where possible.

**Outcome:** the streamer serves a per-provider model catalog (web → SQLite → hardcoded fallback, user-editable); mobile renders model and effort pickers from it and writes through the #306 endpoints.

---

## Phase A — streamer: model catalog

Lands in **tb-streamer**, on its own branch. Mobile Phase B depends only on the `GET` contract, so B can be written against a stub once A's shape is fixed.

### A1. The three tiers

Resolution order at read time, highest first:

| Tier | Source | Notes |
|---|---|---|
| 1 | `model_catalog` rows with `source = 'manual'` | User edits always win — never overwritten by a refresh |
| 2 | `model_catalog` rows with `source = 'web'` | Populated by the refresh job |
| 3 | `MODEL_CATALOG_FALLBACK` const in `src/model-catalog.ts` | Always present; the only tier that cannot fail |

Tier 3 is not a degraded mode — it is the correctness floor. A fresh install with no network and an empty table must still render a usable picker, so the endpoint never returns an empty list for a known provider.

### A2. Web sources — and the credential constraint

**The streamer has no Anthropic credential of its own.** It spawns the `claude` CLI, which authenticates with the user's own OAuth profile or subscription; `grep -rn "ANTHROPIC_API_KEY" src/` returns nothing. `pty-manager` maps `CLAUDE_API_KEY` → `ANTHROPIC_API_KEY` for the *spawned process* only, so that env var may or may not be set on the host.

That decides tier 1's shape: **the Anthropic fetch is opportunistic, never required.**

| Provider | Source | Auth |
|---|---|---|
| `claude` | `GET https://api.anthropic.com/v1/models` | `x-api-key: $CLAUDE_API_KEY` (or `ANTHROPIC_API_KEY`) when either is set on the host — **skip the fetch entirely when neither is.** An OAuth token would instead need `Authorization: Bearer` **plus** `anthropic-beta: oauth-2025-04-20`; out of scope for v1 |
| everything else | `GET https://openrouter.ai/api/v1/models` | none — keyless, and one call covers gemini / deepseek / qwen / llama / glm / kimi via `id` prefix (`google/`, `deepseek/`, `qwen/`, `meta-llama/`, `z-ai/`, `moonshotai/`) |
| `codex` | OpenAI's `GET /v1/models` needs a key | Same opportunistic rule via `OPENAI_API_KEY`; otherwise fallback-only |

Anthropic response shape (verified): `{ data: [{ id, display_name, created_at, max_input_tokens, max_tokens, capabilities }], has_more, first_id, last_id }`. Note it uses the **`after_id`/`before_id`** cursor scheme, *not* the `page`/`next_page` scheme used elsewhere in that API — follow `has_more` + `last_id` if paginating. `max_input_tokens` is the context window; there is no `context_window` field.

Store only what the picker needs — `provider`, `model_id`, `display_name` — plus `max_input_tokens` for an optional context-size subtitle. Do not mirror `capabilities`; it's a large nested tree with no picker use, and storing it invites drift.

### A3. Schema

New `src/db/migrations/015_create_model_catalog.sql`, applied by the existing runner (`db/sqlite-migrate.ts`, tracked in `schema_migrations`):

```sql
CREATE TABLE IF NOT EXISTS model_catalog (
  provider      TEXT NOT NULL,
  model_id      TEXT NOT NULL,
  display_name  TEXT,
  max_input_tokens INTEGER,
  source        TEXT NOT NULL CHECK (source IN ('web','manual')),
  updated_at    TEXT NOT NULL,
  PRIMARY KEY (provider, model_id)
);
CREATE INDEX IF NOT EXISTS idx_model_catalog_provider ON model_catalog(provider);
```

`source` is only `'web'` or `'manual'` — the fallback tier lives in code and is never written to the table, so a stale row can never masquerade as a shipped default. A refresh does `DELETE FROM model_catalog WHERE source='web'` then re-inserts, leaving `'manual'` rows untouched.

`provider` is deliberately a free-text column, not constrained to `ProviderName`. The catalog spans providers the streamer cannot run sessions for (gemini, deepseek, …); `src/providers.ts` stays the source of truth for *runnable* providers, and the two lists are not the same set.

### A4. Endpoints

All under the admin-scoped `/api/config` prefix, so they inherit `admin` from `ROUTE_CAPABILITIES` with no registry edit.

| Method | Path | Body / result |
|---|---|---|
| `GET` | `/api/config/models` | `{ providers: { claude: [{id, displayName, maxInputTokens}], … }, source: 'web'\|'manual'\|'fallback', refreshedAt }` — per-provider `source` reflects the winning tier |
| `POST` | `/api/config/models/refresh` | Runs the fetch, returns the same shape plus `{ errors: [{provider, message}] }`. Partial success is success: one provider's fetch failing must not fail the request |
| `PUT` | `/api/config/models` | `{ provider, models: [{id, displayName?}] }` → upserts as `source='manual'`. A `models: []` clears that provider's manual rows and falls back a tier |

Zod schema in `src/schemas/modelCatalog.schema.ts`, matching the `.strict()` style of `claudeFlags.schema.ts`. **Validate `model_id` with the same `MODEL_NAME_RE` #306 uses** — a catalog entry is the value that later gets typed into a live PTY by `applyLiveSessionSetting`, so a catalog row is the same trust boundary as a `PATCH` body one hop earlier. Reject, never sanitize.

Refresh is also attempted once at boot, fire-and-forget: `void refreshModelCatalog().catch(…)`. It must never block or fail the boot — a laptop starting offline is the normal case, not an error.

### A5. Tests

- `__tests__/model-catalog.test.ts` — tier resolution (manual > web > fallback), the empty-table fallback, `MODEL_NAME_RE` rejection of a bad catalog row, and that a `web` refresh leaves `manual` rows intact.
- Web fetch mocked via `global.fetch`; assert the no-credential path **skips** the Anthropic call rather than sending an unauthenticated one.
- Route tests follow `__tests__/config-routes.test.ts` (bare Hono, stubbed deps). Any test touching the real DB needs the `THREADBASE_CONFIG_DIR` + temp-`cacheDir` isolation that `session-settings.test.ts` uses — `setClaudeFlagsConfig`-style writes hit the developer's real `~/.threadbase` otherwise.
- Docs: `docs/api-reference.md` rows, a `docs/compatibility/tb-mobile.md` entry (new endpoints are additive/safe), and a CLAUDE.md section next to **Model & effort**.

---

## Phase B — mobile: the pickers

### B1. Capability probe — reuse the 404→null pattern

`getModelCatalog(serverId)` in `services/api-client.ts`, mirroring `getClaudeFlags` (`:418-427`) exactly: `NotFoundError → null`, everything else rethrown. `null` means "server predates the catalog" and the picker hides.

Do **not** model this on `ServerInfo.claudeFlags` — that capability bit is declared in `types/api.ts:265` and read nowhere in the app. The house pattern is probe-by-calling.

**The live-session `PATCH` needs the catalog probe, not its own.** A `404` from `PATCH /api/sessions/:id/model` is ambiguous — old server *or* vanished session — so it cannot be used as a feature probe. Gate the picker on `getModelCatalog() !== null` instead; a server new enough to serve the catalog is new enough to have #306's routes, since they ship together.

### B2. Where it lives

A new `components/sessions/SessionSettingsSheet.tsx`, opened from the existing `HeaderOverflowMenu` in `app/session/[id].tsx:837-847` (add an item next to `info`).

**Not** an extension of `InfoModal`. That component is read-only by contract — `InfoField` is `{label, value}`, it has a single optional `action` slot, and it drops empty values (`:71`). It's also rendered from four separate return branches on the session screen, including ones where `session` is undefined. Adding mutation there would touch a shared component used elsewhere and put a picker on screens with no session. A sheet keeps the blast radius to one new file plus one menu item.

Copy the chip row from `components/servers/SortSheet.tsx` (`:88-94`), **not** from `ServerClaudeFlagsSection.tsx` (`:148-162`): SortSheet's has `accessibilityRole="button"` + `accessibilityState={{selected}}` and `minHeight: 36`, while the flags version has no a11y role and `paddingVertical: 4` — about a 24pt tap target, well under the 44pt the rest of the app uses. Also leave behind the flags row's toggle-off-on-re-tap semantics (`value === option ? undefined : option`); that's flag-specific and wrong for a required setting.

### B3. Selection state — the scraped-string trap

`session.effort` is a clean lowercase tier (`'high'`), so `value === option` highlighting works.

`session.model` is **not** — it's `'Opus 4.8 (1M context)'`, scraped from Claude's status line, and will never string-match a catalog id like `claude-opus-4-8`. Two options, pick one deliberately:

- **Recommended:** show the scraped `session.model` as a read-only "current" line above the chips, and don't mark any chip selected. Honest, no normaliser to keep in sync.
- Normalise both sides for comparison. Adds a mapping that drifts every model release — only worth it if a selected-state chip is a hard design requirement.

### B4. Writes and invalidation

`hooks/useSessionSettings.ts` with two mutations calling `createApiForServer(serverId).patch(...)` inline — the precedent is `hooks/useSessionName.ts:12-15`, which does exactly this rather than adding an api-client wrapper.

**Invalidate `['session', serverId, sessionId]` on success — WS is not enough here.** It is tempting to skip invalidation the way `useSessionActions.sendInput` does (`:29-38`), since `app/_layout.tsx:135-155` merges every WS `session_update` into that key. That reasoning does not hold for these two fields:

- `ManagedSession` (`src/types.ts:59-130`) has **no `effort` field at all**, and `managedToResponse` (`src/session-store.ts:227`) emits only `model`. `effort` and `permissionMode` exist solely on the wire type `SessionResponse`, injected by `handleGetSession` after the store lookup.
- So `effort` rides **only** `GET /api/sessions/:id` — never the list endpoint, never `session_update`. Waiting on WS would leave the sheet showing a stale effort forever.

Invalidate the key after a `202` and let `useSessionDetail` re-fetch; the scrape on that endpoint is what reports the applied value. Do not add an optimistic update: `202` means *requested*, not *applied*, and optimism would show a value Claude may not have taken.

There is a timing wrinkle to allow for: the value is applied on the TUI's next render, so an immediate re-fetch can still read the old status line. Invalidate once on success and once more after a short delay, or accept that the first refresh may lag by a render.

Surface the error codes as distinct states — they are the difference between "try again in a moment" and "this won't work":

| Code | UI |
|---|---|
| `409 SESSION_BUSY` | "Session is mid-turn — try again when it's waiting for input." Keep the sheet open |
| `409 SESSION_IDLE` | "Resume the session first." |
| `501 UNSUPPORTED_PROVIDER` | Hide the effort row for Codex sessions rather than letting it fail |
| `400` | Shouldn't happen with catalog-sourced values — log it; it means catalog and validator disagree |

### B5. i18n

Add `claudeFlags.flags.model.label` / `.effort.label` to `locales/{en,he,ru,ar}/servers.json` — without them `ServerClaudeFlagsSection` falls back to showing the raw `--model` / `--effort` CLI spelling for the *server-default* form (`t(..., { defaultValue: def.flag })`). Add the sheet's own strings under a new `sessions:settings.*` block.

### B6. Slash commands — keep them

Leave the free-text `/model` and `/effort` entries in `constants/slashCommands.ts:105-121`. They're one array element each with no code branches, and they remain the escape hatch for a model the catalog doesn't list yet. Retiring them buys ~18 deleted lines and removes the only recovery path when the catalog is stale.

### B7. Tests

- `__tests__/integration/components/SessionSettingsSheet.test.tsx` — mock the hooks (not the api-client), per `ServerClaudeFlagsSection.test.tsx`: chips render from catalog data, `null` catalog renders nothing, each error code maps to its message, and the mutation is called with the chip's id.
- `__tests__/unit/services/modelCatalogApi.test.ts` — mock `global.fetch`, per `claudeFlagsApi.test.ts`: 200 → parsed, 404 → `null`, 403 → rejects.
- Add a `SessionSettingsSheet` case to the existing session-screen suites for the overflow-menu wiring.

---

## Open question for the user

Phase A's multi-provider tier depends on **OpenRouter** as the keyless aggregator — one call covering gemini/deepseek/qwen/llama/glm/kimi. That's a third-party dependency in the streamer's boot path (best-effort, non-blocking, but still an outbound call to a non-Anthropic host).

The alternative is per-provider official APIs, which each need their own key and would mean most providers are fallback-only for most users. Worth confirming before A2 is built — it's the one decision here that adds an external dependency rather than reusing something already present.

## Verification

**Phase A** — `npm run lint && npm test` in the streamer worktree, then against a dev instance:

```bash
curl -s localhost:<port>/api/config/models -H "Authorization: Bearer $KEY" | jq '{source, claude: .providers.claude[0:3]}'
curl -X POST localhost:<port>/api/config/models/refresh -H "Authorization: Bearer $KEY" | jq '{source, errors}'
# offline check — the floor that must always hold
sudo ifconfig en0 down; curl -s localhost:<port>/api/config/models -H "Authorization: Bearer $KEY" | jq '.source'  # → "fallback", non-empty
sudo ifconfig en0 up
# manual edit wins and survives a refresh
curl -X PUT localhost:<port>/api/config/models -H "Authorization: Bearer $KEY" -d '{"provider":"claude","models":[{"id":"opus"}]}'
curl -X POST localhost:<port>/api/config/models/refresh -H "Authorization: Bearer $KEY" >/dev/null
curl -s localhost:<port>/api/config/models -H "Authorization: Bearer $KEY" | jq '.providers.claude'  # still the manual row
```

**Phase B** — `npm test` and `npx tsc --noEmit` in the mobile worktree, then on a device against a live session: open the sheet, pick an effort level, and confirm the info modal's `Effort` line reflects it after the re-fetch. That is the real end-to-end proof — the field is scraped from Claude's live status line, so it reports what Claude actually applied rather than what was requested, and because `effort` never rides `session_update` it also proves the invalidation in B4 is wired. Then send a prompt, and while it's running open the sheet again and confirm the `SESSION_BUSY` message appears instead of a silent failure.
