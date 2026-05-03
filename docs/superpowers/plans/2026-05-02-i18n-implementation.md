# i18n Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add production-grade i18n to tb-mobile using i18next — extracting all hardcoded strings into typed JSON namespaces across 5 waves, with RTL readiness and a clean Zustand-backed locale system.

**Architecture:** i18next initializes at app boot via `lib/i18n.ts`, reading device locale from `expo-localization` and storing it in `useSettingsStore`. `I18nextProvider` wraps the entire app tree. TypeScript types are derived from the English JSON files via module augmentation, giving compile-time key checking. Strings are extracted namespace-by-namespace in 5 independent waves; each wave's PR is independently shippable.

**Tech Stack:** i18next 23.x, react-i18next 15.x, expo-localization, intl-pluralrules, eslint-plugin-i18next (Wave 5)

---

## File Map

### New files
- `locales/en/common.json` — shared strings: buttons, errors, loading
- `locales/en/sessions.json` — session list, cards, status, sort/filter
- `locales/en/settings.json` — settings screen + notification strings
- `locales/en/servers.json` — server management modals
- `locales/en/terminal.json` — session detail, action sheets, alert dialogs
- `locales/en/onboarding.json` — onboarding, browse, conversation screens
- `lib/i18n.ts` — i18next init + device locale detection + RTL wiring
- `lib/i18n.types.ts` — TypeScript module augmentation for all namespaces
- `test-utils/i18n-setup.ts` — i18next init with real English translations for tests
- `test-utils/render.tsx` — `renderWithI18n()` wrapper utility

### Modified files
- `package.json` — add i18next, react-i18next, expo-localization, intl-pluralrules
- `app/_layout.tsx` — import `lib/i18n.ts`, wrap tree with `I18nextProvider`
- `stores/settings.ts` — add `locale: string` + `setLocale()` + persist
- `jest.setup.js` — import `test-utils/i18n-setup.ts`
- `components/ui/Badge.tsx` — Wave 1
- `components/ui/EmptyState.tsx` — Wave 1
- `components/ui/Banner.tsx` — Wave 1
- `components/shared/ScreenHeader.tsx` — Wave 1
- `components/sessions/SessionCard.tsx` — Wave 2
- `components/sessions/classic/ClassicSessionsList.tsx` — Wave 2
- `components/sessions/hub/HubSessionsList.tsx` — Wave 2
- `components/sessions/tree/TreeSessionsList.tsx` — Wave 2
- `app/index.tsx` — Wave 2
- `app/session/[id].tsx` — Wave 3
- `components/terminal/TerminalOutput.tsx` — Wave 3
- `app/settings.tsx` — Wave 4
- `components/servers/ServerListCard.tsx` — Wave 4
- `components/servers/ServerEditModal.tsx` — Wave 4
- `app/onboarding.tsx` — Wave 5
- `app/browse.tsx` — Wave 5
- `app/conversation/[id].tsx` — Wave 5
- `.eslintrc.js` — Wave 5: add eslint-plugin-i18next rule

---

## Task 1: Install packages

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install dependencies**

```bash
npx expo install expo-localization
npm install i18next react-i18next intl-pluralrules
```

Expected output: packages added to `node_modules`, versions locked in `package.json`.

- [ ] **Step 2: Verify installs**

```bash
node -e "require('i18next'); require('react-i18next'); require('expo-localization'); require('intl-pluralrules'); console.log('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install i18next, react-i18next, expo-localization, intl-pluralrules"
```

---

## Task 2: Create common.json (English baseline)

**Files:**
- Create: `locales/en/common.json`

- [ ] **Step 1: Create the locales directory and common.json**

```bash
mkdir -p locales/en
```

Write `locales/en/common.json`:

```json
{
  "button": {
    "cancel": "Cancel",
    "confirm": "Confirm",
    "save": "Save",
    "done": "Done",
    "back": "Back",
    "close": "Close",
    "retry": "Retry",
    "remove": "Remove"
  },
  "error": {
    "generic": "Something went wrong",
    "loadFailed": "Unable to load",
    "connectionFailed": "Connection failed"
  },
  "state": {
    "loading": "Loading…",
    "empty": "Nothing here yet",
    "noResults": "No results"
  },
  "search": {
    "placeholder": "Search…",
    "clear": "Clear search"
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add locales/en/common.json
git commit -m "feat(i18n): add locales/en/common.json baseline"
```

