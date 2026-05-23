> **Archived 2026-05-22.** This file has been moved to the archive. Active backlog/roadmap now lives in [`docs/BACKLOG.md`](../../../BACKLOG.md) and [`docs/ROADMAP.md`](../../../ROADMAP.md). The contents below are preserved verbatim for historical reference.

---

# Server List Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the server card's bottom "Remove" button with inline icon actions (Delete/Edit/Refresh), add error/edit modals, pull-to-refresh, and migrate all icons to `phosphor-react-native`.

**Architecture:** Add `phosphor-react-native` and replace all `Ionicons` usage across the app. Extend `ServerConfig` and the servers store with `connectionError`, `refreshServerInfo`, and `editServer`. Introduce two new modal components (`ServerErrorModal`, `ServerEditModal`) and wire them into the redesigned `ServerListCard` and `settings.tsx`.

**Tech Stack:** React Native 0.83.6, Expo SDK 55, Zustand, `phosphor-react-native`, `expo-secure-store`, existing `PairScannerModal`

---

## File Map

| File | Change |
|---|---|
| `package.json` | Add `phosphor-react-native` |
| `types/api.ts` | Add `connectionError: string \| null` to `ServerConfig`; add `connectionError?: string` to `PersistedServer` |
| `stores/servers.ts` | Update `PersistedServer`, `loadPersistedServers`, `persistServerList`, `addServer` (duplicate check); add `refreshServerInfo`, `editServer` |
| `__tests__/unit/stores/servers.test.ts` | New — unit tests for `addServer` duplicate check, `refreshServerInfo`, `editServer` |
| `app/_layout.tsx` | Replace `Ionicons` `chevron-back` → Phosphor `CaretLeft` |
| `app/session/[id].tsx` | Replace all `Ionicons` with Phosphor equivalents |
| `app/conversation/[id].tsx` | Replace `Ionicons` with Phosphor |
| `components/queue/PromptQueueSheet.tsx` | Replace `Ionicons` with Phosphor |
| `components/shared/InfoModal.tsx` | Replace `Ionicons` with Phosphor |
| `components/shared/SlashCommandArgModal.tsx` | Replace `Ionicons` with Phosphor |
| `components/shared/SlashCommandBoard.tsx` | Replace `Ionicons` with Phosphor |
| `components/servers/AddServerScreen.tsx` | Replace `Ionicons` `qr-code-outline` with Phosphor `QrCode`; remove label from scan button |
| `components/servers/ServerListCard.tsx` | Full redesign — inline icon actions, no bottom row |
| `components/servers/ServerErrorModal.tsx` | New — read-only error detail modal |
| `components/servers/ServerEditModal.tsx` | New — add/edit server modal with QR scan |
| `app/(tabs)/settings.tsx` | Add `RefreshControl`, wire modal state, pass new callbacks to `ServerListCard`, replace `+ Add Server` navigation with `ServerEditModal` |

---

## Task 1: Install phosphor-react-native

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the package**

```bash
cd /Users/ronenmars/Desktop/dev/ai-tools/tb-mobile
npx expo install phosphor-react-native
```

Expected: package added to `package.json` dependencies, no errors.

- [ ] **Step 2: Verify the install**

```bash
node -e "require('./node_modules/phosphor-react-native')" && echo "OK"
```

Expected: prints `OK`.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json yarn.lock bun.lockb 2>/dev/null; git add package.json
git commit -m "chore: add phosphor-react-native icon library"
```

---

## Task 2: Migrate Ionicons → Phosphor across the app

Replace every `Ionicons` usage with the Phosphor equivalent. The full mapping:

| Ionicons name | Phosphor component | Props |
|---|---|---|
| `chevron-back` | `CaretLeft` | `size={28} color={tintColor}` |
| `copy-outline` | `Copy` | `size={22} color={...}` |
| `information-circle-outline` | `Info` | `size={22} color={...}` |
| `image` | `Image` | `size={18} color={...}` |
| `close` | `X` | `size={20} color={...}` |
| `attach` | `Paperclip` | `size={22} color={...}` |
| `paper-plane` | `PaperPlaneRight` | `size={22} color={...}` |
| `qr-code-outline` | `QrCode` | `size={18} color={dark.text.accent}` |
| `terminal-outline` | `Terminal` | `size={16} color={...}` |
| `chevron-forward` | `CaretRight` | `size={16} color={...}` |

**Files:**
- Modify: `app/_layout.tsx`
- Modify: `app/session/[id].tsx`
- Modify: `app/conversation/[id].tsx`
- Modify: `components/queue/PromptQueueSheet.tsx`
- Modify: `components/shared/InfoModal.tsx`
- Modify: `components/shared/SlashCommandArgModal.tsx`
- Modify: `components/shared/SlashCommandBoard.tsx`
- Modify: `components/servers/AddServerScreen.tsx`

- [ ] **Step 1: Replace in `app/_layout.tsx`**

Change line 12:
```tsx
// Remove this line:
import { Ionicons } from '@expo/vector-icons'
```

Change line 187 area (the headerLeft option):
```tsx
// Before:
import { Ionicons } from '@expo/vector-icons'
// ...
headerLeft: ({ tintColor }) => (
  <TouchableOpacity onPress={() => router.back()} hitSlop={16} activeOpacity={1} style={{ paddingHorizontal: 4 }}>
    <Ionicons name="chevron-back" size={28} color={tintColor ?? '#e6edf3'} />
  </TouchableOpacity>
),

