# 05 — Fix `05_chat_flow`'s `hideKeyboard` step

**Repo:** tb-mobile · **Base:** `main` (independent of the ADR work)
**Owns:** `e2e/05_chat_flow.yaml` · shares the simulator with 06 — run them as one stream

The full brief lives at [`05-chat-flow-hidekeyboard-brief.md`](./05-chat-flow-hidekeyboard-brief.md), alongside this file. Read it rather than this file.

Three things it records that you would otherwise spend an hour rediscovering:

- `hideKeyboard` is a platform-wide **Maestro 2.6.1 / iOS 26.x** break, not a bug in this flow. `07_conversation_scroll_gaps.yaml`'s header documents it independently.
- The composer input is **`multiline`**, so the `pressKey: Enter` fix applied to `e2e/setup.yaml` must **not** be copied — Enter inserts a newline, and the very next assertion checks the message text.
- The flow currently fails *earlier*, at `first-session-card is visible`, before it ever reaches the keyboard step. That is a separate pre-existing failure (see 06).

Pair this with 06: both are e2e-only, both need the simulator, and they share the same build.
