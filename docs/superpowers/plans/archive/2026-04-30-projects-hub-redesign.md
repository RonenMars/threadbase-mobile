> **Archived 2026-05-22.** This file has been moved to the archive. Active backlog/roadmap now lives in [`docs/BACKLOG.md`](../../../BACKLOG.md) and [`docs/ROADMAP.md`](../../../ROADMAP.md). The contents below are preserved verbatim for historical reference.

---

# Projects Hub Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Expo Router tab navigator with a tab-free Projects hub screen — accordion cards per project, green FAB for new sessions, avatar dropdown for settings — while preserving a Classic mode that restores the flat Sessions/History lists.

**Architecture:** The Expo `(tabs)` directory and its layout are deleted. `app/index.tsx` becomes the real root screen (Projects hub or Classic segmented view depending on `sessionsLayout` setting). New hub components live in `components/sessions/hub/`. `app/project/[path].tsx` is a new stack screen for full per-project conversation lists. The root `app/_layout.tsx` is updated to redirect to `/` instead of `/(tabs)/sessions` after onboarding.

**Tech Stack:** React Native, Expo Router (Stack), Zustand, React Query, Reanimated 2, `phosphor-react-native`, `@gorhom/bottom-sheet`

---

## File Map

### New files
| File | Responsibility |
|---|---|
| `components/sessions/hub/ProjectHubList.tsx` | FlatList of ProjectHubCard; grouping logic, accordion state, search state |
| `components/sessions/hub/ProjectHubCard.tsx` | Accordion card: header + session rows + conversation rows |
| `components/sessions/hub/useProjectGroups.ts` | Pure hook: groups + sorts sessions & conversations into `ProjectGroup[]` |
| `components/servers/SortSheet.tsx` | Sort bottom sheet (Sort by + Order chips, Apply/Cancel) |
| `components/ui/AvatarMenu.tsx` | Avatar circle button + popover dropdown overlay |
| `components/ui/FAB.tsx` | Green floating action button |
| `app/project/[path].tsx` | Project detail screen (full conversation list + search) |
| `types/ui.ts` | `SortBy`, `SortOrder` types |

### Modified files
| File | Change |
|---|---|
| `stores/settings.ts` | Add `sessionsLayout`, `setSessionsLayout`, persist it |
| `app/index.tsx` | Replace redirect with Projects hub screen |
| `app/_layout.tsx` | Redirect to `/` instead of `/(tabs)/sessions`; add `project/[path]` stack screen |
| `app/(tabs)/settings.tsx` | Move to `app/settings.tsx`; add Layout toggle row |
| `components/servers/ServerFilterSheet.tsx` | Accept `isActive` prop for dot indicator; no content change |

### Deleted files
| File | Reason |
|---|---|
| `app/(tabs)/_layout.tsx` | Tab navigator removed |
| `app/(tabs)/sessions.tsx` | Logic absorbed into `app/index.tsx` |
| `app/(tabs)/history.tsx` | Logic absorbed into `app/index.tsx` (classic) + `app/project/[path].tsx` |

---

## Task 1: Add `sessionsLayout` to settings store and types

**Files:**
- Modify: `stores/settings.ts`
- Modify: `types/ui.ts` (create)

- [ ] **Step 1: Create `types/ui.ts`**

```ts
// types/ui.ts
export type SortBy = 'projectName' | 'lastActivity' | 'startedAt' | 'status'
export type SortOrder = 'asc' | 'desc'
export type SessionsLayout = 'hub' | 'classic'
```

- [ ] **Step 2: Add `sessionsLayout` to `stores/settings.ts`**

Open `stores/settings.ts`. Add the new field to the interface, default, setter, hydrate, and subscribe payload. The final file should look like:

```ts
import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { NotificationPreferences } from '@/types/api'
import type { SessionsLayout } from '@/types/ui'

export type AddServerAction = 'ask' | 'add' | 'replace' | 'keep'
const ASYNC_KEY_SETTINGS = 'threadbase_settings'

interface SettingsStore {
  colorScheme: 'dark' | 'light' | 'system'
  completedSessionFadeMs: number
  terminalMaxLines: number
  notifications: NotificationPreferences
  historyMessageDisplay: 'first' | 'last'
  addServerAction: AddServerAction
  sessionsLayout: SessionsLayout
  setColorScheme: (scheme: 'dark' | 'light' | 'system') => void
  setCompletedSessionFadeMs: (ms: number) => void
  setTerminalMaxLines: (n: number) => void
  setNotifications: (prefs: Partial<NotificationPreferences>) => void
  setHistoryMessageDisplay: (v: 'first' | 'last') => void
  setAddServerAction: (v: AddServerAction) => void
  setSessionsLayout: (v: SessionsLayout) => void
  hydrate: () => Promise<void>
}

const DEFAULT_NOTIFICATIONS: NotificationPreferences = {
  waitingInput: true,
  sessionComplete: true,
  sessionFailed: true,
  diffReady: false,
  quietHoursEnabled: false,
  quietHoursFrom: '22:00',
  quietHoursTo: '08:00',
  showBadge: true,
}

interface PersistedSettings {
  notifications: NotificationPreferences
  historyMessageDisplay: 'first' | 'last'
  addServerAction: AddServerAction
  sessionsLayout: SessionsLayout
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  colorScheme: 'dark',
  completedSessionFadeMs: 60000,
  terminalMaxLines: 5000,
  notifications: DEFAULT_NOTIFICATIONS,
  historyMessageDisplay: 'first',
  addServerAction: 'ask',
  sessionsLayout: 'hub',

  setColorScheme: (colorScheme) => set({ colorScheme }),
  setCompletedSessionFadeMs: (completedSessionFadeMs) => set({ completedSessionFadeMs }),
  setTerminalMaxLines: (terminalMaxLines) => set({ terminalMaxLines }),
  setNotifications: (prefs) =>
    set((state) => ({ notifications: { ...state.notifications, ...prefs } })),
  setHistoryMessageDisplay: (historyMessageDisplay) => set({ historyMessageDisplay }),
  setAddServerAction: (addServerAction) => set({ addServerAction }),
  setSessionsLayout: (sessionsLayout) => set({ sessionsLayout }),

  hydrate: async () => {
    const raw = await AsyncStorage.getItem(ASYNC_KEY_SETTINGS)
    if (!raw) return
    const parsed = JSON.parse(raw) as Partial<PersistedSettings>
    set((state) => ({
      notifications: parsed.notifications
        ? { ...state.notifications, ...parsed.notifications }
        : state.notifications,
      historyMessageDisplay: parsed.historyMessageDisplay ?? state.historyMessageDisplay,
      addServerAction: parsed.addServerAction ?? state.addServerAction,
      sessionsLayout: parsed.sessionsLayout ?? state.sessionsLayout,
    }))
  },
}))

useSettingsStore.subscribe((state) => {
  const payload: PersistedSettings = {
    notifications: state.notifications,
    historyMessageDisplay: state.historyMessageDisplay,
    addServerAction: state.addServerAction,
    sessionsLayout: state.sessionsLayout,
  }
  void AsyncStorage.setItem(ASYNC_KEY_SETTINGS, JSON.stringify(payload))
})
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/ronenmars/Desktop/dev/ai-tools/tb-mobile && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors related to `sessionsLayout`.

- [ ] **Step 4: Commit**

```bash
git add stores/settings.ts types/ui.ts
git commit -m "feat: add sessionsLayout setting and ui types"
```

---

## Task 2: Build `SortSheet` component

**Files:**
- Create: `components/servers/SortSheet.tsx`

- [ ] **Step 1: Create `components/servers/SortSheet.tsx`**

```tsx
import React, { useCallback, useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet'
import { dark, font, radius, spacing } from '@/constants/theme'
import type { SortBy, SortOrder } from '@/types/ui'

interface Props {
  visible: boolean
  onClose: () => void
  sortBy: SortBy
  sortOrder: SortOrder
  onChangeSortBy: (v: SortBy) => void
  onChangeSortOrder: (v: SortOrder) => void
}

const SNAP_POINTS = ['40%', '70%']

const SORT_BY_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'projectName', label: 'Project name' },
  { value: 'lastActivity', label: 'Last message' },
  { value: 'startedAt', label: 'Created date' },
  { value: 'status', label: 'Status' },
]

