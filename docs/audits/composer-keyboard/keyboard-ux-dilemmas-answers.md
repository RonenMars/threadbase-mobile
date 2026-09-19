# Keyboard UX Dilemmas

**Basis:** code-only keyboard audit of the live-session screen at `main @ d78f7a5f` on 2026-09-19, plus the seven decisions in `dilemmas.md`.

**Scope note:** the current-state details below are source-verified. iOS and Android focus behavior around native modals, input unmounting, and system pickers should still be confirmed on physical devices.

## Design policy

> The keyboard follows the user's composing intent. Layout reacts to the keyboard. Incoming application state does not control the keyboard.

This policy makes the seven decisions coherent: sending does not end composing; asynchronous content does not change focus; composer-owned subflows can restore prior composer focus; and scroll position remains a user/list-state concern rather than a side effect of keyboard events.

## D1 — Keyboard after send → Keep it open

**Recommendation:** choose **(b) Keep open**.

Sending is normally an action *within* composing, not evidence that the composing task has finished. Preserving focus supports the fast chat loop:

`type → send → continue typing`

### Relevant current state

- `ChatComposer.handleSend` calls `Keyboard.dismiss()` before sending from both the inline and expanded composer.
- While an answer is active, the current `sendDisabled` state disables only Send; the input remains editable. The product already allows the user to prepare the next message, so dismissing the keyboard works against that behavior.

### Practical behavior notes

- Preserve the state present at the moment of Send; do **not** blindly call `focus()` after every send.
- If the inline composer had focus, keep it focused.
- If the message is sent from the expanded editor, close that editor and transfer focus to the inline composer.
- If a hardware keyboard is in use and the software keyboard was not visible, do not programmatically summon the software keyboard.

