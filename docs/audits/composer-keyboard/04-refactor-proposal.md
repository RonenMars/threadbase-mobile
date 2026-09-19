# Live-session keyboard audit: 4. Refactor proposal

[1. Events and conditions](01-keyboard-events-and-conditions.md) · [2. Interaction scenarios](02-interaction-scenarios.md) · [3. UX risks](03-ux-risks.md) · Part 4 of 4

The live-session keyboard behavior is spread across four mechanisms on three event streams (part 1 §1), and there are two independently mounted composers.
This proposal gives each concern exactly one owner, writes the keyboard rules down in one place, and lays out a migration in small, separately shippable steps.
Phase 1 is cheap and independent. Phase 2 is structural and starts with a spike.

**Decisions:** all seven (D1–D7) are resolved in [keyboard-ux-dilemmas-answers.md](keyboard-ux-dilemmas-answers.md) and applied throughout this plan.
§8 summarizes them.

---

## 0. The keyboard contract

This is the governing policy. Every rule, state transition and step below derives from it.

> Sending does not end composing.
> Asynchronous content never dismisses or focuses the composer.
> Composer-owned subflows restore previous composer focus; independent overlays do not.
> Keyboard geometry changes layout but never decides scroll position.
> Transcript position is preserved unless the user was already following the latest content.
> Voice dictation temporarily owns text input.
> Raw terminal controls coexist with the keyboard as an accessory rather than a competing bottom surface.

In one sentence: the keyboard follows the user's composing intent, layout reacts to the keyboard, and incoming application state does not control the keyboard.

---

## 1. Goals (verifiable)

| ID | Outcome | Verified by |
|---|---|---|
| G1 | Focus changes only when the user acts or the contract says so. Surface swaps, conversation rebinds, streaming and incoming cards never drop or move focus, text, attachments or dictation. | Maestro: type → force raw fallback → input still focused, text and attachments intact (P14) |
| G2 | Keyboard geometry never decides scroll position. A reader who scrolled away keeps their position through open, close and height changes. A follower stays pinned to the end **throughout** the animation (no two-step motion). | Maestro assertion on an older row (P14) plus a screen recording (P15) |
| G3 | The composer, the raw-keys accessory and the transcript viewport move as one continuous keyboard animation: no padding snap, a fixed 8 pt gap above the keyboard, and the home indicator cleared when closed. | Recording, frame-stepped (P15) |
| G4 | Any tappable control in the transcript responds to the **first** tap while the keyboard is open. | Maestro: card arrives while focused → one tap answers it (P14) |
| G5 | The state at the moment of Send is preserved: a focused composer stays focused, and the software keyboard is never summoned when it wasn't showing. | Maestro: type → send → type again without tapping (P14) |
| G6 | Exactly one element owns the bottom safe-area inset at any moment. | Screenshots with and without the raw-keys accessory, keyboard open and closed (P15) |

---

## 2. Principles, from chat-app practice

