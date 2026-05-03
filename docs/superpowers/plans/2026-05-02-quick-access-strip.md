# Quick Access Strip Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a collapsible Quick Access Strip above the session list on the home screen, with three tabs — Favorites (manually pinned dirs + sessions), Recents (server-provided), and Popular Projects (server-provided) — each independently togglable via Settings.

**Architecture:** New Zustand store (`stores/quickAccess.ts`) persisted to AsyncStorage holds favorites and ignored-item sets. Recents and Popular data are fetched from the streamer via two new React Query hooks (`hooks/useQuickAccess.ts`). The strip is a self-contained component tree under `components/quick-access/` mounted in `app/index.tsx`. A new screen `app/manage-favorites.tsx` handles ordering and bulk unpinning.

**Tech Stack:** React Native, Expo Router, Zustand, React Query (`@tanstack/react-query`), `phosphor-react-native` for all icons, AsyncStorage for persistence.

---

### Task 1: QuickAccess store

**Files:**
- Create: `stores/quickAccess.ts`
- Create: `__tests__/unit/stores/quickAccess.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/unit/stores/quickAccess.test.ts`:

```ts
import { useQuickAccessStore } from '@/stores/quickAccess'

beforeEach(() => {
  useQuickAccessStore.setState({
    favorites: [],
    ignoredRecents: [],
    ignoredPopular: [],
    stripCollapsed: false,
    favoritesEnabled: true,
    recentsEnabled: true,
    popularEnabled: true,
  })
})

describe('QuickAccessStore – favorites', () => {
  it('starts empty', () => {
    expect(useQuickAccessStore.getState().favorites).toEqual([])
  })

  it('pinItem adds to favorites', () => {
    useQuickAccessStore.getState().pinItem({ type: 'dir', id: '~/my-app', label: '~/my-app' })
    expect(useQuickAccessStore.getState().favorites).toHaveLength(1)
    expect(useQuickAccessStore.getState().favorites[0].id).toBe('~/my-app')
  })

  it('pinItem is idempotent — does not duplicate', () => {
    const store = useQuickAccessStore.getState()
    store.pinItem({ type: 'dir', id: '~/my-app', label: '~/my-app' })
    store.pinItem({ type: 'dir', id: '~/my-app', label: '~/my-app' })
    expect(useQuickAccessStore.getState().favorites).toHaveLength(1)
  })

  it('unpinItem removes by id', () => {
    useQuickAccessStore.getState().pinItem({ type: 'dir', id: '~/my-app', label: '~/my-app' })
    useQuickAccessStore.getState().unpinItem('~/my-app')
    expect(useQuickAccessStore.getState().favorites).toHaveLength(0)
  })
})

describe('QuickAccessStore – ignored sets', () => {
  it('ignoreRecent adds to ignoredRecents', () => {
    useQuickAccessStore.getState().ignoreRecent('srv1::sess1')
    expect(useQuickAccessStore.getState().ignoredRecents).toContain('srv1::sess1')
  })

  it('ignorePopular adds to ignoredPopular', () => {
    useQuickAccessStore.getState().ignorePopular('~/my-app')
    expect(useQuickAccessStore.getState().ignoredPopular).toContain('~/my-app')
  })
})

describe('QuickAccessStore – tab toggles', () => {
  it('can disable recents', () => {
    useQuickAccessStore.getState().setRecentsEnabled(false)
    expect(useQuickAccessStore.getState().recentsEnabled).toBe(false)
  })

  it('defaults all tabs enabled', () => {
    const s = useQuickAccessStore.getState()
    expect(s.favoritesEnabled).toBe(true)
    expect(s.recentsEnabled).toBe(true)
    expect(s.popularEnabled).toBe(true)
  })
})

describe('QuickAccessStore – collapse', () => {
  it('toggles stripCollapsed', () => {
    useQuickAccessStore.getState().setStripCollapsed(true)
    expect(useQuickAccessStore.getState().stripCollapsed).toBe(true)
  })
})
```

- [ ] **Step 2: Run to verify they fail**

```bash
npx jest quickAccess --no-coverage 2>&1 | tail -10
```

Expected: FAIL — module not found

- [ ] **Step 3: Create `stores/quickAccess.ts`**