---

## Task 3: Create remaining namespace JSON files

**Files:**
- Create: `locales/en/sessions.json`
- Create: `locales/en/terminal.json`
- Create: `locales/en/settings.json`
- Create: `locales/en/servers.json`
- Create: `locales/en/onboarding.json`

- [ ] **Step 1: Create sessions.json**

Write `locales/en/sessions.json`:

```json
{
  "header": {
    "title": "Sessions",
    "history": "History"
  },
  "search": {
    "placeholder": "Search sessions & conversations…"
  },
  "filter": {
    "label": "Filter & Sort",
    "all": "All",
    "active": "Active",
    "waiting": "Waiting",
    "completed": "Completed",
    "failed": "Failed"
  },
  "sort": {
    "label": "Sort",
    "newest": "Newest",
    "oldest": "Oldest",
    "az": "A–Z"
  },
  "list": {
    "sessionCount_one": "{{count}} session",
    "sessionCount_other": "{{count}} sessions",
    "empty": "No sessions",
    "emptySubtitle": "Start a Claude Code session to see it here",
    "noResults": "No results",
    "noResultsSubtitle": "Nothing matched \"{{query}}\""
  },
  "card": {
    "status": {
      "active": "Active",
      "waiting": "Waiting for Input",
      "completed": "Session Completed",
      "failed": "Session Failed",
      "starting": "Starting…",
      "stopping": "Stopping…"
    },
    "connectedTo": "{{server}}",
    "copyId": "Copy Session ID",
    "sendInput": "Send Input",
    "cancel": "Cancel Session",
    "remove": "Remove Session",
    "viewError": "View connection error"
  },
  "takeover": {
    "prompt": "Another client is controlling this session",
    "takeControl": "Take Control",
    "dismiss": "Dismiss"
  },
  "directory": {
    "empty": "Empty directory",
    "loadFailed": "Unable to load directories",
    "browsingNotConfigured": "Browsing not configured"
  }
}
```

- [ ] **Step 2: Create terminal.json**

Write `locales/en/terminal.json`:

```json
{
  "header": {
    "session": "Session"
  },
  "action": {
    "copyId": "Copy Session ID",
    "sendInput": "Send Input",
    "cancel": "Cancel Session",
    "more": "More"
  },
  "dialog": {
    "cancelTitle": "Cancel Session",
    "cancelMessage": "Are you sure you want to cancel this session?",
    "cancelConfirm": "Cancel Session",
    "cancelDismiss": "Keep Running",
    "removeTitle": "Remove Session",
    "removeMessage": "Are you sure you want to remove this session?",
    "removeConfirm": "Remove",
    "removeDismiss": "Keep"
  },
  "status": {
    "connecting": "Connecting…",
    "reconnecting": "Reconnecting…",
    "disconnected": "Disconnected",
    "waking": "Waking up…"
  },
  "input": {
    "placeholder": "Send a message…",
    "send": "Send"
  }
}
```

- [ ] **Step 3: Create settings.json**

Write `locales/en/settings.json`:

```json
{
  "header": {
    "title": "Settings"
  },
  "section": {
    "appearance": "Appearance",
    "servers": "Servers",
    "notifications": "Notifications",
    "about": "About"
  },
  "appearance": {
    "theme": "Theme",
    "dark": "Dark",
    "light": "Light",
    "system": "System"
  },
  "notifications": {
    "whenAddingServer": "When Adding A New Server",
    "waitingForInput": "Waiting for Input",
    "sessionCompleted": "Session Completed",
    "sessionFailed": "Session Failed",
    "diffReady": "Diff Ready",
    "showBadgeCount": "Show Badge Count",
    "quietHours": "Quiet Hours"
  },
  "notification": {
    "testTitle": "Test Notification",
    "testBody": "Threadbase notifications are working!"
  }
}
```

- [ ] **Step 4: Create servers.json**

Write `locales/en/servers.json`:

