# Structured message attachments (streamer + mobile)

**Date:** 2026-10-04
**Status:** Proposed
**Scope:** tb-streamer (upload registry, `/input` contract, history and WS shapes, download route), tb-mobile (composer, send path, bubble rendering)
**Verified against:** tb-mobile `4fb94af`, tb-streamer `b69b748` (both `main`, 2026-10-04)

---

## Problem

An attachment is not a thing on the wire today. It is a substring of the prompt.

1. Mobile uploads each file on its own as base64 inside JSON: `POST /api/sessions/:id/files` with `{ filename, mimeType, dataBase64 }` (`services/uploads.ts:117-149`).
2. The streamer writes it to `<projectPath>/.threadbase-uploads/<sessionId>/<ts>-up_<hex>-<name>` and answers with the absolute `path` (`threadbase-streamer/src/uploads.ts:52-84`).
3. Mobile prepends `@<path>` tokens to the typed text (`hooks/useComposerState.ts:98-106`):
   ```ts
   const escapePath = (p: string) => p.replace(/ /g, '\\ ')
   const refs = attachments.map((a) => `@${escapePath(a.path)}`).join(' ')
   return refs && trimmed ? `${refs} ${trimmed}` : refs || trimmed
   ```
4. The streamer writes that string into the PTY verbatim. `POST /api/sessions/:id/input` takes `{ input, keys, idempotencyKey }` and nothing else (`sessions.handlers.ts:1074-1075`, `:1219`).
5. In history the user turn comes back as text containing `@/abs/path/.threadbase-uploads/...`, plus a `has_images` boolean (`conversations.handlers.ts:1409`). No renderer turns the path back into an attachment, so the bubble shows a raw server path.

### What this costs us today

Each of these is a defect or a workaround that exists only because the attachment lives in the text:

