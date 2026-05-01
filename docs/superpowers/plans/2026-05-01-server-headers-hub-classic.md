# Server Headers — Hub & Classic Layouts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add server section headers to the Hub and Classic (merged) layouts so that when multiple servers are active, each server's content is visually separated — matching the behaviour already shipped in the Tree layout.

**Architecture:** The existing `ServerHeaderRow` component (in `components/sessions/tree/`) is reused as-is. Hub layout: a new `useServerGroups` hook wraps `useProjectGroups` output into per-server buckets; `ProjectHubList` renders a `ServerHeaderRow` before each bucket when `>1 server`. Classic merged layout: `MergedClassicList` in `app/index.tsx` groups its flat `MergedItem[]` by `serverId` and renders `ServerHeaderRow` between groups. Both layouts are unchanged when only one server is active.

**Tech Stack:** React Native, TypeScript, Expo, Zustand (useServersStore)

---

## File Map

| File | Change |
|------|--------|
| `components/sessions/hub/useServerGroups.ts` | **Create** — hook that splits `ProjectGroup[]` into per-server buckets |
| `components/sessions/hub/ProjectHubList.tsx` | **Modify** — use `useServerGroups`, render `ServerHeaderRow` between server sections |
| `app/index.tsx` (`MergedClassicList`) | **Modify** — group `filteredItems` by serverId, render `ServerHeaderRow` between groups |

`ServerHeaderRow` is imported from `components/sessions/tree/ServerHeaderRow` in both modified files — no changes to that component.

---

### Task 1: Create `useServerGroups` hook

**Files:**
- Create: `components/sessions/hub/useServerGroups.ts`

This hook takes the already-sorted `ProjectGroup[]` from `useProjectGroups` and the list of active server IDs (for ordering), and returns `ServerGroup[]` — one entry per server that has at least one group.

- [ ] **Step 1: Create the file**

Create `components/sessions/hub/useServerGroups.ts` with this exact content:

```typescript
import { useMemo } from 'react'
import type { ProjectGroup } from './useProjectGroups'

export interface ServerGroup {
  serverId: string
  serverLabel: string
  groups: ProjectGroup[]
  totalCount: number
}

export function useServerGroups(
  projectGroups: ProjectGroup[],
  activeServerIds: string[],
  serverLabels: Record<string, string>,
): ServerGroup[] {
  return useMemo(() => {
    if (activeServerIds.length <= 1) return []

    const map = new Map<string, ServerGroup>()

    for (const group of projectGroups) {
      const allItems = [...group.sessions, ...group.conversations]
      for (const item of allItems) {
        const serverId = item.serverId
        if (!map.has(serverId)) {
          map.set(serverId, {
            serverId,
            serverLabel: serverLabels[serverId] ?? serverId,
            groups: [],
            totalCount: 0,
          })
        }
      }
    }

    for (const group of projectGroups) {
      const serverIds = new Set([
        ...group.sessions.map((s) => s.serverId),
        ...group.conversations.map((c) => c.serverId),
      ])
      for (const serverId of serverIds) {
        const serverGroup = map.get(serverId)
        if (serverGroup) {
          const filteredGroup: ProjectGroup = {
            ...group,
            sessions: group.sessions.filter((s) => s.serverId === serverId),
            conversations: group.conversations.filter((c) => c.serverId === serverId),
          }
          filteredGroup.latestActivityMs = Math.max(
            ...filteredGroup.sessions.map((s) =>
              s.completedAt ? Date.parse(s.completedAt) : Date.parse(s.startedAt) + (s.elapsedMs ?? 0),
            ),
            ...filteredGroup.conversations.map((c) => Date.parse(c.lastActivity) || 0),
            0,
          )
          serverGroup.groups.push(filteredGroup)
          serverGroup.totalCount +=
            filteredGroup.sessions.length + filteredGroup.conversations.length
        }
      }
    }

    return activeServerIds
      .map((id) => map.get(id))
      .filter((sg): sg is ServerGroup => sg !== undefined && sg.totalCount > 0)
  }, [projectGroups, activeServerIds, serverLabels])
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/ronenmars/Desktop/dev/ai-tools/tb-mobile && npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors (one pre-existing error in `ServerListCard.tsx` is fine).

- [ ] **Step 3: Commit**

```bash
git add components/sessions/hub/useServerGroups.ts
git commit -m "feat: add useServerGroups hook for hub server sectioning"
```

---

### Task 2: Wire server headers into `ProjectHubList`

**Files:**
- Modify: `components/sessions/hub/ProjectHubList.tsx`

When `>1 server` is active, the list renders `ServerHeaderRow` + that server's `ProjectHubCard` rows. When `1 server`, behaviour is identical to today.

Current `ProjectHubList.tsx` starts at line 1. The relevant parts to change:
- Imports (add `useServerGroups`, `ServerHeaderRow`, `useServersStore`)
- The `groups` computation (add `serverGroups`)
- The FlatList `data` / `keyExtractor` / `renderItem` (add server header items)

- [ ] **Step 1: Read the current file**

Read `components/sessions/hub/ProjectHubList.tsx` in full to confirm current line numbers before editing.

- [ ] **Step 2: Add imports**

Add these three imports to the import block (after the existing imports):

```typescript
import { useServerGroups } from './useServerGroups'
import { ServerHeaderRow } from '@/components/sessions/tree/ServerHeaderRow'
import { useServersStore } from '@/stores/servers'
```

- [ ] **Step 3: Add server group computation inside the component**

After the existing `const groups = useProjectGroups(...)` line, add:

```typescript
  const activeServerIds = useServersStore((s) => s.activeServerIds)
  const servers = useServersStore((s) => s.servers)
  const serverLabels = useMemo(
    () => Object.fromEntries(activeServerIds.map((id) => [id, servers[id]?.label ?? id])),
    [activeServerIds, servers],
  )
  const serverGroups = useServerGroups(groups, activeServerIds, serverLabels)
  const showServerHeaders = serverGroups.length > 0