const SORT_ORDER_OPTIONS: { value: SortOrder; label: string }[] = [
  { value: 'asc', label: '↑ Ascending' },
  { value: 'desc', label: '↓ Descending' },
]

export function SortSheet({ visible, onClose, sortBy, sortOrder, onChangeSortBy, onChangeSortOrder }: Props) {
  const [draftBy, setDraftBy] = useState<SortBy>(sortBy)
  const [draftOrder, setDraftOrder] = useState<SortOrder>(sortOrder)

  useEffect(() => {
    if (visible) {
      setDraftBy(sortBy)
      setDraftOrder(sortOrder)
    }
  }, [visible, sortBy, sortOrder])

  const renderBackdrop = useCallback(
    (props: React.ComponentProps<typeof BottomSheetBackdrop>) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} pressBehavior="close" />
    ),
    [],
  )

  if (!visible) return null

  return (
    <BottomSheet
      snapPoints={SNAP_POINTS}
      index={0}
      enablePanDownToClose
      onClose={onClose}
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.sheetBg}
      handleIndicatorStyle={styles.handle}
    >
      <BottomSheetView style={styles.content}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Sort</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton} hitSlop={8}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sort by</Text>
          <View style={styles.chipRow}>
            {SORT_BY_OPTIONS.map((opt) => {
              const selected = draftBy === opt.value
              return (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => setDraftBy(opt.value)}
                  style={[styles.chip, selected && styles.chipSelected]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order</Text>
          <View style={styles.chipRow}>
            {SORT_ORDER_OPTIONS.map((opt) => {
              const selected = draftOrder === opt.value
              return (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => setDraftOrder(opt.value)}
                  style={[styles.chip, selected && styles.chipSelected]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.applyButton}
            onPress={() => {
              onChangeSortBy(draftBy)
              onChangeSortOrder(draftOrder)
              onClose()
            }}
          >
            <Text style={styles.applyText}>Apply</Text>
          </TouchableOpacity>
        </View>
      </BottomSheetView>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  sheetBg: { backgroundColor: dark.bg.secondary },
  handle: { backgroundColor: dark.border },
  content: { flex: 1, padding: spacing.md, gap: spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: dark.text.primary, fontSize: font.lg, fontWeight: '600' },
  closeButton: { padding: spacing.xs },
  closeButtonText: { color: dark.text.secondary, fontSize: font.lg, lineHeight: font.lg },
  section: { gap: spacing.sm },
  sectionTitle: { color: dark.text.primary, fontSize: font.base, fontWeight: '600' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    borderWidth: 1,
    borderColor: dark.border,
    backgroundColor: dark.bg.card,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    minHeight: 36,
    justifyContent: 'center',
  },
  chipSelected: { borderColor: dark.text.accent, backgroundColor: dark.bg.primary },
  chipText: { color: dark.text.secondary, fontSize: font.sm, fontWeight: '500' },
  chipTextSelected: { color: dark.text.primary },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: 'auto',
    paddingTop: spacing.sm,
  },
  cancelButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md },
  cancelText: { color: dark.text.secondary, fontSize: font.base },
  applyButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md },
  applyText: { color: dark.text.accent, fontSize: font.base, fontWeight: '600' },
})
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /Users/ronenmars/Desktop/dev/ai-tools/tb-mobile && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/servers/SortSheet.tsx
git commit -m "feat: add SortSheet component"
```

---

## Task 3: Build `FAB` component

**Files:**
- Create: `components/ui/FAB.tsx`

- [ ] **Step 1: Create `components/ui/FAB.tsx`**

```tsx
import React from 'react'
import { TouchableOpacity, StyleSheet } from 'react-native'
import { Plus } from 'phosphor-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

interface Props {
  onPress: () => void
}

export function FAB({ onPress }: Props) {
  const insets = useSafeAreaInsets()
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.fab, { bottom: 24 + insets.bottom }]}
      activeOpacity={0.85}
      accessibilityLabel="New session"
      accessibilityRole="button"
    >
      <Plus size={24} color="#000" weight="bold" />
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#30d158',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#30d158',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
})
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /Users/ronenmars/Desktop/dev/ai-tools/tb-mobile && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add components/ui/FAB.tsx
git commit -m "feat: add FAB component"
```

---

## Task 4: Build `AvatarMenu` component

**Files:**
- Create: `components/ui/AvatarMenu.tsx`

- [ ] **Step 1: Create `components/ui/AvatarMenu.tsx`**

```tsx
import React, { useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  Modal,
} from 'react-native'
import { useRouter } from 'expo-router'
import { dark, font, radius, spacing } from '@/constants/theme'
import { useSettingsStore } from '@/stores/settings'

interface Props {
  onOpenServerFilter: () => void
}

export function AvatarMenu({ onOpenServerFilter }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const sessionsLayout = useSettingsStore((s) => s.sessionsLayout)
  const setSessionsLayout = useSettingsStore((s) => s.setSessionsLayout)

  const close = () => setOpen(false)

  return (
    <View>
      <TouchableOpacity
        onPress={() => setOpen((v) => !v)}
        style={[styles.avatar, open && styles.avatarActive]}
        accessibilityLabel="Menu"
        accessibilityRole="button"
        hitSlop={8}
      >
        <Text style={styles.avatarText}>T</Text>
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="none"
        onRequestClose={close}
        statusBarTranslucent
      >
        <TouchableWithoutFeedback onPress={close}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>
        <View style={styles.menu}>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => { close(); router.push('/settings') }}
          >
            <Text style={styles.menuIcon}>⚙️</Text>
            <Text style={styles.menuLabel}>Settings</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => { close(); onOpenServerFilter() }}
          >
            <Text style={styles.menuIcon}>🖥️</Text>
            <Text style={styles.menuLabel}>Servers</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.menuItem, styles.menuItemLast]}
            onPress={() => {
              setSessionsLayout(sessionsLayout === 'hub' ? 'classic' : 'hub')
              close()
            }}
          >
            <Text style={styles.menuIcon}>{sessionsLayout === 'hub' ? '📋' : '📂'}</Text>
            <Text style={styles.menuLabel}>
              {sessionsLayout === 'hub' ? 'Classic view' : 'Hub view'}
            </Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#0a84ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarActive: {
    borderWidth: 2,
    borderColor: dark.text.accent,
  },
  avatarText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  menu: {
    position: 'absolute',
    top: 52,
    left: 16,
    backgroundColor: dark.bg.secondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: dark.border,
    minWidth: 160,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: dark.border,
    minHeight: 44,
  },
  menuItemLast: { borderBottomWidth: 0 },
  menuIcon: { fontSize: 16 },
  menuLabel: { color: dark.text.primary, fontSize: font.base },
})
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /Users/ronenmars/Desktop/dev/ai-tools/tb-mobile && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add components/ui/AvatarMenu.tsx
git commit -m "feat: add AvatarMenu component"
```

---

## Task 5: Build `useProjectGroups` hook

**Files:**
- Create: `components/sessions/hub/useProjectGroups.ts`

- [ ] **Step 1: Create `components/sessions/hub/useProjectGroups.ts`**

```ts
import { useMemo } from 'react'
import type { MultiSession, MultiConversation } from '@/types/api'
import type { SortBy, SortOrder } from '@/types/ui'