```json
{
  "header": {
    "title": "Servers"
  },
  "status": {
    "connected": "Connected",
    "disconnected": "Disconnected",
    "connecting": "Connecting…",
    "error": "Connection Error"
  },
  "action": {
    "add": "Add Server",
    "edit": "Edit",
    "remove": "Remove Server",
    "viewError": "View connection error"
  },
  "dialog": {
    "removeTitle": "Remove Server",
    "removeMessage": "Are you sure you want to remove this server?",
    "removeConfirm": "Remove",
    "removeDismiss": "Cancel"
  },
  "form": {
    "name": "Name",
    "url": "URL",
    "namePlaceholder": "My Server",
    "urlPlaceholder": "http://localhost:3000"
  }
}
```

- [ ] **Step 5: Create onboarding.json**

Write `locales/en/onboarding.json`:

```json
{
  "welcome": {
    "title": "Welcome to Threadbase",
    "subtitle": "Connect to your Claude Code sessions"
  },
  "addServer": {
    "title": "Add a Server",
    "subtitle": "Enter your Threadbase server URL to get started"
  },
  "browse": {
    "title": "Browse",
    "empty": "No files",
    "emptySubtitle": "This directory is empty"
  },
  "conversation": {
    "title": "Conversation",
    "empty": "No messages",
    "emptySubtitle": "No conversation history yet"
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add locales/en/sessions.json locales/en/terminal.json locales/en/settings.json locales/en/servers.json locales/en/onboarding.json
git commit -m "feat(i18n): add all English namespace JSON files"
```

---

## Task 4: Create lib/i18n.ts and lib/i18n.types.ts

**Files:**
- Create: `lib/i18n.ts`
- Create: `lib/i18n.types.ts`

- [ ] **Step 1: Write lib/i18n.types.ts**

Write `lib/i18n.types.ts`:

```typescript
import type common from '../locales/en/common.json';
import type sessions from '../locales/en/sessions.json';
import type terminal from '../locales/en/terminal.json';
import type settings from '../locales/en/settings.json';
import type servers from '../locales/en/servers.json';
import type onboarding from '../locales/en/onboarding.json';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: {
      common: typeof common;
      sessions: typeof sessions;
      terminal: typeof terminal;
      settings: typeof settings;
      servers: typeof servers;
      onboarding: typeof onboarding;
    };
  }
}
```

- [ ] **Step 2: Write lib/i18n.ts**

Write `lib/i18n.ts`:

```typescript
import 'intl-pluralrules';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales, isRTL } from 'expo-localization';
import { I18nManager } from 'react-native';

import common from '../locales/en/common.json';
import sessions from '../locales/en/sessions.json';
import terminal from '../locales/en/terminal.json';
import settings from '../locales/en/settings.json';
import servers from '../locales/en/servers.json';
import onboarding from '../locales/en/onboarding.json';

import './i18n.types';

const deviceLocale = getLocales()[0]?.languageCode ?? 'en';

I18nManager.forceRTL(isRTL);

i18n.use(initReactI18next).init({
  lng: deviceLocale,
  fallbackLng: 'en',
  defaultNS: 'common',
  resources: {
    en: { common, sessions, terminal, settings, servers, onboarding },
  },
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add lib/i18n.ts lib/i18n.types.ts
git commit -m "feat(i18n): add i18n init and TypeScript namespace types"
```

---

## Task 5: Wire i18n into app root and Zustand

**Files:**
- Modify: `app/_layout.tsx`
- Modify: `stores/settings.ts`

- [ ] **Step 1: Add locale field to settings store**

In `stores/settings.ts`, make these changes:

Add `locale` to the `PersistedSettings` interface (the plain object that gets persisted):
```typescript
type PersistedSettings = {
  // ... existing fields ...
  locale: string;
};
```

Add `locale` and `setLocale` to `SettingsStore` interface:
```typescript
interface SettingsStore {
  // ... existing fields ...
  locale: string;
  setLocale: (locale: string) => void;
}
```

Add initial value and setter in the `create()` call:
```typescript
locale: 'en',
setLocale: (locale) => set({ locale }),
```

Add `locale` to the `hydrate()` function where persisted settings are read (alongside the other fields like `colorScheme`):
```typescript
if (stored.locale) set({ locale: stored.locale });
```

Add `locale` to the subscription write (alongside other fields):
```typescript
locale: s.locale,
```

- [ ] **Step 2: Wrap app tree with I18nextProvider**

