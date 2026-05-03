# Session Naming Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add user-visible names to sessions via four touchpoints (creation modal, auto-name from first message, inline rename, on-exit prompt) with Zustand + SecureStore on the client synced to SQLite on the streamer.

**Architecture:** A new `sessionNamesStore` (Zustand + SecureStore) holds names keyed by `serverId::sessionId`, hydrated from SecureStore on launch and background-synced from the streamer's new `session_names` SQLite table. Rename is optimistic — Zustand updates immediately, a React Query mutation syncs to the streamer in the background. A shared `NameSessionModal` handles both the creation and exit prompts. Four new settings flags (`askOnCreate`, `askOnExit`, `autoNameFromMessage`, `aiGeneratedNames`) control which touchpoints fire.

**Tech Stack:** React Native / Expo, Zustand, expo-secure-store, @tanstack/react-query, @gorhom/bottom-sheet, better-sqlite3 (streamer), Node.js HTTP server (streamer), Vitest (streamer tests), Jest (mobile tests)

---

## File Map

### Mobile (tb-mobile) — new files
- `stores/sessionNames.ts` — Zustand store: names + origins, SecureStore persistence, hydrate()
- `hooks/useSessionName.ts` — React Query: useRenameSession mutation, useFetchSessionNames query
- `components/sessions/NameSessionModal.tsx` — shared modal for creation + exit prompts
- `components/sessions/RenameSessionSheet.tsx` — @gorhom/bottom-sheet inline rename

### Mobile — modified files
- `stores/settings.ts` — add 4 new boolean flags + setters + persist them
- `app/browse.tsx` — show NameSessionModal after session starts
- `app/session/[id].tsx` — show pencil icon in header, show NameSessionModal on back press
- `app/settings.tsx` — add Session Naming section with 4 toggles

### Streamer (tb-streamer) — modified files
- `src/conversation-cache.ts` — add `session_names` table, prepared statements, and public methods
- `src/server.ts` — add `PATCH /api/sessions/:id/name` and `GET /api/sessions/names` endpoints

### Tests
- `__tests__/unit/stores/sessionNames.test.ts` — store unit tests
- `__tests__/unit/stores/settings-naming.test.ts` — new settings flags
- `__tests__/streamer/sessionNames.test.ts` (vitest) — streamer DB + endpoint tests

---

## Task 1: Add session_names table and methods to streamer

**Files:**
- Modify: `src/conversation-cache.ts`

- [ ] **Step 1: Add the table to SCHEMA**

Open `src/conversation-cache.ts`. The `SCHEMA` const ends around line 113. Append after the existing `CREATE INDEX` lines:

Append the following SQL block at the end of the existing `SCHEMA` string, before the closing backtick:

```sql
CREATE TABLE IF NOT EXISTS session_names (
  session_id  TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  updated_at  INTEGER NOT NULL
);
```

Do not touch the existing table definitions — only add the new block.

- [ ] **Step 2: Add prepared statements to the stmts object**

In the `private stmts` interface (around line 124), add two new entries:

```typescript
private stmts: {
  // ... existing entries ...
  upsertSessionName: Database.Statement;
  getSessionName: Database.Statement;
  listSessionNames: Database.Statement;
}
```

In the constructor (around line 142), initialize them:

```typescript
upsertSessionName: db.prepare(`
  INSERT INTO session_names (session_id, name, updated_at)
  VALUES (?, ?, ?)
  ON CONFLICT(session_id) DO UPDATE SET
    name       = excluded.name,
    updated_at = excluded.updated_at
  WHERE session_names.updated_at < excluded.updated_at
`),
getSessionName: db.prepare(
  "SELECT name FROM session_names WHERE session_id = ?"
),
listSessionNames: db.prepare(
  "SELECT session_id, name FROM session_names"
),
```

- [ ] **Step 3: Add public methods**

Add three public methods to the `ConversationCache` class after the existing public methods:

```typescript
upsertSessionName(sessionId: string, name: string): void {
  this.stmts.upsertSessionName.run(sessionId, name, Date.now());
}

getSessionName(sessionId: string): string | null {
  const row = this.stmts.getSessionName.get(sessionId) as { name: string } | undefined;
  return row?.name ?? null;
}

listSessionNames(): Record<string, string> {
  const rows = this.stmts.listSessionNames.all() as { session_id: string; name: string }[];
  return Object.fromEntries(rows.map((r) => [r.session_id, r.name]));
}
```

- [ ] **Step 4: Write a vitest test**