```ts
import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'

const ASYNC_KEY = 'threadbase_quick_access'

export interface FavoriteItem {
  type: 'dir' | 'session'
  id: string        // dir: path string; session: "serverId::sessionId"
  label: string     // display text
  serverId?: string // sessions only
}

interface PersistedState {
  favorites: FavoriteItem[]
  ignoredRecents: string[]
  ignoredPopular: string[]
  stripCollapsed: boolean
  favoritesEnabled: boolean
  recentsEnabled: boolean
  popularEnabled: boolean
}

interface QuickAccessStore extends PersistedState {
  pinItem: (item: FavoriteItem) => void
  unpinItem: (id: string) => void
  reorderFavorites: (from: number, to: number) => void
  ignoreRecent: (id: string) => void
  ignorePopular: (id: string) => void
  setStripCollapsed: (v: boolean) => void
  setFavoritesEnabled: (v: boolean) => void
  setRecentsEnabled: (v: boolean) => void
  setPopularEnabled: (v: boolean) => void
  hydrate: () => Promise<void>
}

const DEFAULTS: PersistedState = {
  favorites: [],
  ignoredRecents: [],
  ignoredPopular: [],
  stripCollapsed: false,
  favoritesEnabled: true,
  recentsEnabled: true,
  popularEnabled: true,
}

export const useQuickAccessStore = create<QuickAccessStore>((set, get) => ({
  ...DEFAULTS,

  pinItem: (item) =>
    set((s) => {
      if (s.favorites.some((f) => f.id === item.id)) return s
      return { favorites: [...s.favorites, item] }
    }),

  unpinItem: (id) =>
    set((s) => ({ favorites: s.favorites.filter((f) => f.id !== id) })),

  reorderFavorites: (from, to) =>
    set((s) => {
      const next = [...s.favorites]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      return { favorites: next }
    }),

  ignoreRecent: (id) =>
    set((s) => ({
      ignoredRecents: s.ignoredRecents.includes(id) ? s.ignoredRecents : [...s.ignoredRecents, id],
    })),

  ignorePopular: (id) =>
    set((s) => ({
      ignoredPopular: s.ignoredPopular.includes(id) ? s.ignoredPopular : [...s.ignoredPopular, id],
    })),

  setStripCollapsed: (stripCollapsed) => set({ stripCollapsed }),
  setFavoritesEnabled: (favoritesEnabled) => set({ favoritesEnabled }),
  setRecentsEnabled: (recentsEnabled) => set({ recentsEnabled }),
  setPopularEnabled: (popularEnabled) => set({ popularEnabled }),

  hydrate: async () => {
    const raw = await AsyncStorage.getItem(ASYNC_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as Partial<PersistedState>
    set((s) => ({
      favorites: parsed.favorites ?? s.favorites,
      ignoredRecents: parsed.ignoredRecents ?? s.ignoredRecents,
      ignoredPopular: parsed.ignoredPopular ?? s.ignoredPopular,
      stripCollapsed: parsed.stripCollapsed ?? s.stripCollapsed,
      favoritesEnabled: parsed.favoritesEnabled ?? s.favoritesEnabled,
      recentsEnabled: parsed.recentsEnabled ?? s.recentsEnabled,
      popularEnabled: parsed.popularEnabled ?? s.popularEnabled,
    }))
  },
}))

useQuickAccessStore.subscribe((state) => {
  const payload: PersistedState = {
    favorites: state.favorites,
    ignoredRecents: state.ignoredRecents,
    ignoredPopular: state.ignoredPopular,
    stripCollapsed: state.stripCollapsed,
    favoritesEnabled: state.favoritesEnabled,
    recentsEnabled: state.recentsEnabled,
    popularEnabled: state.popularEnabled,
  }
  void AsyncStorage.setItem(ASYNC_KEY, JSON.stringify(payload))
})
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest quickAccess --no-coverage 2>&1 | tail -10
```

Expected: PASS (all tests green)

- [ ] **Step 5: Commit**

```bash
git add stores/quickAccess.ts __tests__/unit/stores/quickAccess.test.ts
git commit -m "feat: add QuickAccessStore with favorites, ignored sets, and tab toggles"
```

---

### Task 2: API types and React Query hooks

