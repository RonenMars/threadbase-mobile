# Live-session keyboard audit: 1. Events and conditions

Part 1 of 4 · [2. Interaction scenarios](02-interaction-scenarios.md) · [3. UX risks](03-ux-risks.md) · [4. Refactor proposal](04-refactor-proposal.md)

**Snapshot:** `main` @ `d78f7a5f`, 2026-09-19.
**Scope:** the live session screen (`app/session/[id].tsx`), covering the chat surface (`LiveConversationView`), the terminal surface (`TerminalView`), their shared `ChatComposer`, and every overlay reachable from that screen.
**Method:** I read the code only. Nothing was run on a device.

**Confidence legend** (used in every file of this audit):

| Tag | Meaning |
|---|---|
| **Code** | Read in this repo's source at the snapshot commit. |
| **Lib** | Read in the installed library source under `node_modules/`. |
| **OS** | Documented or well-known iOS/Android behavior that this audit did not reproduce. |
| **Device** | An inference that only a screenshot or screen recording can settle. |

---

## 1. Who does what (layer map)

| Layer | File | Mechanism | Runs on | Reacts to |
|---|---|---|---|---|
| Keyboard state provider | `app/_layout.tsx:555` | `KeyboardProvider` (react-native-keyboard-controller 1.22.4), app-wide | Native → UI thread | IME / keyboard frame |
| Screen shell | `app/session/[id].tsx:1049` | `SafeAreaView edges={['top']}`. The bottom edge is deliberately left to the composer. | — | — |
| **Lift** (keyboard avoidance) | `hooks/useKeyboardInset.ts:22-25`, applied at `LiveConversationView.tsx:413` and `TerminalView.tsx:187` | `paddingBottom: -height.value` from `useReanimatedKeyboardAnimation`, set on the surface's root `Reanimated.View` | UI thread, every frame | Keyboard height |
| **Resting gap** (composer bottom padding) | `components/conversation/ChatComposer.tsx:88-97`, `:230` | `useKeyboardState(s => s.isVisible)`. Open: `spacing.sm` (8). Closed: `max(insets.bottom, 8)` | JS thread, discrete re-render | `keyboardWillShow` / `keyboardDidHide` only |
| **Transcript scroll** on keyboard change | `LiveConversationView.tsx:388-399` | RN `Keyboard.addListener('keyboardDidShow' \| 'keyboardDidChangeFrame')` → `scrollToEnd({animated:true})` | JS thread | RN keyboard events (not keyboard-controller) |
| Transcript follow on new content | `LiveConversationView.tsx:72-80`, `:437` | FlashList `maintainVisibleContentPosition` with `autoscrollToBottomThreshold: 0.2` | FlashList | `data` changes |
| Initial pin to end | `hooks/useInitialScrollToEnd.ts`, wired at `LiveConversationView.tsx:109,439-441` | `scrollToEnd({animated:false})` on every `onLoad` / `onContentSizeChange` until the first user drag | JS thread | Content size |
| Focus restore | `ChatComposer.tsx:100-113` | `AppState 'active'` → `inputRef.focus()` when `wasFocusedRef` is true | JS thread | App foreground |
| Expanded editor | `ChatComposer.tsx:297-363` | RN `Modal` + **RN's own** `KeyboardAvoidingView` (`padding` on iOS, `height` on Android) | JS thread | RN keyboard events |
| Native window | `android/app/src/main/AndroidManifest.xml:30`, `android/gradle.properties:53` | `windowSoftInputMode="adjustResize"` + `edgeToEdgeEnabled=true`. The window is not resized by the IME, so the lift is the only avoidance. | — | — |

Four independent mechanisms react to the keyboard, on three different event streams:

1. The keyboard-controller shared value.
2. The keyboard-controller JS state.
3. RN's `Keyboard` events.
4. RN KAV in the modal.

Most of the risks in part 3 come from these four drifting apart.

---

## 2. Keyboard signals the code listens to