export interface ProjectGroup {
  projectPath: string
  projectName: string
  sessions: MultiSession[]
  conversations: MultiConversation[]
  /** Most-recent activity timestamp (ms) across all sessions+conversations */
  latestActivityMs: number
  /** Earliest startedAt across sessions (ms) */
  earliestStartMs: number
}

function toMs(iso: string | undefined): number {
  return iso ? new Date(iso).getTime() : 0
}

function statusPriority(status: MultiSession['status']): number {
  switch (status) {
    case 'running': return 0
    case 'waiting_input': return 1
    case 'idle': return 2
    case 'failed': return 3
    case 'completed': return 4
    default: return 5
  }
}

export function useProjectGroups(
  sessions: MultiSession[],
  conversations: MultiConversation[],
  sortBy: SortBy,
  sortOrder: SortOrder,
): ProjectGroup[] {
  return useMemo(() => {
    const map = new Map<string, ProjectGroup>()

    for (const s of sessions) {
      const key = s.projectPath
      if (!map.has(key)) {
        map.set(key, {
          projectPath: key,
          projectName: s.projectName ?? key.split('/').pop() ?? key,
          sessions: [],
          conversations: [],
          latestActivityMs: 0,
          earliestStartMs: Infinity,
        })
      }
      const g = map.get(key)!
      g.sessions.push(s)
      const actMs = toMs(s.completedAt) || (toMs(s.startedAt) + (s.elapsedMs ?? 0))
      if (actMs > g.latestActivityMs) g.latestActivityMs = actMs
      const startMs = toMs(s.startedAt)
      if (startMs < g.earliestStartMs) g.earliestStartMs = startMs
    }

    for (const c of conversations) {
      const key = c.projectPath
      if (!map.has(key)) {
        map.set(key, {
          projectPath: key,
          projectName: key.split('/').pop() ?? key,
          sessions: [],
          conversations: [],
          latestActivityMs: 0,
          earliestStartMs: Infinity,
        })
      }
      const g = map.get(key)!
      g.conversations.push(c)
      const actMs = toMs(c.lastActivity)
      if (actMs > g.latestActivityMs) g.latestActivityMs = actMs
    }

    // Sort conversations within each group by lastActivity desc
    for (const g of map.values()) {
      g.conversations.sort((a, b) => toMs(b.lastActivity) - toMs(a.lastActivity))
      if (g.earliestStartMs === Infinity) g.earliestStartMs = 0
    }

    const groups = Array.from(map.values())

    groups.sort((a, b) => {
      let cmp = 0
      switch (sortBy) {
        case 'projectName':
          cmp = a.projectName.localeCompare(b.projectName)
          break
        case 'lastActivity':
          cmp = b.latestActivityMs - a.latestActivityMs
          break
        case 'startedAt':
          cmp = b.earliestStartMs - a.earliestStartMs
          break
        case 'status': {
          const ap = Math.min(...(a.sessions.map((s) => statusPriority(s.status))), 99)
          const bp = Math.min(...(b.sessions.map((s) => statusPriority(s.status))), 99)
          cmp = ap - bp
          break
        }
      }
      return sortOrder === 'asc' ? -cmp : cmp
    })

    return groups
  }, [sessions, conversations, sortBy, sortOrder])
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /Users/ronenmars/Desktop/dev/ai-tools/tb-mobile && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add components/sessions/hub/useProjectGroups.ts
git commit -m "feat: add useProjectGroups hook"
```

---

## Task 6: Build `ProjectHubCard` component

**Files:**
- Create: `components/sessions/hub/ProjectHubCard.tsx`

- [ ] **Step 1: Create `components/sessions/hub/ProjectHubCard.tsx`**

```tsx
import React, { useCallback } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  LayoutAnimation,
  Platform,
  UIManager,
  ActionSheetIOS,
  Alert,
} from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
} from 'react-native-reanimated'
import { useRouter } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { dark, font, radius, spacing } from '@/constants/theme'
import { useSessionActions } from '@/hooks/useSessionActions'
import type { MultiSession, MultiConversation } from '@/types/api'
import type { ProjectGroup } from './useProjectGroups'

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true)
}

const MAX_CONVERSATIONS = 5

// ── Date label helpers ───────────────────────────────────
function isToday(iso: string): boolean {
  const d = new Date(iso)
  const now = new Date()
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  )
}

function formatHour(iso: string): string {
  const d = new Date(iso)
  const h = d.getHours().toString().padStart(2, '0')
  const m = d.getMinutes().toString().padStart(2, '0')
  return `${h}:${m}`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  return d.toLocaleDateString()
}

/**
 * Returns the date label for an item given whether multiple today-items
 * exist in the same card.
 */
function dateLabel(iso: string, multipleToday: boolean): string {
  if (isToday(iso) && multipleToday) return formatHour(iso)
  return formatDate(iso)
}

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${s % 60}s`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}

// ── Session row ──────────────────────────────────────────
function SessionRow({ session, multipleToday }: { session: MultiSession; multipleToday: boolean }) {
  const router = useRouter()
  const { cancelSession } = useSessionActions(session.serverId, session.id)

  const handlePress = useCallback(() => {
    Haptics.selectionAsync()
    if (session.source === 'discovered' && session.conversationId) {
      router.push(`/conversation/${session.conversationId}?server=${session.serverId}`)
    } else {
      router.push(`/session/${session.id}?server=${session.serverId}`)
    }
  }, [session, router])

  const handleLongPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    const options = ['Copy Session ID', 'Send Input', 'Cancel Session', 'Cancel']
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, destructiveButtonIndex: 2, cancelButtonIndex: 3 },
        (index) => {
          if (index === 2) {
            Alert.alert('Cancel Session', 'Are you sure?', [
              { text: 'No', style: 'cancel' },
              { text: 'Yes', style: 'destructive', onPress: () => cancelSession.mutate() },
            ])
          } else if (index === 1) {
            router.push(`/session/${session.id}?server=${session.serverId}`)
          }
        },
      )
    } else {
      Alert.alert('Session Actions', session.projectName, [
        { text: 'Copy Session ID', onPress: () => {} },
        { text: 'Send Input', onPress: () => router.push(`/session/${session.id}?server=${session.serverId}`) },
        { text: 'Cancel Session', style: 'destructive', onPress: () => cancelSession.mutate() },
        { text: 'Dismiss', style: 'cancel' },
      ])
    }
  }, [session, cancelSession, router])

  const label = dateLabel(session.startedAt, multipleToday)

  return (
    <TouchableOpacity
      style={styles.sessionRow}
      onPress={handlePress}
      onLongPress={handleLongPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Session ${session.projectName} ${formatElapsed(session.elapsedMs)}`}
    >
      <Text style={styles.sessionMeta} numberOfLines={1}>
        {[session.branch, formatElapsed(session.elapsedMs), `${session.promptCount} prompt${session.promptCount !== 1 ? 's' : ''}`]
          .filter(Boolean)
          .join(' · ')}
      </Text>
      <Text style={styles.sessionDate}>{label}</Text>
    </TouchableOpacity>
  )
}

