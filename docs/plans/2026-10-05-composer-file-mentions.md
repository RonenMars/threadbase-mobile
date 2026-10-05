# Plan — `@` file/directory mentions in the session composer

Date: 2026-10-05
Status: proposal, nothing implemented

## Goal

In a live session, typing `@` in `ChatComposer` opens a picker showing the files and directories on the streamer's machine, starting at the session's working directory.
Choosing an entry inserts `@<path>` into the message at the cursor, which is the same syntax Claude Code (and Codex / Cursor) already read as a file reference.
It should feel like the slash-command board: type to filter, tap to insert, keep typing.

## What exists today (verified 2026-10-05)

**Listing API (streamer).**
`GET /api/browse?path=<p>` → `{ path, directories: {name}[], files?: {name}[] }` (`threadbase-streamer/src/server.ts:3252`, helpers in `src/browse.ts`).
- One directory level per call, sorted, no hidden-file filtering, no cap on entry count.
- `path` is relative to the server's `browseRoot`; a POSIX absolute path under the root is accepted as-is (`src/browse.ts:23-29`). On Windows a leading separator is always stripped, so an absolute path is **not** accepted there.
- A path outside the root → 400 `Path outside browse root`; missing → 404 `PATH_NOT_FOUND`; no root configured → 403 `BROWSE_ROOT_NOT_SET`.
- Gated by the `fs:browse` device capability (`src/services/security/capabilities.ts:113`).
- `files` is optional — older servers return directories only (`types/api.ts:757`).

**Listing hook (mobile).** `useBrowse(serverId, path)` in `hooks/useBrowse.ts` — React Query, key `['browse', serverId, path]`, already wired to the "slow" banner via `services/query-client.ts:33`.
`app/browse.tsx` consumes it and already falls back to the root when a session cwd is outside the browse root (`app/browse.tsx:148-160`).

**Session cwd.** `Session.projectPath` (absolute) via `useSessionDetail(serverId, sessionId)`, already loaded in `LiveConversationView.tsx:188`.

**Composer.** One `ChatComposer` (`components/conversation/ChatComposer.tsx`) used by both `LiveConversationView` and `TerminalView`; all text state lives in `useComposerState` (`hooks/useComposerState.ts`).
- The composer does **not** track the cursor (`selection`) today.
- `buildPayload()` already emits `@path` for attachments and escapes spaces as `\ ` for Claude Code's parser (`useComposerState.ts:103-110`).

**Slash board (the pattern to mirror, and its warning).**
`SlashCommandBoard` is a `Modal` sheet lifted by `useKeyboardInset`, opened when the whole input matches `^/.{0,30}$`.
It is **behind `EXPO_PUBLIC_SLASH_COMMANDS=1`** because of device issues with the modal (`useComposerState.ts:126-129`), and iOS can present only one modal per presenter, so a `Modal` cannot appear over the expanded editor (`ChatComposer.tsx:224-226`).
Lesson: copy the board's *look and filtering*, not its `Modal` mounting.

## Design

### 1. Trigger and token parsing — pure function

New `lib/mentionToken.ts`:

```ts
interface MentionToken { start: number; end: number; dir: string; query: string }
function findMentionToken(text: string, cursor: number): MentionToken | null
```

- Scan back from `cursor` to the nearest `@`. It is a mention only if `@` is at index 0 or preceded by whitespace (so `foo@bar.com` never triggers), and there is no unescaped whitespace between `@` and the cursor (`\ ` counts as part of the token).
- Split the token at its last `/`: `@src/comp` → `dir: 'src'`, `query: 'comp'`; `@` → `dir: ''`, `query: ''`.
- Reject `..` segments and a leading `/` or `~` — mentions are relative to the session cwd only; the server's root check is the real guard, this just keeps the UI honest.
- Pure, no React: unit-tested exhaustively in `__tests__/unit/lib/mentionToken.test.ts`.

### 2. Cursor tracking in the composer

`ChatComposer` gains `selection`/`onSelectionChange` passthrough on **both** inputs (inline and expanded).
`useComposerState` holds `cursor` and derives `mentionToken = findMentionToken(inputText, cursor)`.
After an insert, the hook sets a controlled `selection` once so the caret lands after the inserted text, then releases control (a permanently controlled `selection` fights typing on Android).

### 3. Data — directory-at-a-time navigation over the existing API

New hook `hooks/useMentionEntries.ts`:

```ts
useMentionEntries(serverId, projectPath, token) → { entries, isLoading, error, unsupported }
```

- Resolves the listing path as `join(projectPath, token.dir)` and calls the existing `/api/browse` through the **same query key shape** as `useBrowse`, so the browse screen and the picker share cache.
- Filters client-side: case-insensitive prefix match first, then substring, directories before files, capped at ~50 rows. Hidden entries (`.` prefix) are shown only when `query` starts with `.`.
- `staleTime` ~30 s and `keepPreviousData` so typing within one directory never refetches, and drilling shows the previous list until the next arrives.
- Debounce only the *directory* change (~150 ms); the filter is synchronous.

**Path translation (the one real gap).**
`/api/browse` wants a path relative to `browseRoot`, the session gives an absolute cwd, and mobile is never told the root.
- POSIX servers: send the absolute path; `resolveBrowsePath` accepts it. Works today with no server change.
- Windows servers and cwd outside the root: the call 400s. Treat that as `unsupported` and show one line ("File suggestions aren't available for this session's folder"), per the "degrade, don't break" rule — never fall back to the browse root, since paths from the root would not resolve relative to the agent's cwd.
- Proper fix is streamer-side (Phase 2): accept a session id instead of a path.