**Files:**
- Modify: `types/api.ts` (add `PopularProject`)
- Create: `hooks/useQuickAccess.ts`
- Create: `__tests__/unit/hooks/useQuickAccess.test.ts`

- [ ] **Step 1: Add `PopularProject` to `types/api.ts`**

At the bottom of `types/api.ts`, add:

```ts
export interface PopularProject {
  path: string
  name: string
  sessionCount: number
}
```

- [ ] **Step 2: Check for test-utils wrapper**

```bash
ls __tests__/unit/test-utils.tsx 2>/dev/null || echo "missing"
```

If missing, create `__tests__/unit/test-utils.tsx`:

```tsx
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

export function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}
```

- [ ] **Step 3: Write the failing hook tests**

Create `__tests__/unit/hooks/useQuickAccess.test.ts`:

```ts
import { renderHook, waitFor } from '@testing-library/react-native'
import { useRecentSessions, usePopularProjects } from '@/hooks/useQuickAccess'
import { createWrapper } from '../test-utils'

const mockGet = jest.fn()
jest.mock('@/services/api-client', () => ({
  createApiForServer: () => ({ get: mockGet }),
}))

beforeEach(() => { mockGet.mockReset() })

describe('useRecentSessions', () => {
  it('fetches from /api/sessions/recents', async () => {
    mockGet.mockResolvedValue({ sessions: [{ id: 's1', projectPath: '~/app' }], total: 1 })
    const { result } = renderHook(() => useRecentSessions('srv1'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.sessions).toHaveLength(1)
    expect(mockGet).toHaveBeenCalledWith('/api/sessions/recents?limit=20')
  })
})

describe('usePopularProjects', () => {
  it('fetches from /api/projects/popular', async () => {
    mockGet.mockResolvedValue({ projects: [{ path: '~/app', name: 'app', sessionCount: 5 }], total: 1 })
    const { result } = renderHook(() => usePopularProjects('srv1'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.projects[0].sessionCount).toBe(5)
    expect(mockGet).toHaveBeenCalledWith('/api/projects/popular?limit=20')
  })
})
```

- [ ] **Step 4: Run to verify they fail**

```bash
npx jest useQuickAccess --no-coverage 2>&1 | tail -10
```

Expected: FAIL — module not found

- [ ] **Step 5: Create `hooks/useQuickAccess.ts`**

```ts
import { useQuery } from '@tanstack/react-query'
import { createApiForServer } from '@/services/api-client'
import type { Session, PopularProject } from '@/types/api'

export function useRecentSessions(serverId: string, limit = 20) {
  return useQuery({
    queryKey: ['quick-access-recents', serverId, limit],
    queryFn: () =>
      createApiForServer(serverId).get<{ sessions: Session[]; total: number }>(
        `/api/sessions/recents?limit=${limit}`
      ),
    staleTime: 30_000,
    enabled: !!serverId,
  })
}

export function usePopularProjects(serverId: string, limit = 20) {
  return useQuery({
    queryKey: ['quick-access-popular', serverId, limit],
    queryFn: () =>
      createApiForServer(serverId).get<{ projects: PopularProject[]; total: number }>(
        `/api/projects/popular?limit=${limit}`
      ),
    staleTime: 5 * 60_000,
    enabled: !!serverId,
  })
}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
npx jest useQuickAccess --no-coverage 2>&1 | tail -10
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add types/api.ts hooks/useQuickAccess.ts __tests__/unit/hooks/useQuickAccess.test.ts
git commit -m "feat: add useRecentSessions and usePopularProjects hooks"
```

---

### Task 3: QuickAccessChip component

**Files:**
- Create: `components/quick-access/QuickAccessChip.tsx`

- [ ] **Step 1: Create `components/quick-access/QuickAccessChip.tsx`**