// After:
import { CaretLeft } from 'phosphor-react-native'
// ...
headerLeft: ({ tintColor }) => (
  <TouchableOpacity onPress={() => router.back()} hitSlop={16} activeOpacity={1} style={{ paddingHorizontal: 4 }}>
    <CaretLeft size={28} color={tintColor ?? '#e6edf3'} />
  </TouchableOpacity>
),
```

- [ ] **Step 2: Replace in `app/session/[id].tsx`**

Remove: `import { Ionicons } from '@expo/vector-icons'`

Add: `import { Copy, Info, Image as PhosphorImage, X, Paperclip, PaperPlaneRight } from 'phosphor-react-native'`

Replace each usage:
- `<Ionicons name="copy-outline" size={22} color={...} />` → `<Copy size={22} color={...} />`
- `<Ionicons name="information-circle-outline" size={22} color={...} />` → `<Info size={22} color={...} />`
- `<Ionicons name="image" size={18} color={...} />` → `<PhosphorImage size={18} color={...} />`
- `<Ionicons name="close" size={20} color={...} />` → `<X size={20} color={...} />`
- `<Ionicons name="attach" size={22} color={...} />` → `<Paperclip size={22} color={...} />`
- `<Ionicons name="paper-plane" size={22} color={...} />` → `<PaperPlaneRight size={22} color={...} />`

- [ ] **Step 3: Replace in `app/conversation/[id].tsx`**

Remove: `import { Ionicons } from '@expo/vector-icons'`

Add: `import { Info } from 'phosphor-react-native'`

Replace: `<Ionicons name="information-circle-outline" .../>` → `<Info size={22} color={...} />`

- [ ] **Step 4: Replace in `components/queue/PromptQueueSheet.tsx`**

Remove: `import { Ionicons } from '@expo/vector-icons'`

Add: `import { PaperPlaneRight } from 'phosphor-react-native'`

Replace: `<Ionicons name="paper-plane" .../>` → `<PaperPlaneRight size={22} color={...} />`

- [ ] **Step 5: Replace in `components/shared/InfoModal.tsx`**

Remove: `import { Ionicons } from '@expo/vector-icons'`

Add: `import { X } from 'phosphor-react-native'`

Replace: `<Ionicons name="close" .../>` → `<X size={20} color={...} />`

- [ ] **Step 6: Replace in `components/shared/SlashCommandArgModal.tsx`**

Remove: `import { Ionicons } from '@expo/vector-icons'`

Add: `import { X, PaperPlaneRight } from 'phosphor-react-native'`

Replace:
- `<Ionicons name="close" .../>` → `<X size={20} color={...} />`
- `<Ionicons name="paper-plane" .../>` → `<PaperPlaneRight size={22} color={...} />`

- [ ] **Step 7: Replace in `components/shared/SlashCommandBoard.tsx`**

Remove: `import { Ionicons } from '@expo/vector-icons'`

Add: `import { Terminal, CaretRight } from 'phosphor-react-native'`

Replace:
- `<Ionicons name="terminal-outline" .../>` → `<Terminal size={16} color={...} />`
- `<Ionicons name="chevron-forward" .../>` → `<CaretRight size={16} color={...} />`

- [ ] **Step 8: Replace in `components/servers/AddServerScreen.tsx`**

Remove: `import { Ionicons } from '@expo/vector-icons'`

Add: `import { QrCode } from 'phosphor-react-native'`

Replace the scan QR button — also remove the text label per spec (icon only):
```tsx
// Before:
<Ionicons name="qr-code-outline" size={18} color={dark.text.accent} />
<Text style={styles.scanQrText}>Scan QR</Text>

// After:
<QrCode size={18} color={dark.text.accent} />
```

Remove the `scanQrText` style and its `Text` element.

- [ ] **Step 9: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -40
```

Expected: no errors related to Ionicons or Phosphor.

- [ ] **Step 10: Commit**

```bash
git add app/_layout.tsx app/session/[id].tsx app/conversation/[id].tsx \
  components/queue/PromptQueueSheet.tsx components/shared/InfoModal.tsx \
  components/shared/SlashCommandArgModal.tsx components/shared/SlashCommandBoard.tsx \
  components/servers/AddServerScreen.tsx
git commit -m "chore: migrate all icons from Ionicons to phosphor-react-native"
```

---

## Task 3: Extend types and servers store

**Files:**
- Modify: `types/api.ts`
- Modify: `stores/servers.ts`
- Create: `__tests__/unit/stores/servers.test.ts`

- [ ] **Step 1: Add `connectionError` to `ServerConfig` in `types/api.ts`**

Find the `ServerConfig` interface (around line 143) and add the field:

```ts
export interface ServerConfig {
  id: string
  url: string
  apiKey: string
  label?: string
  isConnected: boolean
  serverInfo: ServerInfo | null
  connectionError: string | null   // ← add this line
}
```

- [ ] **Step 2: Write failing tests for the new store actions**

Create `__tests__/unit/stores/servers.test.ts`:

