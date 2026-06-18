# Bubble-only session screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `LiveConversationView` (bubble chat) the sole live view on the session screen, removing the Terminal tab/`TerminalOutput`/terminal composer, with the full composer (attach/voice/slash/queue/plan + PR #141 multiline+expand) ported into a new `ChatComposer`.

**Architecture:** Extract a `ChatComposer` component carrying every composer capability. `LiveConversationView` renders the message list + `ChatComposer` + the slash/queue/plan sheets. `app/session/[id].tsx` keeps pre-session screens and placeholders, but renders `LiveConversationView` in the live branch instead of the tab bar + terminal.

**Tech Stack:** React Native, Expo, FlashList, react-i18next, phosphor-react-native, Jest + @testing-library/react-native, Maestro.

## Global Constraints

- Icons: phosphor-react-native only, never emojis (project rule).
- Lint staged files before commit; conventional-commit titles; no AI attribution.
- Run jest with `--testPathIgnorePatterns '/node_modules/'` (worktree path contains `.worktrees/` which the default config ignores).
- `settings-flow.test.tsx` is a pre-existing OOM flake — ignore it when assessing suite health.
- No `crypto.randomUUID` for ids — use the existing optimistic counter pattern.

---

### Task 1: Extract `ChatComposer` with full feature parity + multiline expand

**Files:**
- Create: `components/conversation/ChatComposer.tsx`
- Create test: `__tests__/integration/components/ChatComposer.test.tsx`

**Interfaces:**
- Consumes: `useVoiceInput({ onTranscript, contextualStrings })` → `{ listening, start, stop }`; `UploadedFile` from `@/services/uploads`.
- Produces:
  ```ts
  interface ChatComposerProps {
    value: string
    onChangeText: (text: string) => void
    onSend: () => void           // parent builds payload + optimistic + mutate
    onAttach: () => void
    attachments: UploadedFile[]
    onRemoveAttachment: (id: string) => void
    isUploading: boolean
    attachError: string | null
    sendError: string | null
    disabled: boolean            // waking-up gate
    voice: { listening: boolean; start: () => Promise<void>; stop: () => void }
    micGranted: boolean
    onToggleMic: () => void
  }
  export function ChatComposer(props: ChatComposerProps): JSX.Element
  ```

- [ ] **Step 1: Write failing tests** in `ChatComposer.test.tsx`:
  - renders `chat-message-input`; typing calls `onChangeText`.
  - send button (`chat-send-button`) calls `onSend` when text present.
  - expand button (`expand-input-button`) opens modal showing `message-input-expanded`; minimize (`minimize-input-button`) closes it.
  - attach button calls `onAttach`; mic button (when `micGranted`) calls `onToggleMic`.
  Mock `@/contexts/ThemeContext` is global; wrap with i18n via `renderWithI18n` from `@/test-utils/render`.
- [ ] **Step 2: Run** `npx jest --testPathIgnorePatterns '/node_modules/' --testPathPattern ChatComposer` → FAIL (no module).
- [ ] **Step 3: Implement `ChatComposer`** — inline row (attach / multiline TextInput `chat-message-input` / expand `ArrowsOut` / send-or-mic) + attachment chips + error texts + full-screen `Modal` (`message-input-expanded`, toolbar: `ArrowsIn` minimize / attach / mic / send). Port styles + behavior from PR #141's expand modal and the current terminal composer (`app/session/[id].tsx` input block). Disabled state shows "Starting up…" placeholder and disables all controls.
- [ ] **Step 4: Run** the test → PASS.
- [ ] **Step 5: Lint + commit** `npx eslint components/conversation/ChatComposer.tsx __tests__/integration/components/ChatComposer.test.tsx` then `git commit -m "feat(conversation): add ChatComposer with multiline expand + attach/voice/slash"`.

---

### Task 2: Wire `ChatComposer` + sheets into `LiveConversationView`

**Files:**
- Modify: `components/conversation/LiveConversationView.tsx`
- Modify test: `__tests__/integration/components/LiveConversationView.test.tsx`

**Interfaces:**
- Consumes: `ChatComposer` from Task 1; existing `useSessionActions().sendInput`; `useConversation`, `useConversationStream`.
- Produces: `LiveConversationView` renders `ChatComposer` (replacing its inline TextInput) and the slash/queue/plan sheets; keeps `handleSend` optimistic path.

- [ ] **Step 1: Update tests** — the existing two tests (optimistic bubble, dedupe) must still pass against the `ChatComposer`-based markup (`chat-message-input`, `chat-send-button` testIDs unchanged). Add: attachments + slash text route correctly (build payload `@ref text`).
- [ ] **Step 2: Run** `--testPathPattern LiveConversationView` → expect the two existing tests to still pass after refactor (run before edit to confirm baseline, then after).
- [ ] **Step 3: Refactor** `LiveConversationView` to: own `attachments`, `attachError`, `isUploading`, `voice`, `micGranted`, slash board state, queue/plan visibility; move `buildPayload`/`resetComposer`/`runUpload`/`handleAttach`/`handleToggleMic`/slash handlers from `app/session/[id].tsx` into it; render `ChatComposer` + `SlashCommandBoard` + `SlashCommandArgModal` + `PromptQueueSheet` + `PlanPreviewSheet`. Keep optimistic `pendingSends`.
- [ ] **Step 4: Run** the tests → PASS.
- [ ] **Step 5: Lint + commit** `git commit -m "feat(conversation): render full composer + sheets in LiveConversationView"`.