```tsx
import React from 'react'
import { Pressable, Text, View, StyleSheet } from 'react-native'
import { Folder, Lightning, X } from 'phosphor-react-native'
import { dark, font, spacing } from '@/constants/theme'

export type QuickAccessTab = 'favorites' | 'recents' | 'popular'

export interface ChipItem {
  type: 'dir' | 'session'
  id: string
  label: string
  serverId?: string
  sessionCount?: number  // popular tab only
}

interface Props {
  item: ChipItem
  tab: QuickAccessTab
  editMode: boolean
  onPress: () => void
  onDelete: () => void
}

export function QuickAccessChip({ item, tab, editMode, onPress, onDelete }: Props) {
  const isPinned = tab === 'favorites'

  return (
    <Pressable
      style={({ pressed }) => [
        styles.chip,
        isPinned && styles.chipPinned,
        pressed && !editMode && styles.chipPressed,
      ]}
      onPress={onPress}
      accessibilityLabel={item.label}
    >
      {item.type === 'dir'
        ? <Folder size={13} color={isPinned ? dark.text.accent : dark.text.secondary} />
        : <Lightning size={13} color={isPinned ? dark.text.accent : dark.text.secondary} />
      }
      <Text style={[styles.label, isPinned && styles.labelPinned]} numberOfLines={1}>
        {item.label}
      </Text>
      {item.sessionCount !== undefined && (
        <Text style={styles.count}>{item.sessionCount}</Text>
      )}
      {editMode && (
        <Pressable style={styles.deleteBadge} onPress={onDelete} hitSlop={6}>
          <X size={9} color="#fff" weight="bold" />
        </Pressable>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: dark.border,
    backgroundColor: dark.bg.card,
  },
  chipPinned: {
    borderColor: dark.text.accent,
    backgroundColor: 'rgba(28,100,242,0.08)',
  },
  chipPressed: { opacity: 0.65 },
  label: {
    color: dark.text.secondary,
    fontSize: font.xs,
    maxWidth: 120,
  },
  labelPinned: { color: dark.text.accent },
  count: {
    color: dark.text.secondary,
    fontSize: 10,
    marginLeft: 2,
  },
  deleteBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#e55',
    alignItems: 'center',
    justifyContent: 'center',
  },
})
```

- [ ] **Step 2: Run full test suite**

```bash
npx jest --no-coverage 2>&1 | tail -10
```

Expected: all pass

- [ ] **Step 3: Commit**

```bash
git add components/quick-access/QuickAccessChip.tsx
git commit -m "feat: add QuickAccessChip component"
```

---

### Task 4: QuickAccessActionSheet component

**Files:**
- Create: `components/quick-access/QuickAccessActionSheet.tsx`

- [ ] **Step 1: Create `components/quick-access/QuickAccessActionSheet.tsx`**

```tsx
import React from 'react'
import { View, Text, Pressable, Modal, StyleSheet } from 'react-native'
import { ArrowRight, FolderOpen, Star, X } from 'phosphor-react-native'
import { dark, font, spacing } from '@/constants/theme'
import type { ChipItem } from './QuickAccessChip'

interface Props {
  item: ChipItem | null
  isFavorite: boolean
  onClose: () => void
  onNewSession: () => void
  onBrowse: () => void
  onOpenSession: () => void
  onTogglePin: () => void
}

export function QuickAccessActionSheet({
  item, isFavorite, onClose, onNewSession, onBrowse, onOpenSession, onTogglePin,
}: Props) {
  if (!item) return null

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <Text style={styles.title} numberOfLines={1}>{item.label}</Text>

        {item.type === 'dir' ? (
          <>
            <Pressable style={styles.row} onPress={onNewSession}>
              <ArrowRight size={18} color={dark.text.accent} />
              <Text style={[styles.rowText, styles.rowTextPrimary]}>New Session here</Text>
            </Pressable>
            <Pressable style={styles.row} onPress={onBrowse}>
              <FolderOpen size={18} color={dark.text.secondary} />
              <Text style={styles.rowText}>Browse directory</Text>
            </Pressable>
          </>
        ) : (
          <Pressable style={styles.row} onPress={onOpenSession}>
            <ArrowRight size={18} color={dark.text.accent} />
            <Text style={[styles.rowText, styles.rowTextPrimary]}>Open session</Text>
          </Pressable>
        )}

        <Pressable style={styles.row} onPress={onTogglePin}>
          <Star size={18} color={dark.text.secondary} weight={isFavorite ? 'fill' : 'regular'} />
          <Text style={styles.rowText}>{isFavorite ? 'Unpin from Favorites' : 'Pin to Favorites'}</Text>
        </Pressable>

        <Pressable style={[styles.row, styles.rowCancel]} onPress={onClose}>
          <X size={18} color={dark.status.failed} />
          <Text style={[styles.rowText, styles.rowTextCancel]}>Cancel</Text>
        </Pressable>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    backgroundColor: dark.bg.card,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderColor: dark.border,
  },
  title: {
    color: dark.text.secondary,
    fontSize: font.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    borderColor: dark.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: dark.bg.secondary,
  },
  rowText: { color: dark.text.primary, fontSize: font.base },
  rowTextPrimary: { color: dark.text.accent },
  rowCancel: { borderBottomWidth: 0 },
  rowTextCancel: { color: dark.status.failed },
})
```