| ID | Signal | API | Platforms | Fires when | Consumer | Effect | Conf. |
|---|---|---|---|---|---|---|---|
| K1 | `keyboardWillShow` | keyboard-controller `KeyboardEvents` | iOS, Android | **Start** of the open animation. It also fires again when focus moves between inputs on iOS (OS). | `module.ts` sets `isClosed=false`. `useKeyboardState` re-reads (`useKeyboardState/index.ts:8`). | Composer padding jumps to 8 (`ChatComposer.tsx:95-97`) | Lib |
| K2 | `keyboardDidHide` | keyboard-controller `KeyboardEvents` | iOS, Android | **End** of the close animation | Same as K1 | Composer padding jumps back to `max(insets.bottom, 8)` | Lib |
| K3 | Keyboard height / progress shared values | `useReanimatedKeyboardAnimation` | iOS, Android (Android via WindowInsetsAnimation) | Every animation frame, including interactive changes and height changes | `useKeyboardInset` | Surface root `paddingBottom` = keyboard height | Lib + Code |
| K4 | `keyboardDidShow` | RN `Keyboard` | iOS, Android | End of the open animation. On iOS, also on a focus change. | `LiveConversationView.tsx:396` | Unconditional animated `scrollToEnd` | Code |
| K5 | `keyboardDidChangeFrame` | RN `Keyboard` | **iOS only.** RN Android emits only `keyboardDidShow` / `keyboardDidHide` (Lib: grep of `ReactAndroid`). | Any frame change: show, **hide**, QuickType or emoji switch, hardware keyboard, rotation (OS) | `LiveConversationView.tsx:397` | Unconditional animated `scrollToEnd` | Code + Lib + OS |
| K6 | `keyboardWillShow/WillHide` (iOS), `keyboardDidShow/DidHide` (Android) | RN `KeyboardAvoidingView` | iOS, Android | As named. If the component **mounts while the keyboard is already open**, it has no metrics until the next show event (`KeyboardAvoidingView.js:192-216`). | Expanded editor `ChatComposer.tsx:298-301` | Modal content padding (iOS) or height (Android) | Lib |
| K7 | `AppState` → `'active'` | RN `AppState` | iOS, Android | Return from background/inactive, including Control Center, permission prompts and Face ID (OS) | `ChatComposer.tsx:106-113` | `inputRef.focus()` if `wasFocusedRef` is true | Code |
| K8 | `onFocus` / `onBlur` | `TextInput` | iOS, Android | Inline composer input only (`:243-244`, `:272-273`). The expanded input (`:312-323`) has **none**. | `wasFocusedRef` | Feeds K7 | Code |

The terminal surface's transcript (`components/terminal/TerminalOutput.tsx`) has no keyboard listeners. It scrolls on its own content-size logic (`:173-181`, `:247`).

---

## 3. What opens the keyboard (show triggers)

| ID | Trigger | Where | Guard / condition | Focus lands on | Conf. |
|---|---|---|---|---|---|
| O1 | User taps the composer input | `ChatComposer.tsx:237-251` (Android), `:266-280` (iOS) | `editable={!disabled}`. `disabled` = `isWakingUp` (`session/[id].tsx:814`, passed at `:1117`, `:1128`). | Inline input | Code |
| O2 | Expand button → full-screen editor | `ChatComposer.tsx:257`, `:286` → `Modal` `:297`, `autoFocus` `:321` | Button `disabled={disabled}` | Expanded input (focus moves out of the inline input) | Code |
| O3 | App returns to foreground | `ChatComposer.tsx:106-113` | `wasFocusedRef.current === true`. Not gated on screen focus or on `expanded`. | Inline input | Code |
| O4 | Slash command that needs arguments | `useComposerState.ts:149-152` → `SlashCommandArgModal.tsx:99` (`autoFocus`) | `command.needsArgs` | Arg modal input | Code |
| O5 | Rename (header pencil) | `session/[id].tsx:1229` → `NameSessionModal.tsx:70` (`autoFocus`) | `renameSheetVisible` | Rename input | Code |
| O6 | Model / effort sheet | `session/[id].tsx:1241` → `ModelEffortSheet.tsx:89` | User taps the field. `editable={!busy}`. | Model input | Code |
| O7 | Review sheet search | `ReviewSheet.tsx:138` | User taps the field | Search input | Code |
| O8 | Terminal surface, history search | `SessionHistoryFeed.tsx:305` (`autoFocus={!searchQuery}`) | Terminal surface only, when search is opened | Search input | Code |
| — | Prompt queue sheet input | `PromptQueueSheet.tsx:106` | **Unreachable.** Nothing calls `setQueueVisible(true)` (grep of `app`, `components`, `hooks`). | — | Code |

---

## 4. What closes the keyboard (hide triggers)