---

### Task 3: Remove terminal tab/output/composer from session screen

**Files:**
- Modify: `app/session/[id].tsx`
- Create test: `__tests__/integration/components/SessionScreen.bubbleOnly.test.tsx` (light — assert no `message-input`/no tab testIDs in live branch)

**Interfaces:**
- Consumes: `LiveConversationView` (now self-contained composer).
- Produces: session screen renders `<LiveConversationView serverId sessionId conversationId />` in the live branch; no `activeTab`, no tab bar, no `TerminalOutput`, no terminal composer.

- [ ] **Step 1: Write failing test** — render `SessionDetailScreen` with a live session (mock `useSessionDetail` → `{ ptyAttached:true, status:'waiting_input', conversationId:'c1' }`, mock `LiveConversationView`); assert `queryByTestId('session-tab-terminal')` is null and `queryByTestId('message-input')` is null. (Mock heavy native deps as needed; if too heavy, assert via a focused unit on the render-branch helper instead.)
- [ ] **Step 2: Run** `--testPathPattern SessionScreen.bubbleOnly` → FAIL.
- [ ] **Step 3: Edit `app/session/[id].tsx`:** remove tab bar JSX, `activeTab` state, `TerminalOutput` render, the terminal `inputArea` block, `useTerminalStream`/`sendKeys` usage and now-unused imports/handlers (buildPayload/runUpload/etc. moved to LiveConversationView in Task 2). Live branch renders `LiveConversationView`. Keep Pending/Discovered/Loading/Not-found and Failed/Ran-elsewhere/No-terminal placeholders. Remove orphaned styles/imports introduced unused by this change only.
- [ ] **Step 4: Run** test → PASS; run `npx tsc --noEmit` → clean.
- [ ] **Step 5: Lint + commit** `git commit -m "refactor(session): make bubble chat the sole live view, drop terminal tab"`.

---

### Task 4: Update Maestro flow + run against Release build

**Files:**
- Modify: `e2e/live-chat-tab.yaml`

- [ ] **Step 1: Rewrite flow** — remove tab taps (`session-tab-chat/terminal`) and `assertNotVisible message-input`; after opening the live session, assert `chat-message-input`, type + tap `chat-send-button`, assert the typed text bubble appears (optimistic). Add expand leg: tap `expand-input-button`, assert `message-input-expanded`, type, tap `minimize-input-button`.
- [ ] **Step 2: Build/refresh Release app** if JS changed (Release bundles JS): re-run `npx expo run:ios --configuration Release --device <UDID>` OR rely on the already-installed Release build if only the flow changed.
- [ ] **Step 3: Start a live session via API**, navigate the app to it, run `maestro --device <UDID> test -e SERVER_URL=http://127.0.0.1:8766 -e API_KEY=... e2e/live-chat-tab.yaml`.
- [ ] **Step 4:** Capture screenshots; confirm single composer + optimistic bubble + expand modal work on-device.
- [ ] **Step 5: Commit** `git commit -m "test(e2e): bubble-only chat flow with expand modal"`.

---

### Task 5: Full verification + push

- [ ] **Step 1:** `npx jest --testPathIgnorePatterns '/node_modules/' --maxWorkers=2` — all green except the known settings-flow OOM flake.
- [ ] **Step 2:** `npx eslint` changed files + `npx tsc --noEmit` clean.
- [ ] **Step 3:** Show diff + conventional-commit summary, get approval, `git push origin feat/live-chat-view`.

## Self-Review

- **Spec coverage:** ChatComposer extraction (Task 1) ✓; composer features + sheets (Task 2) ✓; remove terminal/tab/activeTab (Task 3) ✓; multiline+expand from #141 (Task 1) ✓; empty-conversation live = empty list + composer (LiveConversationView already renders composer regardless of message count) ✓; Maestro rewrite (Task 4) ✓; tests (Tasks 1-3) ✓.
- **Placeholders:** none — testIDs and prop shapes are concrete.
- **Type consistency:** `ChatComposerProps` names used in Task 2 match Task 1; testIDs `chat-message-input`/`chat-send-button`/`expand-input-button`/`message-input-expanded`/`minimize-input-button` consistent across tasks and flow.

## Deferred (separate PRs)
- Option B: fold Failed/Ran-elsewhere/No-terminal into LiveConversationView.
- Option C: fold Discovered/overtake + loading/not-found into the bubble view.
