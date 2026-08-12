# Follow-up prompt — fix `05_chat_flow`'s `hideKeyboard` step

Hand this to a Claude Code session in `tb-mobile`. It is a small, self-contained fix that was deliberately left out of the `fix(e2e): repair cold-start onboarding in the setup flow` PR because the safe answer there is not the safe answer here.

---

## The task

`e2e/05_chat_flow.yaml` fails on `hideKeyboard`. Fix it so the flow passes, without changing what the test actually asserts.

## What is already known — do not re-derive this

**`hideKeyboard` is broken on this platform, not in this flow.** Maestro 2.6.1 cannot dismiss the iOS 26.x keyboard; the command fails outright with `CommandFailed: Couldn't hide the keyboard`. This is not specific to the chat composer — it broke every flow that ran `e2e/setup.yaml` and took the mock suite down to 1/15. `e2e/07_conversation_scroll_gaps.yaml`'s header comment documents the same finding independently and works around it by inlining its own pairing.

**`setup.yaml` was already fixed by replacing `hideKeyboard` with `pressKey: Enter`,** which took the suite to 11/15. **Do not blindly copy that fix here.** The onboarding URL and token fields are single-line; the chat composer is not.

**The chat composer input is `multiline`** (`components/conversation/ChatComposer.tsx`, `testID="chat-message-input"`). On a multiline `TextInput`, Enter inserts a newline rather than dismissing the keyboard. Applying the `setup.yaml` fix verbatim would most likely leave the keyboard up *and* append a newline to the message body — and the very next assertion is that the text `"hello from chat-flow e2e"` appears as an optimistic bubble. A trailing newline could make that assertion pass or fail for reasons unrelated to the behaviour under test, which is worse than the current honest failure.

## The failing step

`e2e/05_chat_flow.yaml`, in the "Fix 5: Send a message" block:

```yaml
- tapOn:
    id: "chat-message-input"
- inputText: "hello from chat-flow e2e"

- hideKeyboard          # <-- fails here
- waitForAnimationToEnd

- tapOn:
    id: "chat-send-button"
```

The only reason the keyboard is dismissed at all is so the following `tapOn: chat-send-button` lands on the button rather than on the keyboard. **First check whether the dismissal is needed at all** — `chat-send-button` may already sit above the keyboard, in which case deleting the two lines is the whole fix. Verify by running, not by reading the layout.

If it *is* needed, options worth trying, cheapest first:
- Drop `hideKeyboard` entirely and tap the send button directly.
- Tap a static, non-interactive element to blur (Maestro's own error message suggests this). Note that plain RN `Text` does not always blur a focused `TextInput`, so confirm empirically.
- Scroll the send button into view before tapping.

Avoid a raw coordinate tap unless nothing else works — it silently rots when the layout moves.

## How to run it

The suite installs a **Release** build and `e2e/ensure-release-build.js` will happily reuse a stale one, so confirm you are testing current code before trusting a pass:

```bash
# one flow, with the mock server up
MOCK_PORTS=7071,7072 node e2e/mock-server.js &
node e2e/run-maestro.js test e2e/05_chat_flow.yaml
```

If the app needs rebuilding: `npx expo run:ios --configuration Release --device <sim-udid>`.

**Verify the binary contains your code before believing a result.** A previous run of this suite silently tested a week-old build:

```bash
C=$(xcrun simctl get_app_container <sim-udid> com.ronenmars.threadbase)
grep -ac "some-string-you-just-added" "$C/main.jsbundle"
```

## Scope

`e2e/05_chat_flow.yaml` only. Do not touch app code — this is a test-harness defect, not a product bug.

Four other flows (`session_lifecycle`, `feedback_flow`, `05_chat_flow`'s later assertions, `06_search_anchor`) fail for reasons **unrelated** to the keyboard. Each was confirmed pre-existing by running it against a build of the branch base with the feature code absent. `05_chat_flow` currently fails at `first-session-card is visible`, which is *before* the `hideKeyboard` step — so expect to hit that first, and treat it as a separate, out-of-scope problem unless fixing it is trivial.

## Commit

`fix(e2e): dismiss the composer keyboard without hideKeyboard` — one sentence per line in the body, no AI attribution (see `CLAUDE.md`).
