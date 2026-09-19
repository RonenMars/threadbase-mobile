# Live-session keyboard audit: 3. UX risks

[1. Events and conditions](01-keyboard-events-and-conditions.md) · [2. Interaction scenarios](02-interaction-scenarios.md) · Part 3 of 4 · [4. Refactor proposal](04-refactor-proposal.md)

Every user-visible risk found in parts 1–2, ordered by severity.
The **Fix** column points to the step in part 4 that removes it, as planned after decisions D1–D7 ([answers](keyboard-ux-dilemmas-answers.md)).

**Severity:**

- **High**: the user loses typed input, focus mid-typing, or a tap on a time-sensitive control.
- **Medium**: the user loses reading position, needs an extra action, or a control is hidden.
- **Low**: polish, or a rare edge.

**Likelihood** is how often a normal user in a live session would hit it: Always, Often, Sometimes, Rare.
Confidence tags are defined in part 1. **Device** means a screenshot or recording is needed before acting.

---

## 1. Risk register

| ID | What the user experiences | Scenarios | Platform | Severity | Likelihood | Evidence | Conf. | Fix |
|---|---|---|---|---|---|---|---|---|
| R1 | A question or permission card arrives while they type. They tap "Allow" or an option and nothing happens. The tap only closed the keyboard, so a second tap is needed. The same applies to every tappable element in the transcript. | S5 | Both | High | Often | The chat `FlashList` has no `keyboardShouldPersistTaps` (`LiveConversationView.tsx:414-477`), FlashList adds no default, so RN's `'never'` applies. The card is the list footer (`:460-477`). | Code + Lib | P1 |
| R4 | They are typing when the view flips between chat and terminal, either on its own (parse confidence drops, raw fallback) or via the chip. **iOS:** the keyboard closes mid-word. **Android:** the IME may stay up while focus jumps to a different input. | S13, S14, S15 | iOS (Android differs) | High | Sometimes | The surface switch unmounts one composer and mounts another (`session/[id].tsx:1030-1035`, `:1111-1131`). `parseConfidence` can change mid-stream. #1044 removed #964's dismiss but not the unmount. | Code + OS | P9 |
| R6 | After R4 or R5, **attachments disappear**, dictation stops, and the draft text blinks empty before being restored | S13–S16 | Both | High | Sometimes | Attachments live in `useComposerState` local state (`useComposerState.ts:52`), not in the drafts store. The draft is restored asynchronously (`:88-93`). | Code | P9 |
| R5 | Codex only: they are typing when the session binds its rollout id, and the whole chat view remounts (keyboard closes on iOS) | S16 | iOS (Android differs) | Medium | Sometimes (once per Codex session) | `key={historyConversationId!}` (`session/[id].tsx:1123`), where the id changes on first bind (`:1019`, `:696-709`) | Code | P9 |
| R2 | They scroll up to read the reply, tap the composer to answer, and are taken to the bottom, losing the passage. The same happens on returning to the app with the keyboard restored. | S2, S29 | Both | Medium | Often | Unconditional `scrollToEnd` on `keyboardDidShow` (`LiveConversationView.tsx:395-396`). This contradicts the file's own follow rule ("scrolled up → don't", `:72-80`). | Code | P3 |
| R3 | iOS: **closing** the keyboard, whether by sending, tapping a message, or switching to the emoji keyboard, also takes the reader to the bottom. Every open scrolls twice. | S2, S7, S32 | iOS | Medium | Often | `keyboardDidChangeFrame` listener (`:397`). RN Android doesn't emit it. iOS posts it for show, hide and height changes. | Code + Lib + OS | P3 |
| R11 | Typing `/` opens the command list, but the keyboard covers most of it. Only the header and a couple of rows are visible, so they can't see the commands they're filtering. | S20 | iOS | Medium | Often (every slash use) | Full-screen transparent `Modal`, sheet bottom-anchored with `maxHeight: '55%'` and no keyboard avoidance (`SlashCommandBoard.tsx:44-53`, `:127-136`) | Code + OS; Device | P11 (interim: P11a) |
| R18 | With the raw-keys panel open, tapping the composer makes it float a panel-height above the keyboard while the panel hides behind the keyboard. At rest, there is a double gap (composer safe-area padding above a panel that has none). | S26 | Both | Medium | Sometimes | The panel renders below the live body (`session/[id].tsx:1185`). This breaks `useKeyboardInset`'s "spans to the screen's bottom edge" precondition (`hooks/useKeyboardInset.ts:16`). `RemoteKeyboardControls` has no inset handling. | Code | P8, P12 |
| R20 | While dictating, the keyboard covers half the screen. Once words appear, the inline mic turns into Send, so there is no way to stop dictation inline. After sending, a late recognition result can **refill the cleared composer** with the old words. | S12, S33 | Both (device) | Medium | Sometimes | Send never calls `voice.stop()` (`useComposerState.ts:112-124`). Continuous mode with a 30 s silence timeout (`useVoiceInput.ts:14`, `:74-81`). The trailing button swaps on `hasContent` (`ChatComposer.tsx:194-227`). | Code | P16, P4 |
| R21 | There's no clean way to just put the keyboard away and read. No swipe-down; tapping the transcript closes it but also swallows that tap. | S5 | Both | Medium | Often | No `keyboardDismissMode` on the transcript, and the H5 behavior | Code | P1, P10 |
| R13 | Keyboard behavior after sending depends on how they sent. A plain message closes it. A no-arg slash command leaves it open. An arg command closes it and leaves the composer unfocused. | S7, S10, S11 | Both | Medium | Sometimes | `Keyboard.dismiss()` exists only in `ChatComposer.handleSend` (`:120-124`). The slash paths go through `useComposerState.ts:147-162`. | Code | P4 |
| R14 | After closing the expanded editor, the arg modal, or the rename or model sheet, they must tap the composer again to keep typing | S11, S22, S24 | Both | Medium | Often | Nothing refocuses the composer on H3, H6 or H7 (part 1) | Code | P5 |
| R22 | On iOS, going back while typing can show the leave-session dialog with the keyboard still up, covering its buttons | S28 | iOS | Medium | Sometimes | `CriticalDialog` is a centered transparent `Modal` with no keyboard handling (`components/alerts/CriticalDialog.tsx:67-69`). Nothing dismisses the keyboard before it opens. | Code + OS; Device | P5 |
| R19 | The "jump to latest" button hides behind the keyboard. At rest it likely overlaps the composer's Send/Mic end: underneath it on iOS (the composer is a later sibling with an opaque background), on top on Android (`elevation: 4`). | S27 | Both | Medium | Often (whenever scrolled up) | `position: absolute; bottom: spacing.md` in the padded root (`LiveConversationView.tsx:478-489`, `:574-589`). Absolute insets ignore the parent's padding in Yoga. Only jest covers the FAB (no layout). | Code; Device | P7 |
| R7 | The composer jumps about 26 pt (notched iPhones) at the **start** of every open and the **end** of every close. For the last frames of a close, the input row sits inside the home-indicator zone. | S7, all opens and closes | iOS (Android: the jump equals `insets.bottom − 8`) | Low | Always | The discrete `isVisible` switch flips on `WillShow` and `DidHide` (`ChatComposer.tsx:94-97`, keyboard-controller `module.ts:19-27`), while the lift animates per frame | Code + Lib | P2 |
| R8 | On open at the tail, the latest messages slide under the composer during the animation, then scroll back up after it ends: a two-step motion | S3 | Both | Low | Always | The lift shrinks the viewport per frame. The only correction is the post-animation `keyboardDidShow` scroll. | Code + Lib; Device | P3, P10 |
| R9 | Sending during a stream produces a jittery scroll: several scroll commands within about 300 ms (dismiss animation, iOS frame-change scroll, the optimistic row's autoscroll, and a non-animated pin scroll that can cut an animated one short) | S3, S7, S30 | Both | Low | Often | `LiveConversationView.tsx:395-397`, `:437-441`, `hooks/useInitialScrollToEnd.ts` | Code; Device | P3, P10 |
| R10 | While the keyboard is up, the transcript stops auto-following a stream sooner. The "near the end" band is 20% of the visible height, which the keyboard roughly halves. | S1 | Both | Low | Often | FlashList `useBoundDetection.ts:126-131` | Lib | P10 (or accept) |
| R12 | Android: opening the slash board may take focus from the composer, hiding the IME or stopping filter-as-you-type | S20 | Android | Medium if confirmed | Unknown | RN `Modal` is a separate `Dialog` window | OS; Device | P11 |
| R16 | Android: the expanded editor may over-avoid (a gap) or under-avoid (the input under the IME). RN's KAV `height` runs inside a Dialog window, and it mounts under an already-open keyboard with no metrics. | S22 | Android | Medium if confirmed | Sometimes | `ChatComposer.tsx:298-301`, RN `KeyboardAvoidingView.js:192-216` | Lib + OS; Device | P6 |
| R15 | If iOS drops the keyboard while the expanded editor is open, it is not restored on return | S23 | iOS | Low | Rare | The expanded `TextInput` has no `onFocus` / `onBlur` (`ChatComposer.tsx:312-323`) | Code | P5 |
| R17 | A failed send leaves the keyboard closed. The text is kept, but they must tap again to fix it and retry. | S8 | Both | Low | Rare | `Keyboard.dismiss()` precedes the await (`ChatComposer.tsx:122`) | Code | P4 |
| R23 | In a fresh session's first 8 s, the composer can flip to disabled while focused | S19 | Both | Low | Rare | `isWakingUp` tracks `isStreaming` until `WAKING_UP_WS_TIMEOUT_MS` (`session/[id].tsx:84`, `:743-746`, `:814`) | Code + OS | P5 |
| R25 | The foreground refocus isn't gated on the session screen being focused. In theory the keyboard could open over another screen. | S34 | Both | Low | Rare (likely masked by blur-on-detach) | `ChatComposer.tsx:106-113` | Code + OS; Device | P5 |
| R24 | The comment at `ChatComposer.tsx:89` says `behavior="padding"` lifts the composer. For the inline composer that has not been true since #1044, and the comment points the next fix at the wrong layer. | — | — | Low | — | `ChatComposer.tsx:89-93` vs `hooks/useKeyboardInset.ts` | Code | P2 |

### By severity

| Severity | Risks |
|---|---|
| High | R1, R4, R6 |
| Medium | R2, R3, R5, R11, R12\*, R13, R14, R16\*, R18, R19\*, R20, R21, R22\* |
| Low | R7, R8, R9, R10, R15, R17, R23, R24, R25 |

\* needs a device check before it's treated as confirmed.

---

## 2. Adjacent findings (not keyboard, found on the way)

| ID | Finding | Evidence | Why it matters here | Fix |
|---|---|---|---|---|
| A1 | `PromptQueueSheet` is unreachable: nothing sets `queueVisible` to true | grep of `app`, `components`, `hooks` for `setQueueVisible(true` is empty. The only callers pass `false`. | It carries a `@gorhom/bottom-sheet` keyboard config (`keyboardBehavior="extend"`, `PromptQueueSheet.tsx:96-97`). Inside a root that is already keyboard-padded, that config would lift twice if re-enabled. | P18 (deleted, D7) |
| A2 | Cancelling the slash-arg modal clears the composer text but not the stored draft, so `/cmd` reappears on the next mount | `setInputText('')` at `useComposerState.ts:150`. `clearDraft` runs only in `resetComposer` (`:105-110`). | Draft restore is what R6 relies on | P11 |
| A3 | Dictated text bypasses `handleInputChange`, so it is never saved as a draft and never opens the slash board | `onTranscript: (text) => setInputText(text)` (`useComposerState.ts:70`) | A remount (R4, R5) during dictation loses the dictated text entirely | P16 |
| A4 | The whole composer stack is duplicated per surface: `ChatComposer`, `SlashCommandBoard`, `SlashCommandArgModal`, `PromptQueueSheet`, and a separate `useComposerState` | `LiveConversationView.tsx:339-355`, `:490-532` vs `TerminalView.tsx:153`, `:220-262` | The structural cause of R4, R5 and R6 | P9 |

---

## 3. Device checks needed before acting on the Device rows

| Risk | Check | Platforms |
|---|---|---|
| R11, R12 | Type `/` with the keyboard up. Screenshot the board. Keep typing and confirm filtering still works. | iOS, Android |
| R19 | Scroll up until the FAB shows. Screenshot at rest and with the keyboard open. | iOS, Android |
| R16 | Keyboard up, tap expand, type multiple lines. Record the bottom edge. | Android |
| R22 | Type, then tap back on a session where the leave guard applies. Screenshot the dialog. | iOS |
| R4 (Android) | Type, then tap the Chat/Terminal chip. Is the IME still up, and which input has the caret? | Android |
| R8, R9 | Screen-record opening the keyboard at the tail, and sending mid-stream | iOS, Android |
| R25 | With the keyboard up, navigate forward from the session screen, background, then foreground | iOS, Android |

For Maestro on iOS 26, do not use `hideKeyboard` (see `CLAUDE.md` → E2E Testing). Close the keyboard by tapping or scrolling instead.