- [ ] **Step 2: Run full test suite**

```bash
npx jest --no-coverage 2>&1 | tail -10
```

Expected: all pass

- [ ] **Step 3: Commit**

```bash
git add components/quick-access/QuickAccessActionSheet.tsx
git commit -m "feat: add QuickAccessActionSheet component"
```

---

### Task 5: QuickAccessStrip — main strip component

**Files:**
- Create: `components/quick-access/QuickAccessStrip.tsx`

- [ ] **Step 1: Create `components/quick-access/QuickAccessStrip.tsx`**

```tsx
import React, { useState, useMemo } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import {
  Star, ClockCounterClockwise, Fire,
  CaretUp, CaretDown, GearSix, PencilSimple, Check,
} from 'phosphor-react-native'
import { useQuickAccessStore } from '@/stores/quickAccess'
import { useServersStore } from '@/stores/servers'
import { useRecentSessions, usePopularProjects } from '@/hooks/useQuickAccess'
import { QuickAccessChip, type ChipItem, type QuickAccessTab } from './QuickAccessChip'
import { QuickAccessActionSheet } from './QuickAccessActionSheet'
import { dark, font, spacing } from '@/constants/theme'
import type { Session } from '@/types/api'

const INITIAL_CHIPS = 4
const LOAD_MORE_STEP = 4

export function QuickAccessStrip() {
  const router = useRouter()
  const activeServerIds = useServersStore((s) => s.activeServerIds)
  const {
    favorites, ignoredRecents, ignoredPopular,
    stripCollapsed, favoritesEnabled, recentsEnabled, popularEnabled,
    setStripCollapsed, pinItem, unpinItem, ignoreRecent, ignorePopular,
  } = useQuickAccessStore()

  const [currentTab, setCurrentTab] = useState<QuickAccessTab>('favorites')
  const [editMode, setEditMode] = useState(false)
  const [visibleCount, setVisibleCount] = useState(INITIAL_CHIPS)
  const [activeItem, setActiveItem] = useState<ChipItem | null>(null)

  const handleTabSwitch = (tab: QuickAccessTab) => {
    setCurrentTab(tab)
    setEditMode(false)
    setVisibleCount(INITIAL_CHIPS)
  }

  const firstServerId = activeServerIds[0] ?? ''
  const { data: recentsData } = useRecentSessions(firstServerId)
  const { data: popularData } = usePopularProjects(firstServerId)

  const enabledTabs = useMemo((): QuickAccessTab[] => {
    const tabs: QuickAccessTab[] = []
    if (favoritesEnabled) tabs.push('favorites')
    if (recentsEnabled) tabs.push('recents')
    if (popularEnabled) tabs.push('popular')
    return tabs
  }, [favoritesEnabled, recentsEnabled, popularEnabled])

  const effectiveTab: QuickAccessTab = enabledTabs.includes(currentTab)
    ? currentTab
    : (enabledTabs[0] ?? 'favorites')

  const allItems = useMemo((): ChipItem[] => {
    if (effectiveTab === 'favorites') {
      return favorites.map((f) => ({ type: f.type, id: f.id, label: f.label, serverId: f.serverId }))
    }
    if (effectiveTab === 'recents') {
      return (recentsData?.sessions ?? [])
        .filter((s: Session) => !ignoredRecents.includes(`${s.serverId ?? firstServerId}::${s.id}`))
        .map((s: Session) => ({
          type: 'session' as const,
          id: `${s.serverId ?? firstServerId}::${s.id}`,
          label: s.projectName ?? s.projectPath ?? s.id,
          serverId: s.serverId ?? firstServerId,
        }))
    }
    return (popularData?.projects ?? [])
      .filter((p) => !ignoredPopular.includes(p.path))
      .map((p) => ({
        type: 'dir' as const,
        id: p.path,
        label: p.path,
        sessionCount: p.sessionCount,
      }))
  }, [effectiveTab, favorites, recentsData, popularData, ignoredRecents, ignoredPopular, firstServerId])

  const visibleItems = allItems.slice(0, visibleCount)
  const remaining = allItems.length - visibleCount
  const loadMoreCount = Math.min(LOAD_MORE_STEP, remaining)

  if (enabledTabs.length === 0) return null

  const isFavorite = (item: ChipItem) => favorites.some((f) => f.id === item.id)

  const handleChipPress = (item: ChipItem) => { if (!editMode) setActiveItem(item) }

  const handleDelete = (item: ChipItem) => {
    if (effectiveTab === 'favorites') unpinItem(item.id)
    else if (effectiveTab === 'recents') ignoreRecent(item.id)
    else ignorePopular(item.id)
  }

  const handleTogglePin = () => {
    if (!activeItem) return
    if (isFavorite(activeItem)) unpinItem(activeItem.id)
    else pinItem({ type: activeItem.type, id: activeItem.id, label: activeItem.label, serverId: activeItem.serverId })
    setActiveItem(null)
  }

  const handleNewSession = () => {
    if (!activeItem) return
    const serverId = activeItem.serverId ?? firstServerId
    router.push(`/browse?server=${serverId}&path=${encodeURIComponent(activeItem.id)}`)
    setActiveItem(null)
  }

  const handleBrowse = () => {
    if (!activeItem) return
    const serverId = activeItem.serverId ?? firstServerId
    router.push(`/browse?server=${serverId}&path=${encodeURIComponent(activeItem.id)}`)
    setActiveItem(null)
  }

  const handleOpenSession = () => {
    if (!activeItem?.serverId) return
    const [, sessionId] = activeItem.id.split('::')
    router.push(`/session/${sessionId}?server=${activeItem.serverId}`)
    setActiveItem(null)
  }

  const TAB_DEFS: { key: QuickAccessTab; label: string; Icon: React.ComponentType<any> }[] = [
    { key: 'favorites', label: 'Favorites', Icon: Star },
    { key: 'recents',   label: 'Recents',   Icon: ClockCounterClockwise },
    { key: 'popular',   label: 'Popular',   Icon: Fire },
  ]

  return (
    <View style={styles.strip}>
      <View style={styles.tabBar}>
        {TAB_DEFS.filter((t) => enabledTabs.includes(t.key)).map(({ key, label, Icon }) => (
          <Pressable
            key={key}
            style={[styles.tab, effectiveTab === key && styles.tabActive]}
            onPress={() => handleTabSwitch(key)}
          >
            <Icon size={13} color={effectiveTab === key ? dark.text.accent : dark.text.secondary} />
            <Text style={[styles.tabLabel, effectiveTab === key && styles.tabLabelActive]}>{label}</Text>
          </Pressable>
        ))}

        <View style={styles.tabRight}>
          {effectiveTab === 'favorites' && (
            <Pressable style={styles.iconBtn} onPress={() => router.push('/manage-favorites')} hitSlop={8}>
              <GearSix size={16} color={dark.text.secondary} />
            </Pressable>
          )}
          <Pressable style={styles.iconBtn} onPress={() => setEditMode((v) => !v)} hitSlop={8}>
            {editMode
              ? <Check size={16} color={dark.text.accent} />
              : <PencilSimple size={16} color={dark.text.secondary} />
            }
          </Pressable>
          <Pressable style={styles.iconBtn} onPress={() => setStripCollapsed(!stripCollapsed)} hitSlop={8}>
            {stripCollapsed
              ? <CaretDown size={16} color={dark.text.accent} />
              : <CaretUp size={16} color={dark.text.accent} />
            }
          </Pressable>
        </View>
      </View>

      {!stripCollapsed && (
        <View style={styles.chipsContainer}>
          <View style={styles.chips}>
            {visibleItems.map((item) => (
              <QuickAccessChip
                key={item.id}
                item={item}
                tab={effectiveTab}
                editMode={editMode}
                onPress={() => handleChipPress(item)}
                onDelete={() => handleDelete(item)}
              />
            ))}
            {remaining > 0 && (
              <Pressable style={styles.loadMoreChip} onPress={() => setVisibleCount((v) => v + LOAD_MORE_STEP)}>
                <Text style={styles.loadMoreText}>+ {loadMoreCount} more</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}

      <QuickAccessActionSheet
        item={activeItem}
        isFavorite={activeItem ? isFavorite(activeItem) : false}
        onClose={() => setActiveItem(null)}
        onNewSession={handleNewSession}
        onBrowse={handleBrowse}
        onOpenSession={handleOpenSession}
        onTogglePin={handleTogglePin}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  strip: {
    backgroundColor: dark.bg.secondary,
    borderBottomWidth: 1,
    borderColor: dark.border,
  },
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: dark.border,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.sm,
    borderBottomWidth: 2,
    borderColor: 'transparent',
  },
  tabActive: { borderColor: dark.text.accent },
  tabLabel: { color: dark.text.secondary, fontSize: font.xs },
  tabLabelActive: { color: dark.text.accent, fontWeight: '600' },
  tabRight: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', paddingRight: spacing.sm },
  iconBtn: { padding: 6 },
  chipsContainer: { paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  loadMoreChip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: dark.border,
  },
  loadMoreText: { color: dark.text.secondary, fontSize: font.xs },
})
```