```ts
import { useServersStore } from '@/stores/servers'

// Mock SecureStore so tests don't hit the keychain
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  getItemAsync: jest.fn().mockResolvedValue(null),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}))

// Mock fetch for refreshServerInfo
const mockFetch = jest.fn()
global.fetch = mockFetch

function seedServer(overrides: Partial<import('@/types/api').ServerConfig> = {}) {
  const server = {
    id: 'srv_test1',
    url: 'http://192.168.1.10:7070',
    apiKey: 'key-abc',
    isConnected: false,
    serverInfo: null,
    connectionError: null,
    ...overrides,
  }
  useServersStore.setState({
    servers: { [server.id]: server },
    activeServerIds: [server.id],
    displayedServerIds: [server.id],
    isLoading: false,
  })
  return server
}

beforeEach(() => {
  useServersStore.setState({
    servers: {},
    activeServerIds: [],
    displayedServerIds: [],
    isLoading: false,
  })
  jest.clearAllMocks()
})

// ── addServer duplicate detection ──────────────────────────────────────────

describe('addServer – duplicate detection', () => {
  it('returns duplicate error when URL and API key both match an existing server', async () => {
    seedServer()
    const result = await useServersStore.getState().addServer(
      'http://192.168.1.10:7070',
      'key-abc',
    )
    expect(result).toEqual({ error: 'duplicate' })
  })

  it('allows same URL with different API key', async () => {
    seedServer()
    const result = await useServersStore.getState().addServer(
      'http://192.168.1.10:7070',
      'key-different',
    )
    expect(result).not.toEqual({ error: 'duplicate' })
  })

  it('allows same API key with different URL', async () => {
    seedServer()
    const result = await useServersStore.getState().addServer(
      'http://192.168.1.99:7070',
      'key-abc',
    )
    expect(result).not.toEqual({ error: 'duplicate' })
  })

  it('returns server ID string on success', async () => {
    const result = await useServersStore.getState().addServer(
      'http://192.168.1.10:7070',
      'key-abc',
    )
    expect(typeof result).toBe('string')
    expect((result as string).startsWith('srv_')).toBe(true)
  })
})

// ── refreshServerInfo ──────────────────────────────────────────────────────

describe('refreshServerInfo', () => {
  it('updates serverInfo and clears connectionError on success', async () => {
    const server = seedServer({ connectionError: 'previous error' })
    const info = { version: '1.4.2', machineName: 'mac-pro', platform: 'macOS', activeSessions: 0 }
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => info,
    })

    await useServersStore.getState().refreshServerInfo(server.id)

    const updated = useServersStore.getState().servers[server.id]
    expect(updated.serverInfo).toEqual(info)
    expect(updated.connectionError).toBeNull()
  })

  it('sets connectionError and clears serverInfo on fetch failure', async () => {
    const server = seedServer({ serverInfo: { version: '1.0', machineName: 'old', platform: 'macOS', activeSessions: 0 } })
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'))

    await useServersStore.getState().refreshServerInfo(server.id)

    const updated = useServersStore.getState().servers[server.id]
    expect(updated.serverInfo).toBeNull()
    expect(updated.connectionError).toContain('ECONNREFUSED')
  })

  it('sets connectionError on non-ok HTTP response', async () => {
    const server = seedServer()
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 })

    await useServersStore.getState().refreshServerInfo(server.id)

    const updated = useServersStore.getState().servers[server.id]
    expect(updated.connectionError).toBeTruthy()
  })

  it('does nothing if serverId does not exist', async () => {
    await expect(
      useServersStore.getState().refreshServerInfo('nonexistent')
    ).resolves.not.toThrow()
  })
})

// ── editServer ────────────────────────────────────────────────────────────

describe('editServer', () => {
  it('updates label without changing ID when URL is unchanged', async () => {
    const server = seedServer()
    await useServersStore.getState().editServer(server.id, {
      url: server.url,
      apiKey: server.apiKey,
      label: 'New Label',
    })
    const state = useServersStore.getState()
    expect(state.servers[server.id].label).toBe('New Label')
    expect(state.activeServerIds).toEqual([server.id])
  })

  it('replaces server entry at same position when URL changes', async () => {
    seedServer()
    // add a second server so we can verify position preservation
    useServersStore.setState((s) => {
      const second = { id: 'srv_second', url: 'http://other:7070', apiKey: 'k2', isConnected: false, serverInfo: null, connectionError: null }
      return {
        servers: { ...s.servers, srv_second: second },
        activeServerIds: [...s.activeServerIds, 'srv_second'],
        displayedServerIds: [...s.displayedServerIds, 'srv_second'],
      }
    })

    await useServersStore.getState().editServer('srv_test1', {
      url: 'http://192.168.1.99:7070',
      apiKey: 'key-abc',
      label: 'Renamed',
    })

    const state = useServersStore.getState()
    const newId = Object.keys(state.servers).find((id) => state.servers[id].url === 'http://192.168.1.99:7070')
    expect(newId).toBeTruthy()
    expect(state.activeServerIds[0]).toBe(newId) // same position (index 0)
    expect(state.activeServerIds).not.toContain('srv_test1')
  })

  it('returns duplicate error when new URL+key matches another server', async () => {
    seedServer()
    useServersStore.setState((s) => {
      const second = { id: 'srv_second', url: 'http://other:7070', apiKey: 'k2', isConnected: false, serverInfo: null, connectionError: null }
      return {
        servers: { ...s.servers, srv_second: second },
        activeServerIds: [...s.activeServerIds, 'srv_second'],
        displayedServerIds: [...s.displayedServerIds, 'srv_second'],
      }
    })

    const result = await useServersStore.getState().editServer('srv_test1', {
      url: 'http://other:7070',
      apiKey: 'k2',
      label: '',
    })
    expect(result).toEqual({ error: 'duplicate' })
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npx jest __tests__/unit/stores/servers.test.ts --no-coverage 2>&1 | tail -20
```

Expected: tests fail with "not a function" or "cannot read property" errors — the new store actions don't exist yet.

- [ ] **Step 4: Update `stores/servers.ts` — `PersistedServer`, persistence, and `addServer`**

Update the `PersistedServer` interface (top of file):
```ts
interface PersistedServer {
  id: string
  url: string
  label?: string
  connectionError?: string
}
```

Update `persistServerList` to include `connectionError`:
```ts
async function persistServerList(
  servers: Record<string, ServerConfig>,
  order: string[],
  displayedServerIds: string[],
) {
  const list: PersistedServer[] = order
    .filter((id) => Boolean(servers[id]))
    .map((id) => ({
      id: servers[id].id,
      url: servers[id].url,
      label: servers[id].label,
      connectionError: servers[id].connectionError ?? undefined,
    }))
  const payload = {
    list,
    displayedServerIds: displayedServerIds.filter((id) => order.includes(id)),
  }
  await SecureStore.setItemAsync(ASYNC_KEY_SERVERS, JSON.stringify(payload))
}
```

Update `loadPersistedServers` to restore `connectionError` (in the loop where each server is constructed, around line 201):
```ts
servers[entry.id] = {
  id: entry.id,
  url: entry.url,
  apiKey,
  label: entry.label,
  isConnected: false,
  serverInfo: null,
  connectionError: entry.connectionError ?? null,
}
```