```

- [ ] **Step 4: Define the flat list item type and data**

Replace the FlatList in the non-search branch. First, define a union type and flat data array. Add this just before the `return` statement.

Note: `ProjectGroup` is already imported in this file via `import type { ProjectGroup } from './useProjectGroups'` — confirm it's present before proceeding.

```typescript
  type HubFlatItem =
    | { kind: 'header'; serverId: string; serverLabel: string; totalCount: number }
    | { kind: 'group'; group: ProjectGroup }

  const hubFlatData: HubFlatItem[] = showServerHeaders
    ? serverGroups.flatMap((sg) => [
        { kind: 'header' as const, serverId: sg.serverId, serverLabel: sg.serverLabel, totalCount: sg.totalCount },
        ...sg.groups.map((g) => ({ kind: 'group' as const, group: g })),
      ])
    : groups.map((g) => ({ kind: 'group' as const, group: g }))
```

- [ ] **Step 5: Update the FlatList**

Replace the existing FlatList (the one with `data={groups}`) with:

```typescript
        <FlatList
          data={hubFlatData}
          keyExtractor={(item) =>
            item.kind === 'header' ? `header-${item.serverId}` : item.group.projectPath
          }
          renderItem={({ item }) => {
            if (item.kind === 'header') {
              return (
                <ServerHeaderRow
                  serverLabel={item.serverLabel}
                  totalCount={item.totalCount}
                />
              )
            }
            return (
              <ProjectHubCard
                group={item.group}
                isOpen={openPaths.has(item.group.projectPath)}
                onToggle={() => toggleOpen(item.group.projectPath)}
              />
            )
          }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={dark.text.secondary} />
          }
          contentContainerStyle={hubFlatData.length === 0 ? styles.emptyListContent : styles.listContent}
          ListEmptyComponent={
            <EmptyState title="No projects yet" subtitle="Sessions and conversations will appear here" />
          }
        />
```

- [ ] **Step 6: Add `useMemo` to imports if not already present**

Check line 1 of `ProjectHubList.tsx`. If `useMemo` is not in the React import, add it:

```typescript
import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react'
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
cd /Users/ronenmars/Desktop/dev/ai-tools/tb-mobile && npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors.

- [ ] **Step 8: Commit**

```bash
git add components/sessions/hub/ProjectHubList.tsx
git commit -m "feat: add server section headers to hub layout"
```

---

### Task 3: Wire server headers into `MergedClassicList`

**Files:**
- Modify: `app/index.tsx` — only the `MergedClassicList` function (lines ~342–432)

When `>1 server` is active, the merged list renders `ServerHeaderRow` + that server's items (sorted by activity descending). When `1 server`, identical to today.

- [ ] **Step 1: Read the current file**

Read `app/index.tsx` lines 1–20 (imports) and lines 342–432 (`MergedClassicList`) to confirm current state before editing.

- [ ] **Step 2: Add `ServerHeaderRow` import**

Add to the existing import block at the top of `app/index.tsx`:

```typescript
import { ServerHeaderRow } from '@/components/sessions/tree/ServerHeaderRow'
```

- [ ] **Step 3: Replace `MergedClassicList` body**

Replace the entire `MergedClassicList` function with:

