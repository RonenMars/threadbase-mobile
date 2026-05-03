# Session Naming — Design Spec

**Date:** 2026-05-02
**Status:** Approved

---

## Context

Sessions are currently labeled by `projectName` — the folder name chosen at session start. This causes two problems:

1. Multiple sessions for the same project look identical, making them hard to tell apart
2. Folder names are too generic/technical and don't describe what a session is actually doing

This feature adds a dedicated `name` field to sessions with four touchpoints for setting it, local + server persistence, and user-configurable prompting behaviour.

---

## Architecture

### Storage

**Client:** Zustand store (`sessionNamesStore`) keyed by `serverId::sessionId`. Persisted to SecureStore (session names are considered sensitive — they can reveal what the user is working on). Key: `"session_names"`.

**Server:** New `session_names` table in the streamer's existing `cache.db` (better-sqlite3, same file as `ConversationCache`):

```sql
CREATE TABLE IF NOT EXISTS session_names (
  session_id  TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  updated_at  INTEGER NOT NULL
);
```

**Streamer endpoints (new):**
- `PATCH /api/sessions/:id/name` — `{ name: string }` — upsert name
- `GET /api/sessions/names` — returns `{ [sessionId]: string }` map for all sessions on that server

### Zustand Store Shape

```ts
interface SessionNamesStore {
  names: Record<string, string>           // key: "serverId::sessionId"
  nameOrigin: Record<string, 'manual' | 'auto' | 'ai'>
  setName(serverId: string, sessionId: string, name: string, origin: 'manual' | 'auto' | 'ai'): void
  getName(serverId: string, sessionId: string): string | undefined
  getOrigin(serverId: string, sessionId: string): 'manual' | 'auto' | 'ai' | undefined
}
```

### Sync Flow (Rename)

1. User saves name → `setName()` → instant UI update (optimistic)
2. Zustand persist middleware → SecureStore (debounced ~300ms)
3. React Query mutation → `PATCH /api/sessions/:id/name` (background)
4. On error → rollback Zustand to previous name, show inline error

### Hydration on App Launch

1. **Instant (local):** Read SecureStore `"session_names"` → populate Zustand. Sessions render with names immediately, no flicker.
2. **Background sync (on connect):** `GET /api/sessions/names` → merge into Zustand. Server wins on conflict (newer `updated_at`).

---

## Four Naming Touchpoints

### 1. Session Creation Modal

Shown immediately after tapping "Start Session Here" in the browse screen.

- Text input with placeholder "e.g. Fix auth bug"
- Buttons: **Skip** (left) | **Start** (right, primary)
- Checkbox: "Don't ask me again"
- Checking "Don't ask me again" sets `askOnCreate: false` in settings and also suppresses the on-exit prompt (`askOnExit` is suppressed when `askOnCreate` is false)
- If skipped or dismissed, session starts without a name

### 2. Auto-name from First Message (silent)

Triggered when: the first message is sent in a session that has no name yet, and `autoNameFromMessage` setting is enabled.

Transform: `text.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 20)`

Example: `"Fix the broken auth flow in login screen"` → `"fix-the-broken-aut"`

- Happens silently — no toast, no prompt
- Sets name origin as `'auto'`
- Auto-named sessions still trigger the on-exit prompt (origin is not `'manual'`)
- Configurable via Settings toggle (default: on)

### 3. Inline Rename (Pencil Icon)

Pencil icon displayed next to the session title in the session detail screen header.

- Tap pencil → bottom sheet with name text input
- Pre-filled with current name
- Save sets origin to `'manual'`; cancelling makes no change
- Available at any time during or after the session

### 4. On-Exit Prompt

Shown when the user taps Back from the session detail screen, only when ALL of the following are true:
- The session name origin is NOT `'manual'` (i.e. never explicitly named by the user)
- `askOnExit` is `true` (not set to false via the on-exit "Don't ask me again" checkbox)
- `askOnCreate` is `true` (checking "Don't ask me again" at creation suppresses both creation and exit prompts)

UI:
- Shows current auto-generated name as a hint: `Current: "fix-the-broken-aut"`
- Text input for new name
- Buttons: **Leave as is** (left) | **Save** (right, primary)
- Checkbox: "Don't ask me again" — sets `askOnExit: false`

---

## Settings — Session Naming Section

New section added to the existing Settings screen. Four toggles (three default on, AI-generated names defaults off):

| Setting | Key | Default | Description |
|---|---|---|---|
| Ask for name on session start | `askOnCreate` | `true` | Show naming prompt at session creation |
| Ask for name on exit | `askOnExit` | `true` | Show naming prompt on back navigation (suppressed if `askOnCreate` is false) |
| Auto-name from first message | `autoNameFromMessage` | `true` | Silently set name from first ~40 chars of first message. Info note: no AI, no tokens. |
| AI-generated session names | `aiGeneratedNames` | `false` | Use AI model to generate name after a few exchanges. Warning note: uses tokens from configured API key. |

Settings stored in existing app settings store (not SecureStore — these are preferences, not sensitive).

### AI-Generated Names

When `aiGeneratedNames` is enabled and an AI API key is configured:
- After N exchanges (TBD at implementation — suggest 3), trigger a short AI call to generate a concise session name
- Only fires if name origin is not `'manual'`
- Result replaces the auto-name (if any), sets origin to `'ai'`
- If no API key is configured, toggle is shown but disabled with a note to configure an API key first

---

## Files to Create / Modify

### Mobile (tb-mobile)

| File | Change |
|---|---|
| `stores/sessionNames.ts` | New Zustand store with SecureStore persistence |
| `hooks/useSessionName.ts` | React Query hooks: `useRenameSession`, `useFetchSessionNames` |
| `components/sessions/RenameSessionSheet.tsx` | Bottom sheet for inline rename (pencil icon) |
| `components/sessions/NameSessionModal.tsx` | Modal for creation + exit prompts (shared component, `mode: 'create' | 'exit'`) |
| `app/session/[id].tsx` | Add pencil icon to header, wire on-exit prompt to back navigation |
| `app/browse.tsx` | Show `NameSessionModal` after session start |
| `app/settings.tsx` | Add Session Naming section with 4 toggles |
| `stores/settings.ts` | Add `askOnCreate`, `askOnExit`, `autoNameFromMessage`, `aiGeneratedNames` fields |
| `types/api.ts` | No change — name is client-managed, not part of the `Session` type from server |

### Streamer (tb-streamer)

| File | Change |
|---|---|
| `src/conversation-cache.ts` | Add `session_names` table to schema + prepared statements |
| `src/server.ts` | Add `PATCH /api/sessions/:id/name` and `GET /api/sessions/names` endpoints |

---

## Verification

1. **Creation prompt:** Start a new session → modal appears → enter name → confirm it shows in SessionCard and detail header
2. **Skip creation:** Start session, skip naming → no name shown → first message sent → name auto-populates silently from message text
3. **Inline rename:** Open session → tap pencil → enter new name → save → header updates immediately
4. **On-exit prompt:** Open unnamed session, send no messages, tap Back → prompt appears → name it → confirm SessionCard shows new name
5. **Don't ask again:** Check "Don't ask me again" on creation modal → start another session → no modal shown, and no on-exit prompt either
6. **Server sync:** Rename session → kill and reinstall app → session name persists (served from streamer DB via hydration)
7. **Settings toggles:** Disable "Auto-name from first message" → send first message → name does NOT auto-populate
8. **Offline:** Rename session with no server connection → name updates locally → reconnect → streamer DB reflects the rename
