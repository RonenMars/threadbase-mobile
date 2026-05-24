# Bug 5 — Multi-attachment send produces no output: diagnosis

Date: 2026-05-24
Branch: `diagnose/multi-attachment-bug5`
Source plan: `docs/superpowers/plans/archive/2026-05-16-loading-perf-and-tree-new-session.md` (Bug 5)

## Symptom

In a new session, attach two images and send — the server accepts the upload(s) but the UI never renders an assistant turn.

## Trace

The mobile send-path is a single-string `input` POST; "attachments" are encoded purely as `@path` text references prepended to the user message. There is no structured multi-attachment payload anywhere in the client.

Top hops (file:line):

1. **Picker** — `services/uploads.ts:27-47` (`pickFromLibrary` / `pickFromCamera`).
   `PICKER_OPTIONS` (`uploads.ts:20-25`) has no `allowsMultipleSelection` or `selectionLimit`, and `assetToPicked` (`uploads.ts:40-47`) hard-codes `result.assets[0]`. The user must tap the paperclip twice to get two attachments — each tap is an independent picker round-trip.

2. **Per-attachment upload** — `app/session/[id].tsx:604-617` (`runUpload`) → `services/uploads.ts:66-101` (`uploadAttachment`).
   Each call POSTs JSON `{ filename, mimeType, dataBase64 }` to `/api/sessions/:id/files` and gets back `{ id, path, originalName, mimeType, sizeBytes }`. The mobile state (`attachments: UploadedFile[]`, `app/session/[id].tsx:440`) is appended to (`setAttachments((prev) => [...prev, uploaded])`, `app/session/[id].tsx:611`), so two uploads do produce two distinct entries with two distinct server-issued `path` strings.

3. **Composer payload assembly** — `app/session/[id].tsx:567-572` (`buildPayload`).
   ```ts
   const trimmed = inputText.trim()
   if (!trimmed && attachments.length === 0) return null
   const refs = attachments.map((a) => `@${a.path}`).join(' ')
   return refs && trimmed ? `${refs} ${trimmed}` : refs || trimmed
   ```
   With two attachments and an empty text the payload is `"@<path1> @<path2>"` — a single string with two whitespace-separated `@`-tokens and **no user text**. There is no structured attachment array on the wire and no escaping for paths that contain spaces.

4. **Network send** — `app/session/[id].tsx:581-602` (`handleSendInput`) → `hooks/useSessionActions.ts:11-19` (`sendInput`).
   ```ts
   api.post(`/api/sessions/${sessionId}/input`, { input })
   ```
   The wire shape is `{ input: string }`. There is no `attachments` / `files` / `images` field. The mutation only invalidates `['session', …]` and `['terminal-output', …]` on success (`useSessionActions.ts:14-18`) — no client-side error path beyond the generic `Alert.alert('Send failed', …)` (`app/session/[id].tsx:598-599`).

5. **Renderer** — `hooks/useConversations.ts:186-229` (`adaptRawMessage`) → `types/api.ts:90-110` (`Message` / `MessageContent`) → `components/conversation/MessageBubble.tsx`.
   The Message type carries `has_images?: boolean` and `attachment?: Record<string, unknown> | null` (`types/api.ts:97,102`), but `MessageContent` (`types/api.ts:105-110`) has no `image` / `attachment` variant. `MessageBubble.tsx` does not reference `attachment` or `has_images` at all (grep returns zero hits in the renderer). For terminal-PTY sessions, output streams via `useTerminalStream` (`hooks/useTerminalStream.ts:132-167`) — the renderer doesn't gate on attachments.

## Root cause(s)

The mobile client does not actually have a multi-attachment protocol. The "multi-attachment" UI is purely a UX wrapper around two server-side decisions made over a single PTY-input string:

- **Layer 1 (composer):** `buildPayload` (`app/session/[id].tsx:567-572`) collapses N attachments and the text into one space-joined string of `@path` tokens. There is no length cap, no path escaping, and no requirement that the user typed any text. With 2 attachments and an empty composer the prompt sent to Claude is just `"@/abs/path/a.jpg @/abs/path/b.jpg"`.
- **Layer 2 (PTY interpretation, server-side, out of this repo):** Claude's CLI is being asked to interpret two consecutive `@path` references in a bare prompt. The likely failure modes are (a) the second `@path` is parsed as text rather than as a file reference, (b) one or both paths contain a space that we never quoted (so the token splits at the wrong boundary on the server), or (c) the prompt with no surrounding instructions is treated as ambient context and produces no assistant turn — exactly the observed symptom of "nothing renders".

Given the mobile code is provably layer-1-only, the failure point is the silent layer-1 → layer-2 contract. The send succeeds at the HTTP level (`sendInput.isError` would otherwise surface), but the resulting PTY input is malformed or non-actionable, so the streamer never emits assistant output for that turn.

## Recommended fix

**Short-term (fits inside Bug 5):** quote the paths and force a default prompt when text is empty. In `buildPayload`, wrap each path so spaces survive (`` `@'${a.path.replace(/'/g, "'\\''")}'` `` or equivalent), and if `trimmed` is empty append a minimal instruction such as `"please describe these"` so the assistant has a turn to respond to. This is a one-function change that keeps the wire shape and the Go server unchanged.

**Right fix (Feature 3 territory):** stop encoding attachments as positional text. Add an `attachments?: { id: string; path: string }[]` field to the `POST /api/sessions/:id/input` request and have the streamer side construct the prompt server-side (where it can quote paths and add a default instruction in one place). Mobile becomes: send `{ input, attachments }`, and the renderer can finally show attachment chips on the sent message because the message now has structured attachment metadata flowing back through `RawMessage.attachment` (`hooks/useConversations.ts:161`) which the renderer currently ignores.

## Open questions (need a running app or server access)

1. Does the streamer log a turn for the malformed prompt, or does it discard the input pre-turn? Plan step 2 — not verifiable from mobile source alone.
2. Do the server-issued paths from `/api/sessions/:id/files` contain spaces? If they're always under `/tmp/<uuid>/<safe-name>`, the unquoted-space theory is dead and the more likely culprit is "two `@`-tokens with no instruction text".
3. Is there a known Claude CLI behavior where a prompt consisting only of `@path` references is silently consumed? That would be the cleanest explanation of "no response at all", and it would mean the right short-term fix is the "default prompt when empty" half — not the quoting half.
4. Does sending **one** attachment with an empty text also produce no output? If yes, the bug is the empty-text-with-refs case and is not actually multi-attachment-specific. The user's report says 2 attachments; verifying the 1-attachment-empty-text case would split the diagnosis cleanly.
