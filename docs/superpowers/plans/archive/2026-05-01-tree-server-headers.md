> **Archived 2026-05-22.** This file has been moved to the archive. Active backlog/roadmap now lives in [`docs/BACKLOG.md`](../../../BACKLOG.md) and [`docs/ROADMAP.md`](../../../ROADMAP.md). The contents below are preserved verbatim for historical reference.

---

# Tree View Server Headers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a server header row above each server's tree section so sessions from different servers are visually separated, fixing the flat undifferentiated list that appears when multiple servers each have multiple root paths.

**Architecture:** Add a `server-header` variant to the `FlatItem` union in `types.ts`, create a `ServerHeaderRow` component that renders a lightweight section divider, and update `flatItems` in `TreeSessionsList` to always emit a `server-header` before each server's rows (skipped when only one server is active).

**Tech Stack:** React Native, TypeScript, Expo

---

### Task 1: Add `server-header` to `FlatItem` type

**Files:**
- Modify: `components/sessions/tree/types.ts`

- [ ] **Step 1: Add the new union member**

In `components/sessions/tree/types.ts`, replace the `FlatItem` type:

```typescript
export type FlatItem =
  | { kind: 'server-root'; serverId: string; serverLabel: string; node: TreeNode }
  | { kind: 'server-header'; serverId: string; serverLabel: string; totalCount: number }
  | { kind: 'tree-row'; serverId: string; node: TreeNode; depth: number; depthOffset: number }
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/ronenmars/Desktop/dev/ai-tools/tb-mobile && npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors (existing errors unrelated to this change are fine).

- [ ] **Step 3: Commit**

```bash
git add components/sessions/tree/types.ts
git commit -m "feat: add server-header variant to FlatItem union"
```

---

### Task 2: Create `ServerHeaderRow` component

**Files:**
- Create: `components/sessions/tree/ServerHeaderRow.tsx`
- Create: `components/sessions/tree/ServerHeaderRow.styles.ts`

- [ ] **Step 1: Create the styles file**

Create `components/sessions/tree/ServerHeaderRow.styles.ts`:

```typescript
import { StyleSheet } from 'react-native'
import { dark, font, spacing } from '@/constants/theme'

export const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
    gap: spacing.sm,
  },
  label: {
    fontSize: font.xs,
    color: dark.text.secondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    flex: 1,
  },
  count: {
    fontSize: font.xs,
    color: dark.text.secondary,
  },
})
```

- [ ] **Step 2: Create the component file**

Create `components/sessions/tree/ServerHeaderRow.tsx`:

```typescript
import React from 'react'
import { View, Text } from 'react-native'
import { styles } from './ServerHeaderRow.styles'

interface Props {
  serverLabel: string
  totalCount: number
}

export function ServerHeaderRow({ serverLabel, totalCount }: Props) {
  return (
    <View style={styles.row}>
      <Text style={styles.label} numberOfLines={1}>{serverLabel}</Text>
      <Text style={styles.count}>{totalCount}</Text>
    </View>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/ronenmars/Desktop/dev/ai-tools/tb-mobile && npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add components/sessions/tree/ServerHeaderRow.tsx components/sessions/tree/ServerHeaderRow.styles.ts
git commit -m "feat: add ServerHeaderRow section divider component"
```

---

### Task 3: Emit `server-header` items and render them in `TreeSessionsList`

**Files:**
- Modify: `components/sessions/tree/TreeSessionsList.tsx`

- [ ] **Step 1: Add the import for `ServerHeaderRow`**

In `components/sessions/tree/TreeSessionsList.tsx`, add to the import block (after line 8, alongside `ServerRootRow`):

```typescript
import { ServerHeaderRow } from './ServerHeaderRow'
```

- [ ] **Step 2: Update `flatItems` to emit server headers**

Replace the `flatItems` useMemo (lines 124–139) with:

```typescript
const flatItems = useMemo((): FlatItem[] => {
  const items: FlatItem[] = []
  const showHeaders = serverTrees.length > 1
  for (const { serverId, serverLabel, tree, singleRootPath, singleRootNode } of serverTrees) {
    if (showHeaders) {
      items.push({ kind: 'server-header', serverId, serverLabel, totalCount: tree.totalCount })
    }
    if (singleRootNode && singleRootPath) {
      items.push({ kind: 'server-root', serverId, serverLabel, node: singleRootNode })
      for (const fn of flattenVisible(singleRootNode.children, 1, effectiveExpandedPaths)) {
        items.push({ kind: 'tree-row', serverId, node: fn.node, depth: fn.depth, depthOffset: 1 })
      }
    } else {
      for (const fn of flattenVisible(tree.children, 0, effectiveExpandedPaths)) {
        items.push({ kind: 'tree-row', serverId, node: fn.node, depth: fn.depth, depthOffset: 0 })
      }
    }
  }
  return items
}, [serverTrees, effectiveExpandedPaths])
```

- [ ] **Step 3: Render the `server-header` case in `FlatList`**

In the `renderItem` callback (around line 209), add the `server-header` case before the existing `server-root` check:

```typescript
renderItem={({ item }) => {
  if (item.kind === 'server-header') {
    return (
      <ServerHeaderRow
        serverLabel={item.serverLabel}
        totalCount={item.totalCount}
      />
    )
  }
  if (item.kind === 'server-root') {
    return (
      <ServerRootRow
        node={item.node}
        serverLabel={item.serverLabel}
        onSelectLeaf={handleSelectLeaf}
      />
    )
  }
  return (
    <TreeRow
      node={item.node}
      depth={item.depth}
      depthOffset={item.depthOffset}
      isExpanded={effectiveExpandedPaths.has(item.node.fullPath)}
      onToggle={handleToggle}
      onSelectLeaf={handleSelectLeaf}
    />
  )
}}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/ronenmars/Desktop/dev/ai-tools/tb-mobile && npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add components/sessions/tree/TreeSessionsList.tsx
git commit -m "feat: group tree view by server with section headers"
```

---

### Task 4: Manual smoke test

- [ ] **Step 1: Start Metro**

```bash
cd /Users/ronenmars/Desktop/dev/ai-tools/tb-mobile && npx expo start
```

- [ ] **Step 2: Verify multi-server layout**

With 3 servers active (Briya, Pc, Ak), the tree view should show:
- A section header for each server (uppercase label + total count) above its rows
- Each server's path nodes indented beneath their header
- Single-root servers still show the `ServerRootRow` directly below their header

- [ ] **Step 3: Verify single-server layout**

Disable 2 servers in Filter & Sort so only 1 is active. Confirm no header appears (behavior identical to before).

- [ ] **Step 4: Verify search still works**

Tap the search icon and type a query. Confirm results appear normally (search bypasses the flat list entirely).