### 4. UI — inline suggestion panel, not a Modal

New `components/conversation/FileMentionBoard.tsx` (+ `FileMentionBoard.stories.tsx`, required by the pre-commit story hook).
- Rendered **inside** `ChatComposer`, above the input row (same slot as the suggestion chip), in both the inline and expanded layouts. Being inside the composer it rides the keyboard lift for free, needs no `Modal`, and works in the expanded editor — avoiding both problems that keep the slash board behind a flag.
- Max height ~5 rows, `FlatList` with `keyboardShouldPersistTaps="always"` so a tap does not dismiss the keyboard first.
- Row: Phosphor `Folder` / `File` icon, name with the matched part emphasised, `CaretRight` on directories. Header shows the current `dir` as a breadcrumb.
- States: loading spinner, empty ("No matches for …"), unsupported line, error line. No emojis; all copy via `t()` in a new `mentions.*` block of `locales/*/terminal.json` (en, he, ar, ru — `npm run test:i18n` gates parity).
- RTL: entry names are paths, so use `ltrContentStyle` like attachment chips do.
- Dismiss: typing whitespace, moving the cursor out of the token, sending, or an explicit close (×) that suppresses the panel until the next `@`.

### 5. Selection behaviour

- **File** → replace the token with `@<dir>/<name> ` (trailing space ends the mention, panel closes).
- **Directory** → replace with `@<dir>/<name>/` and keep the panel open on that directory (drill-down). To mention the directory itself, the user types a space.
- Escape spaces with the same `\ ` rule `buildPayload` uses; extract that `escapePath` into `lib/mentionToken.ts` so both share one implementation.
- Draft persistence comes for free (`setDraft` already runs on every change).

### 6. Provider compatibility

- **Claude Code**: `@relative/path` resolved against its cwd — the target case.
- **Codex / Cursor**: both TUIs treat `@` as a file-search popup trigger. Text delivered as one paste generally lands verbatim, but this must be verified against each runner's submit path (`codex-pty-runner.ts`, `cursor-pty-runner.ts`) before enabling. Gate the trigger per provider with a small `supportsFileMentions(provider)` resolver; start with Claude only.

### 7. Rollout

Behind `EXPO_PUBLIC_FILE_MENTIONS=1` (same mechanism as slash commands) until verified on a physical iOS and Android device, then default-on for Claude sessions.

## Phase 2 — streamer (separate PR in `threadbase-streamer`)

Additive, so no mobile coordination is required; mobile probes and falls back to Phase 1.

1. `GET /api/sessions/:id/files?dir=<rel>` — lists relative to the session's own cwd. Fixes Windows and outside-root cwds, and stops mobile from shipping absolute paths. Must still enforce `browseRoot` containment (or an explicit decision to allow the session's cwd, which the agent can already read) and the `fs:browse` capability.
2. `GET /api/sessions/:id/files/search?q=<fuzzy>` — recursive fuzzy match honouring `.gitignore` (`git ls-files` when it's a repo, bounded walk otherwise), capped result count and a time budget. Enables `@Composer` → `components/conversation/ChatComposer.tsx` without drilling.
3. Optional `limit` on `/api/browse` and a `truncated` flag — a `node_modules` listing is unbounded today.
4. Advertise both in `GET /api/info` capabilities; mobile treats absence as "off".

File the streamer half as its own issue, linked to the mobile one, per the cross-repo issue rule.

## Testing

- Unit: `findMentionToken` (start/middle/end of text, emails, escaped spaces, `..`, multiple `@`), filtering/ranking, escape round-trip.
- Integration (`__tests__/integration/components/`): `ChatComposer.mention.test.tsx` — typing `@` shows the panel, filtering, drill into a directory, selecting a file inserts at cursor with surrounding text intact, works in the expanded editor, unsupported/older-server (`files` absent) degrade. Mock `/api/browse` the way `BrowseFiles.test.tsx` does.
- Run `SessionScreen.*` suites with `--runInBand` before calling any batch failure real.
- Maestro: `e2e/composer-mentions.yaml` using testIDs (`file-mention-board`, `file-mention-row-<name>`); `e2e/mock-server.js` already serves `/api/browse` (line 522) — extend fixtures with a nested tree. Add it to `test:e2e:mock`. Avoid `hideKeyboard` on iOS 26.

## Work breakdown

1. `lib/mentionToken.ts` + unit tests (shared `escapePath`).
2. Cursor tracking in `ChatComposer` / `useComposerState`.
3. `useMentionEntries` + path translation + degrade states.
4. `FileMentionBoard` + story + i18n keys (4 locales).
5. Wire into both composer layouts; insertion and drill-down.
6. Integration tests, Maestro flow, flag.
7. Device verification (iOS + Android, Claude; then Codex/Cursor runner check).
8. Streamer Phase 2 PR, then mobile switch-over behind the capability probe.

## Open questions

- Should a mentioned file also appear as a chip (like attachments) rather than inline text? Inline text is simpler and editable; chips are clearer on a phone. Proposal: inline for v1.
- Should the panel offer recent/frequently-mentioned files when the query is empty?
- Should the cwd-vs-`browseRoot` containment in Phase 2 follow the root strictly, or trust the session cwd?