In `app/_layout.tsx`, add these two imports at the top of the imports block:
```typescript
import { I18nextProvider } from 'react-i18next';
import i18n from '@/lib/i18n';
```

Wrap the return JSX so `I18nextProvider` is the outermost wrapper (just inside `GestureHandlerRootView`):

```tsx
return (
  <GestureHandlerRootView style={{ flex: 1 }}>
    <I18nextProvider i18n={i18n}>
      <SafeAreaProvider>
        {/* ... rest of existing tree unchanged ... */}
      </SafeAreaProvider>
    </I18nextProvider>
  </GestureHandlerRootView>
);
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/_layout.tsx stores/settings.ts
git commit -m "feat(i18n): wire I18nextProvider into root layout and add locale to settings store"
```

---

## Task 6: Add test utilities for i18n

**Files:**
- Create: `test-utils/i18n-setup.ts`
- Create: `test-utils/render.tsx`
- Modify: `jest.setup.js`

- [ ] **Step 1: Create test-utils/i18n-setup.ts**

Write `test-utils/i18n-setup.ts`:

```typescript
import 'intl-pluralrules';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import common from '../locales/en/common.json';
import sessions from '../locales/en/sessions.json';
import terminal from '../locales/en/terminal.json';
import settings from '../locales/en/settings.json';
import servers from '../locales/en/servers.json';
import onboarding from '../locales/en/onboarding.json';

i18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  defaultNS: 'common',
  resources: {
    en: { common, sessions, terminal, settings, servers, onboarding },
  },
  interpolation: { escapeValue: false },
});

export default i18n;
```

- [ ] **Step 2: Create test-utils/render.tsx**

Write `test-utils/render.tsx`:

```tsx
import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react-native';
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n-setup';

export function renderWithI18n(ui: ReactElement, options?: RenderOptions) {
  return render(
    <I18nextProvider i18n={i18n}>{ui}</I18nextProvider>,
    options
  );
}
```

- [ ] **Step 3: Import i18n setup in jest.setup.js**

Add this line near the top of `jest.setup.js` (after existing imports):

```javascript
import './test-utils/i18n-setup';
```

- [ ] **Step 4: Run the full test suite to confirm nothing broke**

```bash
npm test -- --passWithNoTests
```

Expected: all 265 existing tests pass (i18n setup is additive, no existing tests changed).

- [ ] **Step 5: Commit**

```bash
git add test-utils/i18n-setup.ts test-utils/render.tsx jest.setup.js
git commit -m "feat(i18n): add test utilities — i18n-setup and renderWithI18n"
```

---

## Task 7: Add i18n unit tests (plurals + key smoke test)

**Files:**
- Create: `__tests__/i18n.test.ts`

- [ ] **Step 1: Write failing tests**

Write `__tests__/i18n.test.ts`:

```typescript
import i18n from '../test-utils/i18n-setup';

describe('i18n', () => {
  it('returns English string for a common key', () => {
    expect(i18n.t('common:button.cancel')).toBe('Cancel');
  });

  it('returns singular session count', () => {
    expect(i18n.t('sessions:list.sessionCount', { count: 1 })).toBe('1 session');
  });

  it('returns plural session count', () => {
    expect(i18n.t('sessions:list.sessionCount', { count: 3 })).toBe('3 sessions');
  });

  it('interpolates server name', () => {
    expect(i18n.t('sessions:card.connectedTo', { server: 'My Mac' })).toBe('My Mac');
  });

  it('falls back to key when translation is missing', () => {
    expect(i18n.t('common:nonexistent.key')).toBe('common:nonexistent.key');
  });

  it.skip('runtime locale switch re-renders with new strings (implement when runtime switching is added)', () => {
    // assert: changing i18n.changeLanguage('he') triggers re-render with Hebrew strings
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

```bash
npm test -- __tests__/i18n.test.ts
```

Expected: 5 passing, 1 skipped.

- [ ] **Step 3: Commit**

```bash
git add __tests__/i18n.test.ts
git commit -m "test(i18n): add plural, interpolation, and smoke tests"
```

---

## Task 8: Wave 1 — Migrate common UI components

**Files:**
- Modify: `components/ui/EmptyState.tsx`
- Modify: `components/ui/Banner.tsx`
- Modify: `components/ui/Badge.tsx`
- Modify: `components/shared/ScreenHeader.tsx`

The pattern for every component in this wave and all future waves:

```tsx
// Before
import { useTranslation } from 'react-i18next';  // ADD THIS

