# Live-session keyboard audit: 4. Refactor proposal

[1. Events and conditions](01-keyboard-events-and-conditions.md) · [2. Interaction scenarios](02-interaction-scenarios.md) · [3. UX risks](03-ux-risks.md) · Part 4 of 4

The live-session keyboard behavior is spread across four mechanisms on three event streams (part 1 §1), and there are two independently mounted composers.
This proposal gives each concern exactly one owner, writes the keyboard rules down in one place, and lays out a migration in small, separately shippable steps.
Phase 1 is cheap and independent. Phase 2 is structural and starts with a spike.

---

## 1. Goals (verifiable)

| ID | Outcome | Verified by |
|---|---|---|
| G1 | The keyboard never closes, and focus never moves, except when the user acts or a written policy says so. Surface swaps, conversation rebinds and streaming never drop focus, text, attachments or dictation. | Maestro: type → force raw fallback → input still focused, text and attachments intact (P14) |
| G2 | Opening the keyboard never moves a reader who has scrolled away from the end. At the end, the last message stays visible **throughout** the animation (no two-step motion). | Maestro assertion on an older row (P14) plus a screen recording (P15) |
| G3 | The composer moves continuously with the keyboard: no padding snap, a fixed 8 pt gap above the keyboard, and it clears the home indicator when closed. | Recording, frame-stepped (P15) |
| G4 | Any tappable control in the transcript responds to the **first** tap while the keyboard is open. | Maestro: card arrives while focused → one tap answers it (P14) |
| G5 | Every keyboard-affecting event (send, overlay open/close, foreground, card arrival, dictation) has one written policy, applied in one place. | §4 of this doc plus the unit tests in P13 |
| G6 | Exactly one element owns the bottom safe-area inset at any moment. | Screenshots with and without the raw-keys panel (P15) |

---

## 2. Principles, from chat-app practice