// ── Conversation row ─────────────────────────────────────
function ConvRow({ conv, multipleToday }: { conv: MultiConversation; multipleToday: boolean }) {
  const router = useRouter()
  const label = dateLabel(conv.lastActivity, multipleToday)

  return (
    <TouchableOpacity
      style={styles.convRow}
      onPress={() => router.push(`/conversation/${conv.id}?server=${conv.serverId}`)}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Conversation ${conv.title}`}
    >
      <View style={styles.convLeft}>
        <Text style={styles.convTitle} numberOfLines={1}>{conv.title}</Text>
        <Text style={styles.convMeta} numberOfLines={1}>
          {[conv.branch, `${conv.messageCount} msgs`].filter(Boolean).join(' · ')}
        </Text>
      </View>
      <Text style={styles.convDate}>{label}</Text>
    </TouchableOpacity>
  )
}

// ── Main card ────────────────────────────────────────────
interface Props {
  group: ProjectGroup
  isOpen: boolean
  onToggle: () => void
}

export function ProjectHubCard({ group, isOpen, onToggle }: Props) {
  const router = useRouter()
  const chevronProgress = useSharedValue(isOpen ? 1 : 0)

  // Sync chevron when isOpen changes without triggering re-render
  React.useEffect(() => {
    chevronProgress.value = withTiming(isOpen ? 1 : 0, { duration: 200 })
  }, [isOpen, chevronProgress])

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(chevronProgress.value, [0, 1], [0, 180])}deg` }],
  }))

  const handleToggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    onToggle()
  }

  const visibleConvs = group.conversations.slice(0, MAX_CONVERSATIONS)
  const extraConvs = group.conversations.length - MAX_CONVERSATIONS

  // Date label rule: if 2+ sessions/convos from today, show hour instead of "Today"
  const todaySessions = group.sessions.filter((s) => isToday(s.startedAt))
  const multipleTodaySessions = todaySessions.length > 1
  const todayConvs = group.conversations.filter((c) => isToday(c.lastActivity))
  const multipleTodayConvs = todayConvs.length > 1

  return (
    <View style={styles.card}>
      {/* Header — always visible */}
      <TouchableOpacity
        style={styles.header}
        onPress={handleToggle}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel={`${group.projectName}, ${group.sessions.length} sessions, ${group.conversations.length} conversations`}
        accessibilityState={{ expanded: isOpen }}
      >
        <View style={styles.headerLeft}>
          <Text style={styles.folderIcon}>📁</Text>
          <Text style={styles.projectName} numberOfLines={1}>{group.projectName}</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.counts}>
            {group.sessions.length} · {group.conversations.length}
          </Text>
          <Animated.Text style={[styles.chevron, chevronStyle]}>▼</Animated.Text>
        </View>
      </TouchableOpacity>

      {/* Expanded body */}
      {isOpen ? (
        <>
          {group.sessions.length > 0 ? (
            <View style={styles.strip}>
              <Text style={styles.stripLabel}>SESSIONS</Text>
              {group.sessions.map((s) => (
                <SessionRow
                  key={`${s.serverId}::${s.id}`}
                  session={s}
                  multipleToday={multipleTodaySessions}
                />
              ))}
            </View>
          ) : null}

          {group.conversations.length > 0 ? (
            <View style={styles.convSection}>
              {visibleConvs.map((c) => (
                <ConvRow
                  key={`${c.serverId}::${c.id}`}
                  conv={c}
                  multipleToday={multipleTodayConvs}
                />
              ))}
              {extraConvs > 0 ? (
                <TouchableOpacity
                  style={styles.seeMore}
                  onPress={() =>
                    router.push(
                      `/project/${encodeURIComponent(group.projectPath)}`,
                    )
                  }
                >
                  <Text style={styles.seeMoreText}>
                    See all {group.conversations.length} conversations →
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: dark.bg.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: dark.border,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    backgroundColor: dark.bg.secondary,
    minHeight: 44,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
  },
  folderIcon: { fontSize: font.base },
  projectName: {
    color: dark.text.primary,
    fontSize: font.base,
    fontWeight: '700',
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  counts: { color: dark.text.secondary, fontSize: font.xs },
  chevron: { color: dark.text.secondary, fontSize: font.xs },

  strip: {
    padding: spacing.sm,
    paddingTop: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: dark.border,
    gap: 2,
  },
  stripLabel: {
    color: dark.text.secondary,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  sessionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    minHeight: 32,
  },
  sessionMeta: { color: dark.text.secondary, fontSize: font.xs, flex: 1 },
  sessionDate: { color: dark.text.secondary, fontSize: font.xs },

  convSection: {},
  convRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: dark.border,
    minHeight: 44,
    gap: spacing.sm,
  },
  convLeft: { flex: 1, gap: 2 },
  convTitle: { color: dark.text.primary, fontSize: font.sm, fontWeight: '500' },
  convMeta: { color: dark.text.secondary, fontSize: font.xs },
  convDate: { color: dark.text.secondary, fontSize: font.xs },

  seeMore: {
    padding: spacing.md,
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: dark.border,
    minHeight: 44,
    justifyContent: 'center',
  },
  seeMoreText: { color: dark.text.accent, fontSize: font.sm, fontWeight: '600' },
})
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /Users/ronenmars/Desktop/dev/ai-tools/tb-mobile && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add components/sessions/hub/ProjectHubCard.tsx
git commit -m "feat: add ProjectHubCard accordion component"
```

---

## Task 7: Build `ProjectHubList` component

**Files:**
- Create: `components/sessions/hub/ProjectHubList.tsx`

- [ ] **Step 1: Create `components/sessions/hub/ProjectHubList.tsx`**

```tsx
import React, { useState, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native'
import { useDebounce } from 'use-debounce'
import { dark, font, radius, spacing } from '@/constants/theme'
import { EmptyState } from '@/components/ui/EmptyState'
import { ProjectHubCard } from './ProjectHubCard'
import { useProjectGroups, type ProjectGroup } from './useProjectGroups'
import type { MultiSession, MultiConversation } from '@/types/api'
import type { SortBy, SortOrder } from '@/types/ui'

interface Props {
  sessions: MultiSession[]
  conversations: MultiConversation[]
  sortBy: SortBy
  sortOrder: SortOrder
  refreshing: boolean
  onRefresh: () => void
  searchOpen: boolean
}

function SearchResultItem({
  title,
  subtitle,
  onPress,
}: {
  title: string
  subtitle: string
  onPress: () => void
}) {
  return (
    <TouchableOpacity style={srStyles.row} onPress={onPress} activeOpacity={0.7}>
      <Text style={srStyles.title} numberOfLines={1}>{title}</Text>
      <Text style={srStyles.subtitle} numberOfLines={1}>{subtitle}</Text>
    </TouchableOpacity>
  )
}

const srStyles = StyleSheet.create({
  row: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: dark.border,
    minHeight: 44,
    gap: 2,
  },
  title: { color: dark.text.primary, fontSize: font.sm, fontWeight: '500' },
  subtitle: { color: dark.text.secondary, fontSize: font.xs },
})

export function ProjectHubList({
  sessions,
  conversations,
  sortBy,
  sortOrder,
  refreshing,
  onRefresh,
  searchOpen,
}: Props) {
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery] = useDebounce(searchQuery, 300)
  const [openPaths, setOpenPaths] = useState<Set<string>>(new Set())

  const groups = useProjectGroups(sessions, conversations, sortBy, sortOrder)

  const toggleOpen = useCallback((projectPath: string) => {
    setOpenPaths((prev) => {
      const next = new Set(prev)
      if (next.has(projectPath)) {
        next.delete(projectPath)
      } else {
        next.add(projectPath)
      }
      return next
    })
  }, [])

  // Search filtering
  const q = debouncedQuery.trim().toLowerCase()
  const isSearching = q.length > 0

  const matchedConversations = useMemo(() => {
    if (!isSearching) return []
    return conversations.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        (c.preview ?? '').toLowerCase().includes(q) ||
        (c.firstMessage?.text ?? '').toLowerCase().includes(q) ||
        (c.lastMessage?.text ?? '').toLowerCase().includes(q),
    )
  }, [conversations, q, isSearching])

  const matchedSessions = useMemo(() => {
    if (!isSearching) return []
    return sessions.filter(
      (s) =>
        s.projectName.toLowerCase().includes(q) ||
        (s.lastOutput ?? '').toLowerCase().includes(q),
    )
  }, [sessions, q, isSearching])

  const renderGroup = useCallback(
    ({ item }: { item: ProjectGroup }) => (
      <ProjectHubCard
        group={item}
        isOpen={openPaths.has(item.projectPath)}
        onToggle={() => toggleOpen(item.projectPath)}
      />
    ),
    [openPaths, toggleOpen],
  )

  if (isSearching) {
    return (
      <View style={styles.container}>
        {searchOpen ? (
          <View style={styles.searchBarContainer}>
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search sessions & conversations…"
              placeholderTextColor={dark.text.secondary}
              autoFocus
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
          </View>
        ) : null}
        <FlatList
          data={[]}
          keyExtractor={(_, i) => String(i)}
          renderItem={null}
          ListHeaderComponent={
            <>
              {matchedConversations.length > 0 ? (
                <>
                  <Text style={styles.sectionHeader}>
                    Conversations · {matchedConversations.length} result{matchedConversations.length !== 1 ? 's' : ''}
                  </Text>
                  {matchedConversations.map((c) => (
                    <SearchResultItem
                      key={`${c.serverId}::${c.id}`}
                      title={c.title}
                      subtitle={c.projectPath.split('/').pop() ?? c.projectPath}
                      onPress={() => {}}
                    />
                  ))}
                </>
              ) : null}
              {matchedSessions.length > 0 ? (
                <>
                  <Text style={styles.sectionHeader}>
                    Sessions · {matchedSessions.length} result{matchedSessions.length !== 1 ? 's' : ''}
                  </Text>
                  {matchedSessions.map((s) => (
                    <SearchResultItem
                      key={`${s.serverId}::${s.id}`}
                      title={s.projectName}
                      subtitle={[s.branch, s.lastOutput].filter(Boolean).join(' · ')}
                      onPress={() => {}}
                    />
                  ))}
                </>
              ) : null}
              {matchedConversations.length === 0 && matchedSessions.length === 0 ? (
                <EmptyState title="No results" subtitle={`Nothing matching "${debouncedQuery}"`} />
              ) : null}
            </>
          }
        />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {searchOpen ? (
        <View style={styles.searchBarContainer}>
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search sessions & conversations…"
            placeholderTextColor={dark.text.secondary}
            autoFocus
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>
      ) : null}
      <FlatList<ProjectGroup>
        data={groups}
        keyExtractor={(item) => item.projectPath}
        renderItem={renderGroup}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={dark.text.secondary}
          />
        }
        ListEmptyComponent={
          <EmptyState
            title="No projects"
            subtitle="Start a Claude Code session to see it here"
          />
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchBarContainer: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    backgroundColor: dark.bg.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: dark.border,
    paddingHorizontal: spacing.md,
    minHeight: 44,
    justifyContent: 'center',
  },
  searchInput: {
    color: dark.text.primary,
    fontSize: font.base,
    paddingVertical: spacing.sm,
  },
  listContent: {
    padding: spacing.sm,
    flexGrow: 1,
  },
  sectionHeader: {
    color: dark.text.secondary,
    fontSize: font.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
})
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /Users/ronenmars/Desktop/dev/ai-tools/tb-mobile && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add components/sessions/hub/ProjectHubList.tsx
git commit -m "feat: add ProjectHubList component"
```

---

## Task 8: Move Settings screen out of tabs; add Layout toggle

**Files:**
- Create: `app/settings.tsx` (copy + modify `app/(tabs)/settings.tsx`)
- Note: `app/(tabs)/settings.tsx` will be deleted in Task 10 with the whole `(tabs)` directory.

- [ ] **Step 1: Copy `app/(tabs)/settings.tsx` to `app/settings.tsx` and add the Layout row**

Create `app/settings.tsx` — identical to `app/(tabs)/settings.tsx` with these changes:
1. Add `sessionsLayout` and `setSessionsLayout` to the `useSettingsStore` destructure.
2. Add a "Layout" row inside a new "Appearance" section at the top of the ScrollView.

Add to the `useSettingsStore` destructure (inside `SettingsScreen`):
```tsx
const { sessionsLayout, setSessionsLayout, /* ...existing... */ } = useSettingsStore()
```

Add a new "Appearance" section at the top of the `ScrollView` content, before `<SectionHeader title="Servers" />`:
```tsx
<SectionHeader title="Appearance" />
<View style={styles.card}>
  <View style={styles.row}>
    <Text style={styles.rowLabel}>Layout</Text>
    <View style={styles.segmentedControl}>
      <TouchableOpacity
        style={[styles.segmentBtn, sessionsLayout === 'hub' && styles.segmentBtnActive]}
        onPress={() => setSessionsLayout('hub')}
      >
        <Text style={[styles.segmentBtnText, sessionsLayout === 'hub' && styles.segmentBtnTextActive]}>
          Hub
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.segmentBtn, sessionsLayout === 'classic' && styles.segmentBtnActive]}
        onPress={() => setSessionsLayout('classic')}
      >
        <Text style={[styles.segmentBtnText, sessionsLayout === 'classic' && styles.segmentBtnTextActive]}>
          Classic
        </Text>
      </TouchableOpacity>
    </View>
  </View>