// Inside component
const { t } = useTranslation('common');           // ADD THIS

// Then replace hardcoded strings:
// "Loading…"  →  {t('state.loading')}
// "Cancel"    →  {t('button.cancel')}
```

- [ ] **Step 1: Migrate EmptyState.tsx**

In `components/ui/EmptyState.tsx`, the component receives `title` and `subtitle` as props from callers — it does not hardcode strings itself. No changes needed to `EmptyState.tsx` itself. The callers will be updated in Wave 2 when sessions strings are extracted.

Verify by reading the file:
```bash
grep -n "hardcoded\|Loading\|Cancel\|Error" components/ui/EmptyState.tsx
```

If the component does have its own hardcoded fallback strings, replace them with `t()` calls using the `common` namespace.

- [ ] **Step 2: Migrate Banner.tsx**

In `components/ui/Banner.tsx`, find any hardcoded label strings (e.g. "Dismiss", "Close"). Add `useTranslation('common')` and replace with `t('button.close')` etc.

```bash
grep -n '"' components/ui/Banner.tsx
```

Replace each hardcoded string with the appropriate `common` namespace key.

- [ ] **Step 3: Migrate ScreenHeader.tsx**

In `components/shared/ScreenHeader.tsx`, find any hardcoded navigation labels (e.g. "Back", "Settings", "Search"). Add `useTranslation('common')` and replace with `t()` calls. Labels passed as props from callers are not changed here — only strings hardcoded inside the component itself.

```bash
grep -n '"' components/shared/ScreenHeader.tsx
```

- [ ] **Step 4: Run the test suite**

```bash
npm test
```

Expected: all tests still pass. Existing `getByText('Cancel')` style assertions continue to work because real English translations return the same strings.

- [ ] **Step 5: Commit**

```bash
git add components/ui/EmptyState.tsx components/ui/Banner.tsx components/ui/Badge.tsx components/shared/ScreenHeader.tsx
git commit -m "feat(i18n): Wave 1 — migrate common UI components to i18n"
```

---

## Task 9: Wave 2 — Migrate sessions namespace

**Files:**
- Modify: `components/sessions/SessionCard.tsx`
- Modify: `components/sessions/classic/ClassicSessionsList.tsx`
- Modify: `components/sessions/hub/HubSessionsList.tsx`
- Modify: `components/sessions/tree/TreeSessionsList.tsx`
- Modify: `app/index.tsx`

- [ ] **Step 1: Migrate SessionCard.tsx**

Add `import { useTranslation } from 'react-i18next'` and inside the component:
```tsx
const { t } = useTranslation('sessions');
```

Replace all hardcoded status strings:
```tsx
// Before
'Active'           →  t('card.status.active')
'Waiting for Input' →  t('card.status.waiting')
'Session Completed' →  t('card.status.completed')
'Session Failed'    →  t('card.status.failed')
'Copy Session ID'   →  t('card.copyId')
'Send Input'        →  t('card.sendInput')
'Cancel Session'    →  t('card.cancel')
'Remove Session'    →  t('card.remove')
'View connection error' → t('card.viewError')
```

For Alert/ActionSheet calls (imperative, outside JSX), use `i18n.t()` directly:
```tsx
import i18n from '@/lib/i18n';

Alert.alert(
  i18n.t('sessions:dialog.cancelTitle'),  // if applicable
  ...
)
```

- [ ] **Step 2: Migrate ClassicSessionsList.tsx**

```tsx
const { t } = useTranslation('sessions');

// Line 44: placeholder
placeholder={t('search.placeholder')}

// Line 63: EmptyState with query
<EmptyState
  title={t('list.noResults')}
  subtitle={t('list.noResultsSubtitle', { query: debouncedQuery })}
/>

// Line 65: EmptyState no sessions
<EmptyState
  title={t('list.empty')}
  subtitle={t('list.emptySubtitle')}
