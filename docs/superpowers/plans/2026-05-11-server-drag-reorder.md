# Server Drag-and-Drop Reordering — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users reorder their servers via drag-and-drop with an iOS-style jiggle animation, accessible from the Servers section of the Filter & Sort sheet.

**Architecture:** Add a `reorderServers` action to the servers Zustand store that replaces `activeServerIds` array order and persists. `FilterSortSheet` gains an `isEditingOrder` boolean state and a lock-icon toggle button in the Servers section header. `DisplayedServersList` accepts two new optional props (`isEditingOrder`, `onReorder`) that switch it between toggle mode (today's behaviour) and a `DraggableFlatList` drag mode with jiggle animation.

**Tech Stack:** `react-native-draggable-flatlist@^4.0.3`, `react-native-reanimated@4.2.1`, `phosphor-react-native` — all already installed.

---

## File Map

| File | Change |
|---|---|
| `stores/servers.ts` | Add `reorderServers` action to store interface + implementation |
| `components/servers/DisplayedServersList.tsx` | Add `isEditingOrder` + `onReorder` props; jiggle animation per row; conditional `DraggableFlatList` render |
| `components/servers/FilterSortSheet.tsx` | Add `isEditingOrder` state; lock icon button in Servers section header; wire `reorderServers` to `DisplayedServersList` |
| `__tests__/unit/stores/servers.test.ts` | Add `reorderServers` tests |
| `__tests__/integration/components/DisplayedServersList.test.tsx` | New file — integration tests for edit-order mode |

---

## Task 1: Add `reorderServers` to the servers store

**Files:**
- Modify: `stores/servers.ts`
- Modify: `__tests__/unit/stores/servers.test.ts`

### Step 1: Write the failing test

Add at the bottom of `__tests__/unit/stores/servers.test.ts`:

```ts
// ── reorderServers ─────────────────────────────────────────────────────────

describe('reorderServers', () => {
  function seedTwoServers() {
    const a = { id: 'srv_a', url: 'http://a.local:7070', apiKey: 'key-a', isConnected: false, serverInfo: null, connectionError: null }
    const b = { id: 'srv_b', url: 'http://b.local:7070', apiKey: 'key-b', isConnected: false, serverInfo: null, connectionError: null }
    useServersStore.setState({
      servers: { srv_a: a, srv_b: b },
      activeServerIds: ['srv_a', 'srv_b'],
      displayedServerIds: ['srv_a', 'srv_b'],
      isLoading: false,
    })
  }

  it('reorders activeServerIds to the provided order', () => {
    seedTwoServers()
    useServersStore.getState().reorderServers(['srv_b', 'srv_a'])
    expect(useServersStore.getState().activeServerIds).toEqual(['srv_b', 'srv_a'])
  })

  it('does not change displayedServerIds membership', () => {
    seedTwoServers()
    useServersStore.getState().reorderServers(['srv_b', 'srv_a'])
    const { displayedServerIds } = useServersStore.getState()
    expect(displayedServerIds).toContain('srv_a')
    expect(displayedServerIds).toContain('srv_b')
  })

  it('calls persistServerList (SecureStore.setItemAsync)', () => {
    const SecureStore = require('expo-secure-store')
    seedTwoServers()
    useServersStore.getState().reorderServers(['srv_b', 'srv_a'])
    expect(SecureStore.setItemAsync).toHaveBeenCalled()
  })
})
```

- [ ] Add the test block above to `__tests__/unit/stores/servers.test.ts`

### Step 2: Run tests to confirm they fail

```bash
cd /Users/ronenmars/Desktop/dev/ai-tools/tb-mobile && npx jest __tests__/unit/stores/servers.test.ts --no-coverage 2>&1 | tail -20
```

Expected: FAIL — `reorderServers is not a function`

- [ ] Run the command and confirm failure

### Step 3: Add `reorderServers` to the store interface

In `stores/servers.ts`, add to the `ServersStore` interface (after `getServer` on line 40):

```ts
reorderServers: (orderedIds: string[]) => void
```

### Step 4: Implement `reorderServers`

In `stores/servers.ts`, add after `setDisplayedServerIds` (after line 164):

```ts
reorderServers: (orderedIds: string[]) => {
  set((state) => {
    persistServerList(state.servers, orderedIds, state.displayedServerIds)
    return { activeServerIds: orderedIds }
  })
},
```

- [ ] Add the interface entry and implementation

### Step 5: Run tests to confirm they pass

```bash
cd /Users/ronenmars/Desktop/dev/ai-tools/tb-mobile && npx jest __tests__/unit/stores/servers.test.ts --no-coverage 2>&1 | tail -20
```

Expected: all tests PASS

- [ ] Confirm pass

### Step 6: Commit

```bash
git add stores/servers.ts __tests__/unit/stores/servers.test.ts
git commit -m "feat(servers): add reorderServers store action"
```

- [ ] Commit

---

## Task 2: Add drag-and-drop + jiggle to `DisplayedServersList`

**Files:**
- Modify: `components/servers/DisplayedServersList.tsx`
- Create: `__tests__/integration/components/DisplayedServersList.test.tsx`

### Step 1: Write the failing integration tests

Create `__tests__/integration/components/DisplayedServersList.test.tsx`:

```tsx
import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import { DisplayedServersList } from '@/components/servers/DisplayedServersList'
import type { ServerConfig } from '@/types/api'

const serverA: ServerConfig = {
  id: 'srv_a', url: 'http://a.local:7070', apiKey: 'key-a',
  isConnected: false, serverInfo: null, connectionError: null,
}
const serverB: ServerConfig = {
  id: 'srv_b', url: 'http://b.local:7070', apiKey: 'key-b',
  isConnected: false, serverInfo: null, connectionError: null,
}

const servers = { srv_a: serverA, srv_b: serverB }
const activeServerIds = ['srv_a', 'srv_b']

describe('DisplayedServersList — normal mode', () => {
  it('renders a Switch for each server', () => {
    const { getByTestId } = render(
      <DisplayedServersList
        activeServerIds={activeServerIds}
        servers={servers}
        selectedServerIds={activeServerIds}
        onChange={jest.fn()}
      />
    )
    expect(getByTestId('server-toggle-srv_a')).toBeTruthy()
    expect(getByTestId('server-toggle-srv_b')).toBeTruthy()
  })
})

describe('DisplayedServersList — edit order mode', () => {
  it('does not render Switch components when isEditingOrder is true', () => {
    const { queryByTestId } = render(
      <DisplayedServersList
        activeServerIds={activeServerIds}
        servers={servers}
        selectedServerIds={activeServerIds}
        onChange={jest.fn()}
        isEditingOrder
        onReorder={jest.fn()}
      />
    )
    expect(queryByTestId('server-toggle-srv_a')).toBeNull()
    expect(queryByTestId('server-toggle-srv_b')).toBeNull()
  })

  it('renders drag handle for each server when isEditingOrder is true', () => {
    const { getByTestId } = render(
      <DisplayedServersList
        activeServerIds={activeServerIds}
        servers={servers}
        selectedServerIds={activeServerIds}
        onChange={jest.fn()}
        isEditingOrder
        onReorder={jest.fn()}
      />
    )
    expect(getByTestId('drag-handle-srv_a')).toBeTruthy()
    expect(getByTestId('drag-handle-srv_b')).toBeTruthy()
  })

  it('does not render quick-action buttons when isEditingOrder is true', () => {
    const { queryByText } = render(
      <DisplayedServersList
        activeServerIds={activeServerIds}
        servers={servers}
        selectedServerIds={activeServerIds}
        onChange={jest.fn()}
        isEditingOrder
        onReorder={jest.fn()}
        showQuickActions
      />
    )
    // Quick action buttons should be hidden in edit mode
    expect(queryByText(/all/i)).toBeNull()
  })
})
```

- [ ] Create the test file with content above

### Step 2: Run tests to confirm they fail

```bash
cd /Users/ronenmars/Desktop/dev/ai-tools/tb-mobile && npx jest __tests__/integration/components/DisplayedServersList.test.tsx --no-coverage 2>&1 | tail -30
```

Expected: FAIL — drag handle test IDs not found

- [ ] Confirm failure

### Step 3: Update `DisplayedServersList.tsx`

Replace the entire file content of `components/servers/DisplayedServersList.tsx` with:

```tsx
import React, { useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Switch } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist'
import { DotsSixVertical } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import type { ServerConfig } from '@/types/api'
import { dark, font, radius, spacing } from '@/constants/theme'

interface Props {
  activeServerIds: string[]
  servers: Record<string, ServerConfig>
  selectedServerIds: string[]
  onChange: (ids: string[]) => void
  showQuickActions?: boolean
  isEditingOrder?: boolean
  onReorder?: (orderedIds: string[]) => void
}

function toggleServer(selectedServerIds: string[], serverId: string): string[] {
  if (selectedServerIds.includes(serverId)) {
    return selectedServerIds.filter((id) => id !== serverId)
  }
  return [...selectedServerIds, serverId]
}

interface JigglingRowProps {
  server: ServerConfig
  index: number
  drag: () => void
  isActive: boolean
  isEditingOrder: boolean
}

function JigglingRow({ server, index, drag, isActive, isEditingOrder }: JigglingRowProps) {
  const rotation = useSharedValue(0)

  useEffect(() => {
    if (isEditingOrder) {
      const delay = index * 40
      const timer = setTimeout(() => {
        rotation.value = withRepeat(
          withSequence(
            withTiming(-2, { duration: 80 }),
            withTiming(2, { duration: 80 }),
          ),
          -1,
          true,
        )
      }, delay)
      return () => clearTimeout(timer)
    } else {
      rotation.value = withTiming(0, { duration: 100 })
    }
  }, [isEditingOrder, index, rotation])

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }))

  return (
    <Animated.View style={animatedStyle}>
      <TouchableOpacity
        onLongPress={drag}
        disabled={isActive}
        style={[styles.row, isActive && styles.rowActive]}
        activeOpacity={0.8}
      >
        <View style={styles.serverInfo}>
          <Text style={styles.serverLabel} numberOfLines={1}>
            {server.label || server.url}
          </Text>
          {server.label ? (
            <Text style={styles.serverUrl} numberOfLines={1}>
              {server.url}
            </Text>
          ) : null}
        </View>
        <View testID={`drag-handle-${server.id}`}>
          <DotsSixVertical size={20} color={dark.text.secondary} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  )
}

export function DisplayedServersList({
  activeServerIds,
  servers,
  selectedServerIds,
  onChange,
  showQuickActions = true,
  isEditingOrder = false,
  onReorder,
}: Props) {
  const { t } = useTranslation('servers')
  const latestServerId = activeServerIds[activeServerIds.length - 1]

  if (isEditingOrder) {
    const data = activeServerIds
      .map((id) => servers[id])
      .filter((s): s is ServerConfig => Boolean(s))

    return (
      <View style={styles.container}>
        <DraggableFlatList
          data={data}
          keyExtractor={(s) => s.id}
          renderItem={({ item, drag, isActive }: RenderItemParams<ServerConfig>) => (
            <JigglingRow
              server={item}
              index={data.indexOf(item)}
              drag={drag}
              isActive={isActive}
              isEditingOrder={isEditingOrder}
            />
          )}
          onDragEnd={({ data: reordered }) => onReorder?.(reordered.map((s) => s.id))}
          containerStyle={styles.draggableContainer}
        />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {showQuickActions ? (
        <View style={styles.quickRow}>
          <TouchableOpacity style={styles.quickButton} onPress={() => onChange(activeServerIds)}>
            <Text style={styles.quickButtonText}>{t('displayedServers.all')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickButton}
            onPress={() => onChange(latestServerId ? [latestServerId] : [])}
          >
            <Text style={styles.quickButtonText}>{t('displayedServers.latestOnly')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickButton} onPress={() => onChange([])}>
            <Text style={styles.quickButtonText}>{t('displayedServers.none')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {activeServerIds.map((id) => {
        const server = servers[id]
        if (!server) return null
        const selected = selectedServerIds.includes(id)
        return (
          <View key={id} style={styles.row}>
            <View style={styles.serverInfo}>
              <Text style={styles.serverLabel} numberOfLines={1}>
                {server.label || server.url}
              </Text>
              {server.label ? (
                <Text style={styles.serverUrl} numberOfLines={1}>
                  {server.url}
                </Text>
              ) : null}
            </View>
            <Switch
              value={selected}
              onValueChange={() => onChange(toggleServer(selectedServerIds, id))}
              trackColor={{ false: dark.border, true: dark.text.accent }}
              thumbColor="#fff"
              testID={`server-toggle-${id}`}
            />
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  draggableContainer: {
    gap: spacing.sm,
  },
  quickRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  quickButton: {
    backgroundColor: dark.bg.card,
    borderColor: dark.border,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    minHeight: 38,
    justifyContent: 'center',
  },
  quickButtonText: {
    color: dark.text.secondary,
    fontSize: font.sm,
    fontWeight: '500',
  },
  row: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: dark.border,
    backgroundColor: dark.bg.card,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  rowActive: {
    opacity: 0.7,
    transform: [{ scale: 1.02 }],
  },
  serverInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  serverLabel: {
    color: dark.text.primary,
    fontSize: font.base,
    fontWeight: '500',
  },
  serverUrl: {
    color: dark.text.secondary,
    fontSize: font.xs,
  },
})
```

- [ ] Replace `DisplayedServersList.tsx` with the content above

### Step 4: Run tests to confirm they pass

```bash
cd /Users/ronenmars/Desktop/dev/ai-tools/tb-mobile && npx jest __tests__/integration/components/DisplayedServersList.test.tsx --no-coverage 2>&1 | tail -30
```

Expected: all tests PASS

- [ ] Confirm pass

### Step 5: Run full test suite to catch regressions

```bash
cd /Users/ronenmars/Desktop/dev/ai-tools/tb-mobile && npx jest --no-coverage 2>&1 | tail -20
```

Expected: all existing tests PASS

- [ ] Confirm no regressions

### Step 6: Commit

```bash
git add components/servers/DisplayedServersList.tsx __tests__/integration/components/DisplayedServersList.test.tsx
git commit -m "feat(servers): add drag-and-drop reorder mode to DisplayedServersList"
```

- [ ] Commit

---

## Task 3: Wire edit-order mode into `FilterSortSheet`

**Files:**
- Modify: `components/servers/FilterSortSheet.tsx`

No new tests needed for this task — the store and component are already tested. This is wiring.

### Step 1: Add `useState` import and `reorderServers` from store

In `FilterSortSheet.tsx` line 1, React import already includes hooks. Add `useState` if not already there:

```tsx
import React, { useCallback, useState } from 'react'
```

Add `LockSimple` and `LockSimpleOpen` to the phosphor import (line 4):

```tsx
import { Tree, SquaresFour, List, LockSimple, LockSimpleOpen } from 'phosphor-react-native'
```

- [ ] Update the import lines

### Step 2: Add `reorderServers` from store + `isEditingOrder` state

Inside the `FilterSortSheet` component body, after line 91 (`const setDisplayedServerIds = ...`), add:

```tsx
const reorderServers = useServersStore((s) => s.reorderServers)
const [isEditingOrder, setIsEditingOrder] = useState(false)
```

- [ ] Add the two lines above

### Step 3: Replace the Servers section JSX

Find the Servers section in the JSX (lines 246–257):

```tsx
{/* Servers */}
{showServerFilter ? (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{t('filter.servers')}</Text>
    <DisplayedServersList
      activeServerIds={activeServerIds}
      servers={servers}
      selectedServerIds={displayedServerIds}
      onChange={setDisplayedServerIds}
    />
  </View>
) : null}
```

Replace it with:

```tsx
{/* Servers */}
{showServerFilter ? (
  <View style={styles.section}>
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{t('filter.servers')}</Text>
      {activeServerIds.length >= 2 ? (
        <TouchableOpacity
          onPress={() => setIsEditingOrder((v) => !v)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={isEditingOrder ? t('filter.lockOrder') : t('filter.editOrder')}
          testID="server-order-toggle"
        >
          {isEditingOrder
            ? <LockSimple size={18} color={dark.text.accent} />
            : <LockSimpleOpen size={18} color={dark.text.secondary} />
          }
        </TouchableOpacity>
      ) : null}
    </View>
    <DisplayedServersList
      activeServerIds={activeServerIds}
      servers={servers}
      selectedServerIds={displayedServerIds}
      onChange={setDisplayedServerIds}
      isEditingOrder={isEditingOrder}
      onReorder={reorderServers}
    />
  </View>
) : null}
```

- [ ] Replace the Servers section JSX

### Step 4: Add i18n keys for the new button labels

Open `locales/en/servers.json` and add two keys to the `filter` object:

```json
"editOrder": "Edit order",
"lockOrder": "Lock order"
```

- [ ] Add the two i18n keys

### Step 5: Run full test suite

```bash
cd /Users/ronenmars/Desktop/dev/ai-tools/tb-mobile && npx jest --no-coverage 2>&1 | tail -20
```

Expected: all tests PASS

- [ ] Confirm pass

### Step 6: Commit

```bash
git add components/servers/FilterSortSheet.tsx locales/en/servers.json
git commit -m "feat(servers): wire drag-reorder lock/unlock into FilterSortSheet"
```

- [ ] Commit

---

## Verification Checklist (manual, on simulator)

1. Open Filter & Sort sheet with **2+ servers** configured
2. In the Servers section, tap the `LockSimpleOpen` icon — all server cards start jiggling, switches disappear, drag handles (`⠿`) appear
3. Drag a server card to a new position — on release, cards reorder instantly
4. Tap the `LockSimple` icon — jiggle stops, switches reappear
5. Close and reopen Filter & Sort — new order persists
6. Return to hub — all view modes (Tree / Hub / Classic) reflect the new server order
7. With **1 server** only — lock icon is not shown at all
8. Run `npx jest --no-coverage` — all tests pass