Create `__tests__/streamer/sessionNames.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ConversationCache } from "../../src/conversation-cache";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

let tmpDir: string;
let cache: ConversationCache;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "tb-test-"));
  cache = ConversationCache.open(join(tmpDir, "cache.db"));
});

afterEach(() => {
  cache.close();
  rmSync(tmpDir, { recursive: true });
});

describe("session_names", () => {
  it("returns null for unknown session", () => {
    expect(cache.getSessionName("unknown")).toBeNull();
  });

  it("upserts and retrieves a name", () => {
    cache.upsertSessionName("sess_1", "fix-auth-bug");
    expect(cache.getSessionName("sess_1")).toBe("fix-auth-bug");
  });

  it("updates existing name when newer", () => {
    cache.upsertSessionName("sess_1", "old-name");
    // wait 1ms so updated_at differs
    cache.upsertSessionName("sess_1", "new-name");
    expect(cache.getSessionName("sess_1")).toBe("new-name");
  });

  it("listSessionNames returns all names", () => {
    cache.upsertSessionName("sess_1", "name-one");
    cache.upsertSessionName("sess_2", "name-two");
    const names = cache.listSessionNames();
    expect(names).toEqual({ sess_1: "name-one", sess_2: "name-two" });
  });
});
```

- [ ] **Step 5: Run the test**

```bash
cd /path/to/tb-streamer && npx vitest run __tests__/streamer/sessionNames.test.ts
```

Expected: 4 passing tests.

- [ ] **Step 6: Commit**

```bash
git add src/conversation-cache.ts __tests__/streamer/sessionNames.test.ts
git commit -m "feat(streamer): add session_names table and ConversationCache methods"
```

---

## Task 2: Add streamer API endpoints

**Files:**
- Modify: `src/server.ts`

- [ ] **Step 1: Add PATCH /api/sessions/:id/name route**

In `server.ts`, find the route dispatch block (around line 390). Add after the cancel route:

```typescript
const nameMatch = path.match(/^\/api\/sessions\/([^/]+)\/name$/);
if (method === "PATCH" && nameMatch) return this.handleSetSessionName(nameMatch[1], req, res);
```

- [ ] **Step 2: Add GET /api/sessions/names route**

In the same dispatch block, before the generic sessions list route, add:

```typescript
if (method === "GET" && path === "/api/sessions/names") {
  return this.handleGetSessionNames(res);
}
```

- [ ] **Step 3: Add handler methods**

Add two private handler methods to the server class:

```typescript
private async handleSetSessionName(
  sessionId: string,
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  if (!this.cache) {
    json(res, 503, { error: "Cache not available" });
    return;
  }
  const body = await readBody(req);
  let parsed: { name?: string };
  try {
    parsed = JSON.parse(body);
  } catch {
    json(res, 400, { error: "Invalid JSON" });
    return;
  }
  const name = parsed.name?.trim();
  if (!name) {
    json(res, 400, { error: "name is required" });
    return;
  }
  this.cache.upsertSessionName(sessionId, name);
  json(res, 200, { ok: true });
}

private handleGetSessionNames(res: ServerResponse): void {
  if (!this.cache) {
    json(res, 200, {});
    return;
  }
  json(res, 200, this.cache.listSessionNames());
}
```

- [ ] **Step 4: Check that `readBody` exists**

Search `server.ts` for `readBody`. If it doesn't exist as a standalone function, find how the server reads request bodies (look for `req.on('data')`). Add a helper if needed:

```typescript
function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => { data += chunk; });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}
```

- [ ] **Step 5: Run existing streamer tests to confirm no regression**

```bash
cd /path/to/tb-streamer && npx vitest run
```

Expected: all existing tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/server.ts
git commit -m "feat(streamer): add PATCH /api/sessions/:id/name and GET /api/sessions/names"
```

---

## Task 3: sessionNamesStore (mobile)

**Files:**
- Create: `stores/sessionNames.ts`
- Create: `__tests__/unit/stores/sessionNames.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/unit/stores/sessionNames.test.ts`:

```typescript
import { useSessionNamesStore } from '@/stores/sessionNames'

beforeEach(() => {
  useSessionNamesStore.setState({ names: {}, nameOrigins: {} })
})

