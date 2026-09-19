# Live-session keyboard audit: 2. Interaction scenarios

[1. Events and conditions](01-keyboard-events-and-conditions.md) · Part 2 of 4 · [3. UX risks](03-ux-risks.md) · [4. Refactor proposal](04-refactor-proposal.md)

This file covers the real situations in which the signals, triggers and conditions from part 1 (`K#`, `O#`, `H#`, `C#`) happen at the same time.
Each row traces what the code does today and links the resulting risk (`R#`, part 3).

**Outcome:**

- **OK**: behaves as intended.
- **Glitch**: works, but visibly janky or needs an extra tap.
- **Broken**: the user loses input, focus, position, or a tap.
- **Verify**: depends on OS behavior not reproduced here.

Confidence tags are defined in part 1.

---

## 1. Collision matrix: keyboard phase × what else happens

Keyboard phases:

- **Hidden**: no keyboard.
- **Opening**: K1 has fired, K4 has not yet.
- **Open**: the keyboard is up.
- **Closing**: `Keyboard.dismiss()` or a blur has happened, K2 has not yet.

| Phase ↓ / Event → | New row or stream chunk appended | Question / permission card appears | Surface swap or remount (H8, H9) | Overlay opens | User sends | App backgrounds |
|---|---|---|---|---|---|---|
| **Hidden** | OK: mVCP or pin follows (S1) | OK: first tap works | OK: nothing to lose | Overlay with an input opens the keyboard itself (O2, O4, O5) | No keyboard effect | Nothing |
| **Opening** | Glitch: the viewport shrinks while rows land, then a second scroll (S3) | Broken: the first tap is consumed (S5) | Broken on iOS: the focused input vanishes mid-animation (S13) | Focus moves; the modal's RN KAV mounts under a moving keyboard (S22) | n/a | Verify: iOS may drop the keyboard; K7 refocuses later (S29) |
| **Open** | OK at the tail; the follow band is smaller (S1). Glitch if scrolled up and a keyboard event fires (S2). | Broken: the first tap is consumed (S5) | Broken on iOS; Verify on Android (S13–S16) | Slash board covered by the keyboard (S20). Other modals take focus and don't give it back (S22, S24). | Glitch: several scrolls plus a padding snap (S7) | Verify (S29) |
| **Closing** | Glitch: scroll pile-up (S7) | Card tappable once closed | OK-ish: nothing focused | n/a | n/a | n/a |

---

## 2. Typing while the agent streams

| ID | Scenario | Signals and conditions that meet | What happens today | Platform | Outcome | Risks | Conf. |
|---|---|---|---|---|---|---|---|
| S1 | User types a follow-up while the reply streams. The transcript is at the tail. | K3 lift, C15 near tail, C16 pin, `data` changes | The lift is steady. Appended rows are followed because the view is within `0.2 × visible height` of the end. The pin, if the user hasn't dragged yet, issues a non-animated `scrollToEnd` on every content-size change. | Both | OK. The follow band is roughly halved while the keyboard is up. | R10 | Code + Lib |
| S2 | User scrolled up to read part of a streaming reply, then taps the composer to answer. | O1, K4 (+ K5 on iOS) | `keyboardDidShow` fires an unconditional animated `scrollToEnd` (`LiveConversationView.tsx:395-397`). The reader is taken to the bottom and loses the passage. | Both | Broken | R2, R3 | Code |
| S3 | Keyboard opens while rows are being appended | K1 → K3 frames → K4, mVCP autoscroll, C16 pin | The root's `paddingBottom` grows each frame, so the list viewport shrinks from the bottom and the last rows slide under the composer. mVCP may autoscroll on a `data` change. At `keyboardDidShow` a second animated `scrollToEnd` runs, and the pin may cut it with a non-animated one. | Both | Glitch | R8, R9 | Code + Lib; Device |
| S4 | The thinking bubble mounts or fades while the keyboard is open | C18, content-size changes | The footer height changes, triggering mVCP / pin. The keyboard is unaffected. | Both | OK | — | Code |
| S5 | A question or permission card lands while the user is typing | C18 (the card is the list footer), C2 `sendDisabled`, H5 | Send is disabled, but typing continues and the keyboard stays. The card sits just above the composer if the view was at the tail. With the keyboard covering about half the screen, a tall card needs scrolling. **The first tap on any card button only dismisses the keyboard.** `keyboardShouldPersistTaps` is RN's default `'never'`. | Both | Broken (extra tap on a time-sensitive prompt) | R1 | Code + Lib |
| S6 | User answers the card, then resumes typing | Card answer path, O1 | No keyboard interaction beyond S5 | Both | OK | — | Code |

## 3. Sending

