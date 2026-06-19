# Session View Toggle Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Allow users to choose between chat-bubbles view (default) and terminal view on the live session screen, controlled by a setting (`sessionView`) in the Settings screen — no tabs, just a persisted preference.

**Architecture:**
- Extract all composer state/handlers from `LiveConversationView` into a new `useComposerState(serverId, sessionId)` hook
- `LiveConversationView` consumes the hook (no behaviour change)
- New `TerminalView` component: `TerminalOutput` above + `ChatComposer` below, also consuming the hook
- `stores/settings.ts` gains `sessionView: 'chat' | 'terminal'` (default `'chat'`)
- `app/session/[id].tsx` reads `sessionView` and renders `LiveConversationView` or `TerminalView`
- `app/settings.tsx` adds a toggle row under a new "Session" section

**Tech Stack:** React Native, Expo, TypeScript, Zustand, Jest + @testing-library/react-native.

## Global Constraints

- Icons: phosphor-react-native only, never emojis.
- Lint staged files before commit; conventional-commit titles; no AI attribution.
- Run jest with `--testPathIgnorePatterns '/node_modules/'` and `--moduleDirectories node_modules /Users/ronenmars/Desktop/dev/ai-tools/tb-mobile/node_modules` (worktree shares node_modules with main repo at `/Users/ronenmars/Desktop/dev/ai-tools/tb-mobile/node_modules`). Use `/Users/ronenmars/Desktop/dev/ai-tools/tb-mobile/node_modules/.bin/jest` directly.
- `settings-flow.test.tsx` is a known OOM flake — ignore it when assessing suite health.
- `ConversationListItem.test.tsx` has a pre-existing locale failure (Hebrew locale on machine) — ignore it.
- No `crypto.randomUUID` — use the existing optimistic counter pattern.
- All files in worktree root: `/Users/ronenmars/Desktop/dev/ai-tools/tb-mobile/.worktrees/feat/live-chat-view/`

---

### Task 1: Extract `useComposerState` hook

**Files:**
- Create: `hooks/useComposerState.ts`
- Create test: `__tests__/unit/hooks/useComposerState.test.ts`

**What to extract from `LiveConversationView`:**

All state and handlers that relate purely to the composer (NOT to the message list or optimistic sends — those stay in `LiveConversationView`):

```ts
// State
inputText, setInputText
attachments, setAttachments
isUploading, setIsUploading
attachError, setAttachError
slashBoardVisible, setSlashBoardVisible
pendingArgCommand, setPendingArgCommand
queueVisible, setQueueVisible
micGranted, setMicGranted
voice  // from useVoiceInput

// Handlers (exact signatures to preserve)
handleInputChange(text: string): void
handleSend(): void           // calls onSend callback
handleSlashCommandSelect(command: SlashCommand): void
handleSlashArgConfirm(command: SlashCommand, arg: string): void
runUpload(source: 'camera' | 'library' | 'files'): Promise<void>
handleAttach(): void
removeAttachment(id: string): void
handleToggleMic(): Promise<void>
resetComposer(): void
buildPayload(text: string): string | null
```

**Hook signature:**

```ts
interface UseComposerStateOptions {
  serverId: string
  sessionId: string
  /** Called by handleSend after building the wire payload. */
  onSend: (payload: string, optimisticText: string) => void
}

interface ComposerState {
  // Input
  inputText: string
  handleInputChange: (text: string) => void
  // Send
  handleSend: () => void
  // Slash
  slashBoardVisible: boolean
  setSlashBoardVisible: (v: boolean) => void
  pendingArgCommand: SlashCommand | null
  setPendingArgCommand: (c: SlashCommand | null) => void
  handleSlashCommandSelect: (command: SlashCommand) => void
  handleSlashArgConfirm: (command: SlashCommand, arg: string) => void
  // Attachments
  attachments: UploadedFile[]
  isUploading: boolean
  attachError: string | null
  handleAttach: () => void
  removeAttachment: (id: string) => void
  // Queue
  queueVisible: boolean
  setQueueVisible: (v: boolean) => void
  // Voice / mic
  voice: { listening: boolean; start: () => Promise<void>; stop: () => void }
  micGranted: boolean
  handleToggleMic: () => Promise<void>
}

export function useComposerState(opts: UseComposerStateOptions): ComposerState
```

**Note on auto-naming:** `handleSend` must preserve the auto-name-from-first-message logic currently in `LiveConversationView`. It reads `autoNameFromMessage` from `useSettingsStore` and `getName` from `useSessionNamesStore`.