- [ ] **Step 2: Run full test suite**

```bash
npx jest --no-coverage 2>&1 | tail -10
```

Expected: all pass

- [ ] **Step 3: Commit**

```bash
git add components/quick-access/QuickAccessStrip.tsx
git commit -m "feat: add QuickAccessStrip component"
```

---

### Task 6: Manage Favorites screen

**Files:**
- Create: `app/manage-favorites.tsx`

- [ ] **Step 1: Create `app/manage-favorites.tsx`**

```tsx
import React from 'react'
import { View, Text, Pressable, FlatList, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { ArrowLeft, DragHandleHorizontal, Folder, Lightning, Trash } from 'phosphor-react-native'
import { useQuickAccessStore } from '@/stores/quickAccess'
import { dark, font, spacing } from '@/constants/theme'

export default function ManageFavoritesScreen() {
  const router = useRouter()
  const { favorites, unpinItem } = useQuickAccessStore()

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <ArrowLeft size={20} color={dark.text.accent} />
          <Text style={styles.backLabel}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Manage Favorites</Text>
      </View>

      {favorites.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No favorites pinned yet.</Text>
          <Text style={styles.emptySubText}>Tap a chip in the strip and choose "Pin to Favorites".</Text>
        </View>
      ) : (
        <FlatList
          data={favorites}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <DragHandleHorizontal size={18} color={dark.text.secondary} style={styles.drag} />
              {item.type === 'dir'
                ? <Folder size={16} color={dark.text.secondary} />
                : <Lightning size={16} color={dark.text.secondary} />
              }
              <Text style={styles.label} numberOfLines={1}>{item.label}</Text>
              <Pressable onPress={() => unpinItem(item.id)} hitSlop={8} style={styles.deleteBtn}>
                <Trash size={16} color={dark.status.failed} />
              </Pressable>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: dark.bg.primary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderColor: dark.border,
    gap: spacing.sm,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backLabel: { color: dark.text.accent, fontSize: font.base },
  title: { color: dark.text.primary, fontSize: font.lg, fontWeight: '700', flex: 1 },
  list: { padding: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: dark.bg.card,
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: dark.border,
  },
  drag: { opacity: 0.4 },
  label: { flex: 1, color: dark.text.primary, fontSize: font.base },
  deleteBtn: { padding: 4 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emptyText: { color: dark.text.primary, fontSize: font.base, fontWeight: '600', marginBottom: spacing.xs },
  emptySubText: { color: dark.text.secondary, fontSize: font.sm, textAlign: 'center' },
})
```