| Symptom | Where |
|---|---|
| Filenames with spaces split the `@` token. Fixed twice, once per side: server sanitising and client escaping. | `threadbase-streamer/src/uploads.ts:86-100`, `hooks/useComposerState.ts:101-102` |
| The optimistic bubble never matches its echo (`caption` vs `@path caption`), so the message renders twice. | Open PR #1238 |
| The bubble shows an absolute host path instead of a thumbnail or chip. | `MessageBubble.tsx` never reads attachments |
| Title generation needs four regexes to strip markers back out. | `lib/displayTitle.ts:51-55` |
| The question parser has to stop at upload-path lines. | `utils/parseQuestionBlock.ts`, test at `:219-228` |
| A Cursor transcript is bound by searching its head for `.threadbase-uploads/<sessionId>/`. | `threadbase-streamer/src/session-watchers.ts:541-544` |
| The client builds a provider-specific prompt syntax (`@path`, Claude's mention grammar) that it should not need to know. Codex and Cursor get the same Claude-shaped string. | `pty-manager.ts:152`, `codex-pty-runner.ts:536`, `cursor-pty-runner.ts:279` |
| The client is trusted to name an arbitrary absolute path in the prompt. Anything after `@` is passed to the agent. | `/input` has no attachment validation |

The 2026-05-24 diagnosis (`docs/superpowers/specs/2026-05-24-bug5-multi-attachment-diagnosis.md`) already called a structured field "the right fix". The space-escaping patch shipped instead, and `ROADMAP.md:62-87` still lists the structured contract as unresolved.

### Related gaps found during the audit

These are not the core change, but the new design should close them rather than build on them:

- **No body cap on `/files` without E2EE.** `readBody` buffers the whole body and has no limit (`threadbase-streamer/src/api/handlers/http-helpers.ts:182-196`). The 48 MiB check runs only after `Buffer.from(base64)`.
- **No MIME allowlist and no magic-byte check.** The upload accepts any `mimeType` string.
- **Wrong capability check.** The `fs:upload` scope maps to `/api/upload` (`capabilities.ts:114`), which does not exist. The real route is covered by `session:control`.
- **No retention.** Uploads live forever inside the user's working tree (security review TB-S-20 / M14).
- **No download route.** Mobile can never show a server-side attachment, only the local `localUri` it still holds.
- **Postgres-only registry.** `session_uploads` is written only when Postgres is configured, and nothing ever reads it.
- **Raw Claude image base64 goes out over WebSocket.** `conversation_event(s)` passes Claude JSONL lines through unchanged (`threadbase-streamer/src/utils/codexConversationLine.ts:235`), and the tail cache stores the same blocks in SQLite (`conversation-cache.ts:1400-1416`).
- **Partial failures lose uploads.** `Promise.all` in `runUpload` (`useComposerState.ts:187-221`) drops every file if one fails, and leaves the files that did upload orphaned on the server.

---

## What the industry does

Sources are listed at the end. The pattern is close to unanimous.

**1. Attachments are typed objects next to the text, never inside it.**
- Slack keeps the text in `initial_comment`, separate from the files.
- Telegram uses `caption` beside the media.
- Discord sends an `attachments[]` array.
- Matrix sends `m.image` with `url` and `info`.
- Stream Chat sends `attachments[]`.
- LLM APIs use the same shape. Anthropic's `content` is an array of typed `text` / `image` / `document` blocks, and OpenAI and Gemini do the same with typed input parts.
- Zulip is the counter-example: it puts `[name](url)` inside Markdown. It then needs a server-side text parser and a weeks-long job to delete uploads no message claims. That is exactly the position we are in now.

**2. Two phases: upload the bytes first, then send a message that refers to them by id.**
- Slack, Twilio (Media SID), WhatsApp (media id), Anthropic, OpenAI and Gemini (Files API ids) all work this way.
- Uploads can retry on their own, and the message request stays small.
- The bytes travel over HTTP. Only ids and events travel over WebSocket.

**3. Avoid base64 in JSON.**
- It is about 33% larger than the raw bytes.
- On our path it is worse: one image is held in memory as base64, then as the JSON string, then as the sealed frame.
- A raw body or a resumable upload is preferred (tus, Google resumable uploads).

**4. The client generates the id and reuses it on retry.**
- Stripe's idempotency key does this, and so does Discord's `nonce` with `enforce_nonce`.
- The same id lets the client match its optimistic bubble to the server's echo exactly, without comparing text.

**5. An upload is pending until a message claims it.**
- Twilio deletes media no message has claimed after about 5 minutes. Zulip deletes unclaimed uploads after weeks. Anthropic and Gemini put a TTL on files.

**6. Accept server-issued ids only, and never let the client name a path.**
- Anthropic's Files API docs say to treat `file_id`s as server-side references.
- OWASP: check magic bytes rather than the declared Content-Type, store under server-generated names, enforce size before reading the body, and authorise downloads by id.

**7. Change the schema additively and read it tolerantly.**
- Fowler's TolerantReader and Google AIP-180: add fields, never retype them.
- Matrix keeps a plain-text `body` fallback next to structured media for clients that cannot render it.
- This matches the "degrade, don't break" contract both repos already follow.

---

## The constraint that shapes the design

The agents are interactive TUIs driven over a PTY. A Claude Code TUI cannot receive an attachment object. It receives keystrokes, and the only way to reference a file is a path mention typed into the prompt. **So the agent will still see `@path`. The decision is who writes it and where.**

The change: the `@path` (or whatever a provider needs) moves from the **client** to the **streamer's provider adapter**. That is the one layer that knows the provider, owns the files, and can check that the reference is real. Everything between the app and the adapter, in both directions, carries structured attachments. This follows the direction already set in `threadbase-streamer/docs/architecture/2026-08-12-structured-session-events.md`: the terminal is one rendering of structured state, not the contract.

```
mobile ──POST /uploads (bytes)──────────────► upload registry (runtime.db + disk)
mobile ──POST /input {text, attachments:[id]}─► validate ids ─► provider adapter
                                                                 ├─ claude: bracketed paste "@p1 @p2 text"
                                                                 ├─ codex:  (verify) path paste / -i at spawn
                                                                 └─ cursor: (verify)
JSONL ─► parser ─► extract known upload refs ─► {text, attachments:[{id,...}]} ─► REST history / WS user_message
mobile ──GET /uploads/:id[?variant=thumb]───► bytes (sealed under E2EE)
```

Extracting refs from history is **exact matching, not a heuristic**. The streamer generated the path itself, using a fixed grammar (`.threadbase-uploads/<sessionId>/<ts>-up_<16 hex>-<name>`), and the id is embedded in the path. A `@`-token that matches this grammar under the session's project path is an upload. Anything else stays text. This also gives conversations written before this change structured attachments for free: the path grammar has not changed since the sanitising fix (#241).

---

## Target contract

### Upload: `POST /api/sessions/:id/uploads` (new; `/files` stays as a legacy alias)

- **Request:** raw bytes in the body, `Content-Type: application/octet-stream`.
- **Metadata:** in headers, or in a small JSON part of the sealed envelope:
  - `X-TB-Filename` (URL-encoded)
  - `X-TB-Mime`
  - optional `X-TB-Width`, `X-TB-Height`, `X-TB-Blurhash`. These are display-only and never trusted.
- **Under E2EE** the sealed body is just the raw bytes. `sealedFetch` already accepts `Uint8Array` (`services/authed-fetch.ts:299-310`), so the bytes no longer pass through base64 or a JSON string.
- **Response `201`:**
  ```json
  { "id": "up_9f2c…", "name": "IMG_5192.jpg", "mime": "image/jpeg", "size": 812345,
    "kind": "image", "width": 3024, "height": 4032, "blurhash": "LKO2?U%2Tw=w]~RBVZRi};RPxuwH",
    "status": "pending", "expiresAt": 1759622400000 }
  ```
- **No `path` in the new response.** The path is a server detail. Old clients keep using `/files`, which still returns it.
- **Checks:**
  - Enforce `Content-Length` against the cap **before** reading the body.
  - Sniff the magic bytes against an allowlist (images, PDF, plain text, common source files), and reject a mismatch with `415`.
  - Keep generating the storage name on the server, as now.
- **Capability:** `fs:upload`. Fix the dead `/api/upload` mapping as part of this work.

### Send: `POST /api/sessions/:id/input` (additive fields)

```json
{
  "input": "What is wrong with this screen?",
  "attachments": [{ "id": "up_9f2c…" }, { "id": "up_77ab…" }],
  "idempotencyKey": "msg_01J…"
}
```

- `attachments` holds **ids only**. Each id must belong to this session and be `pending` or `claimed`. An unknown id returns `422 ATTACHMENT_NOT_FOUND`. A file that has expired returns `410 ATTACHMENT_EXPIRED`.
- `input` may be empty when `attachments` is non-empty. The adapter decides what to send to the agent on its own. For Claude, an empty prompt of bare `@`-refs is the Bug 5 failure mode, so the adapter appends a short default instruction from one server-side constant.
- On success the referenced uploads move to `claimed` and are linked to the `idempotencyKey`. They are released only by retention.
- `idempotencyKey` already exists (C4, `sessions.handlers.ts:1080-1112`). Reusing it as the client message id means a retried send cannot claim twice or submit twice.
- **Legacy:** a body with no `attachments` behaves exactly as today, including `@path` tokens typed or built by old clients.

### History and live echo (additive field; `text` becomes clean)

User messages in `GET /api/conversations/:id`, `terminal_replay.userMessages` and the WS `user_message` event gain:

```json
{ "text": "What is wrong with this screen?",
  "attachments": [{ "id": "up_9f2c…", "name": "IMG_5192.jpg", "mime": "image/jpeg",
                    "kind": "image", "size": 812345, "width": 3024, "height": 4032,
                    "blurhash": "…", "available": true }],
  "clientMessageId": "msg_01J…" }
```

- **`text` has the upload refs removed.** This is a change of value, not of type. Grepping mobile finds three consumers, and all three get better:
  - Echo matching (`LiveConversationView.tsx:67-73`): an old client's optimistic text was already the caption without refs, so it now matches. That fixes #1238 on the server side as well.
  - `displayTitle.ts`: its strip regexes become no-ops.
  - `parseQuestionBlock.ts`: the upload-line stop never fires.
- The one thing an old client loses is the visible raw path. That path was never meaningful on a phone, and `has_images` stays.
- `available: false` when the file has been deleted by retention or is missing on disk. The client then shows a "file no longer available" chip instead of an error.
- `clientMessageId` is the `idempotencyKey` echoed back. The new client matches optimistic bubbles on it instead of on text.
- **Raw `conversation_event(s)` lines:** replace inline image `source.data` / `file.base64` with a stub `{ type: "image", omitted: true, mime, size }`. Do the same before the tail is cached. This is the fix for base64 going out over WebSocket. It changes a pass-through, so grep mobile's `useConversationStream.ts` consumer before landing it.

### Download: `GET /api/uploads/:id` and `GET /api/uploads/:id?variant=thumb`

- Requires authentication and a device with read scope on the owning session's project.
- Under E2EE the response is a sealed body. Under a 4 MiB record, a full image may need the 64 MiB upload record class mirrored for responses, or a ranged/chunked read. Decide this in Phase 3.
- Headers: `Content-Disposition: attachment` for non-images, `X-Content-Type-Options: nosniff`, and `Cache-Control: private, max-age=…` with an ETag of the id.
- `variant=thumb`:
  - First choice is a client-supplied thumbnail uploaded with the file (second body part). It is cheap and needs no native image library on the server.
  - Fallback is the original file, which mobile downsizes on render.
  - Server-side thumbnailing (for example `sharp`) is a native dependency and stays out of scope unless the client-supplied thumbnail is found inadequate.

### Capability advertisement

`GET /api/info` gains `structuredAttachments: 1`, a version number rather than a boolean so the shape can grow. Mobile uses the new paths only when this is present. An older server reads as "off", and mobile keeps the `@path` behaviour, so a new app works against an old streamer and vice versa.

### Registry and retention

- **New table `uploads` in `runtime.db`**, not `cache.db`. Claim state and message linkage cannot be rebuilt from `~/.claude`, which is the test `runtime-store.ts` exists for.
- **Columns:** `id, session_id, project_path, file_path, name, mime, kind, size, width, height, blurhash, thumb_path, status (pending|claimed|deleted), client_message_id, created_at, claimed_at, expires_at`.
- **Rebuild when rows are missing:** the directory listing reproduces `id`, `ts` and `name` from the filename. A row missing from the table is therefore re-registered as `claimed`, with `available: true`, the first time history references it.
- **Retention sweep** (piggyback on the idle-reaper interval):
  - Delete `pending` uploads older than 24 h.
  - Delete `claimed` uploads after a configurable `uploadRetentionDays` (default 30) or when the session's conversation is deleted.
- **Deleting a chip in the composer** calls `DELETE /api/uploads/:id`. This is allowed only while the upload is `pending`.
- **Postgres `session_uploads`:** stop writing it once the SQLite registry lands. It is dormant and never read.
- **Location (open question):** keeping files in the project tree is what lets the agent's sandbox read them. Moving them to `~/.threadbase/uploads/` would remove them from `git status` and from the user's repo, but Claude may then need `--add-dir`. Verify that before moving. At minimum, write a `.gitignore` containing `*` into `.threadbase-uploads/` when the directory is created.

---

## Provider adapters

One function per runner turns `(text, attachments[])` into PTY bytes. It replaces the client-side `buildPayload`.

| Provider | Rendering | Status |
|---|---|---|
| Claude | `@<path>` per attachment, space-separated, before the text, all inside the existing bracketed paste (`pty-manager.ts:152-154`). Paths are already free of whitespace and `@` after sanitising, so no escaping is needed. If `text` is empty, append the default instruction. | Known to work today; it is what mobile builds now. |
| Codex | Today it receives the same Claude `@path` string, as plain bytes (`codex-pty-runner.ts:536`). Codex supports `-i/--image` at launch; whether its TUI turns a pasted image path into an attachment mid-session must be **verified on Codex CLI ≥ 0.147** before choosing. Fallback: a plain-text reference ("Attached files: <path>, …") that the model can read with its file tools. | **Verify first** |
| Cursor | Today it receives the same string (`cursor-pty-runner.ts:279`). Whether `@path` is a file mention in `cursor-agent` is unverified. Same fallback as Codex. | **Verify first** |
| Multi-agent (`MULTI_AGENT_FLOW`) | `{ text }` only; `history-mapper.ts:25-43` drops non-text blocks. Out of scope. Answer `422 ATTACHMENTS_UNSUPPORTED` when `attachments` is sent, so the client knows instead of silently losing the files. | Out of scope |

Making this per-provider is half the point. The client stops guessing which mention grammar each CLI uses.

---

## Mobile changes

1. **Upload path** (`services/uploads.ts`):
   - Read the file as bytes rather than base64 and POST it to `/uploads` with headers. Fall back to `/files` when `structuredAttachments` is absent.
   - Downscale images before upload with `expo-image-manipulator`: longest edge about 2048 px, JPEG or WebP at 0.85. Claude downsamples large images anyway, so a 12 MP original wastes bandwidth, the E2EE record budget and tokens.
   - Compute `width`, `height`, `blurhash` and a small thumbnail on the device while the file is in hand.
2. **Per-file state** (`hooks/useComposerState.ts`):
   - Replace `Promise.all` with per-attachment status `uploading | uploaded | failed`, each with its own retry and progress.
   - Allow send only when every chip is `uploaded`.
   - Persist the uploaded `id`s in drafts (`useDraftsStore`) so a remount does not drop them. Pending ids survive 24 h on the server.
3. **Send** (`hooks/useSessionActions.ts`):
   - Send `{ input: text, attachments: ids, idempotencyKey }`, with the key generated once per composed message and reused on retry.
   - Delete `buildPayload`'s `@path` assembly behind the capability check; keep it only for the legacy branch.
4. **Optimistic bubble** (`LiveConversationView.tsx`):
   - Carry the local `localUri`s and the `clientMessageId`.
   - Match the echo on `clientMessageId` when it is present, and on text otherwise.
5. **Types** (`types/api.ts`):
   - Add `MessageAttachment`.
   - Add `attachments?: MessageAttachment[]` to `Message` and to `RawMessage`. `adaptRawMessage` passes the field through and narrows each entry defensively: drop entries without an `id`, and treat an unknown `kind` as `file`.
   - Remove the ambiguous `attachment?: Record<string, unknown>` from the user-facing type, or rename it in mobile only. It is Claude's internal JSONL `attachment` record, not a user upload.
6. **Rendering:**
   - A new `MessageAttachments` row in `MessageBubble`: image tiles with a blurhash placeholder that load `?variant=thumb`, file chips for everything else, and the full-size view in the existing `AttachmentPreview` modal.
   - Needs a story (`MessageAttachments.stories.tsx`), Phosphor icons only, and `t()` keys for "file no longer available" and the size and kind labels.
   - Replace the emoji in `header.containsImage` (`locales/en/conversation.json:3`) while touching this, since it breaks the no-emoji rule.
7. **Cleanup:** once the capability check is in place and old servers age out, remove the `FILE_AT_PATH` / `FILE_AT_BASENAME` regexes from `displayTitle.ts` and the upload-path stop from `parseQuestionBlock.ts`.

---

## Phases

Each phase can ship on its own and is safe against both older and newer peers.

| # | Repo | Deliverable | Depends on |
|---|---|---|---|
| 0 | streamer | Hardening that does not depend on the new design: a `Content-Length` cap on `/files` before buffering, a magic-byte allowlist, `fs:upload` mapped to the real route, and a `.gitignore` written into `.threadbase-uploads/`. | — |
| 1 | streamer | `uploads` table in `runtime.db`, `POST /uploads` with raw body, `attachments[]` on `/input`, provider adapters (Claude complete, Codex and Cursor using the verified or fallback rendering), `structuredAttachments: 1` in `/api/info`. Tests: id ownership, expired and unknown ids, idempotent replay that does not claim twice, empty text with attachments, legacy `@path` input unchanged. | 0 |
| 2 | streamer | History and echo: extract refs into `attachments[]`, clean `text`, `clientMessageId` on `user_message`, and image-base64 stubs on `conversation_event(s)` and in the tail cache. Grep mobile for consumers of the changed values and report them, per streamer `CLAUDE.md`. | 1 |
| 3 | streamer | `GET /uploads/:id` with `?variant=thumb`, the E2EE response-size decision, the retention sweep, and `DELETE /uploads/:id`. | 1 |
| 4 | mobile | Binary upload, per-file state and retry, downscale and blurhash, structured send behind the capability check, optimistic matching on `clientMessageId`. | 1 |
| 5 | mobile | `MessageAttachments` rendering in bubbles, the "not available" state, i18n keys, a story, a Maestro flow in the mock suite (extend `e2e/mock-server.js` with `/uploads` and `/uploads/:id`). | 2, 3 |
| 6 | both | After one release with capability adoption: drop the legacy `buildPayload` branch and the title and parser regexes on mobile; keep `/files` on the streamer for installed old builds (they cannot be force-updated). | 4, 5 in a shipped build |

File the work as cross-repo issues, one per repo, each describing its own half and linked by URL (issue-tracker convention). I could not search existing issues from this session because the GitHub connection failed, so check for duplicates first: Bug 5 / Feature 3 follow-ups, #1238, #1231 and TB-S-20.

---

## Open questions

1. **Codex and Cursor rendering.** Does the Codex TUI attach a pasted image path mid-session, and is `@path` a file mention in `cursor-agent`? The answer decides between a native attachment and a plain-text path reference. Verify on hardware before Phase 1 locks the adapters.
2. **Where files live.** Keep them in the project tree (readable by the agent's sandbox, but they clutter the repo) or move them to `~/.threadbase/uploads/` (needs `--add-dir` or an equivalent per provider)?
3. **E2EE download size.** Add a response-side upload record class, or stream a sealed download in 4 MiB records? The second is more work but avoids holding 64 MiB in memory on both ends.
4. **Background uploads.** iOS background `URLSession` uploads from a file, and Expo `uploadAsync` sends unsealed bytes. A sealed background upload would mean sealing to a temporary file first. Worth it only if foreground-only uploads turn out to be a real complaint.
5. **Retention default.** 30 days for claimed uploads is a guess. The streamer has no hosted service, so this is the user's disk. Should it be configurable in `server.yaml` from day one?

---

## Sources

- Slack, working with files: https://docs.slack.dev/messaging/working-with-files
- Discord, uploading files and message attachments: https://docs.discord.com/developers/reference, https://docs.discord.com/developers/resources/message
- Telegram Bot API, sending files: https://core.telegram.org/bots/api#sending-files
- Matrix content repository and `m.image`: https://spec.matrix.org/latest/client-server-api/#content-repository
- Twilio Conversations media: https://www.twilio.com/docs/conversations/media-support-conversations
- WhatsApp Cloud API media: https://developers.facebook.com/docs/whatsapp/cloud-api/reference/media
- Stream Chat file uploads: https://getstream.io/chat/docs/javascript/file-uploads/
- Microsoft Graph chat hosted content: https://learn.microsoft.com/en-us/graph/api/resources/chatmessagehostedcontent?view=graph-rest-1.0
- Zulip upload API and the cleanup of unclaimed uploads: https://zulip.com/api/upload-file, https://github.com/zulip/zulip/blob/main/zerver/management/commands/delete_old_unclaimed_attachments.py
- Anthropic Files API and vision: https://platform.claude.com/docs/en/build-with-claude/files, https://platform.claude.com/docs/en/build-with-claude/vision
- OpenAI file inputs: https://developers.openai.com/api/docs/guides/file-inputs
- Gemini File API: https://ai.google.dev/gemini-api/docs/files
- tus resumable upload protocol: https://tus.io/protocols/resumable-upload
- Google Cloud Storage resumable uploads: https://docs.cloud.google.com/storage/docs/resumable-uploads
- WebSocket and head-of-line blocking (High Performance Browser Networking): https://hpbn.co/websocket/
- Base64 overhead (MDN): https://developer.mozilla.org/en-US/docs/Glossary/Base64
- Stripe, designing robust APIs with idempotency: https://stripe.com/blog/idempotency
- Fowler, TolerantReader: https://martinfowler.com/bliki/TolerantReader.html
- Google AIP-180, backwards compatibility: https://google.aip.dev/180
- OWASP File Upload Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html
- Apple, background URLSession transfers: https://developer.apple.com/documentation/foundation/downloading-files-in-the-background
- Expo FileSystem (legacy) `uploadAsync`, ImageManipulator: https://docs.expo.dev/versions/latest/sdk/filesystem-legacy/, https://docs.expo.dev/versions/latest/sdk/imagemanipulator/
- BlurHash: https://blurha.sh/