| # | Principle | Reference behavior | Today | Proposal |
|---|---|---|---|---|
| 1 | **Keyboard geometry has a single source, on the UI thread.** Layout never waits for a JS event. | react-native-keyboard-controller's chat components drive layout from shared values | Mixed: shared value (lift), a JS boolean (padding), RN `Keyboard` JS events (scroll), and RN KAV (modal) | Everything reads the `KeyboardProvider` shared values or `useKeyboardHandler` worklets. No RN `Keyboard` listeners and no `isVisible`-driven layout. |
| 2 | **The composer sticks to the keyboard; the transcript owns its own inset.** | iMessage, WhatsApp, Telegram | The whole surface root is padded, so transcript and composer move as one block | `KeyboardStickyView` for the composer. A bottom inset on the transcript. |
| 3 | **Lift the transcript only when the reader is at the end.** | ChatGPT (`keyboardLiftBehavior="whenAtEnd"`; keyboard-controller names these presets after Telegram, ChatGPT, Claude and Perplexity in `KeyboardChatScrollView/types.ts`) | Unconditional `scrollToEnd` on every show and frame change | `whenAtEnd`. This matches the rule already stated at `LiveConversationView.tsx:72-80` ("near the tail → follow, scrolled up → don't"). |
| 4 | **Transcript controls work with the keyboard up.** | iMessage, Slack | RN default `keyboardShouldPersistTaps="never"` | `"handled"` |
| 5 | **The user can put the keyboard away without side effects.** | iMessage, WhatsApp, Telegram: swipe-down interactive dismissal | Only by sending, or by a tap that gets swallowed | `"handled"` taps on empty space now; `keyboardDismissMode="interactive"` (iOS) after P10 |
| 6 | **The composer's identity survives view changes.** | Slack keeps the composer and draft while the message pane changes | One composer per surface and per conversation key, remounted on swap or rebind | One composer per session screen, mounted above the surface switch |
| 7 | **Suggestions attach to the composer; they are not a separate screen.** | Slack and Discord slash/mention popovers above the input | A full-screen RN `Modal`, plus a second modal with its own input for arguments | An inline popover anchored to the composer; arguments typed in the composer |
| 8 | **Focus intent is state, not a side effect.** | — (engineering practice) | `wasFocusedRef` plus scattered `Keyboard.dismiss()` calls | A small focus state machine (§5) with explicit restore rules |
| 9 | **Post-send keyboard behavior is a product decision, applied uniformly.** | Messaging apps keep the keyboard open. Agent-chat apps often let it go so the reply is readable (keyboard-controller's `persistent` preset is described as Claude's app behavior). | Dismiss (#327), except on the slash-command paths | Keep or change per D1, but route every send through one policy (P4) |

---

## 3. Target architecture

```
SessionScreen  (app/session/[id].tsx)
└─ body
   ├─ banners (reconnect / external / raw-fallback)            unchanged
   ├─ Transcript  — chat OR terminal, list only, no inputs      ← surfaces swap here; nothing focusable inside
   │     chat:  FlashList  renderScrollComponent = KeyboardChatScrollView
   │            keyboardLiftBehavior="whenAtEnd"  extraContentPadding = composerHeight
   │            keyboardShouldPersistTaps="handled"  keyboardDismissMode="interactive" (iOS)
   │     key={historyConversationId} resets the transcript only
   └─ KeyboardStickyView  offset={{ closed: 0, opened: restingPad − 8 }}
        ├─ JumpToLatestFab        absolute, bottom: '100%'
        ├─ SlashSuggestions       absolute, bottom: '100%'  (no Modal; keyboard + focus stay)
        ├─ SessionComposer        the ONLY composer; owns useComposerState + focus machine
        ├─ RemoteKeyboardControls (when open; mutually exclusive with the keyboard — D3)
        └─ BottomInset            the ONLY safe-area owner (restingPad = max(insets.bottom, 8))
```

Why `opened: restingPad − 8`: the sticky view translates by `keyboardHeight − offset`, interpolated on keyboard progress (`KeyboardStickyView/index.tsx:60-63`).
With a constant resting pad `P`, the visible gap above the keyboard is `P − opened`, which comes out at 8.
The gap changes continuously, with no discrete padding switch.

### One owner per concern

| Concern | Owner today | Single owner after | Mechanism |
|---|---|---|---|
| Keyboard geometry | 4 mechanisms (part 1 §1) | `KeyboardProvider` shared values | `KeyboardStickyView`, `KeyboardChatScrollView`, `useKeyboardHandler` |
| Composer position | Root padding (`useKeyboardInset`) + discrete padding switch | `KeyboardStickyView` | Continuous `translateY` |
| Transcript inset and scroll-on-keyboard | Root padding + RN `Keyboard` listeners | Transcript (`KeyboardChatScrollView`) | `contentInset` plus offset adjusted with the keyboard, per `keyboardLiftBehavior` |
| Streaming follow | FlashList mVCP + initial pin | Unchanged | `CHAT_ANCHOR`, `useInitialScrollToEnd` |
| Composer instance and state | 2 instances (`LiveConversationView`, `TerminalView`) | `SessionComposer` at the screen level | One `useComposerState` |
| Focus and keyboard intent | `wasFocusedRef`, 2 `Keyboard.dismiss()` calls, nothing for overlays | Focus machine (§5) | Pure reducer plus a thin hook |
| Bottom safe area | Composer (and nobody for the raw-keys panel) | `BottomInset` | One spacer |
| Suggestions and arguments | 2 RN `Modal`s | `SlashSuggestions` plus composer | Inline |

---

## 4. The keyboard and focus policy (one rulebook)

Every behavior below goes through the focus machine (§5) or the submit path (P4).
Nothing else calls `Keyboard.dismiss()` or `.focus()`.

| Event | Policy | Implemented in | Decision |
|---|---|---|---|
| User taps the composer | Focus. The composer rides the keyboard. The transcript lifts only if at the end. | Sticky view + `whenAtEnd` | D5 |
| Any send (inline, expanded, slash with or without args) | Apply the post-send rule once, stop dictation, reset the composer | `useComposerState.sendAndReset` (the choke point all four paths already share) | D1 |
| Send fails | Keep the draft. Restore focus if the user was typing before the send. | Focus machine: `submitted(ok=false)` | — |
| Question or permission card arrives while typing | Keep the keyboard. Card buttons work on the first tap. The card stays in view if the reader is at the end (mVCP). | `keyboardShouldPersistTaps="handled"` | D6 |
| An overlay **with its own input** opens (expanded editor; rename, model or review sheet) | Lend focus to the overlay and remember whether to take it back | Focus machine: `lend` / `return` | D2 |
| An overlay **without** an input opens (slash suggestions) | Keep the keyboard and composer focus | Inline popover | — |
| System UI (attach action sheet, picker, camera, permission prompt) | Lend and return | Focus machine | — |
| Surface swap, conversation rebind | No keyboard effect: the composer is not remounted | Architecture (P9) | — |
| App background → foreground | Restore focus only if the user was typing **and** the session screen is focused | Focus machine: `background` / `foreground` | — |
| Composer becomes disabled (waking) | Never focusable while disabled. Once enabled, latch; don't re-disable under focus (server-side queueing already covers the race, `session/[id].tsx:715-716`). | Screen | — |
| Raw-keys panel opens | Dismiss the keyboard. The panel sits above `BottomInset`. Focusing the composer closes the panel. | Focus machine: `block` | D3 |
| Dictation starts | Per D4. Always show a stop control while listening. | Composer | D4 |
| Leave guard prompts | Dismiss the keyboard before showing the dialog | Guard → focus machine | — |
| Swipe down on the transcript | Interactive dismissal (iOS). Tap on empty space dismisses (both). | Transcript props | — |

---

## 5. Composer focus state machine

A pure reducer, unit-testable, with the hook as a thin adapter that applies the effect to the input ref.

### States

| State | Meaning | Input focused? |
|---|---|---|
| `idle` | Not typing, no intent | No |
| `typing` | Composer focused (software or hardware keyboard) | Yes |
| `lent(resume)` | Focus handed to an overlay or system UI; `resume` says whether to take it back | No (the overlay has it) |
| `blocked` | Disabled (waking) or the raw-keys panel is open | No, and cannot be |
| `away(resume)` | App inactive or in the background | Irrelevant |

### Transitions

| From | Event | To | Effect |
|---|---|---|---|
| `idle` | `focus` | `typing` | — |
| `typing` | `blur` (tap on empty transcript, swipe-down) | `idle` | — |
| `typing` | `submitted(ok=true)` | D1 = dismiss: `idle`; D1 = keep: `typing` | `dismiss` or none |
| `idle`, `typing` | `submitted(ok=false)` | `typing` if the user was typing when they sent | `focus` |
| `typing` | `lend` | `lent(resume=true)` | — (the overlay's input takes focus) |
| `idle` | `lend` | `lent(resume=false)` | — |
| `lent(r)` | `return` | `r ? typing : idle` | `r ? focus : none` |
| `lent(_)` | `blur` | unchanged | ignore (the blur caused by lending) |
| any | `block` | `blocked` | `dismiss` if `typing` |
| `blocked` | `unblock` | `idle` | — (never auto-focus on unblock) |
| `typing` | `background` | `away(resume=true)` | — |
| `idle` | `background` | `away(resume=false)` | — |
| `away(r)` | `foreground(screenFocused)` | `r && screenFocused ? typing : idle` | `focus` if restoring |

### Shape (sketch)

```ts
type FocusState =
  | { kind: 'idle' }
  | { kind: 'typing' }
  | { kind: 'lent'; resume: boolean }
  | { kind: 'blocked' }
  | { kind: 'away'; resume: boolean }

type FocusEvent =
  | { type: 'focus' } | { type: 'blur' }
  | { type: 'submitted'; ok: boolean; wasTyping: boolean }
  | { type: 'lend' } | { type: 'return' }
  | { type: 'block' } | { type: 'unblock' }
  | { type: 'background' } | { type: 'foreground'; screenFocused: boolean }

type FocusEffect = 'focus' | 'dismiss' | 'none'

export function composerFocus(state: FocusState, event: FocusEvent): [FocusState, FocusEffect]
```

Overlays only call `lend()` when they open and `return()` when they close.
They never touch the keyboard directly.

---

## 6. Migration plan

**Size:**

- **XS**: under 20 lines.
- **S**: under 100 lines.
- **M**: under 300 lines.
- **L**: multi-file, over 300 lines.

Each step is its own PR, under the repo rules (a story for any new `components/**` file, `t()` for copy, lint before commit).

### Phase 1: independent quick wins (any order; suggested order in the last column)

| Step | Change | Removes | Size | Done when | Order |
|---|---|---|---|---|---|
| P1 | `keyboardShouldPersistTaps="handled"` on the chat `FlashList` and the terminal `TerminalOutput` list | R1, R21 (partly) | XS | One tap on a card answers it with the keyboard up; a tap on empty space closes the keyboard | 1 |
| P3 | Gate keyboard-triggered scrolling on "near the end" (reuse the distance already computed for the FAB at `LiveConversationView.tsx:407-411`) and ignore hide frames. Later, move it to keyboard-controller's `useKeyboardHandler` and drop the RN `Keyboard` listeners. | R2, R3, R9 (partly) | S | Scrolled-up reader keeps position on open, close and emoji switch | 2 |
| P4 | Make `useComposerState.sendAndReset` the only submit path: move the post-send keyboard rule out of `ChatComposer.handleSend`, call `voice.stop()`, and apply the same rule to the slash paths | R13, R17 (with P5), R20 | S | All four send paths behave identically; no transcript refill after send | 3 |
| P7 | Wrap `FlashList` and the jump FAB in a `flex: 1` view so the FAB anchors to the transcript's bottom (above the composer) and rides the lift | R19 | XS | FAB visible above the composer with the keyboard open and closed | 4 |
| P2 | Replace the `isVisible` switch with a UI-thread interpolation: `paddingBottom = interpolate(progress, [0,1], [restingPad, 8])` from `useReanimatedKeyboardAnimation`. Fix the stale comment at `ChatComposer.tsx:89`. | R7, R24 | S | A frame-stepped recording shows no 26 pt jump | 5 |
| P5 | Add the focus machine (§5): `lend`/`return` for the expanded editor, arg modal, sheets and pickers. Dismiss before the leave dialog. Gate foreground restore on screen focus. Track the expanded input. Latch "enabled" after waking. | R14, R15, R22, R23, R25, R17 | M | P13 reducer tests plus a manual pass through S11, S22–S24, S28 and S29 | 6 |
| P6 | Expanded editor: replace RN `KeyboardAvoidingView` with `useKeyboardInset` on a `Reanimated.View`. The modal spans the screen bottom, and keyboard-controller tracks RN Modal windows on Android (`modal/ModalAttachedWatcher.kt`). | R16 | XS | Android recording: input flush above the IME, no gap | 7 |
| P8 | Raw-keys panel: mutually exclusive with the keyboard (focusing the composer closes the panel), the panel pads `insets.bottom`, and the composer drops its resting safe-area padding while the panel shows | R18 | S | Screenshots with the panel, with and without a focus attempt | 8 |
| P11a | Interim slash board fix: inside the board's `Modal`, pad the sheet container with `useKeyboardInset` so the sheet sits above the keyboard | R11 | XS | Slash board fully visible with the keyboard up (iOS) | 9 |

After Phase 1, every High and Medium risk is resolved or mitigated except R4, R5 and R6 (remounts) and R12 (Android slash board, unconfirmed).

### Phase 2: structural (sequenced)

| Step | Change | Removes | Size | Depends on | Done when |
|---|---|---|---|---|---|
| P9 | **One composer per session screen.** Hoist `ChatComposer` and `useComposerState` (plus the slash overlays) above the surface switch; surfaces become transcript-only. `key={historyConversationId}` then resets only the transcript. Lift what the composer needs: `sendDisabled` (answer phase), send errors and notices, and the chat's optimistic bubbles (`pendingSends` moves to a per-session store the chat transcript reads; the terminal ignores it). | R4, R5, R6, A4 | L | P4, P5 | G1 Maestro flow green; the composer is not remounted on swap or rebind (React DevTools / a mount counter in a test) |
| P10-spike | Timebox (1–2 days): FlashList v2 `renderScrollComponent={KeyboardChatScrollView}` with `keyboardLiftBehavior="whenAtEnd"`, `extraContentPadding = composerHeight`. Check how it interacts with `maintainVisibleContentPosition` (`CHAT_ANCHOR`), `startRenderingFromBottom`, `onStartReached` paging and the initial pin. On Android, use `onContentInsetChange` if FlashList's `scrollToEnd` target ignores the synthetic inset (the prop exists for exactly this, per `KeyboardChatScrollView/types.ts`). | — | M | P9 | Go/no-go written in `docs/` with recordings |
| P10 | If go: composer in `KeyboardStickyView` (§3), transcript inset via `KeyboardChatScrollView`, `keyboardDismissMode="interactive"` on iOS. Delete root `useKeyboardInset` padding on both surfaces, the P3 gate and the P2 interpolation. **If no-go:** keep root padding (proven in #1044) plus P2 and P3, and accept R8 and R10. | R8, R10, R21, R2/R3 structurally | M | Spike | G2 and G3 recordings |
| P11 | Slash suggestions as an inline popover in the sticky stack. Choosing an argument command inserts `/cmd ` into the composer with the argument label as a hint; send submits it. Delete `SlashCommandBoard`'s `Modal` and `SlashCommandArgModal`. | R11, R12, R13 (remaining), A2 | M | P9 (P10 for anchoring) | S20 and S11 pass on both platforms with the keyboard never closing |
| P12 | Bottom stack ownership: one `BottomInset`. The sticky offset uses its `restingPad`. | R18 (structural), R7 (structural) | S | P10 | G6 screenshots |

### Phase 3: guard rails

| Step | What | Where |
|---|---|---|
| P13 | Unit tests: the `composerFocus` reducer (every row of §5), the submit policy (dictation stopped, D1 applied, refocus on failure), the near-end gate | `__tests__/unit/` (keyboard-controller is already mocked in `jest.setup.js:405+`) |
| P14 | Maestro flows (mock suite): (a) scroll up → tap composer → an older row is still visible; (b) card arrives while focused → one tap answers it; (c) type `/` → a command row is visible → tap it with the keyboard still up; (d) raw-keys panel open → tap composer → panel closes; (e) G1: type, force fallback, text still present. No `hideKeyboard` on iOS 26 (`CLAUDE.md`). Add them to `test:e2e:mock`. | `e2e/`, `package.json` |
| P15 | Device recording checklist (part 3 §3), before and after P2, P3, P6, P7, P10 and P11 | iOS notched device plus an Android edge-to-edge device |

---

## 7. What gets deleted

| Code | Location | Replaced by | Step |
|---|---|---|---|
| RN `Keyboard` listeners (`keyboardDidShow`, `keyboardDidChangeFrame`) | `LiveConversationView.tsx:388-399` | Gate (P3), then `whenAtEnd` (P10) | P3 → P10 |
| `useKeyboardState` discrete padding switch | `ChatComposer.tsx:88-97` | Interpolated padding (P2), then the sticky offset (P10) | P2 → P10 |
| RN `KeyboardAvoidingView` in the expanded editor | `ChatComposer.tsx:298-301` | `useKeyboardInset` | P6 |
| `Keyboard.dismiss()` in `ChatComposer.handleSend` | `ChatComposer.tsx:122` | Submit policy in `sendAndReset` | P4 |
| `wasFocusedRef` and the `AppState` refocus effect | `ChatComposer.tsx:100-113`, `:243-244`, `:272-273` | Focus machine | P5 |
| Root `useKeyboardInset` padding on both surfaces | `LiveConversationView.tsx:114`, `:413`; `TerminalView.tsx:154`, `:187` | Sticky composer plus transcript inset | P10 |
| Second composer stack | `TerminalView.tsx:153`, `:220-262` and `LiveConversationView.tsx:339-355`, `:490-532` | One `SessionComposer` | P9 |
| `SlashCommandBoard` `Modal`, `SlashCommandArgModal` | `components/shared/` | Inline suggestions and arguments | P11 |
| `PromptQueueSheet` (unreachable) | `components/queue/PromptQueueSheet.tsx` | Delete, or wire an entry point | D7 |

`hooks/useKeyboardInset.ts` stays: P6 and P11a reuse it for full-screen modals, which is the case its precondition describes.

---

## 8. Decisions for you

| ID | Question | Options | Recommendation |
|---|---|---|---|
| D1 | Keyboard after a send | (a) Dismiss, as today (#327). (b) Keep open, the messaging-app norm. | **(a)**: agent replies are long and meant to be read. Apply it to every send path (P4). Pairs well with D5 (b). |
| D2 | Restore composer focus after an overlay closes | Per overlay | Expanded editor minimize: **yes**. Arg cancel: **yes** (arg confirm is a send, so D1 applies). Rename, model and review sheets: **no** (a different task). |
| D3 | Raw-keys panel and keyboard at the same time? | (a) Mutually exclusive. (b) Stacked. | **(a)**: two input surfaces competing for the same space is R18. |
| D4 | Keyboard while dictating | (a) Dismiss on dictation start. (b) Keep. | **(a)** so more transcript is visible, with a stop control that stays while listening regardless of `hasContent` |
| D5 | Transcript lift when the keyboard opens | (a) `whenAtEnd`. (b) `persistent` (lifts, doesn't drop back on hide). (c) `always`. | **(a)**, and try (b) in the P10 spike: with D1 (a), it avoids the post-send "drop" motion |
| D6 | Question card arrives while typing | (a) Keep the keyboard (with P1). (b) Auto-dismiss to reveal the card. | **(a)**: the user may be mid-sentence; P1 makes the card's buttons work on the first tap |
| D7 | `PromptQueueSheet` | (a) Delete. (b) Wire an entry point. | **(a)** unless the queue is on the roadmap. It is dead code with a conflicting keyboard config (A1). |