- [ ] **Step 2: Run full test suite**

```bash
npx jest --no-coverage 2>&1 | tail -10
```

Expected: all pass

- [ ] **Step 3: Commit**

```bash
git add app/manage-favorites.tsx
git commit -m "feat: add Manage Favorites screen"
```

---

### Task 7: Wire strip into home screen + hydrate store

**Files:**
- Modify: `app/index.tsx`
- Modify: `app/_layout.tsx`

- [ ] **Step 1: Hydrate QuickAccessStore in `app/_layout.tsx`**

Add import at top of `app/_layout.tsx`:

```ts
import { useQuickAccessStore } from '@/stores/quickAccess'
```

Inside the root layout component, alongside the existing `hydrateSettings` effect (around line 42–47), add:

```ts
const hydrateQuickAccess = useQuickAccessStore((s) => s.hydrate)
useEffect(() => {
  hydrateQuickAccess()
}, [hydrateQuickAccess])
```

- [ ] **Step 2: Mount `<QuickAccessStrip />` in `app/index.tsx`**

Add import at top of `app/index.tsx`:

```ts
import { QuickAccessStrip } from '@/components/quick-access/QuickAccessStrip'
```

In the JSX of `ProjectsHub`, insert `<QuickAccessStrip />` immediately after the closing `</View>` of the header block and before the layout switch (`{sessionsLayout === 'tree' ?`):