</View>
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /Users/ronenmars/Desktop/dev/ai-tools/tb-mobile && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add app/settings.tsx
git commit -m "feat: add settings screen with layout toggle"
```

---

## Task 9: Build `app/project/[path].tsx` — Project Detail screen

**Files:**
- Create: `app/project/[path].tsx`

- [ ] **Step 1: Create `app/project/[path].tsx`**

```tsx
import React, { useState, useCallback, useRef } from 'react'
import { View, StyleSheet, AppState } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams } from 'expo-router'
import { useDebounce } from 'use-debounce'
import { ConversationList } from '@/components/conversation/ConversationList'
import { useEagerConversations, useConversationSearch } from '@/hooks/useConversations'
import { useFocusRefetch } from '@/hooks/useFocusRefetch'
import { dark } from '@/constants/theme'
import type { MultiConversation } from '@/types/api'

export default function ProjectDetailScreen() {
  const { path } = useLocalSearchParams<{ path: string }>()
  const projectPath = decodeURIComponent(path ?? '')

  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery] = useDebounce(searchQuery, 300)
  const [refreshEpoch, setRefreshEpoch] = useState(0)
  const nextLoaderModeRef = useRef<'full' | 'minimal'>('minimal')

  React.useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') nextLoaderModeRef.current = 'full'
    })
    return () => sub.remove()
  }, [])

  const { conversations, loaded, total, isDone, isCounting } = useEagerConversations(
    projectPath,
    refreshEpoch,
  )
  const searchResult = useConversationSearch(debouncedQuery, projectPath)

  const handleRefresh = useCallback(() => {
    setRefreshEpoch((e) => e + 1)
  }, [])

  useFocusRefetch(
    useCallback(async () => {
      nextLoaderModeRef.current = 'minimal'
      setRefreshEpoch((e) => e + 1)
    }, []),
  )

  const isSearching = debouncedQuery.length > 0
  const displayedConversations: MultiConversation[] = isSearching
    ? (searchResult.data?.conversations ?? [])
    : conversations

  const showProgress = !isSearching && !isDone

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <View style={styles.listWrapper}>
        <ConversationList
          conversations={displayedConversations}
          onRefresh={handleRefresh}
          refreshing={false}
          onEndReached={() => {}}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          isLoadingInitial={false}
          isFetchingNextPage={false}
          loadingProgress={showProgress ? { loaded, total, isCounting } : null}
        />
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: dark.bg.primary },
  listWrapper: { flex: 1, position: 'relative' },
})
```

> **Note:** This requires `useEagerConversations` to accept an optional `projectPath` filter parameter. Check `hooks/useConversations.ts` — if it doesn't already support filtering by project, add an optional `projectPath?: string` parameter to its `queryFn` that filters the returned conversations client-side. Do not change the API call itself.

- [ ] **Step 2: Verify TypeScript**

```bash
cd /Users/ronenmars/Desktop/dev/ai-tools/tb-mobile && npx tsc --noEmit 2>&1 | head -30
```

If `useEagerConversations` doesn't accept a `projectPath`, add the parameter to the hook signature and filter the result array before returning. The queryKey should include `projectPath` so React Query caches per-project.

- [ ] **Step 3: Commit**

```bash
git add app/project/[path].tsx
git commit -m "feat: add project detail screen"
```

---

## Task 10: Replace `app/index.tsx` with the Projects hub root screen

**Files:**
- Modify: `app/index.tsx`
- Delete: `app/(tabs)/_layout.tsx`, `app/(tabs)/sessions.tsx`, `app/(tabs)/history.tsx`

- [ ] **Step 1: Replace `app/index.tsx`**

```tsx
import React, { useState, useCallback, useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Funnel, SortAscending, MagnifyingGlass } from 'phosphor-react-native'
import * as Haptics from 'expo-haptics'
import { useEagerSessions } from '@/hooks/useSession'
import { useEagerConversations } from '@/hooks/useConversations'
import { useFocusRefetch } from '@/hooks/useFocusRefetch'
import { useServersStore } from '@/stores/servers'
import { useSettingsStore } from '@/stores/settings'
import { wsManager } from '@/services/ws-client'
import { ServerFilterSheet, type SortType } from '@/components/servers/ServerFilterSheet'
import { SortSheet } from '@/components/servers/SortSheet'
import { NewSessionServerPicker } from '@/components/servers/NewSessionServerPicker'
import { FAB } from '@/components/ui/FAB'
import { AvatarMenu } from '@/components/ui/AvatarMenu'
import { ProjectHubList } from '@/components/sessions/hub/ProjectHubList'
import { SessionCard } from '@/components/sessions/SessionCard'
import { ConversationList } from '@/components/conversation/ConversationList'
import { dark, font, spacing } from '@/constants/theme'
import type { SessionStatus } from '@/types/api'
import type { SortBy, SortOrder } from '@/types/ui'