describe('sessionNamesStore – getName/setName', () => {
  it('returns undefined for unknown session', () => {
    expect(useSessionNamesStore.getState().getName('srv1', 'sess1')).toBeUndefined()
  })

  it('stores and retrieves a name', () => {
    useSessionNamesStore.getState().setName('srv1', 'sess1', 'fix-auth', 'manual')
    expect(useSessionNamesStore.getState().getName('srv1', 'sess1')).toBe('fix-auth')
  })

  it('stores origin alongside name', () => {
    useSessionNamesStore.getState().setName('srv1', 'sess1', 'fix-auth', 'auto')
    expect(useSessionNamesStore.getState().getOrigin('srv1', 'sess1')).toBe('auto')
  })

  it('overwrites existing name', () => {
    useSessionNamesStore.getState().setName('srv1', 'sess1', 'old', 'auto')
    useSessionNamesStore.getState().setName('srv1', 'sess1', 'new', 'manual')
    expect(useSessionNamesStore.getState().getName('srv1', 'sess1')).toBe('new')
    expect(useSessionNamesStore.getState().getOrigin('srv1', 'sess1')).toBe('manual')
  })

  it('mergeFromServer does not overwrite manual names', () => {
    useSessionNamesStore.getState().setName('srv1', 'sess1', 'my-name', 'manual')
    useSessionNamesStore.getState().mergeFromServer('srv1', { sess1: 'server-name' })
    expect(useSessionNamesStore.getState().getName('srv1', 'sess1')).toBe('my-name')
  })

  it('mergeFromServer fills in missing names', () => {
    useSessionNamesStore.getState().mergeFromServer('srv1', { sess1: 'server-name' })
    expect(useSessionNamesStore.getState().getName('srv1', 'sess1')).toBe('server-name')
    expect(useSessionNamesStore.getState().getOrigin('srv1', 'sess1')).toBe('auto')
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx jest __tests__/unit/stores/sessionNames.test.ts
```

Expected: FAIL — "Cannot find module '@/stores/sessionNames'"

- [ ] **Step 3: Create the store**

Create `stores/sessionNames.ts`:

```typescript
import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'

const SECURE_KEY = 'threadbase_session_names'

type NameOrigin = 'manual' | 'auto' | 'ai'

function sessionKey(serverId: string, sessionId: string): string {
  return `${serverId}::${sessionId}`
}

interface SessionNamesStore {
  names: Record<string, string>
  nameOrigins: Record<string, NameOrigin>
  getName: (serverId: string, sessionId: string) => string | undefined
  getOrigin: (serverId: string, sessionId: string) => NameOrigin | undefined
  setName: (serverId: string, sessionId: string, name: string, origin: NameOrigin) => void
  mergeFromServer: (serverId: string, serverNames: Record<string, string>) => void
  hydrate: () => Promise<void>
}

export const useSessionNamesStore = create<SessionNamesStore>((set, get) => ({
  names: {},
  nameOrigins: {},

  getName: (serverId, sessionId) => get().names[sessionKey(serverId, sessionId)],

  getOrigin: (serverId, sessionId) => get().nameOrigins[sessionKey(serverId, sessionId)],

  setName: (serverId, sessionId, name, origin) => {
    const key = sessionKey(serverId, sessionId)
    const names = { ...get().names, [key]: name }
    const nameOrigins = { ...get().nameOrigins, [key]: origin }
    set({ names, nameOrigins })
    void SecureStore.setItemAsync(SECURE_KEY, JSON.stringify({ names, nameOrigins }))
  },

  mergeFromServer: (serverId, serverNames) => {
    const { names, nameOrigins } = get()
    const merged = { ...names }
    const mergedOrigins = { ...nameOrigins }
    for (const [sessionId, name] of Object.entries(serverNames)) {
      const key = sessionKey(serverId, sessionId)
      if (mergedOrigins[key] !== 'manual') {
        merged[key] = name
        mergedOrigins[key] = mergedOrigins[key] ?? 'auto'
      }
    }
    set({ names: merged, nameOrigins: mergedOrigins })
    void SecureStore.setItemAsync(SECURE_KEY, JSON.stringify({ names: merged, nameOrigins: mergedOrigins }))
  },

  hydrate: async () => {
    const raw = await SecureStore.getItemAsync(SECURE_KEY)
    if (!raw) return
    try {
      const parsed = JSON.parse(raw) as { names: Record<string, string>; nameOrigins: Record<string, NameOrigin> }
      set({ names: parsed.names ?? {}, nameOrigins: parsed.nameOrigins ?? {} })
    } catch {
      // corrupted — ignore
    }
  },
}))
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
npx jest __tests__/unit/stores/sessionNames.test.ts
```

Expected: 6 passing tests.

- [ ] **Step 5: Commit**

```bash
git add stores/sessionNames.ts __tests__/unit/stores/sessionNames.test.ts
git commit -m "feat: add sessionNamesStore with SecureStore persistence"
```

---

## Task 4: Add naming settings flags

**Files:**
- Modify: `stores/settings.ts`
- Create: `__tests__/unit/stores/settings-naming.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/unit/stores/settings-naming.test.ts`:

```typescript
import { useSettingsStore } from '@/stores/settings'

beforeEach(() => {
  useSettingsStore.setState({
    askOnCreate: true,
    askOnExit: true,
    autoNameFromMessage: true,
    aiGeneratedNames: false,
  } as any)
})

describe('SettingsStore – session naming flags', () => {
  it('askOnCreate defaults to true', () => {
    expect(useSettingsStore.getState().askOnCreate).toBe(true)
  })

  it('askOnExit defaults to true', () => {
    expect(useSettingsStore.getState().askOnExit).toBe(true)
  })

  it('autoNameFromMessage defaults to true', () => {
    expect(useSettingsStore.getState().autoNameFromMessage).toBe(true)
  })

  it('aiGeneratedNames defaults to false', () => {
    expect(useSettingsStore.getState().aiGeneratedNames).toBe(false)
  })

  it('setAskOnCreate updates flag', () => {
    useSettingsStore.getState().setAskOnCreate(false)
    expect(useSettingsStore.getState().askOnCreate).toBe(false)
  })

  it('setAskOnExit updates flag', () => {
    useSettingsStore.getState().setAskOnExit(false)
    expect(useSettingsStore.getState().askOnExit).toBe(false)
  })

  it('setAutoNameFromMessage updates flag', () => {
    useSettingsStore.getState().setAutoNameFromMessage(false)
    expect(useSettingsStore.getState().autoNameFromMessage).toBe(false)
  })

  it('setAiGeneratedNames updates flag', () => {
    useSettingsStore.getState().setAiGeneratedNames(true)
    expect(useSettingsStore.getState().aiGeneratedNames).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx jest __tests__/unit/stores/settings-naming.test.ts
```

Expected: FAIL — properties don't exist yet.

- [ ] **Step 3: Add flags to SettingsStore**

In `stores/settings.ts`, add to the `SettingsStore` interface:

```typescript
askOnCreate: boolean
askOnExit: boolean
autoNameFromMessage: boolean
aiGeneratedNames: boolean
setAskOnCreate: (v: boolean) => void
setAskOnExit: (v: boolean) => void
setAutoNameFromMessage: (v: boolean) => void
setAiGeneratedNames: (v: boolean) => void
```

Add to `PersistedSettings` interface:

```typescript
askOnCreate: boolean
askOnExit: boolean
autoNameFromMessage: boolean
aiGeneratedNames: boolean
```

Add default values in the `create()` call:

```typescript
askOnCreate: true,
askOnExit: true,
autoNameFromMessage: true,
aiGeneratedNames: false,
```

Add setters in the `create()` call:

```typescript
setAskOnCreate: (askOnCreate) => set({ askOnCreate }),
setAskOnExit: (askOnExit) => set({ askOnExit }),
setAutoNameFromMessage: (autoNameFromMessage) => set({ autoNameFromMessage }),
setAiGeneratedNames: (aiGeneratedNames) => set({ aiGeneratedNames }),
```

Add to the `subscribe` payload object:

```typescript
askOnCreate: state.askOnCreate,
askOnExit: state.askOnExit,
autoNameFromMessage: state.autoNameFromMessage,
aiGeneratedNames: state.aiGeneratedNames,
```

Add to `hydrate()` in the `set()` call:

```typescript
askOnCreate: parsed.askOnCreate ?? state.askOnCreate,
askOnExit: parsed.askOnExit ?? state.askOnExit,
autoNameFromMessage: parsed.autoNameFromMessage ?? state.autoNameFromMessage,
aiGeneratedNames: parsed.aiGeneratedNames ?? state.aiGeneratedNames,
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
npx jest __tests__/unit/stores/settings-naming.test.ts
```

Expected: 8 passing tests.

- [ ] **Step 5: Commit**

```bash
git add stores/settings.ts __tests__/unit/stores/settings-naming.test.ts
git commit -m "feat: add session naming settings flags to SettingsStore"
```

---

## Task 5: useSessionName React Query hook

**Files:**
- Create: `hooks/useSessionName.ts`

- [ ] **Step 1: Create the hook file**

Create `hooks/useSessionName.ts`:

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createApiForServer } from '@/services/api-client'
import { useSessionNamesStore } from '@/stores/sessionNames'

export function useRenameSession(serverId: string) {
  const { setName, getName, getOrigin } = useSessionNamesStore()

  return useMutation<void, Error, { sessionId: string; name: string }>({
    mutationFn: async ({ sessionId, name }) => {
      const api = createApiForServer(serverId)
      await api.patch(`/api/sessions/${sessionId}/name`, { name })
    },
    onMutate: ({ sessionId, name }) => {
      const prevName = getName(serverId, sessionId)
      const prevOrigin = getOrigin(serverId, sessionId)
      setName(serverId, sessionId, name, 'manual')
      return { prevName, prevOrigin }
    },
    onError: (_err, { sessionId }, context) => {
      const ctx = context as { prevName?: string; prevOrigin?: 'manual' | 'auto' | 'ai' } | undefined
      if (ctx?.prevName !== undefined) {
        setName(serverId, sessionId, ctx.prevName, ctx.prevOrigin ?? 'auto')
      }
    },
  })
}

export function useFetchSessionNames(serverId: string) {
  const { mergeFromServer } = useSessionNamesStore()

  return useQuery({
    queryKey: ['sessionNames', serverId],
    queryFn: async () => {
      const api = createApiForServer(serverId)
      const data = await api.get<Record<string, string>>('/api/sessions/names')
      mergeFromServer(serverId, data)
      return data
    },
    staleTime: 60_000,
  })
}
```

- [ ] **Step 2: Check `api.patch` exists on the API client**

Open `services/api-client.ts` and confirm a `patch` method exists on `ServerApi`. If it only has `get`, `post`, `delete`, add:

```typescript
patch: <T>(path: string, body?: unknown) => Promise<T>
```

and implement it the same way as `post` but with method `'PATCH'`.

- [ ] **Step 3: Commit**

```bash
git add hooks/useSessionName.ts services/api-client.ts
git commit -m "feat: add useRenameSession and useFetchSessionNames hooks"
```

---

## Task 6: NameSessionModal component

**Files:**
- Create: `components/sessions/NameSessionModal.tsx`

- [ ] **Step 1: Create the component**

Create `components/sessions/NameSessionModal.tsx`:

```typescript
import React, { useState } from 'react'
import { Modal, View, Text, TextInput, Pressable, StyleSheet, CheckBox } from 'react-native'
import { dark } from '@/theme'
import { spacing } from '@/theme'

interface Props {
  visible: boolean
  mode: 'create' | 'exit'
  currentName?: string
  onSave: (name: string) => void
  onSkip: () => void
  onDontAskAgain: () => void
}

export function NameSessionModal({ visible, mode, currentName, onSave, onSkip, onDontAskAgain }: Props) {
  const [name, setName] = useState(currentName ?? '')
  const [dontAsk, setDontAsk] = useState(false)

  function handleSave() {
    if (dontAsk) onDontAskAgain()
    onSave(name.trim())
  }

  function handleSkip() {
    if (dontAsk) onDontAskAgain()
    onSkip()
  }

  const title = mode === 'create' ? 'Name this session?' : 'Name this session before you go?'
  const skipLabel = mode === 'create' ? 'Skip' : 'Leave as is'
  const saveLabel = mode === 'create' ? 'Start' : 'Save'

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          {mode === 'exit' && currentName ? (
            <Text style={styles.hint}>Current: "{currentName}"</Text>
          ) : null}
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Fix auth bug"
            placeholderTextColor={dark.text.tertiary}
            autoFocus
          />
          <View style={styles.buttonRow}>
            <Pressable style={[styles.button, styles.secondary]} onPress={handleSkip}>
              <Text style={styles.secondaryLabel}>{skipLabel}</Text>
            </Pressable>
            <Pressable style={[styles.button, styles.primary]} onPress={handleSave}>
              <Text style={styles.primaryLabel}>{saveLabel}</Text>
            </Pressable>
          </View>
          <Pressable style={styles.checkRow} onPress={() => setDontAsk((v) => !v)}>
            <View style={[styles.checkbox, dontAsk && styles.checkboxChecked]} />
            <Text style={styles.checkLabel}>Don't ask me again</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    backgroundColor: dark.surface.card,
    borderRadius: 12,
    padding: spacing.lg,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: dark.text.primary,
    marginBottom: spacing.sm,
  },
  hint: {
    fontSize: 13,
    color: dark.text.tertiary,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: dark.surface.input ?? dark.surface.secondary,
    borderRadius: 8,
    padding: spacing.sm,
    color: dark.text.primary,
    fontSize: 15,
    borderWidth: 1,
    borderColor: dark.border.default,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  button: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    alignItems: 'center',
  },
  primary: { backgroundColor: dark.accent.primary ?? '#007AFF' },
  secondary: { backgroundColor: dark.surface.secondary },
  primaryLabel: { color: '#fff', fontWeight: '600', fontSize: 15 },
  secondaryLabel: { color: dark.text.secondary, fontSize: 15 },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: dark.border.default,
  },
  checkboxChecked: {
    backgroundColor: dark.accent.primary ?? '#007AFF',
    borderColor: dark.accent.primary ?? '#007AFF',
  },
  checkLabel: { fontSize: 13, color: dark.text.tertiary },
})
```

> **Note:** Check your project's theme tokens. Replace `dark.surface.input`, `dark.accent.primary`, `dark.border.default`, `dark.surface.secondary` with the actual token names used in the project (look at other components for reference). The theme object is in `theme/` or `constants/`.

- [ ] **Step 2: Commit**

```bash
git add components/sessions/NameSessionModal.tsx
git commit -m "feat: add NameSessionModal component (create + exit modes)"
```

---

## Task 7: RenameSessionSheet component

**Files:**
- Create: `components/sessions/RenameSessionSheet.tsx`

- [ ] **Step 1: Create the component**

Create `components/sessions/RenameSessionSheet.tsx` (follows the `PlanPreviewSheet` pattern at `components/queue/PlanPreviewSheet.tsx`):

```typescript
import React, { useRef, useState, useCallback } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import BottomSheet, { BottomSheetTextInput } from '@gorhom/bottom-sheet'
import { dark, spacing } from '@/theme'

interface Props {
  currentName: string
  onSave: (name: string) => void
  onClose: () => void
}

export function RenameSessionSheet({ currentName, onSave, onClose }: Props) {
  const sheetRef = useRef<BottomSheet>(null)
  const [name, setName] = useState(currentName)

  const snapPoints = ['35%']

  const handleSave = useCallback(() => {
    const trimmed = name.trim()
    if (trimmed) onSave(trimmed)
    sheetRef.current?.close()
  }, [name, onSave])

  return (
    <BottomSheet
      ref={sheetRef}
      snapPoints={snapPoints}
      enablePanDownToClose
      onClose={onClose}
      backgroundStyle={{ backgroundColor: dark.surface.card }}
      handleIndicatorStyle={{ backgroundColor: dark.border.default }}
      keyboardBehavior="interactive"
    >
      <View style={styles.container}>
        <Text style={styles.title}>Rename session</Text>
        <BottomSheetTextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Session name"
          placeholderTextColor={dark.text.tertiary}
          autoFocus
        />
        <View style={styles.row}>
          <Pressable style={[styles.btn, styles.secondary]} onPress={onClose}>
            <Text style={styles.secondaryLabel}>Cancel</Text>
          </Pressable>
          <Pressable style={[styles.btn, styles.primary]} onPress={handleSave}>
            <Text style={styles.primaryLabel}>Save</Text>
          </Pressable>
        </View>
      </View>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, flex: 1 },
  title: { fontSize: 16, fontWeight: '600', color: dark.text.primary, marginBottom: spacing.md },
  input: {
    backgroundColor: dark.surface.secondary,
    borderRadius: 8,
    padding: spacing.sm,
    color: dark.text.primary,
    fontSize: 15,
    borderWidth: 1,
    borderColor: dark.border.default,
  },
  row: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  btn: { flex: 1, paddingVertical: spacing.sm, borderRadius: 8, alignItems: 'center' },
  primary: { backgroundColor: dark.accent.primary ?? '#007AFF' },
  secondary: { backgroundColor: dark.surface.secondary },
  primaryLabel: { color: '#fff', fontWeight: '600', fontSize: 15 },
  secondaryLabel: { color: dark.text.secondary, fontSize: 15 },
})
```

- [ ] **Step 2: Commit**

```bash
git add components/sessions/RenameSessionSheet.tsx
git commit -m "feat: add RenameSessionSheet bottom sheet component"
```

---

## Task 8: Wire naming into browse.tsx (creation modal)

**Files:**
- Modify: `app/browse.tsx`

- [ ] **Step 1: Add state and modal to browse screen**

In `app/browse.tsx`, add these imports at the top:

```typescript
import { NameSessionModal } from '@/components/sessions/NameSessionModal'
import { useSessionNamesStore } from '@/stores/sessionNames'
import { useSettingsStore } from '@/stores/settings'
```

Add state inside the component (near other `useState` calls):

```typescript
const [pendingSession, setPendingSession] = useState<{ id: string; serverId: string } | null>(null)
const { setName } = useSessionNamesStore()
const { askOnCreate, setAskOnCreate, setAskOnExit } = useSettingsStore()
```

- [ ] **Step 2: Modify handleStartSession to show modal**

Replace the existing `handleStartSession` and `handleStartFromRecent` `onSuccess` callbacks. Instead of navigating immediately, store the created session and show the modal if `askOnCreate` is true:

```typescript
const handleStartSession = useCallback(() => {
  const displayName = currentPath ? currentPath.split('/').pop() : '~'
  startSession.mutate(
    { path: currentPath, projectName: displayName },
    {
      onSuccess: (session) => {
        if (askOnCreate) {
          setPendingSession({ id: session.id, serverId })
        } else {
          router.dismiss()
          router.push(`/session/${session.id}?server=${serverId}`)
        }
      },
      onError: (err) => {
        Alert.alert('Failed to start session', err.message)
      },
    },
  )
}, [currentPath, serverId, startSession, router, askOnCreate])
```

Apply the same `onSuccess` pattern to `handleStartFromRecent`.

- [ ] **Step 3: Add the modal to the JSX**

At the end of the returned JSX (before the closing tag), add:

```tsx
{pendingSession ? (
  <NameSessionModal
    visible
    mode="create"
    onSave={(name) => {
      setName(pendingSession.serverId, pendingSession.id, name, 'manual')
      setPendingSession(null)
      router.dismiss()
      router.push(`/session/${pendingSession.id}?server=${pendingSession.serverId}`)
    }}
    onSkip={() => {
      setPendingSession(null)
      router.dismiss()
      router.push(`/session/${pendingSession.id}?server=${pendingSession.serverId}`)
    }}
    onDontAskAgain={() => {
      setAskOnCreate(false)
      setAskOnExit(false)
    }}
  />
) : null}
```

- [ ] **Step 4: Commit**

```bash
git add app/browse.tsx
git commit -m "feat: show NameSessionModal after session creation in browse screen"
```

---

## Task 9: Wire naming into session/[id].tsx (pencil icon + on-exit modal + auto-name)

**Files:**
- Modify: `app/session/[id].tsx`

- [ ] **Step 1: Add imports and state**

Add imports:

```typescript
import { useSessionNamesStore } from '@/stores/sessionNames'
import { useSettingsStore } from '@/stores/settings'
import { useRenameSession } from '@/hooks/useSessionName'
import { RenameSessionSheet } from '@/components/sessions/RenameSessionSheet'
import { NameSessionModal } from '@/components/sessions/NameSessionModal'
import { PencilIcon } from 'lucide-react-native'
```

> Check which icon library the project uses — look at existing icon imports in this file (e.g. `InfoIcon`). Use the same library and find the pencil/edit icon name.

Add state inside the component:

```typescript
const { getName, getOrigin, setName } = useSessionNamesStore()
const { askOnExit, setAskOnExit, autoNameFromMessage } = useSettingsStore()
const renameSession = useRenameSession(serverId)
const [renameSheetVisible, setRenameSheetVisible] = useState(false)
const [exitModalVisible, setExitModalVisible] = useState(false)

const sessionName = getName(serverId, id) ?? session?.projectName
const sessionOrigin = getOrigin(serverId, id)
```

- [ ] **Step 2: Auto-name on first message**

Find the function that sends a message (look for `sendInput.mutate` or `handleSend`). Before the send call, add auto-naming logic:

```typescript
// Auto-name from first message if no manual name yet
if (autoNameFromMessage && sessionOrigin !== 'manual' && !getName(serverId, id)) {
  const autoName = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 20)
  setName(serverId, id, autoName, 'auto')
  renameSession.mutate({ sessionId: id, name: autoName })
}
```

- [ ] **Step 3: Add pencil icon to header**

Replace the existing `infoButton` JSX with a `right` prop that includes both pencil and info:

```tsx
const pencilButton = (
  <Pressable
    onPress={() => setRenameSheetVisible(true)}
    hitSlop={8}
    accessibilityLabel="Rename session"
    style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, marginRight: 8 })}
  >
    <PencilIcon size={18} color={dark.text.secondary} />
  </Pressable>
)

const headerRight = (
  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
    {pencilButton}
    {infoButton}
  </View>
)
```

Update `<ScreenHeader title={sessionName} right={headerRight} />`.

- [ ] **Step 4: Intercept back navigation for on-exit prompt**

Find where the back button is handled — either in `ScreenHeader` using `router.back()`, or via a hardware back listener. Add a custom back handler:

```typescript
const handleBack = useCallback(() => {
  if (askOnExit && sessionOrigin !== 'manual') {
    setExitModalVisible(true)
  } else {
    router.back()
  }
}, [askOnExit, sessionOrigin, router])
```

Pass `onBack={handleBack}` to `ScreenHeader` if it supports it, or check if `ScreenHeader` accepts a custom back press prop. If not, look at how `ScreenHeader` renders the back button and add a wrapper. Alternatively, use `useNavigation().addListener('beforeRemove', ...)` pattern from React Navigation.

- [ ] **Step 5: Add RenameSessionSheet and NameSessionModal to JSX**

At the end of the returned JSX (before closing `SafeAreaView`), add:

```tsx
{renameSheetVisible ? (
  <RenameSessionSheet
    currentName={sessionName ?? ''}
    onSave={(name) => {
      setName(serverId, id, name, 'manual')
      renameSession.mutate({ sessionId: id, name })
      setRenameSheetVisible(false)
    }}
    onClose={() => setRenameSheetVisible(false)}
  />
) : null}

{exitModalVisible ? (
  <NameSessionModal
    visible
    mode="exit"
    currentName={sessionName}
    onSave={(name) => {
      setName(serverId, id, name, 'manual')
      renameSession.mutate({ sessionId: id, name })
      setExitModalVisible(false)
      router.back()
    }}
    onSkip={() => {
      setExitModalVisible(false)
      router.back()
    }}
    onDontAskAgain={() => {
      setAskOnExit(false)
      setExitModalVisible(false)
      router.back()
    }}
  />
) : null}
```

- [ ] **Step 6: Commit**

```bash
git add "app/session/[id].tsx"
git commit -m "feat: add pencil rename, on-exit prompt, and auto-name to session screen"
```

---

## Task 10: Session name display in SessionCard and other list views

**Files:**
- Modify: `components/sessions/SessionCard.tsx`
- Modify: `components/sessions/tree/DrillView.tsx`

- [ ] **Step 1: Update SessionCard to show custom name**

In `components/sessions/SessionCard.tsx`, add the store import:

```typescript
import { useSessionNamesStore } from '@/stores/sessionNames'
```

In the component body, read the custom name:

```typescript
const customName = useSessionNamesStore((s) => s.getName(session.serverId, session.id))
const displayName = customName ?? session.projectName
```

Replace `session.projectName` with `displayName` in the card title render (around line 95).

- [ ] **Step 2: Update DrillView**

In `components/sessions/tree/DrillView.tsx` (around line 21), import the store and use `customName ?? s.projectName ?? s.projectPath` as the label.

- [ ] **Step 3: Commit**

```bash
git add components/sessions/SessionCard.tsx components/sessions/tree/DrillView.tsx
git commit -m "feat: show custom session name in SessionCard and DrillView"
```

---

## Task 11: Hydrate session names on app launch + background sync

**Files:**
- Modify: `app/_layout.tsx` (or wherever other stores are hydrated — check where `useDraftsStore().hydrate()` is called)

- [ ] **Step 1: Find where stores are hydrated**

```bash
grep -r "hydrate" /path/to/tb-mobile/app --include="*.tsx" -l
```

Open the file(s) found. It is likely `app/_layout.tsx` or a root provider component.

- [ ] **Step 2: Add sessionNames hydration**

In the same location as `useDraftsStore().hydrate()`, add:

```typescript
import { useSessionNamesStore } from '@/stores/sessionNames'

// inside the useEffect or init function:
void useSessionNamesStore.getState().hydrate()
```

- [ ] **Step 3: Add background sync for each server**

In the sessions list screen or layout that knows about active servers, import and call `useFetchSessionNames` for each connected server:

```typescript
import { useFetchSessionNames } from '@/hooks/useSessionName'

// For each serverId in the server list:
useFetchSessionNames(serverId)
```

Find where the sessions list fetches data (likely in `app/(tabs)/sessions.tsx` or the layout) and add the sync there.

- [ ] **Step 4: Commit**

```bash
git add app/_layout.tsx  # or whichever file was modified
git commit -m "feat: hydrate sessionNames store on launch and sync from server"
```

---

## Task 12: Settings UI — Session Naming section

**Files:**
- Modify: `app/settings.tsx`

- [ ] **Step 1: Add imports**

```typescript
import { useSettingsStore } from '@/stores/settings'
// Add these selectors alongside existing ones:
const {
  askOnCreate, setAskOnCreate,
  askOnExit, setAskOnExit,
  autoNameFromMessage, setAutoNameFromMessage,
  aiGeneratedNames, setAiGeneratedNames,
} = useSettingsStore()
```

- [ ] **Step 2: Add the Session Naming section to the settings JSX**

Find an existing section header + toggle row in `app/settings.tsx` to understand the exact component/style pattern used. Then add a new section following the same pattern. The section contains 4 rows:

**Row 1 — Ask for name on session start:**
```tsx
<SettingsRow
  title="Ask for name on session start"
  description="Show a prompt to name the session when you start a new one. You can always skip it."
  value={askOnCreate}
  onValueChange={setAskOnCreate}
/>
```

**Row 2 — Ask for name on exit:**
```tsx
<SettingsRow
  title="Ask for name on exit"
  description="Suggest naming the session when you leave it, if it hasn't been named yet."
  value={askOnExit}
  onValueChange={setAskOnExit}
/>
```

**Row 3 — Auto-name from first message (with info note):**
```tsx
<SettingsRow
  title="Auto-name from first message"
  description="Set the session name from the first words of your first message. Happens silently."
  note={{ type: 'info', text: 'Auto-naming reads the first ~40 characters of your message locally — no AI model is used and no tokens are consumed for this feature.' }}
  value={autoNameFromMessage}
  onValueChange={setAutoNameFromMessage}
/>
```

**Row 4 — AI-generated session names (with warning note):**
```tsx
<SettingsRow
  title="AI-generated session names"
  description="Use an AI model to generate a meaningful name based on your session content. Requires a configured AI API key."
  note={{ type: 'warning', text: 'AI-generated names use tokens from your configured AI API key. Each session name generation counts as a short API call.' }}
  value={aiGeneratedNames}
  onValueChange={setAiGeneratedNames}
/>
```

> **Note:** Check the exact component name and props for toggle rows in `app/settings.tsx`. If there's no `note` prop yet, add it to the row component (or render the note inline as a `<Text>` below the toggle row).

- [ ] **Step 3: Commit**

```bash
git add app/settings.tsx
git commit -m "feat: add Session Naming section to Settings screen"
```

---

## Task 13: Run full test suite and verify

- [ ] **Step 1: Run all mobile tests**

```bash
npx jest --testPathPattern="sessionNames|settings-naming"
```

Expected: all tests pass.

- [ ] **Step 2: Run all streamer tests**

```bash
cd /path/to/tb-streamer && npx vitest run
```

Expected: all tests pass including the new `sessionNames` suite.

- [ ] **Step 3: Manual smoke test checklist**

Boot the iOS simulator with `npm run ios`. Then verify:

1. Tap "Start Session Here" → NameSessionModal appears with Skip/Start buttons
2. Enter a name, tap Start → navigate to session, header shows the name
3. Tap Back → no on-exit prompt (name was manually set)
4. Start a second session, skip naming → send a message → header auto-updates to slugified message text
5. Tap Back from unnamed session → on-exit prompt appears
6. Check "Don't ask me again" on creation modal → start another session → no modal shown, no on-exit prompt
7. Open a session → tap pencil icon → RenameSessionSheet opens pre-filled → save → header updates
8. Open Settings → Session Naming section shows 4 toggles with notes
9. Disable "Auto-name from first message" → start session → send message → no auto-name