| # | Principle | Reference behavior | Today | Proposal |
|---|---|---|---|---|
| 1 | **Keyboard geometry has a single source, on the UI thread.** Layout never waits for a JS event. | react-native-keyboard-controller's chat components drive layout from shared values | Mixed: shared value (lift), a JS boolean (padding), RN `Keyboard` JS events (scroll), and RN KAV (modal) | Everything reads the `KeyboardProvider` shared values or `useKeyboardHandler` worklets. No RN `Keyboard` listeners and no `isVisible`-driven layout. |
| 2 | **The composer sticks to the keyboard; the transcript owns its own inset.** | iMessage, WhatsApp, Telegram | The whole surface root is padded, so transcript and composer move as one block | `KeyboardStickyView` for the composer stack. A bottom inset on the transcript. |
| 3 | **Keyboard geometry changes layout; the list decides position.** Lift only if the reader was following the end. | ChatGPT (`keyboardLiftBehavior="whenAtEnd"`; keyboard-controller names these presets after Telegram, ChatGPT, Claude and Perplexity in `KeyboardChatScrollView/types.ts`) | Unconditional `scrollToEnd` on every show and frame change | `whenAtEnd` (D5). This matches the rule already stated at `LiveConversationView.tsx:72-80` ("near the tail → follow, scrolled up → don't"). |
| 4 | **Transcript controls work with the keyboard up.** | iMessage, Slack | RN default `keyboardShouldPersistTaps="never"` | `"handled"` (D6) |
| 5 | **Sending is part of composing.** | iMessage, WhatsApp, Telegram, Slack: the keyboard stays after Send | Dismiss on every send (#327), except the slash-command paths | Keep focus as it was at Send (D1) |
| 6 | **The user can put the keyboard away deliberately and without side effects.** This matters more once Send stops dismissing it. | iMessage, WhatsApp, Telegram: swipe-down interactive dismissal | Only by sending, or by a tap that gets swallowed | A tap on empty transcript space dismisses (P1). Swipe-down: `keyboardDismissMode="interactive"` on iOS, keyboard-controller `KeyboardGestureArea` on Android 11+ (P10). |
| 7 | **The composer's identity survives view changes.** | Slack keeps the composer and draft while the message pane changes | One composer per surface and per conversation key, remounted on swap or rebind | One composer per session screen, mounted above the surface switch |
| 8 | **Suggestions and special keys attach to the composer; they are not separate screens.** | Slack and Discord popovers above the input; terminal apps' key rows above the keyboard | A full-screen `Modal` for suggestions, a second modal for arguments, and a raw-keys panel outside the lifted content | Inline suggestion popover; arguments typed in the composer; raw keys as a compact accessory row between the composer and the keyboard (D3) |
| 9 | **Focus intent is state, not a side effect.** Never invent focus. | Apple HIG, focus and selection: focus changes stay predictable and purposeful | `wasFocusedRef` plus scattered `Keyboard.dismiss()` and `autoFocus` | A focus state machine (§5) with per-overlay restore rules (D2) |
| 10 | **One editor per value at a time.** | — | The keyboard stays editable while dictation rewrites the same field | Dictation dismisses the keyboard and owns the input until stopped (D4) |

---

## 3. Target architecture

```
SessionScreen  (app/session/[id].tsx)
└─ body
   ├─ banners (reconnect / external / raw-fallback)            unchanged
   ├─ Transcript  — chat OR terminal, list only, no inputs      ← surfaces swap here; nothing focusable inside
   │     chat:  FlashList  renderScrollComponent = KeyboardChatScrollView
   │            keyboardLiftBehavior="whenAtEnd"  extraContentPadding = stackHeight
   │            keyboardShouldPersistTaps="handled"  keyboardDismissMode="interactive" (iOS)
   │            wrapped in KeyboardGestureArea interpolator="ios" (Android 11+)
   │     key={historyConversationId} resets the transcript only
   └─ KeyboardStickyView  offset={{ closed: 0, opened: restingPad − 8 }}
        ├─ JumpToLatestFab        absolute, bottom: '100%'; shows "question waiting" when a card is pending off-screen (D6)
        ├─ SlashSuggestions       absolute, bottom: '100%'  (no Modal; keyboard + focus stay)
        ├─ SessionComposer        the ONLY composer; owns useComposerState + focus machine
        ├─ RawKeysAccessory       compact single row, when toggled; coexists with the keyboard (D3)
        └─ BottomInset            the ONLY safe-area owner (restingPad = max(insets.bottom, 8))
```

The stack order matches D3's layout: transcript, composer, raw-keys row, OS keyboard.
The composer and the raw-keys row share one `KeyboardStickyView`, so they move with the same IME inset and the same animation.

Why `opened: restingPad − 8`: the sticky view translates by `keyboardHeight − offset`, interpolated on keyboard progress (`KeyboardStickyView/index.tsx:60-63`).
With a constant resting pad `P`, the visible gap above the keyboard is `P − opened`, which comes out at 8.
The gap changes continuously, with no discrete padding switch.

keyboard-controller's own `KeyboardExtender` is **not** a fit for the raw keys.
It renders with `opacity: progress` (`views/KeyboardExtender/index.tsx`), so it disappears whenever the keyboard is closed.
Raw keys must also work with the keyboard closed, for example to answer a TUI picker with arrows and Enter.

### Three owners (from the answers' cross-cutting notes)

| Concern | Owner today | Single owner after | Mechanism |
|---|---|---|---|
| IME geometry and animation | 4 mechanisms (part 1 §1) | `KeyboardProvider` shared values | `KeyboardStickyView`, `KeyboardChatScrollView`, `useKeyboardHandler` |
| Input focus | `wasFocusedRef`, 2 `Keyboard.dismiss()` calls, `autoFocus`, `AppState` | Focus machine (§5) | Pure reducer plus a thin hook |
| Transcript position | FlashList mVCP + initial pin + RN `Keyboard` listeners | List follow-tail and visible-anchor state | mVCP (`CHAT_ANCHOR`) + `whenAtEnd`; the keyboard never calls `scrollToEnd` |

### Supporting ownership

| Concern | Owner today | Owner after |
|---|---|---|
| Composer instance and state | 2 instances (`LiveConversationView`, `TerminalView`) | `SessionComposer` at the screen level, one `useComposerState` |
| Bottom safe area | Composer (and nobody for the raw-keys panel) | `BottomInset` |
| Suggestions and arguments | 2 RN `Modal`s | `SlashSuggestions` plus composer |
| Raw keys | A panel below the whole live body (`session/[id].tsx:1185`) | `RawKeysAccessory` inside the sticky stack |

---

## 4. The keyboard and focus policy (one rulebook)

Every behavior below goes through the focus machine (§5), the list's follow-tail state, or the submit path (P4).
Nothing else calls `Keyboard.dismiss()`, `.focus()` or `scrollToEnd()` in response to the keyboard.

| Event | Policy | Implemented in | Decision |
|---|---|---|---|
| User taps the composer | Focus. The composer stack rides the keyboard. The transcript lifts only if the reader was following the end. | Sticky view + `whenAtEnd` | D5 |
| Send (inline, slash no-arg) | **Preserve the state at the moment of Send.** A focused composer stays focused. No `dismiss()`, no blind `focus()`. Stop dictation if running. | `useComposerState.sendAndReset` (the choke point all send paths share) | D1 |
| Send from the expanded editor | Close the editor and **transfer** focus to the inline composer | Focus machine: `submit` in `typing(expanded)` | D1 |
| Send fails | Nothing to repair: focus was never taken. Keep the draft. | — | D1 |
| Hardware keyboard in use | Never summon the software keyboard. The machine only preserves, transfers or restores focus that existed. | Focus machine | D1 |
| Question or permission card arrives | **No effect on focus or keyboard.** Card buttons work on the first tap. A follower sees the card (mVCP follows). A reader who scrolled up is not moved; the jump FAB shows a "question waiting" state instead. | P1 + P17 | D6 |
| Composer-owned subflow closes (expanded minimize, slash arguments, attachment picker, cancelled leave dialog) | Restore the focus that existed when it opened (inline or expanded) | Focus machine: `lend` / `return` | D2 |
| Independent overlay closes (rename, model/effort, review) | Do not restore | Focus machine | D2 |
| Any overlay opened while the composer was unfocused | Never restore, never invent focus | Focus machine | D2 |
| Overlay without an input opens (slash suggestions) | Keep the keyboard and composer focus | Inline popover | — |
| Surface swap, conversation rebind | No keyboard effect: the composer is not remounted | Architecture (P9) | — |
| App background → foreground | Restore focus only if the user was typing **and** the session screen is focused | Focus machine: `background` / `foreground` | — |
| Keyboard opens, closes or changes height | Layout only. Snapshot "following the end" at the **start** of the animation. Followers stay anchored during it; readers keep their visible content. On hide, the inset reverses normally with no persistent displacement. | P3 (Phase 1), `whenAtEnd` (P10) | D5 |
| Dictation starts | Dismiss the keyboard. Voice owns the input: it is read-only while listening, and the trailing control is Stop. | P16 | D4 |
| Dictation stops (Stop, silence timeout) | The transcript stays in the composer. **Do not reopen the keyboard.** The user taps to edit. | P16 | D4 |
| Raw-keys accessory toggled | Coexists with the keyboard. Opening it no longer dismisses the keyboard. Tapping a key doesn't take focus from the composer. | P8 | D3 |
| Composer becomes disabled (waking) | Never focusable while disabled. Once enabled, latch; don't re-disable under focus (server-side queueing already covers the race, `session/[id].tsx:715-716`). | Screen + focus machine | — |
| Leave guard prompts | Lend focus (dismissing the keyboard so the dialog isn't covered). On cancel, restore the prior state. | Focus machine | D2 |
| User wants to read | Tap empty transcript space (P1), or swipe down: interactive on iOS and Android 11+ (P10) | Transcript props | D6 |

---

## 5. Composer focus state machine

A pure reducer, unit-testable, with the hook as a thin adapter that applies the effect to the input refs.
It tracks **which** input held focus (the answers' `focusBeforeOverlay`), so a subflow opened from the expanded editor returns to the expanded editor.

### States

| State | Meaning | Keyboard |
|---|---|---|
| `idle` | Composer not focused | Down (unless another input owns it) |
| `typing(target)` | `target` ∈ `inline`, `expanded` | Up, or hardware keyboard |
| `lent(restoreTo)` | An overlay or system UI holds focus. `restoreTo` ∈ `inline`, `expanded`, `none`. | The overlay's |
| `dictating` | Voice owns the value; the input is read-only | Down |
| `disabled` | Waking; not focusable | Down |
| `away(restoreTo)` | App inactive or backgrounded | — |

### Overlay restore rules (D2)

| Overlay | `restores` | Why |
|---|---|---|
| Slash-command arguments (until P11 makes them inline) | yes | Composer sub-flow |
| Attachment action sheet and picker / camera / files | yes | Composer sub-flow |
| Leave-session dialog (cancelled) | yes | Temporary interruption. On confirm the screen leaves. |
| Rename session | no | Separate task |
| Model / effort sheet | no | Configuration, not composition |
| Review sheet | no | Separate task |

The expanded editor is not an overlay here. It is a second input target, handled by `expand` / `minimize`.

### Transitions

| From | Event | To | Effect |
|---|---|---|---|
| `idle` | `focus(t)` | `typing(t)` | — |
| `typing(t)` | `blur` (tap on empty transcript, swipe-down, iPad hide key) | `idle` | — |
| `idle`, `typing(inline)` | `expand` | `typing(expanded)` | The editor's input takes focus (user-initiated) |
| `typing(expanded)` | `minimize` | `typing(inline)` | `focus(inline)` |
| `typing(inline)`, `idle` | `submit` | unchanged | none (D1) |
| `typing(expanded)` | `submit` | `typing(inline)` | Close the editor, `focus(inline)` (D1) |
| `typing(t)` | `lend(o)` | `lent(restores(o) ? t : none)` | — (the overlay takes focus) |
| `idle` | `lend(o)` | `lent(none)` | — (never invent focus) |
| `lent(r)` | `return(o)` | `r ≠ none ? typing(r) : idle` | `focus(r)` if `r ≠ none` |
| `lent(r)` | `blur` | unchanged | Ignored: this is the blur caused by lending |
| `idle`, `typing(t)` | `dictationStart` | `dictating` | `dismiss` |
| `dictating` | `dictationStop` (Stop, silence timeout, unmount) | `idle` | none — never reopen (D4) |
| any | `disable` | `disabled` | `dismiss` if `typing` |
| `disabled` | `enable` | `idle` | none; the screen latches enabled |
| `typing(t)` | `background` | `away(t)` | — |
| `idle` | `background` | `away(none)` | — |
| `away(r)` | `foreground(screenFocused)` | `r ≠ none && screenFocused ? typing(r) : idle` | `focus(r)` if restoring |

There is deliberately **no** event for incoming cards, stream chunks, surface swaps or rebinds: asynchronous content does not touch focus.
The raw-keys accessory has no event either, because it coexists with the keyboard (D3).

### Shape (sketch)

```ts
type FocusTarget = 'inline' | 'expanded'
type RestoreTo = FocusTarget | 'none'
type Overlay = 'slashArgs' | 'attach' | 'leaveDialog' | 'rename' | 'modelEffort' | 'review'

type FocusState =
  | { kind: 'idle' }
  | { kind: 'typing'; target: FocusTarget }
  | { kind: 'lent'; restoreTo: RestoreTo }
  | { kind: 'dictating' }
  | { kind: 'disabled' }
  | { kind: 'away'; restoreTo: RestoreTo }

type FocusEvent =
  | { type: 'focus'; target: FocusTarget } | { type: 'blur' }
  | { type: 'expand' } | { type: 'minimize' } | { type: 'submit' }
  | { type: 'lend'; overlay: Overlay } | { type: 'return'; overlay: Overlay }
  | { type: 'dictationStart' } | { type: 'dictationStop' }
  | { type: 'disable' } | { type: 'enable' }
  | { type: 'background' } | { type: 'foreground'; screenFocused: boolean }

type FocusEffect = { kind: 'none' } | { kind: 'dismiss' } | { kind: 'focus'; target: FocusTarget }

export function composerFocus(state: FocusState, event: FocusEvent): [FocusState, FocusEffect]
```

Overlays only call `lend(overlay)` when they open and `return(overlay)` when they close.
They never touch the keyboard directly.

---

## 6. Migration plan

**Size:**

- **XS**: under 20 lines.
- **S**: under 100 lines.
- **M**: under 300 lines.
- **L**: multi-file, over 300 lines.

Each step is its own PR, under the repo rules (a story for any new `components/**` file, `t()` for copy in en/he/ar/ru, lint before commit).

### Phase 1: independent quick wins (any order; suggested order in the last column)

| Step | Change | Removes | Size | Done when | Order |
|---|---|---|---|---|---|
| P1 | `keyboardShouldPersistTaps="handled"` on the chat `FlashList` and the terminal `TerminalOutput` list (D6) | R1, R21 (partly) | XS | One tap on a card answers it with the keyboard up; a tap on empty space closes the keyboard | 1 |
| P4 | **Keep focus on Send (D1).** Delete `Keyboard.dismiss()` from `ChatComposer.handleSend` (`:122`) and don't add a `focus()` in its place. Expanded-editor Send closes the editor and transfers focus to the inline input. `sendAndReset` also calls `voice.stop()`. This reverses #327 by decision. | R13, R17 | S | Type → send → keep typing with no tap, on all send paths. With a hardware keyboard, no software keyboard appears. | 2 |
| P3 | **Keyboard never decides scroll position (D5).** Delete the RN `keyboardDidShow` / `keyboardDidChangeFrame` → `scrollToEnd` listeners (`LiveConversationView.tsx:388-399`). Use keyboard-controller's `useKeyboardHandler`: in `onStart`, snapshot `wasFollowingTail`; in `onEnd`, scroll to the end only for an opening keyboard with the snapshot true. Keep one definition of "following the end" for the screen, shared with the FAB (`:407-411`). | R2, R3, R9 (partly) | S | A reader who scrolled up keeps position on open, close, emoji switch and rotation. A follower still sees the latest message after opening. | 3 |
| P16 | **Dictation owns the input (D4).** On start: dismiss the keyboard. While listening: input read-only and the trailing control is Stop regardless of `hasContent` (inline and expanded). On stop: keep the transcript, don't reopen the keyboard. Route transcripts through the draft store (A3). | R20, A3 | S | Start → keyboard down, transcript streams in, can't be typed over. Stop → transcript stays, no keyboard. Remount mid-dictation keeps the text. | 4 |
| P7 | Wrap `FlashList` and the jump FAB in a `flex: 1` view so the FAB anchors to the transcript's bottom (above the composer) and rides the lift | R19 | XS | FAB visible above the composer with the keyboard open and closed | 5 |
| P17 | **"Question waiting" (D6).** When a question or permission card is pending and the reader is not following the end, the jump FAB changes to a question state (Phosphor icon, translated label). Tapping it jumps to the card. Nothing moves on its own. | — (D6 requirement) | S | Scroll up, trigger a card: nothing moves, the FAB changes; tap → at the card | 6 (after P7) |
| P2 | Replace the `isVisible` switch with a UI-thread interpolation: `paddingBottom = interpolate(progress, [0,1], [restingPad, 8])` from `useReanimatedKeyboardAnimation`. Fix the stale comment at `ChatComposer.tsx:89`. | R7, R24 | S | A frame-stepped recording shows no 26 pt jump | 7 |
| P5 | Add the focus machine (§5) with the D2 restore table. Wire `lend` / `return` into the arg modal, attach flow, leave dialog, and rename/model/review sheets. Gate foreground restore on screen focus. Track the expanded input. Latch "enabled" after waking. Remove `wasFocusedRef` and its `AppState` effect. | R14, R15, R22, R23, R25 | M | P13 reducer tests plus a manual pass through S11, S22–S25, S28 and S29 | 8 |
| P8 | **Raw keys as a keyboard accessory (D3).** Move `RemoteKeyboardControls` out of the screen bottom (`session/[id].tsx:1185`) into the composer stack via an `accessory` slot on `ChatComposer`, below the input row and inside the lifted content. Compact it to one row: the existing Esc, Tab, Shift-Tab, arrows and Enter (horizontally scrollable if narrow), plus Confirm when a prompt is pending and a close control. Drop the title row. Remove `Keyboard.dismiss()` from the "agree" handler (`:652`). The row sits above the bottom inset, and the composer stops padding the safe area while the row is showing. Adding new keys such as Ctrl is a separate feature. | R18 | M (threads a prop through both surfaces until P9) | Keyboard up + accessory on: composer, row, keyboard stack flush with an 8 pt gap. Keyboard down: row clears the home indicator once. | 9 |
| P6 | Expanded editor: replace RN `KeyboardAvoidingView` with `useKeyboardInset` on a `Reanimated.View`. The modal spans the screen bottom, and keyboard-controller tracks RN Modal windows on Android (`modal/ModalAttachedWatcher.kt`). | R16 | XS | Android recording: input flush above the IME, no gap | 10 |
| P11a | Interim slash board fix: inside the board's `Modal`, pad the sheet container with `useKeyboardInset` so the sheet sits above the keyboard | R11 | XS | Slash board fully visible with the keyboard up (iOS) | 11 |
| P18 | **Delete `PromptQueueSheet` (D7).** Remove the component; `queueVisible` / `setQueueVisible` (`useComposerState.ts:42-43`, `:57`, `:258-259`); both render sites (`LiveConversationView.tsx:527-532`, `TerminalView.tsx:257-262`); the then-orphaned `addToQueue` / `removeFromQueue` mutations (`useSessionActions.ts:76-90`, `:296`); the store slice (`promptQueues`, add/remove/reorder, the per-server cleanup in `stores/sessions.ts`, which is not persisted); the `queue` locale namespace in en/he/ar/ru plus its registration (`lib/i18n.ts`, `lib/i18n.types.ts`, `test-utils/i18n-setup.ts`); and the test references. Keep `react-native-draggable-flatlist`, which `FilterSortSheet` and `DisplayedServersList` still use. The streamer's `/api/sessions/:id/queue` endpoints are untouched. | A1 | S | `tsc`, jest and `npm run test:i18n` (including `--unused`) green; no references to `promptQueues` left | 12 |

After Phase 1, every High and Medium risk is resolved or mitigated except R4, R5 and R6 (remounts) and R12 (Android slash board, unconfirmed).
The two-step motion for followers (R8) remains until P10.

### Phase 2: structural (sequenced)

| Step | Change | Removes | Size | Depends on | Done when |
|---|---|---|---|---|---|
| P9 | **One composer per session screen.** Hoist `ChatComposer` and `useComposerState`, the slash overlays and the raw-keys accessory above the surface switch; surfaces become transcript-only. `key={historyConversationId}` then resets only the transcript. Lift what the composer needs: `sendDisabled` (answer phase), send errors and notices, and the chat's optimistic bubbles (`pendingSends` moves to a per-session store the chat transcript reads; the terminal ignores it). | R4, R5, R6, A4 | L | P4, P5, P8 | G1 Maestro flow green; the composer is not remounted on swap or rebind (a mount counter in a test) |
| P10-spike | Timebox (1–2 days): FlashList v2 `renderScrollComponent={KeyboardChatScrollView}` with `keyboardLiftBehavior="whenAtEnd"`, `extraContentPadding = stackHeight` (composer plus accessory). Check how it interacts with `maintainVisibleContentPosition` (`CHAT_ANCHOR`), `startRenderingFromBottom`, `onStartReached` paging and the initial pin. On Android, use `onContentInsetChange` if FlashList's `scrollToEnd` target ignores the synthetic inset (the prop exists for exactly this, per `KeyboardChatScrollView/types.ts`). Not `persistent`: D5 requires the inset to reverse on hide. | — | M | P9 | Go/no-go written in `docs/` with recordings |
| P10 | If go: the composer stack in `KeyboardStickyView` (§3); transcript inset via `KeyboardChatScrollView`; interactive dismissal (`keyboardDismissMode="interactive"` on iOS, `KeyboardGestureArea interpolator="ios"` on Android 11+, which keyboard-controller gates at API 30 in `bindings.native.ts:63-66`). Delete root `useKeyboardInset` padding on both surfaces, the P3 `onEnd` scroll and the P2 interpolation. **If no-go:** keep root padding (proven in #1044) plus P2 and P3, and accept R8 and R10. | R8, R10, R21, R2/R3 structurally | M | Spike | G2 and G3 recordings |
| P11 | Slash suggestions as an inline popover in the sticky stack. Choosing an argument command inserts `/cmd ` into the composer with the argument label as a hint; send submits it. Delete `SlashCommandBoard`'s `Modal` and `SlashCommandArgModal`, and the `slashArgs` overlay from the focus machine. | R11, R12, A2 | M | P9 (P10 for anchoring) | S20 and S11 pass on both platforms with the keyboard never closing |
| P12 | Bottom stack ownership: one `BottomInset` below the raw-keys accessory. The sticky offset uses its `restingPad`. | R18 (structural), R7 (structural) | S | P10 | G6 screenshots |

### Phase 3: guard rails

| Step | What | Where |
|---|---|---|
| P13 | Unit tests: the `composerFocus` reducer (every transition in §5 and every row of the D2 table), the submit path (focus untouched, dictation stopped, expanded → inline transfer), the `onStart` follow-tail snapshot | `__tests__/unit/` (keyboard-controller is already mocked in `jest.setup.js:406`) |
| P14 | Maestro flows (mock suite): (a) type → send → type again without tapping (G5); (b) scroll up → tap composer → an older row is still visible (G2); (c) card arrives while focused → one tap answers it (G4); (d) scroll up → card arrives → nothing moves, "question waiting" shows (D6); (e) type `/` → a command row is visible → tap it with the keyboard still up; (f) raw keys on → tap composer → both visible (D3); (g) type, force fallback, text still present (G1). No `hideKeyboard` on iOS 26 (`CLAUDE.md`). Add them to `test:e2e:mock`. | `e2e/`, `package.json` |
| P15 | Device recording checklist (part 3 §3), before and after P2, P3, P6, P7, P8, P10 and P11 | iOS notched device plus an Android edge-to-edge device |

---

## 7. What gets deleted

| Code | Location | Replaced by | Step |
|---|---|---|---|
| `Keyboard.dismiss()` on Send | `ChatComposer.tsx:122` | Nothing: focus is preserved (D1) | P4 |
| RN `Keyboard` listeners (`keyboardDidShow`, `keyboardDidChangeFrame`) | `LiveConversationView.tsx:388-399` | `useKeyboardHandler` snapshot (P3), then `whenAtEnd` (P10) | P3 → P10 |
| `useKeyboardState` discrete padding switch | `ChatComposer.tsx:88-97` | Interpolated padding (P2), then the sticky offset (P10) | P2 → P10 |
| `Keyboard.dismiss()` when raw keys open | `session/[id].tsx:652` | Nothing: the accessory coexists (D3) | P8 |
| Raw-keys panel below the live body, title row, three-row layout | `session/[id].tsx:1185-1217`, `RemoteKeyboardControls.tsx:34-69` | Compact accessory row in the composer stack | P8 |
| RN `KeyboardAvoidingView` in the expanded editor | `ChatComposer.tsx:298-301` | `useKeyboardInset` | P6 |
| `wasFocusedRef` and the `AppState` refocus effect | `ChatComposer.tsx:100-113`, `:243-244`, `:272-273` | Focus machine | P5 |
| `PromptQueueSheet` and its state, actions, store slice and `queue` locale namespace | See P18 | Nothing (D7) | P18 |
| Root `useKeyboardInset` padding on both surfaces | `LiveConversationView.tsx:114`, `:413`; `TerminalView.tsx:154`, `:187` | Sticky composer stack plus transcript inset | P10 |
| Second composer stack | `TerminalView.tsx:153`, `:220-262` and `LiveConversationView.tsx:339-355`, `:490-532` | One `SessionComposer` | P9 |
| `SlashCommandBoard` `Modal`, `SlashCommandArgModal` | `components/shared/` | Inline suggestions and arguments | P11 |

`hooks/useKeyboardInset.ts` stays: P6 and P11a reuse it for full-screen modals, which is the case its precondition describes.

---

## 8. Decisions (resolved)

Full reasoning: [keyboard-ux-dilemmas-answers.md](keyboard-ux-dilemmas-answers.md).

| ID | Question | Decision | Applied in |
|---|---|---|---|
| D1 | Keyboard after a send | **(b) Keep open.** Preserve the state at Send; the expanded editor hands focus to the inline composer; never summon the software keyboard over a hardware one. | §0, §4, §5 (`submit`), P4 |
| D2 | Restore composer focus after an overlay closes | **Only for composer-owned subflows** (expanded minimize, slash arguments, attachment picker, cancelled leave dialog). Not for rename, model/effort or review. Never when the composer was unfocused. | §4, §5 restore table, P5 |
| D3 | Raw keys and keyboard together | **(b) Stacked**, reworked as a compact accessory row between the composer and the keyboard, on the same inset | §3, §4, P8, P12 |
| D4 | Keyboard while dictating | **(a) Dismiss on dictation start.** Voice owns the input until stopped; the keyboard is not reopened afterwards. | §4, §5 (`dictating`), P16 |
| D5 | Transcript lift when the keyboard opens | **(a) `whenAtEnd`.** Snapshot "following" before the viewport changes; no persistent displacement on hide. | §2 #3, §4, P3, P10 |
| D6 | Question card arrives while typing | **(a) Keep the keyboard.** `keyboardShouldPersistTaps="handled"`, interactive dismissal, and a "question waiting" affordance instead of moving a reader. | §4, P1, P17, P10 |
| D7 | `PromptQueueSheet` | **(a) Delete.** Reintroduce only with a real entry point and its own focus rule. | P18 |

### Differences from the original recommendations

| ID | Originally recommended | Decided | Plan impact |
|---|---|---|---|
| D1 | (a) Dismiss | (b) Keep open | P4 now deletes the dismiss instead of centralizing it. R17 disappears rather than needing a refocus. Deliberate dismissal (P1, P10) becomes more important. |
| D2 | Yes for expanded and args; no for sheets | Same, plus the attachment picker and the cancelled leave dialog; tracks `inline` vs `expanded` | Restore table and `FocusTarget` in §5 |
| D3 | (a) Mutually exclusive | (b) Stacked accessory | P8 rewritten; the `block` state for raw keys is gone from §5 |
| D4 | (a) Dismiss | (a) Dismiss, and never reopen after stop | New P16 |
| D5 | (a), try `persistent` in the spike | (a) only; the inset must reverse on hide | P10-spike no longer tries `persistent`. P3 snapshots at `onStart`, not at the end. |
| D6 | (a) Keep | (a) Keep, plus "question waiting" | New P17 |
| D7 | (a) Delete | (a) Delete | New P18 |

One detail in the answers is superseded by a library capability.
D6 notes that React Native has no interactive dismissal on Android.
That is true of RN core, but keyboard-controller 1.22.4 ships `KeyboardGestureArea` with interactive dismissal on Android 11+ (`bindings.native.ts:63-66`), so P10 uses it there.