const ALL_STATUSES: SessionStatus[] = ['running', 'waiting_input', 'completed', 'failed', 'idle']

function ConnectionDot() {
  const activeServerIds = useServersStore((s) => s.activeServerIds)
  const [connectedCount, setConnectedCount] = useState(0)

  useEffect(() => {
    const update = () => {
      let count = 0
      for (const id of activeServerIds) {
        if (wsManager.status(id) === 'connected') count++
      }
      setConnectedCount(count)
    }
    update()
    return wsManager.onAnyStatusChange(() => update())
  }, [activeServerIds])

  const total = activeServerIds.length
  const color =
    connectedCount === total && total > 0
      ? dark.status.running
      : connectedCount > 0
        ? dark.status.waiting
        : dark.status.failed

  const label = total <= 1
    ? connectedCount > 0 ? 'Connected' : 'Offline'
    : `${connectedCount}/${total} connected`

  return (
    <View
      style={[styles.connDot, { backgroundColor: color }]}
      accessibilityLabel={label}
    />
  )
}

export default function ProjectsScreen() {
  const router = useRouter()
  const sessionsLayout = useSettingsStore((s) => s.sessionsLayout)
  const activeServerIds = useServersStore((s) => s.activeServerIds)
  const displayedServerIds = useServersStore((s) => s.displayedServerIds)
  const servers = useServersStore((s) => s.servers)

  // Shared state
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [isSortOpen, setIsSortOpen] = useState(false)
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [selectedStatuses, setSelectedStatuses] = useState<SessionStatus[]>(ALL_STATUSES)
  const [sortBy, setSortBy] = useState<SortBy>('lastActivity')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  // Classic mode only
  const [classicTab, setClassicTab] = useState<'sessions' | 'history'>('sessions')
  const [classicSortType, setClassicSortType] = useState<SortType>('lastActivity')

  // Data
  const { sessions, isDone: sessionsDone, refetch: refetchSessions } = useEagerSessions()
  const { conversations, isDone: convsDone, refetch: refetchConvs } = useEagerConversations(undefined, 0)
  const [manualRefreshing, setManualRefreshing] = useState(false)

  useFocusRefetch(refetchSessions)

  const handleRefresh = useCallback(async () => {
    setManualRefreshing(true)
    await Promise.all([refetchSessions(), refetchConvs()])
    setManualRefreshing(false)
  }, [refetchSessions, refetchConvs])

  const handleNewSession = useCallback(() => {
    Haptics.selectionAsync()
    if (activeServerIds.length === 0) return
    if (activeServerIds.length === 1) {
      router.push(`/browse?server=${activeServerIds[0]}`)
    } else {
      setIsPickerOpen(true)
    }
  }, [activeServerIds, router])

  const isFilterActive =
    selectedStatuses.length < ALL_STATUSES.length ||
    (activeServerIds.length > 1 && displayedServerIds.length < activeServerIds.length)
  const isSortActive = sortBy !== 'lastActivity' || sortOrder !== 'desc'

  const visibleSessions = sessions.filter(
    (s) =>
      s.source !== 'discovered' &&
      displayedServerIds.includes(s.serverId) &&
      selectedStatuses.includes(s.status),
  )

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <AvatarMenu onOpenServerFilter={() => setIsFilterOpen(true)} />
        <Text style={styles.headerTitle}>Projects</Text>
        <View style={styles.headerActions}>
          <ConnectionDot />
          <TouchableOpacity
            onPress={() => setSearchOpen((v) => !v)}
            hitSlop={8}
            style={styles.iconBtn}
            accessibilityLabel="Search"
          >
            <MagnifyingGlass
              size={20}
              color={searchOpen ? dark.text.primary : dark.text.secondary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setIsFilterOpen(true)}
            hitSlop={8}
            style={[styles.iconBtn, isFilterActive && styles.iconBtnActive]}
            accessibilityLabel="Filter"
          >
            <Funnel size={20} color={isFilterActive ? dark.text.accent : dark.text.secondary} />
            {isFilterActive ? <View style={styles.activeDot} /> : null}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setIsSortOpen(true)}
            hitSlop={8}
            style={[styles.iconBtn, isSortActive && styles.iconBtnActive]}
            accessibilityLabel="Sort"
          >
            <SortAscending size={20} color={isSortActive ? dark.text.accent : dark.text.secondary} />
            {isSortActive ? <View style={styles.activeDot} /> : null}
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Body ── */}
      {sessionsLayout === 'hub' ? (
        <ProjectHubList
          sessions={visibleSessions}
          conversations={conversations}
          sortBy={sortBy}
          sortOrder={sortOrder}
          refreshing={manualRefreshing}
          onRefresh={handleRefresh}
          searchOpen={searchOpen}
        />
      ) : (
        /* Classic mode */
        <View style={styles.classicBody}>
          {/* Segmented control */}
          <View style={styles.classicTabs}>
            <TouchableOpacity
              style={[styles.classicTab, classicTab === 'sessions' && styles.classicTabActive]}
              onPress={() => setClassicTab('sessions')}
            >
              <Text style={[styles.classicTabText, classicTab === 'sessions' && styles.classicTabTextActive]}>
                ⚡ Sessions
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.classicTab, classicTab === 'history' && styles.classicTabActive]}
              onPress={() => setClassicTab('history')}
            >
              <Text style={[styles.classicTabText, classicTab === 'history' && styles.classicTabTextActive]}>
                📚 History
              </Text>
            </TouchableOpacity>
          </View>
          {classicTab === 'sessions' ? (
            <ClassicSessionsList
              sessions={visibleSessions}
              refreshing={manualRefreshing}
              onRefresh={handleRefresh}
            />
          ) : (
            <ConversationList
              conversations={conversations}
              onRefresh={handleRefresh}
              refreshing={manualRefreshing}
              onEndReached={() => {}}
              searchQuery=""
              onSearchChange={() => {}}
              isLoadingInitial={!convsDone}
              isFetchingNextPage={false}
            />
          )}
        </View>
      )}

      {/* ── FAB ── */}
      <FAB onPress={handleNewSession} />

      {/* ── Sheets / Modals ── */}
      <ServerFilterSheet
        visible={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        selectedStatuses={selectedStatuses}
        onChangeStatuses={setSelectedStatuses}
        sortType={classicSortType}
        onChangeSortType={setClassicSortType}
      />
      <SortSheet
        visible={isSortOpen}
        onClose={() => setIsSortOpen(false)}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onChangeSortBy={setSortBy}
        onChangeSortOrder={setSortOrder}
      />
      <NewSessionServerPicker
        visible={isPickerOpen}
        serverIds={activeServerIds}
        servers={servers}
        onPick={(serverId) => {
          setIsPickerOpen(false)
          router.push(`/browse?server=${serverId}`)
        }}
        onClose={() => setIsPickerOpen(false)}
      />
    </SafeAreaView>
  )
}

