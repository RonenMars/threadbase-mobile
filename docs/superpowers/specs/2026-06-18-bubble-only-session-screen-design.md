# Bubble-only session screen — design (Option A)

**Date:** 2026-06-18
**Branch:** `feat/live-chat-view` (PR #148)
**Status:** approved

## Goal

Replace the terminal (PTY) view on the session screen with the bubble chat
(`LiveConversationView`) as the sole live view. Remove the Terminal/Chat tab
bar, `TerminalOutput`, and the terminal composer. Port the full composer
feature set — plus PR #141's multi-line auto-grow + full-screen expand — onto
the bubble composer.

This is **Option A** (minimal collapse): pre-session screens and content
placeholders are kept as-is; only the live content area + composer collapse
into the bubble view. Options B and C (folding placeholders, then pre-session
screens, into the bubble view) are deferred to follow-up PRs on top of A.

PR #141 (`feat/multiline-text-input`) is not merged separately. Its multi-line
expand capability is applied **directly to the bubble composer** here, so no
throwaway terminal-composer step is created.

## Architecture & component boundaries

- **`LiveConversationView`** — owns the message list (FlashList of
  `MessageItem`) and orchestrates the composer + sheets. Remains the
  screen-level live view.
- **`ChatComposer`** (new) — extracted composer component: multi-line text
  input, attach (photo/file), voice mic, slash trigger, send, expand button,
  and the full-screen expand `Modal`. Independently testable. Props (shape):
  `value`, `onChangeText`, `onSend`, `attachments`, `onAttach`,
  `onRemoveAttachment`, `voice`, `micGranted`, `disabled` (waking-up),
  `isUploading`, `attachError`, `sendError`.
- **Sheets/modals** — `SlashCommandBoard`, `SlashCommandArgModal`,
  `PromptQueueSheet`, `PlanPreviewSheet` are rendered by `LiveConversationView`
  and wired to the composer's text state.

`app/session/[id].tsx` keeps its pre-session/placeholder branching unchanged
and renders `LiveConversationView` in the live branch instead of the tab bar +
terminal + terminal composer. It drops `useTerminalStream`, `sendKeys`,
`activeTab`, and the terminal-only `isWakingUp` overlay where now unused.

## Composer behavior & feature parity

Inline composer row:
- Multi-line auto-grow `TextInput` (`multiline`, `textAlignVertical="top"`,
  `maxHeight: 160`, `minHeight: 44`), placeholder "Message…".
- Attach (`Paperclip`) → Alert (Take Photo / Gallery / Files) →
  `uploadAttachment`; attachment chips row with remove (`X`).
- Expand (`ArrowsOut`) → full-screen modal.
- Send (`PaperPlaneRight`) when text/attachments present; otherwise Mic
  (`Microphone`/`MicrophoneSlash`) if granted, else disabled send.
- Slash board: text matching `^/.{0,30}$` opens `SlashCommandBoard`; selection
  sends immediately or opens `SlashCommandArgModal`.

Full-screen expand modal (ported from PR #141): slide-in `Modal`, large
top-aligned `TextInput` (`message-input-expanded`, `autoFocus`), toolbar =
minimize (`ArrowsIn`) / attach / mic / send. Send closes the modal.

Send semantics: bubble composer send routes through `LiveConversationView`'s
`handleSend` → `buildPayload` (`@refs + text`) → connected guard → optimistic
append (`pendingSends`) → `sendInput.mutate` → `resetComposer`. The WS echo is
deduped by text. Auto-name-from-first-message and the not-connected guard carry
over.

Removed (no terminal): `sendKeys` (raw keys), `onSubmitEditing`→PTY, and the
terminal waking-up overlay. Waking-up becomes: composer disabled + "Starting
up…" placeholder while `session.status === 'running' && !hasReachedPrompt`.

## Render branches (in `app/session/[id].tsx`)

```
Pending                          → PendingSessionScreen      (unchanged)
Discovered (pty=false, running/waiting) → DiscoveredSessionScreen (unchanged)
Loading / Not-found              → existing screens          (unchanged)
session exists:
  failureReason                  → Failed placeholder        (unchanged, A)
  noAttachEmptyPlaceholder       → Ran-elsewhere / No-terminal (unchanged, A)
  else                           → <LiveConversationView />   ← sole live view
```

No `activeTab`, no tab bar. A live session with a `conversationId` renders the
bubbles. A live session with no `conversationId` yet renders an empty message
list + active composer (first send creates the conversation).

## Data flow (send)

```
ChatComposer.onSend(text, attachments)
  → LiveConversationView.handleSend
      → buildPayload (@refs + text)
      → connected? guard
      → optimistic append (pendingSends)        [Bug 2 fix]
      → sendInput.mutate(payload)
      → resetComposer (clear text/attachments/draft)
  → echo via useConversationStream → dedupe by text  [Bug 2 fix]
```

Drafts: per-session draft store (`setDraft`/`clearDraft`/`hydrate`) moves with
the composer so half-typed messages survive navigation.

## Testing & error handling

- **Unit (Jest, TDD):** `ChatComposer` renders text/attach/mic/expand; expand
  opens modal with `message-input-expanded`; send fires `onSend` and clears.
  `LiveConversationView`: existing two tests stay green (single composer,
  optimistic bubble) + a new test asserting no terminal tab / no `message-input`
  testID.
- **Maestro:** rewrite `e2e/live-chat-tab.yaml` — drop tab taps + `message-input`
  `assertNotVisible`; assert `chat-message-input`, type, send, optimistic bubble
  appears; add expand → type → minimize → send leg. Runs against the Release
  build (no dev menu).
- **Error handling (unchanged):** send errors → Alert; attach errors → inline
  `attachError`; not-connected guard before send.

## Follow-ups (separate PRs, in order)

- **Option B** (on top of merged A): fold Failed / Ran-elsewhere / No-terminal
  into `LiveConversationView` as inline banner/empty states.
- **Option C** (on top of merged B): fold Discovered/overtake + loading/
  not-found into the bubble view (single-view session route).