This is focus preservation, not forced focus. It aligns with the general platform expectation that focus changes stay predictable and purposeful. See [Apple’s focus and selection guidance](https://developer.apple.com/design/human-interface-guidelines/focus-and-selection/).

## D2 — Restore composer focus after an overlay closes → Only for composer-owned overlays

**Recommendation:** make restoration conditional on the overlay’s interaction ownership, rather than applying one global rule.

### Relevant current state

- `wasFocusedRef` only tracks the inline input.
- On `AppState → active`, the inline input can be refocused when that ref is true, without considering the active screen or expanded-editor state.
- The expanded editor does not participate in the same focus tracking, so focus can be lost or restored inconsistently during surface swaps, modal dismissal, or return from system UI.

### Practical behavior notes

Track a richer `focusBeforeOverlay` value—`inlineComposer`, `expandedComposer`, or `none`—and give each overlay an explicit `restorePreviousFocus` rule.

| Overlay closes | Restore composer focus? | Why |
|---|---:|---|
| Expanded editor via Minimize | Yes | The user is continuing the same message. |
| Slash-command arguments | Yes | It is a composer sub-flow. |
| Attachment picker | Yes, if the composer was focused when opened | It is a composer sub-flow. |
| Cancelled leave-session dialog | Restore prior state | It was a temporary interruption. |
| Rename session | No | It is a separate task. |
| Model/effort sheet | No by default | It is configuration, not composition. |
| Review/search sheet | No | It is a separate task. |
| Any overlay opened while the composer was unfocused | No | Never invent focus. |

This makes focus intentional rather than an emergent result of mounting, `autoFocus`, `AppState`, and OS behavior. It also follows the platform principle that returning from a sheet returns a person to the parent context, without treating every dismissal as a reason to start editing again. See [Apple’s focus and selection guidance](https://developer.apple.com/design/human-interface-guidelines/focus-and-selection/).

## D3 — Raw-keys panel and keyboard together → Stack them as a keyboard accessory

**Recommendation:** choose **(b) Stacked**, but rework the implementation into a compact input accessory rather than preserving the current layout.

For a terminal-oriented interface, normal text input and special/raw keys are complementary. Making them mutually exclusive creates needless mode switching:

`type text → need Esc/Ctrl/arrow → hide keyboard → press raw key → reopen keyboard`

### Relevant current state

- When `rawKeyboardVisible` is true, `RemoteKeyboardControls` is added below the entire live body.
- That means the live surface no longer reaches the bottom of the screen, violating the precondition assumed by `useKeyboardInset`.
- The raw-key panel has no bottom safe-area handling.

### Practical behavior notes

Use one bottom-layout system:

```text
Conversation
────────────
Composer
────────────
Esc  Ctrl  Tab  ↑  ↓  …   ← compact accessory
────────────
OS keyboard
```

- The composer and raw-key row should use the same IME inset and animation.
- Do not place the raw-key panel as a competing bottom surface outside the lifted live content.
- Keep the row compact and action-oriented; it is an accessory to typing, not a second keyboard mode.

Android’s edge-to-edge guidance treats the IME as a window inset that interactive UI should respect. See [Android’s window-insets guidance](https://developer.android.com/develop/ui/compose/system/insets-ui) and the [react-native-keyboard-controller documentation](https://kirillzyusko.github.io/react-native-keyboard-controller/).

## D4 — Keyboard while dictating → Dismiss on dictation start

**Recommendation:** choose **(a) Dismiss on dictation start**.

### Relevant current state

- While `voice.listening` is true, interim voice transcription directly overwrites `inputText`.
- The existing flow does not dismiss the keyboard.

Leaving an editable keyboard visible signals that the user can type concurrently, but the live transcript can overwrite that edit:

`user types → interim speech result arrives → user’s edit is overwritten`

That is a misleading and destructive interaction, not merely a layout concern.

### Practical behavior notes

Use this flow:

`Typing → tap microphone → dismiss keyboard → listening/live transcription → stop → transcript remains in composer`

- Do not automatically reopen the keyboard after dictation stops; that is an unsolicited focus and layout change.
- Let the user tap the composer to edit the completed transcript.
- Revisit this decision only if voice input becomes selection-aware and inserts text without continuously replacing the field’s value.

Supporting multiple input methods does not require presenting two competing editors for the same value. See [React Native TextInput](https://reactnative.dev/docs/textinput) for the underlying input model.

## D5 — Transcript lift when the keyboard opens → `whenAtEnd`

**Recommendation:** choose **(a) `whenAtEnd`**.

### Relevant current state

- `LiveConversationView` unconditionally calls `scrollToEnd({ animated: true })` on `keyboardDidShow` and `keyboardDidChangeFrame`.
- On iOS, `keyboardDidChangeFrame` can occur for hiding, QuickType changes, emoji switching, rotation, and other frame changes.
- FlashList already uses `maintainVisibleContentPosition` with an `autoscrollToBottomThreshold` for appended content.

The current keyboard event listener can destroy a user’s reading position merely because the keyboard changed size. Keyboard geometry should change layout; it should not decide scroll position.

### Practical behavior notes

Before the viewport starts changing, capture whether the user was following the newest content:

```text
if wasFollowingTail:
    keep the bottom anchor during the IME animation
else:
    keep the visible message and its offset stable
```

- When the keyboard hides, reverse the IME inset normally; do not retain a persistent transcript displacement.
- Remove the direct `keyboardDidShow` / `keyboardDidChangeFrame → scrollToEnd()` relationship.
- A person who has scrolled up keeps reading where they are; someone already at the end remains pinned to the active conversation.

React Native documents `maintainVisibleContentPosition` specifically for chat-style lists, preserving visible content while allowing autoscroll only near the relevant edge. See [React Native ScrollView](https://reactnative.dev/docs/scrollview#maintainvisiblecontentposition).

## D6 — Question card arrives while typing → Keep the keyboard

**Recommendation:** choose **(a) Keep the keyboard**.

An incoming question is asynchronous application state. It must not cancel a composition already in progress.

### Relevant current state

- `activeQuestion` renders as the `FlashList` footer.
- The chat list does not set `keyboardShouldPersistTaps`; the React Native default is `"never"`.
- With that default, the first tap on a question button while the keyboard is open can be consumed to dismiss the keyboard instead of activating the button.

### Practical behavior notes

- Leave the composer and keyboard untouched when a question arrives.
- Set `keyboardShouldPersistTaps="handled"` on the transcript list, so a question action works on the first tap without automatically dismissing the keyboard.
- Prefer `"handled"` over `"always"`: handled controls work immediately, while ordinary noninteractive transcript space can still follow the chosen dismissal behavior.
- On iOS, consider `keyboardDismissMode="interactive"` for a user-initiated transcript drag. Android should use the closest supported behavior, noting that React Native does not support interactive dismissal there.
- If the user is reading older content, do not jump them to a newly arrived question. Show a small nonmodal “Question waiting” or “Jump to latest” affordance instead.

React Native defines the tap semantics and platform limits for these props in its [ScrollView documentation](https://reactnative.dev/docs/scrollview#keyboardshouldpersisttaps).

## D7 — `PromptQueueSheet` → Delete it for now

**Recommendation:** choose **(a) Delete**.

### Relevant current state

- `PromptQueueSheet` contains an input.
- The audit found no call to `setQueueVisible(true)`, making the sheet unreachable.

### Practical behavior notes

- Remove the unreachable sheet rather than adding an entry point simply to justify its presence.
- This reduces the number of focus, keyboard, and modal states the live session needs to support and test.
- If prompt-queue management becomes a real user requirement, reintroduce it with a deliberate entry point, ownership rule, and focus-restoration policy.

An inaccessible future feature has no current UX value; it only increases behavioral surface area.

## Cross-cutting implementation notes

The audit found four independently reacting keyboard systems: keyboard-controller animation values, keyboard-controller JS visibility, React Native `Keyboard` events, and a React Native `KeyboardAvoidingView` inside the expanded-editor modal. They run on different event streams and can drift apart.

Reduce the contract to three explicit owners:

| Concern | Owner |
|---|---|
| IME geometry and animation | `react-native-keyboard-controller` shared inset/animation |
| Input focus | Composer/overlay focus state machine |
| Transcript position | List follow-tail and visible-anchor state |

One further source-verified issue should be addressed alongside these decisions: the composer’s bottom padding changes discretely from the closed safe-area value to `8` at `keyboardWillShow`, while surface lift animates frame-by-frame. On a notched iPhone, the audit estimates a 26-point jump (`34 → 8`). Make the safe-area transition part of the same keyboard animation as the composer, raw-key accessory, and transcript viewport.

## Final keyboard contract

> Sending does not end composing. Asynchronous content never dismisses or focuses the composer. Composer-owned subflows restore previous composer focus; independent overlays do not. Keyboard geometry changes layout but never decides scroll position. Transcript position is preserved unless the user was already following the latest content. Voice dictation temporarily owns text input. Raw terminal controls coexist with the keyboard as an accessory rather than a competing bottom surface.

## Sources

- [Apple Human Interface Guidelines — Focus and selection](https://developer.apple.com/design/human-interface-guidelines/focus-and-selection/)
- [Android Developers — Set up window insets](https://developer.android.com/develop/ui/compose/system/insets-ui)
- [React Native — ScrollView](https://reactnative.dev/docs/scrollview)
- [React Native — Keyboard](https://reactnative.dev/docs/keyboard)
- [React Native Keyboard Controller](https://kirillzyusko.github.io/react-native-keyboard-controller/)