function ClassicSessionsList({
  sessions,
  refreshing,
  onRefresh,
}: {
  sessions: import('@/types/api').MultiSession[]
  refreshing: boolean
  onRefresh: () => void
}) {
  const { FlatList, RefreshControl } = require('react-native')
  return (
    <FlatList
      data={sessions}
      keyExtractor={(item: import('@/types/api').MultiSession) => `${item.serverId}::${item.id}`}
      renderItem={({ item }: { item: import('@/types/api').MultiSession }) => (
        <SessionCard session={item} />
      )}
      contentContainerStyle={{ padding: spacing.sm, flexGrow: 1 }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={dark.text.secondary}
        />
      }
    />
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: dark.bg.primary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: dark.border,
    minHeight: 44,
  },
  headerTitle: {
    color: dark.text.primary,
    fontSize: font.lg,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    position: 'relative',
  },
  iconBtnActive: {
    backgroundColor: `${dark.text.accent}18`,
  },
  activeDot: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: dark.text.accent,
    borderWidth: 1,
    borderColor: dark.bg.primary,
  },
  connDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  classicBody: { flex: 1 },
  classicTabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: dark.border,
  },
  classicTab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  classicTabActive: { borderBottomColor: dark.text.accent },
  classicTabText: { color: dark.text.secondary, fontSize: font.sm, fontWeight: '500' },
  classicTabTextActive: { color: dark.text.accent },
})
```

- [ ] **Step 2: Delete the old (tabs) files**

```bash
rm /Users/ronenmars/Desktop/dev/ai-tools/tb-mobile/app/\(tabs\)/_layout.tsx
rm /Users/ronenmars/Desktop/dev/ai-tools/tb-mobile/app/\(tabs\)/sessions.tsx
rm /Users/ronenmars/Desktop/dev/ai-tools/tb-mobile/app/\(tabs\)/history.tsx
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd /Users/ronenmars/Desktop/dev/ai-tools/tb-mobile && npx tsc --noEmit 2>&1 | head -30
```

Fix any remaining type errors before committing.

- [ ] **Step 4: Commit**

```bash
git add app/index.tsx
git add app/settings.tsx
git rm app/\(tabs\)/_layout.tsx app/\(tabs\)/sessions.tsx app/\(tabs\)/history.tsx
git commit -m "feat: replace tab navigator with Projects hub root screen"
```

---

## Task 11: Update `app/_layout.tsx` — fix redirects and register new routes

**Files:**
- Modify: `app/_layout.tsx`

- [ ] **Step 1: Update redirect targets and add new stack screens**

In `app/_layout.tsx`, make three changes:

1. Replace the redirect from `/(tabs)/sessions` → `/` in the `AuthGate` effect:
```tsx
// Replace:
router.replace('/(tabs)/sessions')
// With:
router.replace('/')
```

2. Remove the `(tabs)` stack screen registration (the `<Stack.Screen name="(tabs)" ...>` entry).

3. Add new stack screens inside `<Stack>`:
```tsx
<Stack.Screen
  name="settings"
  options={{ title: 'Settings', headerShown: true }}
