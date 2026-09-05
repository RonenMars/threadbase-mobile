# 03 — The E2E suite cannot gate anything at 11/15

> **Overtaken 2026-09-05.** The four-flow table below is a 2026-08 iOS measurement and no longer describes the suite.
> Android CI run [33933929192](https://github.com/RonenMars/threadbase-mobile/actions/runs/33933929192) on `main` `8146d2f5` ran **16 flows and failed 1**: `session_lifecycle`, `05_chat_flow` and `06_search_anchor` all passed.
> The one failure is `feedback_flow`, and not at the assertion named below — #772 fixed `settings-help-feedback-row` on 2026-08-20.
> It now dies 30 lines later at `e2e/feedback_flow.yaml`'s `tapOn: "Help us squash a bug"`, because the Android IME scrolls that heading off the top of the `KeyboardAwareScrollView`.
> Re-measure before acting on any count here.

**Priority: high.** Depends on task 04 — you need a trustworthy build before you can trust a pass set.

## State of play

Four flows fail for known reasons unrelated to any current change:

| flow | fails at |
|---|---|
| `session_lifecycle` | `hub-screen is visible` |
| `feedback_flow` | `settings-help-feedback-row is visible` |
| `05_chat_flow` | `first-session-card is visible` |
| `06_search_anchor` | `conversation-row-conv-search-anchor is visible` |

Each was confirmed pre-existing: reproduces in isolation *and* fails identically against a Release build of the branch base with the feature code absent.

Red is therefore the expected state of the suite. Nobody can distinguish new breakage from the familiar four — which is exactly how the job sat broken at the **build step** for three months without anyone reading the result. Even a successful build would have produced a red suite.

`05_chat_flow` is a special case: it still calls `hideKeyboard` deliberately. Its composer input is `multiline`, so the `pressKey: Enter` fix applied to `setup.yaml` would insert a newline instead of dismissing the keyboard, and the next assertion checks the message text. See `../mobile/05-chat-flow-hidekeyboard.md` — that work is owned there, not here.

## Two acceptable outcomes

- **Fix them.** `../mobile/06-mock-suite-remaining-failures.md` already owns three of the four. If that lands first, this task shrinks to confirming the suite is green and removing any quarantine.
- **Quarantine them explicitly.** A `test:e2e:mock:known-good` script, or Maestro tags, so a red run means *new* red. The quarantined set must be named in one place with a reason per flow, or it becomes a graveyard.

Either is fine. What is not fine is leaving the suite at "expected 11/15", because that number is not a signal.

The `flows` input added in #574 lets a run dodge the four, but that is a per-invocation workaround, not a fix to the default.

## Done when

- A passing run is the normal outcome of the default suite invocation.
- Any red run means something changed.
- If quarantining: each excluded flow has a written reason and a pointer to whoever owns fixing it.