| ID | Trigger | Where | Explicit or implicit | Composer refocused afterwards? | Conf. |
|---|---|---|---|---|---|
| H1 | Send from the inline composer | `ChatComposer.tsx:120-124` (`Keyboard.dismiss()` **before** `onSend`) | Explicit (#327) | No, by design | Code |
| H2 | Send from the expanded editor | `ChatComposer.tsx:350-353` (H1, then `setExpanded(false)`) | Explicit | No | Code |
| H3 | Minimize the expanded editor | `ChatComposer.tsx:328`. The modal unmounts with the focused input. | Implicit (focused view removed) | **No.** The inline input is not refocused. | Code + OS |
| H4 | Raw-keyboard panel, "agree" | `session/[id].tsx:651-653` | Explicit `Keyboard.dismiss()` | No | Code |
| H5 | Tap anywhere on the transcript | The chat `FlashList` sets no `keyboardShouldPersistTaps` (`LiveConversationView.tsx:414-477`). FlashList adds no default (Lib: grep of `@shopify/flash-list/src` is empty), so RN's default `'never'` applies. | Implicit. **The tap is consumed** to dismiss; the target does not receive it. | No | Code + Lib |
| H6 | Slash arg modal confirm or cancel | `useComposerState.ts:161`, `LiveConversationView.tsx:524`. The modal returns `null` (`SlashCommandArgModal.tsx:44`), so the focused input unmounts. | Implicit | **No** | Code |
| H7 | Rename / model / review sheet closes | Modal unmounts with its focused input | Implicit | No | Code |
| H8 | **Surface swap** chat ↔ terminal: manual chip (`session/[id].tsx:1067-1072`) or automatic (`showTerminalSurface`, `:1030-1035`: `parseConfidence === 'low'`, `forceRawTerminal` via `onPreferRawTerminal`, render mode) | `session/[id].tsx:1111-1131`. The outgoing surface, and its composer, unmounts. | Implicit. **iOS:** the keyboard closes because a first responder removed from the window resigns (OS). **Android:** per #964's repro the IME stayed up and a caret appeared in the new surface's input. That repro predates #1044. | No explicit refocus | Code + OS |
| H9 | **Codex first bind**: `boundConversationId` goes from null to a UUID | `key={historyConversationId!}` (`session/[id].tsx:1123`) with `historyConversationId = boundConversationId ?? conversationId` (`:1019`). The whole chat surface remounts. | Implicit, same platform split as H8 | No | Code |
| H10 | Session leaves the live state | `isLive` (`session/[id].tsx:632-634`) turns false. The live body at `:1087` is replaced. | Implicit | n/a | Code |
| H11 | Composer disabled while focused | `editable={!disabled}`. `isWakingUp` can re-flip with `isStreaming` until `WAKING_UP_WS_TIMEOUT_MS` (8 s, `session/[id].tsx:84`, `:734-737`, `:743-746`, `:814`). | Implicit. The effect on a focused input is OS-dependent. | No | Code + OS |
| H12 | Attach → action-sheet `Alert` → camera / library / files picker | `useComposerState.ts:213-221`, `:179-211` | Implicit (system UI takes over). Whether focus is restored on return is OS-dependent. | OS-dependent | OS / Device |
| H13 | Back navigation / leave guard | `usePreventRemove` (`hooks/useSessionLeaveGuard.ts:239`) shows `LeaveSessionModal` → `CriticalDialog` (transparent RN `Modal`, centered, no keyboard handling). Android hardware back closes the IME first (OS). | Implicit or none | n/a | Code + OS |

What **never** closes the keyboard today:

- Scrolling or dragging the transcript. There is no `keyboardDismissMode`, so no swipe-down or interactive dismissal.
- Tapping the header, banners, or the mic and attach buttons. They are outside any ScrollView.
- Opening the slash board. On iOS it is a transparent RN `Modal` over the still-focused composer (OS).
- A question or permission card arriving.

---

## 5. State that changes keyboard or padding behavior (conditions)

| ID | Condition | Source | What it changes | Conf. |
|---|---|---|---|---|
| C1 | `disabled` (`isWakingUp`) | `session/[id].tsx:743-746`, `:814` | Input `editable=false`, the displayed value becomes `''`, placeholder "starting", expand/attach/mic disabled (`ChatComposer.tsx:180-262`) | Code |
| C2 | `sendDisabled` (`answerPhase === 'active'`) | `LiveConversationView.tsx:499`, `TerminalView.tsx:228` | Send button only. Typing and the keyboard stay live. | Code |
| C3 | `hasContent` (text or attachments) | `ChatComposer.tsx:115` | Trailing button is Send, else Mic (if `micGranted`), else disabled Send. `handleSend` guard. | Code |
| C4 | `voice.listening` | `hooks/useVoiceInput.ts` (continuous, interim results, 30 s silence timeout) | Transcript overwrites `inputText` directly (`useComposerState.ts:70`). Does not dismiss the keyboard. | Code |
| C5 | `expanded` | `ChatComposer.tsx:98` | Which input owns focus. The expanded input is not tracked by `wasFocusedRef`. | Code |
| C6 | `slashBoardVisible` | `useComposerState.ts:129` (`/^\/.{0,30}$/`) | Full-screen transparent `Modal` over the composer (`SlashCommandBoard.tsx:44-50`). The sheet is bottom-anchored with `maxHeight: '55%'` (`:127-136`) and has **no keyboard avoidance**. Rows use `keyboardShouldPersistTaps="always"` (`:76`). | Code |
| C7 | `pendingArgCommand` | `useComposerState.ts:56`, `:149-152` | Arg modal with its own focused input and `KeyboardAwareScrollView` (`SlashCommandArgModal.tsx:61-66`) | Code |
| C8 | `showTerminalSurface` | `session/[id].tsx:1030-1035` | Which surface, and which **composer instance**, is mounted. Can flip without user action (`parseConfidence`, `forceRawTerminal`). | Code |
| C9 | `historyConversationId` (React key) | `session/[id].tsx:1019`, `:1123` | Remounts the chat surface and its composer when it changes (Codex bind, `:696-709`) | Code |
| C10 | `isLive` | `session/[id].tsx:632-634` | Whether any live surface or composer exists | Code |
| C11 | `rawKeyboardVisible` | `session/[id].tsx:568`, `:1185` | Adds `RemoteKeyboardControls` **below** the live body. The live surface no longer reaches the screen bottom, which breaks `useKeyboardInset`'s stated precondition (`hooks/useKeyboardInset.ts:16`). The panel has no bottom safe-area handling. | Code |
| C12 | `wasFocusedRef` | `ChatComposer.tsx:105`, `:243-244`, `:272-273` | Gates K7 refocus | Code |
| C13 | Keyboard `isVisible` | keyboard-controller `module.ts:19-27` | True from **WillShow** to **DidHide**. Asymmetric: flips early on open, late on close. | Lib |
| C14 | `insets.bottom` | `useSafeAreaInsets` | Closed-keyboard composer padding (34 on notched iPhones, so the open/closed delta is 26) | Code |
| C15 | Near tail | FlashList `useBoundDetection.ts:126-131`: `offset + visible >= content − 0.2 × visible` | Whether appended content is followed. The band is **relative to the visible height**, which shrinks while the keyboard is up. | Lib |
| C16 | Initial pin (`pinRef`) | `hooks/useInitialScrollToEnd.ts` | Non-animated `scrollToEnd` on every content-size change until the first drag, then off for the life of the mount | Code |
| C17 | `showJumpToLatest` | `LiveConversationView.tsx:407-411` (> 100 px from end) | FAB visible. The FAB is `position: absolute; bottom: spacing.md` in the padded root (`:478-489`, `:574-589`). | Code |
| C18 | `activeQuestion` / `showThinkingFooter` | `LiveConversationView.tsx:286`, `:460-477` | The question card renders as the **list footer**, so its buttons are subject to H5 | Code |
| C19 | Platform | — | See the table below | Lib + OS |

### Platform differences

| Aspect | iOS | Android |
|---|---|---|
| RN `Keyboard` events available | `Will/Did` + `Show/Hide/ChangeFrame` | `keyboardDidShow`, `keyboardDidHide` only |
| Window resized by the IME | No | No (`edgeToEdgeEnabled` + keyboard-controller). The lift padding is the only avoidance. |
| Keyboard with an RN `Modal` over a focused input | Keyboard stays; the presenting view keeps first responder (OS) | The Modal is a separate `Dialog` window. keyboard-controller tracks it (`modal/ModalAttachedWatcher.kt`), but IME and focus behavior need a device check. |
| Focused input unmounted | Keyboard closes | IME may stay up; focus can jump to the next focusable input (#964's repro) |
| Back gesture / button with the keyboard open | Header back navigates (guard may show a dialog) | Hardware back closes the IME first (OS) |