| ID | Scenario | Signals and conditions that meet | What happens today | Platform | Outcome | Risks | Conf. |
|---|---|---|---|---|---|---|---|
| S7 | Send from the inline composer while the agent streams | H1, K3 frames, K5 on hide (iOS), optimistic bubble (`pendingSends`), mVCP, C16, K2 | In order: `Keyboard.dismiss()` (JS), then the close animation shrinks the lift. The optimistic row changes `data`, so mVCP autoscrolls. On iOS, `keyboardDidChangeFrame` fires on hide and adds another `scrollToEnd`. At `keyboardDidHide`, the composer padding snaps from 8 to 34 (+26 pt), shrinking the list again. | iOS: all steps. Android: no K5. | Glitch | R3, R7, R9 | Code + Lib + OS |
| S8 | Send fails (not connected, or the server refuses because a prompt is pending) | H1 runs **before** the await (`ChatComposer.tsx:122`) | The keyboard is already gone. "Not connected" shows an `Alert` (`LiveConversationView.tsx:305-307`). "Prompt pending" calls `jumpToLatest` (`:329-332`). The draft is kept. The user must tap the input again to edit. | Both | Glitch | R17 | Code |
| S9 | Send from the expanded editor | H2 | Dismiss, close the modal, send | Both | OK | — | Code |
| S10 | Pick a **no-arg** slash command from the board | `handleSlashCommandSelect` → `sendAndReset` (`useComposerState.ts:147-156`) | No `Keyboard.dismiss()`, so the keyboard stays up. This differs from S7. | Both | Glitch (inconsistent) | R13 | Code |
| S11 | Pick an **arg** slash command, type the argument, confirm | O4 then H6 | The board closes. The arg modal autofocuses, so focus moves. On confirm the modal returns `null`, the focused input unmounts, the keyboard closes, and the composer is **not** refocused. | Both | Glitch | R13, R14 | Code |
| S12 | Dictate with the mic, then tap Send while recognition is still running | C4, H1 | Send dismisses the keyboard and resets the composer, but `voice.stop()` is never called. A later interim `result` (continuous mode, up to the 30 s silence timeout) writes the old transcript back into the now-empty composer (`useComposerState.ts:70`). | Both (real device only; the simulator throws `VOICE_UNAVAILABLE`) | Broken | R20 | Code |

## 4. Session and surface changes while the keyboard is open

| ID | Scenario | Signals and conditions that meet | What happens today | Platform | Outcome | Risks | Conf. |
|---|---|---|---|---|---|---|---|
| S13 | Mid-stream, parse confidence drops to `low`, or chat reports an empty transcript with an active PTY (`onPreferRawTerminal`) | C8 flips without user action → H8 | `LiveConversationView` unmounts and `TerminalView` mounts with a **new** `ChatComposer` and `useComposerState`. **iOS:** the keyboard closes. **Android:** per #964 the IME can stay up and focus may jump to the new input. Draft text comes back from the drafts store asynchronously (a brief empty composer). **Attachments are lost** because they are local state. Dictation stops (unmount cleanup). | iOS: Broken. Android: Verify. | Broken | R4, R6 | Code + OS |
| S14 | Confidence recovers, so the screen swaps back to chat | C8 again | Same as S13 in reverse | Same | Broken | R4, R6 | Code |
| S15 | User taps the Chat/Terminal chip while typing | Manual H8 | Same as S13. #964 used to dismiss explicitly; #1044 removed that on the grounds that the lift now survives. The focused input still unmounts. | Same | Broken on iOS | R4 | Code |
| S16 | Codex session: `boundConversationId` arrives while the user is typing | C9 key change → H9 | The whole chat surface remounts. Same effects as S13, on the same surface. Happens once per Codex session. | Same | Broken on iOS | R5, R6 | Code |
| S17 | Reconnect banner, external-session banner or raw-fallback banner appears while typing | Siblings above the body (`session/[id].tsx:1089-1108`) | The top edge shifts. The bottom still reaches the screen edge, so the lift stays correct. No remount, because the conditional slots keep their positions. | Both | OK | — | Code |
| S18 | The session stops being live (PTY detaches, status leaves `running` / `waiting_input`) | C10 → H10 | The live body is replaced and the keyboard closes. The draft persists. | Both | OK (expected) | — | Code |
| S19 | First seconds of a fresh session: output flickers | C1: `isWakingUp` follows `isStreaming` until the 8 s timeout | If the user focused during an enabled window, `editable` can flip to false under focus | Both | Verify (low likelihood) | R23 | Code + OS |

## 5. Overlays and modals