Update `addServer` to add duplicate check and change return type. Replace the function:
```ts
addServer: async (url: string, apiKey: string, label?: string): Promise<string | { error: 'duplicate' }> => {
  const normalised = url.replace(/\/+$/, '')

  // Duplicate check: same normalised URL AND same API key
  const { servers, activeServerIds } = get()
  for (const id of activeServerIds) {
    const s = servers[id]
    if (s && s.url === normalised && s.apiKey === apiKey) {
      return { error: 'duplicate' }
    }
  }

  const id = serverIdFromUrl(normalised)
  await SecureStore.setItemAsync(secureKeyForServer(id), apiKey)

  const config: ServerConfig = {
    id,
    url: normalised,
    apiKey,
    label,
    isConnected: false,
    serverInfo: null,
    connectionError: null,
  }

  set((state) => {
    const servers = { ...state.servers, [id]: config }
    const activeServerIds = state.activeServerIds.includes(id)
      ? state.activeServerIds
      : [...state.activeServerIds, id]
    const displayedServerIds = state.displayedServerIds.includes(id)
      ? state.displayedServerIds
      : [...state.displayedServerIds, id]
    persistServerList(servers, activeServerIds, displayedServerIds)
    return { servers, activeServerIds, displayedServerIds }
  })

  return id
},
```

Also update `ServersStore` interface to reflect new return type:
```ts
addServer: (url: string, apiKey: string, label?: string) => Promise<string | { error: 'duplicate' }>
```

- [ ] **Step 5: Add `refreshServerInfo` and `editServer` to the store**

Add these two actions to the `create` call (after `setConnected`):

```ts
refreshServerInfo: async (serverId: string): Promise<void> => {
  const server = get().servers[serverId]
  if (!server) return

  try {
    const response = await fetch(`${server.url}/api/info`, {
      headers: { Authorization: `Bearer ${server.apiKey}` },
    })
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`)
    }
    const info = await response.json() as ServerInfo
    set((state) => {
      const s = state.servers[serverId]
      if (!s) return state
      const updated = { ...s, serverInfo: info, connectionError: null }
      const servers = { ...state.servers, [serverId]: updated }
      persistServerList(servers, state.activeServerIds, state.displayedServerIds)
      return { servers }
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    set((state) => {
      const s = state.servers[serverId]
      if (!s) return state
      const updated = { ...s, serverInfo: null, connectionError: message }
      const servers = { ...state.servers, [serverId]: updated }
      persistServerList(servers, state.activeServerIds, state.displayedServerIds)
      return { servers }
    })
  }
},

editServer: async (
  serverId: string,
  patch: { url: string; apiKey: string; label?: string },
): Promise<void | { error: 'duplicate' }> => {
  const normalised = patch.url.replace(/\/+$/, '')
  const { servers, activeServerIds, displayedServerIds } = get()

  // Duplicate check: same URL+key as any OTHER server
  for (const id of activeServerIds) {
    if (id === serverId) continue
    const s = servers[id]
    if (s && s.url === normalised && s.apiKey === patch.apiKey) {
      return { error: 'duplicate' }
    }
  }

  const existingServer = servers[serverId]
  if (!existingServer) return

  const newId = serverIdFromUrl(normalised)
  const idChanged = newId !== serverId

  // Update SecureStore key if ID changed
  if (idChanged) {
    await SecureStore.deleteItemAsync(secureKeyForServer(serverId))
  }
  await SecureStore.setItemAsync(secureKeyForServer(newId), patch.apiKey)

  set((state) => {
    const { [serverId]: old, ...rest } = state.servers
    const updated: ServerConfig = {
      ...old,
      id: newId,
      url: normalised,
      apiKey: patch.apiKey,
      label: patch.label,
      isConnected: false,
      serverInfo: null,
      connectionError: null,
    }
    const newServers = { ...rest, [newId]: updated }

    const replaceId = (id: string) => (id === serverId ? newId : id)
    const newActiveIds = state.activeServerIds.map(replaceId)
    const newDisplayedIds = state.displayedServerIds.map(replaceId)

    persistServerList(newServers, newActiveIds, newDisplayedIds)
    return { servers: newServers, activeServerIds: newActiveIds, displayedServerIds: newDisplayedIds }
  })
},
```

Add these to the `ServersStore` interface:
```ts
refreshServerInfo: (serverId: string) => Promise<void>
editServer: (serverId: string, patch: { url: string; apiKey: string; label?: string }) => Promise<void | { error: 'duplicate' }>
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
npx jest __tests__/unit/stores/servers.test.ts --no-coverage 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 7: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -40
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add types/api.ts stores/servers.ts __tests__/unit/stores/servers.test.ts
git commit -m "feat(stores): add connectionError, refreshServerInfo, editServer; duplicate check on addServer"
```

---

## Task 4: Build ServerErrorModal

**Files:**
- Create: `components/servers/ServerErrorModal.tsx`

- [ ] **Step 1: Create the component**

```tsx
import React from 'react'
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
  StyleSheet,
} from 'react-native'
import { XCircle, X } from 'phosphor-react-native'
import { dark, font, radius, spacing } from '@/constants/theme'
import type { ServerConfig } from '@/types/api'

interface Props {
  visible: boolean
  server: ServerConfig | null
  onClose: () => void
}

function maskApiKey(key: string): string {
  if (key.length <= 4) return '••••'
  return '••••••••' + key.slice(-4)
}