/>
<Stack.Screen
  name="project/[path]"
  options={({ route }) => ({
    title: decodeURIComponent((route.params as { path?: string }).path?.split('/').pop() ?? 'Project'),
  })}
/>
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /Users/ronenmars/Desktop/dev/ai-tools/tb-mobile && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Start Metro and smoke-test in simulator**

```bash
cd /Users/ronenmars/Desktop/dev/ai-tools/tb-mobile && npx expo start --ios
```

Verify:
- App opens to Projects hub (hub mode)
- Avatar menu opens with Settings / Servers / Hub view toggle items
- Green FAB is visible and tappable
- At least one project card appears
- Tapping a card expands it
- Tapping a conversation row navigates to the conversation detail
- Settings push from avatar menu works
- Classic mode toggle shows segmented Sessions / History control

- [ ] **Step 4: Commit**

```bash
git add app/_layout.tsx
git commit -m "feat: update root layout for tab-free navigation"
```

---

## Task 12: Fix `ClassicSessionsList` — remove require() anti-pattern

The `ClassicSessionsList` function in `app/index.tsx` uses `require()` to avoid circular imports. Refactor it to use proper imports.

**Files:**
- Modify: `app/index.tsx`

- [ ] **Step 1: Move `ClassicSessionsList` into its own file**

Create `components/sessions/ClassicSessionsList.tsx`:

```tsx
import React from 'react'
import { FlatList, RefreshControl, StyleSheet } from 'react-native'
import { SessionCard } from '@/components/sessions/SessionCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { dark, spacing } from '@/constants/theme'
import type { MultiSession } from '@/types/api'

interface Props {
  sessions: MultiSession[]
  refreshing: boolean
  onRefresh: () => void
}

export function ClassicSessionsList({ sessions, refreshing, onRefresh }: Props) {
  return (
    <FlatList
      data={sessions}
      keyExtractor={(item) => `${item.serverId}::${item.id}`}
      renderItem={({ item }) => <SessionCard session={item} />}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={dark.text.secondary}
        />
      }
      ListEmptyComponent={
        <EmptyState title="No sessions" subtitle="Start a Claude Code session to see it here" />
      }
    />
  )
}

const styles = StyleSheet.create({
  content: { padding: spacing.sm, flexGrow: 1 },
})
```

- [ ] **Step 2: Update `app/index.tsx` to import `ClassicSessionsList`**

Remove the inline `ClassicSessionsList` function and its `require()` calls. Add to imports:
```tsx
import { ClassicSessionsList } from '@/components/sessions/ClassicSessionsList'
```

- [ ] **Step 3: Verify TypeScript and run Metro**

```bash
cd /Users/ronenmars/Desktop/dev/ai-tools/tb-mobile && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add components/sessions/ClassicSessionsList.tsx app/index.tsx
git commit -m "refactor: extract ClassicSessionsList component"
```

---

## Task 13: Wire navigation for search results in `ProjectHubList`

The search result `SearchResultItem` components in `ProjectHubList` have empty `onPress` handlers. Wire them up.

**Files:**
- Modify: `components/sessions/hub/ProjectHubList.tsx`

- [ ] **Step 1: Add router and wire onPress for search results**

Add `useRouter` import and wire both search result item lists:

```tsx
import { useRouter } from 'expo-router'

// Inside ProjectHubList, add:
const router = useRouter()

// For conversation results:
onPress={() => router.push(`/conversation/${c.id}?server=${c.serverId}`)}

// For session results:
onPress={() => {
  if (s.source === 'discovered' && s.conversationId) {
    router.push(`/conversation/${s.conversationId}?server=${s.serverId}`)
  } else {
    router.push(`/session/${s.id}?server=${s.serverId}`)
  }
}}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /Users/ronenmars/Desktop/dev/ai-tools/tb-mobile && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add components/sessions/hub/ProjectHubList.tsx
git commit -m "fix: wire navigation for hub search results"
```

---

## Task 14: Delete `app/(tabs)/settings.tsx` and clean up (tabs) directory

Once `app/settings.tsx` is confirmed working and `app/(tabs)/sessions.tsx` and `history.tsx` are deleted, remove the last file and the (tabs) directory entirely.

**Files:**
- Delete: `app/(tabs)/settings.tsx`
- Delete directory: `app/(tabs)/`

- [ ] **Step 1: Delete settings from (tabs)**

```bash
rm /Users/ronenmars/Desktop/dev/ai-tools/tb-mobile/app/\(tabs\)/settings.tsx
rmdir /Users/ronenmars/Desktop/dev/ai-tools/tb-mobile/app/\(tabs\)/ 2>/dev/null || true
```

- [ ] **Step 2: Verify no broken imports**

```bash
cd /Users/ronenmars/Desktop/dev/ai-tools/tb-mobile && grep -r "(tabs)/settings" --include="*.tsx" --include="*.ts" . | grep -v node_modules
```

Expected: no output.

- [ ] **Step 3: Verify TypeScript**

```bash
cd /Users/ronenmars/Desktop/dev/ai-tools/tb-mobile && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git rm "app/(tabs)/settings.tsx" 2>/dev/null || git add -A
git commit -m "chore: remove (tabs) directory, navigation fully migrated"
```

---

## Task 15: Full smoke-test and final cleanup

- [ ] **Step 1: Run full TypeScript check**

```bash
cd /Users/ronenmars/Desktop/dev/ai-tools/tb-mobile && npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 2: Run existing tests**

```bash
cd /Users/ronenmars/Desktop/dev/ai-tools/tb-mobile && npx jest --passWithNoTests 2>&1 | tail -20
```

Expected: all pass.

- [ ] **Step 3: Smoke test checklist in simulator**

Open the app in iOS simulator (`npx expo start --ios`) and verify:

**Hub mode (default):**
- [ ] Projects screen loads with accordion cards
- [ ] Avatar button opens dropdown (Settings, Servers, Hub view toggle)
- [ ] Tapping "Classic view" switches to classic mode and updates label to "Hub view"
- [ ] Search icon expands search bar; typing filters sessions and conversations
- [ ] Funnel icon opens ServerFilterSheet; active dot appears when filter applied
- [ ] Sort icon opens SortSheet; active dot appears when sort changed from default
- [ ] Tapping a collapsed card expands it showing sessions + conversations
- [ ] Multiple cards can be open at once
- [ ] Session row tap navigates to session detail
- [ ] Session row long-press shows action sheet
- [ ] Conversation row tap navigates to conversation detail
- [ ] "See all N conversations →" opens Project Detail screen with full list + search
- [ ] FAB opens new session picker
- [ ] Green FAB is above safe area on devices with home indicator

**Classic mode:**
- [ ] Segmented control shows ⚡ Sessions | 📚 History
- [ ] Sessions tab shows existing flat session cards
- [ ] History tab shows existing conversation list with search
- [ ] FAB still visible in both tabs

**Settings:**
- [ ] Tapping Settings in avatar menu pushes Settings screen
- [ ] Layout: Hub / Classic toggle works and persists after app restart

- [ ] **Step 4: Final commit if any fixes were made**

```bash
git add -p  # stage only the fixup changes
git commit -m "fix: smoke-test fixups"
```