**Test cases (`__tests__/unit/hooks/useComposerState.test.ts`):**
1. `handleInputChange` updates `inputText` and shows slash board when text starts with `/`
2. `handleSend` calls `onSend` with the trimmed text and clears the input
3. `handleSend` does nothing when input is empty and no attachments
4. `removeAttachment` removes the attachment with the matching id
5. `handleSlashCommandSelect` for a no-args command calls `onSend` immediately
6. `handleSlashCommandSelect` for a needs-args command sets `pendingArgCommand` and does NOT call `onSend`
7. `handleSlashArgConfirm` calls `onSend` with `/<id> <arg>` and clears `pendingArgCommand`

Mock `useDraftsStore`, `useSettingsStore`, `useSessionNamesStore`, `useRenameSession`, `useVoiceInput`, `ExpoSpeechRecognitionModule`, `@/services/uploads`, `expo-haptics`, `@/services/ws-client` (return `{ status: () => 'connected' }`), and `react-native/Libraries/Alert/Alert`.

**Steps:**
- [ ] Write failing tests
- [ ] Run → FAIL
- [ ] Implement hook (extract from `LiveConversationView`, no behaviour change)
- [ ] Run → PASS
- [ ] Lint + commit: `feat(hooks): extract useComposerState from LiveConversationView`

---

### Task 2: Refactor `LiveConversationView` to consume `useComposerState`

**Files:**
- Modify: `components/conversation/LiveConversationView.tsx`
- Existing tests must still pass: `__tests__/integration/components/LiveConversationView.test.tsx`

**What changes:**
- Replace the extracted state/handlers with a single `useComposerState` call
- The `send` function (which does optimistic message management + WS mutation) stays in `LiveConversationView` and is passed as `onSend` to the hook
- The `pendingSends` state and dedup logic stay in `LiveConversationView`
- All JSX stays identical — the component is a refactor only, zero behaviour change

**Verify:** Run `--testPathPattern LiveConversationView` — both existing tests pass.

**Steps:**
- [ ] Refactor (no new tests needed — existing tests cover the behaviour)
- [ ] Run existing tests → PASS
- [ ] Lint + commit: `refactor(conversation): consume useComposerState in LiveConversationView`

---

### Task 3: Add `sessionView` to settings store

**Files:**
- Modify: `stores/settings.ts`

**Changes (exact values):**

Add to `SettingsStore` interface:
```ts
sessionView: 'chat' | 'terminal'
setSessionView: (v: 'chat' | 'terminal') => void
```

Add to `PersistedSettings` interface:
```ts
sessionView: 'chat' | 'terminal'
```

Default value: `'chat'`

In the store initialiser, add:
```ts
sessionView: 'chat',
setSessionView: (sessionView) => set({ sessionView }),
```

In `hydrate`, add:
```ts
sessionView: parsed.sessionView === 'terminal' ? 'terminal' : state.sessionView,
```

In the `subscribe` persistence payload, add:
```ts
sessionView: state.sessionView,
```

**Test:** No new test needed — the store pattern is identical to existing fields (`mergeChats`, `autoNameFromMessage`). TypeScript will catch errors. Run `npx tsc --noEmit` to verify.

**Steps:**
- [ ] Modify store
- [ ] `npx tsc --noEmit` → clean
- [ ] Lint + commit: `feat(settings): add sessionView preference (chat | terminal)`

---

### Task 4: Create `TerminalView` component

**Files:**
- Create: `components/terminal/TerminalView.tsx`
- Create test: `__tests__/integration/components/TerminalView.test.tsx`

**Interface:**
```ts
interface Props {
  serverId: string
  sessionId: string
  disabled?: boolean           // waking-up gate, passed to ChatComposer
  pendingPlan?: string | null
  onClosePlan?: () => void
}

export function TerminalView(props: Props): JSX.Element
```

**Behaviour:**
- Calls `useTerminalStream(serverId, sessionId)` for `{ lines, isStreaming }`
- Calls `useSessionActions(serverId, sessionId)` for `{ sendInput, sendKeys }`
- Calls `useComposerState({ serverId, sessionId, onSend })` where `onSend` calls `sendInput.mutate(payload, { onError: ... })`
- Renders (top to bottom):
  1. `<TerminalOutput lines={lines} isStreaming={isStreaming} onSendInput={...} onSendKeys={...} />`
  2. `<ChatComposer ...composerState... disabled={disabled} sendError={sendInput.isError ? ... : null} />`
  3. `<SlashCommandBoard ...>`, `<SlashCommandArgModal ...>`, `<PromptQueueSheet ...>`, `<PlanPreviewSheet ...>` — same pattern as `LiveConversationView`