| ID | Scenario | Signals and conditions that meet | What happens today | Platform | Outcome | Risks | Conf. |
|---|---|---|---|---|---|---|---|
| S20 | User types `/` with the keyboard up | C6 | A full-screen transparent `Modal` opens. **iOS:** the keyboard stays and covers the lower part of the bottom-anchored sheet (up to 55% of the screen), so only the header and a few rows are visible. Typing continues to filter because the composer underneath keeps focus, and rows respond to the first tap (`persistTaps="always"`). **Android:** the Dialog window may take focus from the input, hiding the IME or stopping the filtering. | iOS: Glitch. Android: Verify. | Glitch | R11, R12 | Code + OS; Device |
| S21 | User taps the slash board backdrop | `onDismiss={() => handleInputChange('')}` | The text is cleared; the keyboard stays | Both | OK | — | Code |
| S22 | User expands the editor while the keyboard is up, then minimizes | O2 → H3, K6 | Focus moves to the modal input. RN KAV mounts **under an already-open keyboard** and has no metrics until the next show event. On iOS that event is re-posted on the focus change (OS), so it is likely fine; Android is a Dialog with `height` behavior plus `adjustResize` (Verify). Minimize unmounts the input, so the keyboard closes and the inline input is **not** refocused. | iOS: Glitch. Android: Verify. | Glitch | R14, R16 | Code + Lib + OS |
| S23 | App goes to the background with the expanded editor open, and iOS drops the keyboard | K7, C5 | `wasFocusedRef` is false (the expanded input has no `onFocus`), so nothing is refocused | iOS | Glitch | R15 | Code |
| S24 | Rename, model/effort or review sheet opened from the header while typing | O5, O6, O7 → H7 | Focus moves into the sheet. On close, the keyboard closes and the composer is not refocused. | Both | Glitch (probably acceptable for rename and model; see D2 in part 4) | R14 | Code |
| S25 | Attach while the keyboard is up | H12 | The action-sheet `Alert`, then the system picker or camera, take over. Whether the keyboard comes back on return is OS-dependent. The chips row then grows the composer, and the list shrinks. | Both | Verify | — | OS; Device |
| S26 | Raw-keyboard panel open, then the user taps the composer | H4 then O1, C11 | The panel sits **below** the live surface, so the surface no longer reaches the screen bottom. The lift is still the full keyboard height, so the composer floats one panel-height above the keyboard, and the panel itself is hidden behind the keyboard. At rest, the composer also keeps its home-indicator padding although the panel, not the composer, is bottom-most. The panel has no bottom safe-area handling. | Both | Broken (layout) | R18 | Code |
| S27 | Jump-to-latest FAB showing, then the keyboard opens | C17, K3 | The FAB's `bottom: spacing.md` is measured from the root's outer edge. Absolute insets ignore the parent's padding (Yoga), so the keyboard padding does not move it and it stays behind the keyboard. At rest it falls inside the composer's band. | Both | Verify with a screenshot | R19 | Code; Device |
| S28 | User goes back while typing, and the leave guard prompts | H13 | `CriticalDialog` (centered transparent `Modal`) appears. **iOS:** the keyboard can remain over it and cover its buttons. **Android:** the first hardware back closes the IME instead of navigating. | iOS: Verify. Android: OK. | Verify | R22 | Code + OS |

## 6. App lifecycle, system and input sources

| ID | Scenario | Signals and conditions that meet | What happens today | Platform | Outcome | Risks | Conf. |
|---|---|---|---|---|---|---|---|
| S29 | Background → foreground while typing (iOS sometimes drops the keyboard) | K7, C12, then K4 | The inline input is refocused and the keyboard reopens. `keyboardDidShow` then forces `scrollToEnd`, even if the user was reading older content. | iOS mainly | Glitch | R2 | Code + OS |
| S30 | Foreground triggers a reconnect burst (session invalidation plus WS catch-up) while typing | `data` bursts, C15, C16 | Content is followed only if near the tail; the keyboard is unaffected | Both | OK (verify smoothness) | R9 | Code |
| S31 | Hardware keyboard, or iPad floating keyboard | K1 with a small height, or K2 when floating | Accessory bar only: small lift, 8 pt gap. Floating: `WillHide`, so the composer uses full safe-area padding while the user types. | iOS | OK | — | Lib + OS |
| S32 | User switches to the emoji keyboard or toggles QuickType (height change) | K3, K5 | The lift tracks it. `keyboardDidChangeFrame` fires another unconditional `scrollToEnd`. | iOS | Glitch if scrolled up | R3 | Code + OS |
| S33 | User starts dictation with the keyboard up | C4 | The keyboard stays up, covering about half the transcript. When the first result arrives, `hasContent` becomes true and the inline mic button turns into Send, so the inline composer has no stop control (the expanded editor still has one). Only the 30 s silence timer ends it. | Both (device) | Glitch | R20 | Code |
| S34 | The app backgrounds while the session screen sits under another screen with a stale `wasFocusedRef` | K7 is not gated on screen focus | Likely prevented, because a detached input blurs (OS). If not, the keyboard could open over another screen on return. | Both | Verify (low) | R25 | Code + OS |