/>
```

- [ ] **Step 3: Migrate HubSessionsList.tsx and TreeSessionsList.tsx**

Apply the same pattern as ClassicSessionsList — replace search placeholder, EmptyState titles/subtitles, and any status/action labels with `t()` calls from the `sessions` namespace.

Run this to find all hardcoded strings in these files:
```bash
grep -n '"' components/sessions/hub/HubSessionsList.tsx components/sessions/tree/TreeSessionsList.tsx
```

- [ ] **Step 4: Migrate app/index.tsx**

Find hardcoded tab labels and screen titles:
```bash
grep -n '"' app/index.tsx
```

Replace with:
```tsx
const { t } = useTranslation('sessions');
// "Sessions" → t('header.title')
// "History"  → t('header.history')
```

- [ ] **Step 5: Run tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add components/sessions/ app/index.tsx
git commit -m "feat(i18n): Wave 2 — migrate sessions namespace"
```

---

## Task 10: Wave 3 — Migrate terminal namespace

**Files:**
- Modify: `app/session/[id].tsx`
- Modify: `components/terminal/TerminalOutput.tsx`

- [ ] **Step 1: Find all hardcoded strings in terminal files**

```bash
grep -n '"' app/session/\[id\].tsx components/terminal/TerminalOutput.tsx
```

Note every hardcoded string and its line number.

- [ ] **Step 2: Migrate app/session/[id].tsx**

Add `useTranslation('terminal')` hook. Replace JSX strings with `t()` calls. For `Alert.alert()` and `ActionSheetIOS` calls, use `i18n.t('terminal:...')` directly:

```tsx
import i18n from '@/lib/i18n';

Alert.alert(
  i18n.t('terminal:dialog.cancelTitle'),
  i18n.t('terminal:dialog.cancelMessage'),
  [
    { text: i18n.t('terminal:dialog.cancelDismiss'), style: 'cancel' },
    { text: i18n.t('terminal:dialog.cancelConfirm'), style: 'destructive', onPress: handleCancel },
  ]
);
```

- [ ] **Step 3: Migrate TerminalOutput.tsx**

Replace any status labels or UI strings using `useTranslation('terminal')`.

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/session/\[id\].tsx components/terminal/
git commit -m "feat(i18n): Wave 3 — migrate terminal namespace"
```

---

## Task 11: Wave 4 — Migrate servers + settings namespaces

**Files:**
- Modify: `app/settings.tsx`
- Modify: `components/servers/ServerListCard.tsx`
- Modify: `components/servers/ServerEditModal.tsx`

- [ ] **Step 1: Find all hardcoded strings**

```bash
grep -n '"' app/settings.tsx components/servers/ServerListCard.tsx components/servers/ServerEditModal.tsx
```

- [ ] **Step 2: Migrate app/settings.tsx**

```tsx
const { t } = useTranslation('settings');

// Section headers
t('header.title')           // "Settings"
t('section.appearance')     // "Appearance"
t('section.servers')        // "Servers"
t('section.notifications')  // "Notifications"

// Notification toggles
t('notifications.waitingForInput')   // "Waiting for Input"
t('notifications.sessionCompleted')  // "Session Completed"
// etc.
```

For notification service calls (imperative), use `i18n.t('settings:notification.testTitle')` etc. directly.

- [ ] **Step 3: Migrate ServerListCard.tsx and ServerEditModal.tsx**

```tsx
const { t } = useTranslation('servers');

// Status labels
t('status.connected')     // "Connected"
t('status.disconnected')  // "Disconnected"

// Action labels
t('action.remove')        // "Remove Server"
t('action.viewError')     // "View connection error"

// Alert dialogs (imperative)
Alert.alert(
  i18n.t('servers:dialog.removeTitle'),
  i18n.t('servers:dialog.removeMessage'),
  [
    { text: i18n.t('servers:dialog.removeDismiss'), style: 'cancel' },
    { text: i18n.t('servers:dialog.removeConfirm'), style: 'destructive', onPress: handleRemove },
  ]
);
```

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/settings.tsx components/servers/
git commit -m "feat(i18n): Wave 4 — migrate servers and settings namespaces"
```

---

## Task 12: Wave 5 — Migrate onboarding/browse/conversation + add ESLint guard

**Files:**
- Modify: `app/onboarding.tsx`
- Modify: `app/browse.tsx`
- Modify: `app/conversation/[id].tsx`
- Modify: `.eslintrc.js`
- Modify: `package.json` (add eslint-plugin-i18next)