```typescript
function MergedClassicList({
  items,
  refreshing,
  onRefresh,
  searchOpen,
  searchQuery,
  onSearchChange,
}: {
  items: MergedItem[]
  refreshing: boolean
  onRefresh: () => void
  searchOpen: boolean
  searchQuery: string
  onSearchChange: (q: string) => void
}) {
  const router = useRouter()
  const activeServerIds = useServersStore((s) => s.activeServerIds)
  const servers = useServersStore((s) => s.servers)
  const showServerHeaders = activeServerIds.length > 1

  const filteredItems = useMemo(() => {
    if (!searchQuery) return items
    const q = searchQuery.toLowerCase()
    return items.filter((item) => {
      if (item.kind === 'session') {
        const s = item.item as MultiSession
        return s.projectName?.toLowerCase().includes(q) || s.lastOutput?.toLowerCase().includes(q)
      }
      const c = item.item as MultiConversation
      return (
        c.title?.toLowerCase().includes(q) ||
        c.preview?.toLowerCase().includes(q)
      )
    })
  }, [searchQuery, items])

  type ClassicFlatItem =
    | { kind: 'header'; serverId: string; serverLabel: string; totalCount: number }
    | MergedItem

  const flatData = useMemo((): ClassicFlatItem[] => {
    if (!showServerHeaders) return filteredItems

    const buckets = new Map<string, MergedItem[]>()
    for (const id of activeServerIds) buckets.set(id, [])
    for (const item of filteredItems) {
      const sid = item.item.serverId
      if (!buckets.has(sid)) buckets.set(sid, [])
      buckets.get(sid)!.push(item)
    }

    const result: ClassicFlatItem[] = []
    for (const id of activeServerIds) {
      const bucket = buckets.get(id) ?? []
      if (bucket.length === 0) continue
      result.push({
        kind: 'header',
        serverId: id,
        serverLabel: servers[id]?.label ?? id,
        totalCount: bucket.length,
      })
      result.push(...bucket)
    }
    return result
  }, [filteredItems, showServerHeaders, activeServerIds, servers])

  const renderConvCard = useCallback(
    (item: MultiConversation) => (
      <TouchableOpacity
        style={styles.convCard}
        activeOpacity={0.75}
        onPress={() => router.push(`/conversation/${item.id}?server=${item.serverId}`)}
      >
        <View style={styles.convCardTitleRow}>
          <FolderSimple size={18} color={dark.text.secondary} weight="fill" />
          <Text style={styles.convCardTitle} numberOfLines={1}>
            {item.title || item.projectPath}
          </Text>
        </View>
        {item.preview ? (
          <Text style={styles.convCardPreview} numberOfLines={2}>{item.preview}</Text>
        ) : null}
        <Text style={styles.convCardMeta}>
          {item.messageCount} msg{item.messageCount !== 1 ? 's' : ''}
        </Text>
      </TouchableOpacity>
    ),
    [router],
  )

  return (
    <View style={{ flex: 1 }}>
      {searchOpen ? (
        <View style={searchStyles.searchBar}>
          <TextInput
            style={searchStyles.searchInput}
            value={searchQuery}
            onChangeText={onSearchChange}
            placeholder="Search sessions & conversations…"
            placeholderTextColor={dark.text.secondary}
            autoFocus
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>
      ) : null}
      <FlatList
        data={flatData}
        keyExtractor={(item) => {
          if (item.kind === 'header') return `header-${item.serverId}`
          if (item.kind === 'session') return `s-${item.item.serverId}::${item.item.id}`
          return `c-${item.item.serverId}::${item.item.id}`
        }}
        renderItem={({ item }) => {
          if (item.kind === 'header') {
            return <ServerHeaderRow serverLabel={item.serverLabel} totalCount={item.totalCount} />
          }
          if (item.kind === 'session') {
            return <SessionCard session={item.item as MultiSession} />
          }
          return renderConvCard(item.item as MultiConversation)
        }}
        contentContainerStyle={styles.mergedContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={dark.text.secondary} />
        }
      />
    </View>
  )
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/ronenmars/Desktop/dev/ai-tools/tb-mobile && npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add app/index.tsx
git commit -m "feat: add server section headers to classic merged layout"
```

---

### Task 4: Manual smoke test

- [ ] **Step 1: Start Metro**

```bash
cd /Users/ronenmars/Desktop/dev/ai-tools/tb-mobile && npx expo start
```

- [ ] **Step 2: Verify Hub layout with 3 servers**

Switch to Hub view in Filter & Sort. With 3 servers active (Briya, Pc, Ak):
- Each server should have an uppercase section header with its label and total item count
- Project cards appear beneath their server's header
- Cards still expand/collapse normally

- [ ] **Step 3: Verify Hub layout with 1 server**

Disable 2 servers. Confirm no header appears — identical to before.

- [ ] **Step 4: Verify Classic merged layout with 3 servers**

Switch to Classic view with `mergeChats` enabled. With 3 servers:
- Each server should have a section header above its items
- Items within each server section sorted by activity (newest first)

- [ ] **Step 5: Verify Classic merged layout with 1 server**

Disable 2 servers. Confirm no header appears.

- [ ] **Step 6: Verify search is unaffected**

In both Hub and Classic views, tap search and type a query. Confirm results appear normally (search bypasses server grouping).