- Wrap in `<KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>`

**`onSendInput` / `onSendKeys` for `TerminalOutput`:** pass `session?.status === 'waiting_input'` callbacks from `sendInput`/`sendKeys` — but since `TerminalView` doesn't receive `session`, simplify: always pass `onSendInput` and `onSendKeys` (they call `sendInput.mutate` / `sendKeys.mutate`). `TerminalOutput` ignores them when not in `waiting_input` — that's fine for the terminal view.

**Test cases (`__tests__/integration/components/TerminalView.test.tsx`):**
1. Renders `terminal-line-row` elements when `lines` are provided (mock `useTerminalStream` returning 2 lines)
2. Renders `chat-message-input` (the composer is present)
3. Typing and tapping `chat-send-button` calls `sendInput.mutate` with the typed text

Mock `useTerminalStream`, `useSessionActions`, `useComposerState` (return minimal stub), `@/services/ws-client`, `SlashCommandBoard`, `SlashCommandArgModal`, `PromptQueueSheet`, `PlanPreviewSheet`.

**Steps:**
- [ ] Write failing tests
- [ ] Run → FAIL
- [ ] Implement `TerminalView`
- [ ] Run → PASS
- [ ] Lint + commit: `feat(terminal): add TerminalView with ChatComposer`

---

### Task 5: Wire `sessionView` into `[id].tsx` and `settings.tsx`

**Files:**
- Modify: `app/session/[id].tsx`
- Modify: `app/settings.tsx`

**`[id].tsx` changes:**
- Import `TerminalView` from `@/components/terminal/TerminalView`
- Import `sessionView` and `setSessionView` (not needed in this file — just `sessionView`) from `useSettingsStore`
- In the `isLive` branch, replace the current `<LiveConversationView ... />` block with:
```tsx
{sessionView === 'terminal' ? (
  <TerminalView
    serverId={serverId}
    sessionId={id}
    disabled={isWakingUp}
    pendingPlan={planVisible ? pendingPlan : null}
    onClosePlan={() => { setPlanVisible(false); setPendingPlan(null) }}
  />
) : (
  <LiveConversationView
    serverId={serverId}
    sessionId={id}
    conversationId={session.conversationId!}
    disabled={isWakingUp}
    pendingPlan={planVisible ? pendingPlan : null}
    onClosePlan={() => { setPlanVisible(false); setPendingPlan(null) }}
  />
)}
```
- No other changes to `[id].tsx`.

**`settings.tsx` changes:**
- Import `sessionView` and `setSessionView` from `useSettingsStore`
- After the `sessionNaming` section (around line 500), add a new section:
```tsx
<SectionHeader title={t('section.session')} />
<SettingsRow
  label={t('session.terminalView')}
  value={sessionView === 'terminal'}
  onValueChange={(v) => setSessionView(v ? 'terminal' : 'chat')}
/>
<Text style={s.rowNote}>{t('session.terminalViewNote')}</Text>
```
- Add translation keys to `i18n/en/settings.json` (or wherever settings strings live — check the file):
  - `section.session`: `"Session"`
  - `session.terminalView`: `"Terminal view"`
  - `session.terminalViewNote`: `"Show the raw terminal output instead of chat bubbles for live sessions."`

**i18n file location:** check `i18n/` or `locales/` directory. Add only to the `en` file — other locales will fall back.

**Update `SessionScreen.bubbleOnly.test.tsx`:** The mock for `useSettingsStore` needs to return `sessionView: 'chat'` so the test still passes (it asserts no terminal tab, which is only true in chat mode).

**Steps:**
- [ ] Find and update i18n strings file
- [ ] Modify `app/session/[id].tsx`
- [ ] Modify `app/settings.tsx`
- [ ] Update `SessionScreen.bubbleOnly.test.tsx` mock
- [ ] Run `--testPathPattern SessionScreen.bubbleOnly` → PASS
- [ ] `npx tsc --noEmit` → clean
- [ ] Lint + commit: `feat(session): sessionView setting wires chat/terminal view toggle`

---

## Self-Review

- `useComposerState` hook extracts all composer logic: ✓ (Task 1)
- `LiveConversationView` behaviour unchanged: ✓ (Task 2 — existing tests verify)
- `TerminalView` uses same `ChatComposer` (attach/mic/expand/slash): ✓ (Task 4)
- `sessionView` persisted to AsyncStorage: ✓ (Task 3 — follows existing pattern)
- No tabs — pure settings toggle: ✓ (Task 5)
- Default is `'chat'`: ✓ (Task 3)