- [ ] **Step 1: Find all hardcoded strings in remaining files**

```bash
grep -rn '"' app/onboarding.tsx app/browse.tsx app/conversation/
```

- [ ] **Step 2: Migrate remaining screens**

```tsx
const { t } = useTranslation('onboarding');

// Welcome
t('welcome.title')     // "Welcome to Threadbase"
t('welcome.subtitle')  // "Connect to your Claude Code sessions"

// Browse
t('browse.empty')         // "No files"
t('browse.emptySubtitle') // "This directory is empty"

// Conversation
t('conversation.empty')         // "No messages"
t('conversation.emptySubtitle') // "No conversation history yet"
```

- [ ] **Step 3: Install eslint-plugin-i18next**

```bash
npm install --save-dev eslint-plugin-i18next
```

- [ ] **Step 4: Update .eslintrc.js**

```javascript
module.exports = {
  extends: 'expo',
  root: true,
  plugins: ['i18next'],
  rules: {
    'i18next/no-literal-string': ['warn', {
      markupOnly: true,
      ignoreAttribute: ['testID', 'accessibilityRole', 'style', 'className'],
    }],
  },
};
```

- [ ] **Step 5: Run ESLint to check for remaining unharvested strings**

```bash
npx eslint app/ components/ --ext .tsx,.ts
```

Review warnings — each one is a string that was missed. Fix remaining ones by extracting to the appropriate namespace JSON and using `t()`.

- [ ] **Step 6: Run full test suite one final time**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add app/onboarding.tsx app/browse.tsx app/conversation/ .eslintrc.js package.json package-lock.json
git commit -m "feat(i18n): Wave 5 — migrate onboarding/browse/conversation, add ESLint i18next guard"
```

---

## Task 13: Key completeness test (future locale guard)

**Files:**
- Create: `__tests__/i18n-completeness.test.ts`

This test does nothing today (only English exists), but it will automatically catch missing keys when a second locale is added.

- [ ] **Step 1: Write the test**

Write `__tests__/i18n-completeness.test.ts`:

```typescript
import enCommon from '../locales/en/common.json';
import enSessions from '../locales/en/sessions.json';
import enTerminal from '../locales/en/terminal.json';
import enSettings from '../locales/en/settings.json';
import enServers from '../locales/en/servers.json';
import enOnboarding from '../locales/en/onboarding.json';

const enResources = { enCommon, enSessions, enTerminal, enSettings, enServers, enOnboarding };

function getAllKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    return typeof v === 'object' && v !== null
      ? getAllKeys(v as Record<string, unknown>, key)
      : [key];
  });
}

// When Hebrew (or any locale) is added, import its resources here and
// uncomment the test below. It will fail CI if any English key is missing.

// import heCommon from '../locales/he/common.json';
// ...

describe.skip('i18n key completeness (enable when a second locale is added)', () => {
  it('Hebrew has all English keys', () => {
    // const heResources = { heCommon, ... };
    // Object.entries(enResources).forEach(([ns, enNs]) => {
    //   const enKeys = getAllKeys(enNs as Record<string, unknown>);
    //   const heKeys = getAllKeys(heResources[ns] as Record<string, unknown>);
    //   enKeys.forEach(key => expect(heKeys).toContain(key));
    // });
  });
});
```

- [ ] **Step 2: Run tests**

```bash
npm test -- __tests__/i18n-completeness.test.ts
```

Expected: 0 passing, 1 suite skipped. No failures.

- [ ] **Step 3: Commit**

```bash
git add __tests__/i18n-completeness.test.ts
git commit -m "test(i18n): add skipped key completeness test for future locales"
```

---

## Verification Checklist

- [ ] `npx tsc --noEmit` — zero TypeScript errors
- [ ] `npm test` — all 265+ tests pass
- [ ] App boots on iOS simulator, `expo-localization` detects locale, strings render from JSON
- [ ] Intentional key typo (e.g. `t('button.cancle')`) fails `tsc` compilation
- [ ] `npx eslint app/ components/ --ext .tsx,.ts` — zero i18next warnings after Wave 5
- [ ] RTL test: in Expo Go set device locale to Hebrew → layout flips (verify after Hebrew locale added)