```tsx
      {/* Quick Access Strip */}
      <QuickAccessStrip />

      {/* Content */}
      {sessionsLayout === 'tree' ? (
```

- [ ] **Step 3: Run full test suite**

```bash
npx jest --no-coverage 2>&1 | tail -10
```

Expected: all pass

- [ ] **Step 4: Commit**

```bash
git add app/index.tsx app/_layout.tsx
git commit -m "feat: mount QuickAccessStrip in home screen and hydrate store on app start"
```

---

### Task 8: Settings toggles for Quick Access

**Files:**
- Modify: `app/settings.tsx`

- [ ] **Step 1: Add import to `app/settings.tsx`**

At the top of `app/settings.tsx`, add:

```ts
import { useQuickAccessStore } from '@/stores/quickAccess'
```

- [ ] **Step 2: Destructure store values inside `SettingsScreen`**

After the existing store destructures (around line 73), add:

```ts
const {
  favoritesEnabled, setFavoritesEnabled,
  recentsEnabled, setRecentsEnabled,
  popularEnabled, setPopularEnabled,
} = useQuickAccessStore()
```

- [ ] **Step 3: Add Quick Access section to the JSX**

In the ScrollView content, add after the existing `<SectionHeader title="Appearance" />` block:

```tsx
<SectionHeader title="Quick Access" />
<SettingsRow
  label="Favorites"
  value={favoritesEnabled}
  onValueChange={setFavoritesEnabled}
/>
<SettingsRow
  label="Recent Sessions"
  value={recentsEnabled}
  onValueChange={setRecentsEnabled}
/>
<SettingsRow
  label="Popular Projects"
  value={popularEnabled}
  onValueChange={setPopularEnabled}
/>
```

- [ ] **Step 4: Run full test suite**

```bash
npx jest --no-coverage 2>&1 | tail -10
```

Expected: all pass

- [ ] **Step 5: Commit**

```bash
git add app/settings.tsx
git commit -m "feat: add Quick Access toggles to Settings screen"
```

---

### Task 9: TypeScript check + final verification

- [ ] **Step 1: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors. Fix any type errors before proceeding.

- [ ] **Step 2: Full test suite**

```bash
npx jest --no-coverage 2>&1 | tail -15
```

Expected: all tests pass, no regressions.

- [ ] **Step 3: Manual smoke test on simulator**

```bash
npm run ios
```

Verify:
1. Strip appears above session list with Favorites / Recents / Popular tabs
2. Switching tabs resets to 4 chips; "+ N more" loads 4 more at a time
3. Collapse toggle hides chips; state survives navigating away and back
4. Edit mode (`PencilSimple`) shows red `✕` badges; tapping removes/ignores item
5. Tapping a chip opens action sheet with correct actions for dir vs session
6. "New Session here" on a dir chip navigates to `/browse` at that path
7. Gear icon (Favorites tab only) navigates to Manage Favorites screen; Unpin removes item
8. Settings → Quick Access toggles hide/show tabs instantly; all-off hides strip entirely
9. Favorites survive app restart (check AsyncStorage persistence)
10. No emojis anywhere — all icons are Phosphor components