export function ServerErrorModal({ visible, server, onClose }: Props) {
  if (!server) return null

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay} />
      </TouchableWithoutFeedback>

      <View style={styles.container} pointerEvents="box-none">
        <View style={styles.modal}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <View style={[styles.dot, server.isConnected ? styles.dotConnected : styles.dotDisconnected]} />
              <Text style={styles.serverName}>{server.label || 'Server'}</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.closeBtn}>
              <X size={20} color={dark.text.secondary} />
            </TouchableOpacity>
          </View>

          {/* Server details */}
          <View style={styles.detailRows}>
            <DetailRow label="URL" value={server.url} mono />
            <DetailRow label="API Key" value={maskApiKey(server.apiKey)} mono />
            <DetailRow label="Machine" value={server.serverInfo?.machineName ?? '—'} />
            <DetailRow label="Platform" value={server.serverInfo?.platform ?? '—'} />
            <DetailRow label="Version" value={server.serverInfo ? `v${server.serverInfo.version}` : '—'} />
          </View>

          {/* Error box */}
          {server.connectionError ? (
            <ScrollView style={styles.errorBox} nestedScrollEnabled>
              <View style={styles.errorInner}>
                <XCircle size={14} color={dark.text.danger} weight="fill" style={styles.errorIcon} />
                <Text style={styles.errorText}>{server.connectionError}</Text>
              </View>
            </ScrollView>
          ) : null}

          {/* Close button */}
          <TouchableOpacity style={styles.closeFooterBtn} onPress={onClose}>
            <Text style={styles.closeFooterText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, mono && styles.mono]} numberOfLines={1}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  modal: {
    width: '100%',
    backgroundColor: dark.bg.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: dark.border,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: dark.border,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotConnected: { backgroundColor: dark.status.running },
  dotDisconnected: { backgroundColor: dark.status.failed },
  serverName: {
    color: dark.text.primary,
    fontSize: font.base,
    fontWeight: '600',
    flex: 1,
  },
  closeBtn: {
    padding: spacing.xs,
  },
  detailRows: {
    padding: spacing.md,
    gap: spacing.xs,
  },
  detailRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
  },
  detailLabel: {
    color: dark.text.secondary,
    fontSize: font.sm,
    width: 64,
  },
  detailValue: {
    color: dark.text.primary,
    fontSize: font.sm,
    flex: 1,
  },
  mono: {
    fontFamily: 'monospace',
    fontSize: font.xs,
  },
  errorBox: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    maxHeight: 120,
    backgroundColor: 'rgba(248,81,73,0.08)',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(248,81,73,0.25)',
  },
  errorInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.sm,
  },
  errorIcon: {
    marginTop: 1,
  },
  errorText: {
    color: dark.text.danger,
    fontSize: font.xs,
    flex: 1,
    lineHeight: 18,
  },
  closeFooterBtn: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: dark.border,
    padding: spacing.md,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  closeFooterText: {
    color: dark.text.accent,
    fontSize: font.base,
    fontWeight: '500',
  },
})
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep ServerErrorModal
```

Expected: no output (no errors).

- [ ] **Step 3: Commit**

```bash
git add components/servers/ServerErrorModal.tsx
git commit -m "feat: add ServerErrorModal component"
```

---

## Task 5: Build ServerEditModal

**Files:**
- Create: `components/servers/ServerEditModal.tsx`

- [ ] **Step 1: Create the component**

```tsx
import React, { useEffect, useState } from 'react'
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native'
import { X, Eye, EyeSlash, QrCode, XCircle } from 'phosphor-react-native'
import { PairScannerModal } from '@/components/pair/PairScannerModal'
import { useServersStore } from '@/stores/servers'
import { wsManager } from '@/services/ws-client'
import { dark, font, radius, spacing } from '@/constants/theme'
import type { ExchangeResult } from '@/services/pair-exchange'

interface Props {
  visible: boolean
  /** null = Add mode, string = Edit mode (serverId) */
  serverId: string | null
  onClose: () => void
}

export function ServerEditModal({ visible, serverId, onClose }: Props) {
  const { servers, addServer, editServer } = useServersStore()
  const server = serverId ? servers[serverId] : null
  const isEditMode = serverId !== null

  const [label, setLabel] = useState('')
  const [url, setUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDirty, setIsDirty] = useState(false)

  // Pre-fill fields when entering edit mode
  useEffect(() => {
    if (visible) {
      if (server) {
        setLabel(server.label ?? '')
        setUrl(server.url)
        setApiKey(server.apiKey)
      } else {
        setLabel('')
        setUrl('')
        setApiKey('')
      }
      setError(null)
      setIsDirty(false)
      setShowApiKey(false)
    }
  }, [visible, serverId])

  function markDirty() {
    if (!isDirty) setIsDirty(true)
  }

  function handleDismiss() {
    if (isDirty) {
      Alert.alert('Discard changes?', 'Your unsaved changes will be lost.', [
        { text: 'Keep Editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: onClose },
      ])
    } else {
      onClose()
    }
  }

  async function handleSave() {
    const trimmedUrl = url.trim().replace(/\/+$/, '')
    const trimmedKey = apiKey.trim()

    if (!trimmedUrl) {
      setError('Server URL is required.')
      return
    }
    if (!trimmedKey) {
      setError('API key is required.')
      return
    }

    setError(null)

    if (isEditMode && serverId) {
      const result = await editServer(serverId, { url: trimmedUrl, apiKey: trimmedKey, label: label.trim() || undefined })
      if (result && 'error' in result && result.error === 'duplicate') {
        setError('A server with this URL and API key already exists.')
        return
      }
      // Reconnect WS with potentially new credentials
      const state = useServersStore.getState()
      const newId = Object.keys(state.servers).find(
        (id) => state.servers[id].url === trimmedUrl && state.servers[id].apiKey === trimmedKey
      ) ?? serverId
      const updated = state.servers[newId]
      if (updated) {
        wsManager.connect(newId, updated.url, updated.apiKey)
      }
    } else {
      const result = await addServer(trimmedUrl, trimmedKey, label.trim() || undefined)
      if (result && typeof result === 'object' && 'error' in result && result.error === 'duplicate') {
        setError('A server with this URL and API key already exists.')
        return
      }
      const newId = result as string
      wsManager.connect(newId, trimmedUrl, trimmedKey)
    }

    onClose()
  }

  function handleScanSuccess(result: ExchangeResult) {
    setScannerOpen(false)
    setUrl(result.url)
    setApiKey(result.apiKey)
    if (result.machineName && !label) setLabel(result.machineName)
    markDirty()
  }

  return (
    <>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={handleDismiss}>
        <TouchableWithoutFeedback onPress={handleDismiss}>
          <View style={styles.overlay} />
        </TouchableWithoutFeedback>

        <KeyboardAvoidingView
          style={styles.avoidingView}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          pointerEvents="box-none"
        >
          <View style={styles.modal}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>{isEditMode ? 'Edit Server' : 'Add Server'}</Text>
              <TouchableOpacity onPress={handleDismiss} hitSlop={12} style={styles.closeBtn}>
                <X size={20} color={dark.text.secondary} />
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
              {/* Label row — QR icon right-aligned */}
              <View style={styles.fieldLabelRow}>
                <Text style={styles.fieldLabel}>Label (optional)</Text>
                <TouchableOpacity
                  onPress={() => setScannerOpen(true)}
                  hitSlop={12}
                  accessibilityLabel="Scan QR code"
                >
                  <QrCode size={18} color={dark.text.accent} />
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.input}
                value={label}
                onChangeText={(v) => { setLabel(v); markDirty() }}
                placeholder="e.g. Work Mac, Home Server"
                placeholderTextColor={dark.text.secondary}
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="next"
              />

              <Text style={styles.fieldLabel}>Server URL</Text>
              <TextInput
                style={styles.input}
                value={url}
                onChangeText={(v) => { setUrl(v); markDirty() }}
                placeholder="http://192.168.1.10:7070"
                placeholderTextColor={dark.text.secondary}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                returnKeyType="next"
              />

              <Text style={styles.fieldLabel}>API Key</Text>
              <View style={styles.apiKeyRow}>
                <TextInput
                  style={[styles.input, styles.apiKeyInput]}
                  value={apiKey}
                  onChangeText={(v) => { setApiKey(v); markDirty() }}
                  placeholder="Enter THREADBASE_API_KEY"
                  placeholderTextColor={dark.text.secondary}
                  secureTextEntry={!showApiKey}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={handleSave}
                />
                <TouchableOpacity
                  onPress={() => setShowApiKey((v) => !v)}
                  hitSlop={8}
                  style={styles.eyeBtn}
                >
                  {showApiKey
                    ? <EyeSlash size={18} color={dark.text.secondary} />
                    : <Eye size={18} color={dark.text.secondary} />}
                </TouchableOpacity>
              </View>

              {error ? (
                <View style={styles.errorBox}>
                  <XCircle size={14} color={dark.text.danger} weight="fill" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={[styles.saveBtn, (!url.trim() || !apiKey.trim()) && styles.saveBtnDisabled]}
                onPress={handleSave}
                disabled={!url.trim() || !apiKey.trim()}
              >
                <Text style={styles.saveBtnText}>Save</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <PairScannerModal
        visible={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onSuccess={handleScanSuccess}
      />
    </>
  )
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  avoidingView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  modal: {
    width: '100%',
    backgroundColor: dark.bg.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: dark.border,
    overflow: 'hidden',
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: dark.border,
  },
  title: {
    color: dark.text.primary,
    fontSize: font.base,
    fontWeight: '600',
  },
  closeBtn: {
    padding: spacing.xs,
  },
  body: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldLabel: {
    color: dark.text.secondary,
    fontSize: font.sm,
    fontWeight: '500',
    marginBottom: 2,
  },
  input: {
    backgroundColor: dark.bg.primary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: dark.border,
    color: dark.text.primary,
    fontSize: font.base,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 44,
  },
  apiKeyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  apiKeyInput: {
    flex: 1,
  },
  eyeBtn: {
    padding: spacing.xs,
    minHeight: 44,
    justifyContent: 'center',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: 'rgba(248,81,73,0.08)',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(248,81,73,0.25)',
    padding: spacing.sm,
  },
  errorText: {
    color: dark.text.danger,
    fontSize: font.sm,
    flex: 1,
    lineHeight: 18,
  },
  saveBtn: {
    backgroundColor: dark.text.accent,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  saveBtnDisabled: {
    opacity: 0.4,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: font.base,
    fontWeight: '600',
  },
})
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep ServerEditModal
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add components/servers/ServerEditModal.tsx
git commit -m "feat: add ServerEditModal component"
```

---

## Task 6: Redesign ServerListCard

**Files:**
- Modify: `components/servers/ServerListCard.tsx`

- [ ] **Step 1: Replace the full component**

```tsx
import React, { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { Trash, PencilSimple, ArrowsClockwise, XCircle } from 'phosphor-react-native'
import { dark, font, radius, spacing } from '@/constants/theme'
import type { ServerConfig } from '@/types/api'

interface Props {
  server: ServerConfig
  isRefreshing: boolean
  onRemove: (serverId: string) => void
  onEdit: (serverId: string) => void
  onRefresh: (serverId: string) => void
  onViewError: (serverId: string) => void
}

export function ServerListCard({ server, isRefreshing, onRemove, onEdit, onRefresh, onViewError }: Props) {
  const handleRemove = () => {
    Alert.alert(
      'Remove Server',
      `Disconnect from ${server.label || server.url}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => onRemove(server.id) },
      ]
    )
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={[styles.statusDot, server.isConnected ? styles.dotConnected : styles.dotDisconnected]} />
        <Text style={styles.label} numberOfLines={1}>
          {server.label || 'Server'}
        </Text>
        <View style={styles.iconGroup}>
          {server.connectionError ? (
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => onViewError(server.id)}
              hitSlop={4}
              accessibilityLabel="View connection error"
            >
              <XCircle size={20} color={dark.text.danger} weight="fill" />
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={handleRemove}
            hitSlop={4}
            accessibilityLabel="Delete server"
          >
            <Trash size={20} color={dark.text.danger} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => onEdit(server.id)}
            hitSlop={4}
            accessibilityLabel="Edit server"
          >
            <PencilSimple size={20} color={dark.text.accent} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconBtn, isRefreshing && styles.iconBtnDisabled]}
            onPress={() => !isRefreshing && onRefresh(server.id)}
            hitSlop={4}
            accessibilityLabel="Refresh server info"
          >
            <ArrowsClockwise size={20} color={dark.text.secondary} />
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.url} numberOfLines={1}>{server.url}</Text>

      {server.serverInfo ? (
        <Text style={styles.meta}>
          {server.serverInfo.machineName} · {server.serverInfo.platform} · v{server.serverInfo.version}
        </Text>
      ) : (
        <Text style={styles.meta}>
          {server.isConnected ? 'Connected' : 'Disconnected'}
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: dark.bg.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: dark.border,
    overflow: 'hidden',
    marginBottom: spacing.sm,
    padding: spacing.md,
    paddingBottom: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  dotConnected: { backgroundColor: dark.status.running },
  dotDisconnected: { backgroundColor: dark.status.failed },
  label: {
    color: dark.text.primary,
    fontSize: font.base,
    fontWeight: '600',
    flex: 1,
  },
  iconGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flexShrink: 0,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnDisabled: {
    opacity: 0.4,
  },
  url: {
    color: dark.text.secondary,
    fontSize: font.xs,
    fontFamily: 'monospace',
    paddingLeft: 16,
    marginBottom: 2,
  },
  meta: {
    color: dark.text.secondary,
    fontSize: font.xs,
    paddingLeft: 16,
    paddingBottom: spacing.xs,
  },
})
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep ServerListCard
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add components/servers/ServerListCard.tsx
git commit -m "feat: redesign ServerListCard with inline icon actions"
```

---

## Task 7: Wire everything into settings.tsx

**Files:**
- Modify: `app/(tabs)/settings.tsx`

- [ ] **Step 1: Replace the full file**

```tsx
import React, { useState } from 'react'
import {
  View,
  Text,
  Switch,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  RefreshControl,
} from 'react-native'
import Constants from 'expo-constants'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import * as Notifications from 'expo-notifications'
import { useServersStore } from '@/stores/servers'
import { useSettingsStore, type AddServerAction } from '@/stores/settings'
import { DisplayedServersList } from '@/components/servers/DisplayedServersList'
import { ServerListCard } from '@/components/servers/ServerListCard'
import { ServerErrorModal } from '@/components/servers/ServerErrorModal'
import { ServerEditModal } from '@/components/servers/ServerEditModal'
import { dark, font, radius, spacing } from '@/constants/theme'

function addServerActionLabel(action: AddServerAction): string {
  switch (action) {
    case 'ask': return 'Ask each time'
    case 'add': return 'Add to displayed'
    case 'replace': return 'Display only new'
    case 'keep': return 'Keep current'
  }
}

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>
}

function SettingsRow({
  label,
  value,
  onValueChange,
}: {
  label: string
  value: boolean
  onValueChange: (v: boolean) => void
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: dark.border, true: dark.text.accent }}
        thumbColor="#fff"
      />
    </View>
  )
}

export default function SettingsScreen() {
  const router = useRouter()
  const { servers, activeServerIds, displayedServerIds, removeServer, setDisplayedServerIds, refreshServerInfo } = useServersStore()
  const {
    notifications,
    setNotifications,
    historyMessageDisplay,
    setHistoryMessageDisplay,
    addServerAction,
    setAddServerAction,
  } = useSettingsStore()
  const [isAddBehaviorOpen, setIsAddBehaviorOpen] = React.useState(false)
  const [refreshingServerIds, setRefreshingServerIds] = useState<Set<string>>(new Set())
  const [isPullRefreshing, setIsPullRefreshing] = useState(false)
  const [errorServerId, setErrorServerId] = useState<string | null>(null)
  // null = closed, 'new' = add mode, string = edit mode (serverId)
  const [editServerId, setEditServerId] = useState<string | null | 'new'>(null)

  const handleTestNotification = async () => {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '⚡ Test Notification',
        body: 'Threadbase notifications are working!',
      },
      trigger: null,
    })
  }

  const handleRemoveServer = async (serverId: string) => {
    await removeServer(serverId)
    if (activeServerIds.length <= 1) {
      router.replace('/onboarding')
    }
  }

  const handleRefreshServer = async (serverId: string) => {
    setRefreshingServerIds((prev) => new Set(prev).add(serverId))
    await refreshServerInfo(serverId)
    setRefreshingServerIds((prev) => {
      const next = new Set(prev)
      next.delete(serverId)
      return next
    })
  }

  const handlePullRefresh = async () => {
    setIsPullRefreshing(true)
    await Promise.all(activeServerIds.map((id) => refreshServerInfo(id)))
    setIsPullRefreshing(false)
  }

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isPullRefreshing}
            onRefresh={handlePullRefresh}
            tintColor={dark.text.secondary}
          />
        }
      >
        <SectionHeader title="Servers" />
        {activeServerIds.map((id) => {
          const server = servers[id]
          if (!server) return null
          return (
            <ServerListCard
              key={id}
              server={server}
              isRefreshing={refreshingServerIds.has(id)}
              onRemove={handleRemoveServer}
              onEdit={(sid) => setEditServerId(sid)}
              onRefresh={handleRefreshServer}
              onViewError={(sid) => setErrorServerId(sid)}
            />
          )
        })}
        <TouchableOpacity
          style={styles.addServerBtn}
          onPress={() => setEditServerId('new')}
        >
          <Text style={styles.addServerText}>+ Add Server</Text>
        </TouchableOpacity>

        <SectionHeader title="Displayed Servers" />
        <DisplayedServersList
          activeServerIds={activeServerIds}
          servers={servers}
          selectedServerIds={displayedServerIds}
          onChange={setDisplayedServerIds}
        />

        <SectionHeader title="When Adding A New Server" />
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.row}
            onPress={() => setIsAddBehaviorOpen((v) => !v)}
          >
            <Text style={styles.rowLabel}>Selected action on create</Text>
            <Text style={styles.rowValue}>{addServerActionLabel(addServerAction)}</Text>
          </TouchableOpacity>
          {isAddBehaviorOpen ? (
            <View style={styles.accordionBody}>
              <ActionSegment value={addServerAction} onChange={setAddServerAction} />
              <TouchableOpacity style={styles.resetBtn} onPress={() => setAddServerAction('ask')}>
                <Text style={styles.resetBtnText}>Reset to ask each time</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        <SectionHeader title="Notifications" />
        <View style={styles.card}>
          <SettingsRow label="Waiting for Input" value={notifications.waitingInput} onValueChange={(v) => setNotifications({ waitingInput: v })} />
          <SettingsRow label="Session Completed" value={notifications.sessionComplete} onValueChange={(v) => setNotifications({ sessionComplete: v })} />
          <SettingsRow label="Session Failed" value={notifications.sessionFailed} onValueChange={(v) => setNotifications({ sessionFailed: v })} />
          <SettingsRow label="Diff Ready" value={notifications.diffReady} onValueChange={(v) => setNotifications({ diffReady: v })} />
          <SettingsRow label="Show Badge Count" value={notifications.showBadge} onValueChange={(v) => setNotifications({ showBadge: v })} />
          <SettingsRow label="Quiet Hours" value={notifications.quietHoursEnabled} onValueChange={(v) => setNotifications({ quietHoursEnabled: v })} />
          <TouchableOpacity style={styles.testBtn} onPress={handleTestNotification}>
            <Text style={styles.testBtnText}>Send Test Notification</Text>
          </TouchableOpacity>
        </View>

        <SectionHeader title="History" />
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Message Preview</Text>
            <View style={styles.segmentedControl}>
              <TouchableOpacity
                style={[styles.segmentBtn, historyMessageDisplay === 'first' && styles.segmentBtnActive]}
                onPress={() => setHistoryMessageDisplay('first')}
              >
                <Text style={[styles.segmentBtnText, historyMessageDisplay === 'first' && styles.segmentBtnTextActive]}>First</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.segmentBtn, historyMessageDisplay === 'last' && styles.segmentBtnActive]}
                onPress={() => setHistoryMessageDisplay('last')}
              >
                <Text style={[styles.segmentBtnText, historyMessageDisplay === 'last' && styles.segmentBtnTextActive]}>Last</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <SectionHeader title="Help" />
        <View style={styles.card}>
          <TouchableOpacity style={styles.row} onPress={() => router.push('/onboarding')}>
            <Text style={styles.rowLabel}>Restart onboarding</Text>
            <Text style={styles.rowValue}>›</Text>
          </TouchableOpacity>
        </View>

        <SectionHeader title="About" />
        <View style={styles.card}>
          <Text style={styles.aboutText}>
            {`Threadbase Mobile v${Constants.expoConfig?.version ?? '—'} (${
              Platform.OS === 'ios'
                ? (Constants.expoConfig?.ios?.buildNumber ?? '—')
                : (Constants.expoConfig?.android?.versionCode ?? '—')
            })`}
          </Text>
          <Text style={styles.aboutSubtext}>AI Agent Control Center</Text>
        </View>
      </ScrollView>

      <ServerErrorModal
        visible={errorServerId !== null}
        server={errorServerId ? servers[errorServerId] ?? null : null}
        onClose={() => setErrorServerId(null)}
      />

      <ServerEditModal
        visible={editServerId !== null}
        serverId={editServerId === 'new' ? null : editServerId}
        onClose={() => setEditServerId(null)}
      />
    </SafeAreaView>
  )
}

function ActionSegment({
  value,
  onChange,
}: {
  value: AddServerAction
  onChange: (v: AddServerAction) => void
}) {
  const options: { id: AddServerAction; label: string }[] = [
    { id: 'ask', label: 'Ask' },
    { id: 'add', label: 'Add' },
    { id: 'replace', label: 'Replace' },
    { id: 'keep', label: 'Keep' },
  ]
  return (
    <View style={styles.segmentedControl}>
      {options.map((option) => (
        <TouchableOpacity
          key={option.id}
          style={[styles.segmentBtn, value === option.id && styles.segmentBtnActive]}
          onPress={() => onChange(option.id)}
        >
          <Text style={[styles.segmentBtnText, value === option.id && styles.segmentBtnTextActive]}>
            {option.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: dark.bg.primary },
  content: { padding: spacing.md, gap: spacing.sm },
  sectionHeader: {
    color: dark.text.secondary,
    fontSize: font.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    marginLeft: spacing.xs,
  },
  card: {
    backgroundColor: dark.bg.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: dark.border,
    overflow: 'hidden',
  },
  addServerBtn: {
    backgroundColor: dark.bg.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: dark.border,
    borderStyle: 'dashed',
    padding: spacing.md,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  addServerText: {
    color: dark.text.accent,
    fontSize: font.base,
    fontWeight: '500',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    minHeight: 44,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: dark.border,
  },
  rowLabel: { color: dark.text.primary, fontSize: font.base },
  rowValue: { color: dark.text.secondary, fontSize: font.sm },
  accordionBody: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  resetBtn: { minHeight: 44, justifyContent: 'center' },
  resetBtnText: { color: dark.text.accent, fontSize: font.sm, fontWeight: '500' },
  testBtn: { padding: spacing.md, alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  testBtnText: { color: dark.text.accent, fontSize: font.base },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: dark.bg.primary,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  segmentBtn: { paddingVertical: spacing.xs, paddingHorizontal: spacing.md, borderRadius: radius.sm },
  segmentBtnActive: { backgroundColor: dark.text.accent },
  segmentBtnText: { color: dark.text.secondary, fontSize: font.sm, fontWeight: '500' },
  segmentBtnTextActive: { color: '#fff' },
  aboutText: { color: dark.text.primary, fontSize: font.base, padding: spacing.md, fontWeight: '500' },
  aboutSubtext: { color: dark.text.secondary, fontSize: font.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.md },
})
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -40
```

Expected: no errors.

- [ ] **Step 3: Run the full test suite**

```bash
npx jest --no-coverage 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add app/(tabs)/settings.tsx
git commit -m "feat: wire ServerListCard actions, pull-to-refresh, and modals into settings screen"
```

---

## Task 8: Final verification

- [ ] **Step 1: Full TypeScript check**

```bash
npx tsc --noEmit 2>&1
```

Expected: no errors.

- [ ] **Step 2: Full test suite**

```bash
npx jest --no-coverage 2>&1 | tail -30
```

Expected: all tests pass.

- [ ] **Step 3: Lint**

```bash
npx eslint . --ext .ts,.tsx 2>&1 | grep -v node_modules | head -40
```

Expected: no new errors.

- [ ] **Step 4: Final commit if any lint fixes were needed**

```bash
git add -A
git commit -m "fix: address lint issues from server list redesign"
```
